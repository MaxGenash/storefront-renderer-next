/* eslint-disable no-process-exit,global-require,import/no-dynamic-require,no-param-reassign,no-underscore-dangle,no-plusplus,prefer-object-spread */
const path = require('path');
const Docker = require('dockerode');
const { EXECUTION_TIMEOUT } = require('./constants');

class VmUtils {
    constructor(fsUtils, containerPort) {
        this.fsUtils = fsUtils;
        this.containerPort = containerPort;
        this.container = null;
    }

    async runInIsolatedVm(filePath) {
        await this.fsUtils.moveToActiveDir(filePath, 'routeHandler.js');
        await this.fsUtils.moveToActiveDir(path.resolve(process.cwd(), './src/containerServer.js'));
        await this.fsUtils.moveToActiveDir(
            path.resolve(process.cwd(), './docker/theme-page-handlers.Dockerfile'),
            'Dockerfile',
        );

        console.time('container creation');

        const docker = new Docker({ version: 'v1.41' });

        const stream = await docker.buildImage(
            {
                context: this.fsUtils.fullActiveThemeDir,
            },
            {
                // dockerfile: path.resolve(process.cwd(), './docker/theme.Dockerfile'),
                t: 'theme-store1',
            },
        );
        await new Promise((resolve, reject) => {
            docker.modem.followProgress(stream, (err, res) => (err ? reject(err) : resolve(res)));
        });

        this.container = await docker.createContainer({
            Image: 'theme-store1',
            AttachStdin: false,
            AttachStdout: true,
            AttachStderr: true,
            OpenStdin: false,
            StdinOnce: false,
            ExposedPorts: {
                [`3000/tcp`]: {},
            },
            HostConfig: {
                PortBindings: {
                    [`3000/tcp`]: [
                        {
                            HostPort: `${this.containerPort}/tcp`,
                        },
                    ],
                },
            },
        });

        this.timeoutTimer = setTimeout(() => this.clear(), EXECUTION_TIMEOUT);

        await this.container.start();

        console.timeEnd('container creation');
    }

    async clear() {
        clearTimeout(this.timeoutTimer);
        if (!this.container) {
            return;
        }
        await this.container.stop();
        await this.container.remove();
    }
}

module.exports = VmUtils;
