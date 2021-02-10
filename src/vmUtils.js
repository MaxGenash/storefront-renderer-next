/* eslint-disable no-process-exit,global-require,import/no-dynamic-require,no-param-reassign,no-underscore-dangle,no-plusplus,prefer-object-spread */
const path = require('path');
const fs = require('fs');
const ivm = require('isolated-vm');
const { EXECUTION_TIMEOUT } = require('./constants');

class VmUtils {
    constructor(fsUtils) {
        this.fsUtils = fsUtils;
        this.overriddenModules = {};
        this.isolate = new ivm.Isolate({
            memoryLimit: 512,
        });
    }

    buildMocks() {
        // TODO: mock everything that can lead to stealing / modifying data of other themes
        const activeThemeDir = this.fsUtils.getActiveThemeDir();
        this.overriddenModules = {
            // Override events to fix https://github.com/patriksimek/vm2/issues/216#issuecomment-528866482
            process: {
                ...process,
                cwd: () => activeThemeDir,
                chdir: () => {
                    throw new Error('chdir is restricted');
                },
            },
            path: {
                ...path,
                resolve: (...paths) => {
                    const result = path.join(activeThemeDir, ...paths);
                    // console.log('activeThemeDir =');
                    // console.log('called path.resolve with', paths, '. Result =', result);
                    return result;
                },
            },
            fs: this.fsUtils.overridenFs,
        };

        return this.overriddenModules;
    }

    async getVmScript(filePath) {
        const src = await fs.promises.readFile(filePath, 'utf8');

        return this.isolate.compileModule(src, { filename: 'file:///' + filePath });
    }

    async buildScriptContext() {
        const context = {
            // Buffer,
            // URL,
            // URLSearchParams,
            // TextDecoder,
            // TextEncoder,
            console,
            // queueMicrotask,
            // TODO: need to limit timers
            // setTimeout,
            // setImmediate,
            // setInterval,
            // clearTimeout,
            // clearImmediate,
            // clearInterval,
            __dirname: this.fsUtils.getActiveThemeDir(),
            module: {},
            process: this.overriddenModules.process,
            require: this.fsUtils.overridenRequire,
        };
        context.module.require = context.require;

        return Object.freeze(context);
    }

    async runInIsolatedVm(filePath) {
        // return require(filePath);

        // const isolatedScript = await this.getVmScript(fullFilePath);
        // return isolatedScript.runInNewContext(overriddenGlobals, {
        //     timeout: EXECUTION_TIMEOUT,
        //     filename: filePath,
        // });

        const overriddenGlobals = await this.buildScriptContext();

        const context = await this.isolate.createContext();
        const jail = context.global;

        for (const [key, value] of Object.entries(overriddenGlobals)) {
            jail.setSync(key, value, { reference: true });
        }

        jail.setSync('global', jail.derefInto());

        const isolatedModule = await this.getVmScript(filePath);
        await isolatedModule.instantiate(context, (specifier, referrer) => {
            console.log(`called resolveCallback with ("${specifier}", "${referrer}")`);
            return require(specifier);
        });

        const res = await isolatedModule.evaluate({
            timeout: EXECUTION_TIMEOUT,
        });
        const reference = isolatedModule.namespace;
        return reference;
    }

    clear() {
        return this.isolate.dispose();
    }
}

module.exports = VmUtils;
