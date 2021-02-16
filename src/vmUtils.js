/* eslint-disable no-process-exit,global-require,import/no-dynamic-require,no-param-reassign,no-underscore-dangle,no-plusplus,prefer-object-spread */
const jsEvents = require('jsEvents');
const path = require('path');
const fs = require('fs');
const { NodeVM, VMScript } = require('vm2');
const { EXECUTION_TIMEOUT } = require('./constants');

let sumEvalTime = 0;
let evalCounter = 0;
let minEvalTime = 10000000;
let maxEvalTime = 0;

class VmUtils {
    constructor(fsUtils) {
        this.fsUtils = fsUtils;
        this.overriddenModules = {};
    }

    buildMocks() {
        // TODO: mock everything that can lead to stealing / modifying data of other themes
        const activeThemeDir = this.fsUtils.getActiveThemeDir();
        this.overriddenModules = {
            // Override events to fix https://github.com/patriksimek/vm2/issues/216#issuecomment-528866482
            events: jsEvents,
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

        // return new vm.Script(src, { timeout: PARSING_TIMEOUT });
        return new VMScript(src, { filename: filePath });
    }

    async buildScriptContext() {
        const context = {
            Buffer,
            URL,
            URLSearchParams,
            TextDecoder,
            TextEncoder,
            console,
            queueMicrotask,
            // TODO: need to limit timers
            setTimeout,
            setImmediate,
            setInterval,
            clearTimeout,
            clearImmediate,
            clearInterval,
            __dirname: this.fsUtils.getActiveThemeDir(),
            module: {},
            process: this.overriddenModules.process,
            require: this.fsUtils.overridenRequire,
        };
        context.module.require = context.require;

        return Object.freeze(context);
    }

    async runInIsolatedVm(filePath) {
        ++evalCounter;
        const evalStart = Date.now();

        // const result = this.fsUtils.originalRequire(filePath);

        // const isolatedScript = await this.getVmScript(fullFilePath);
        // const result = isolatedScript.runInNewContext(overriddenGlobals, {
        //     timeout: EXECUTION_TIMEOUT,
        //     filename: filePath,
        // });
        //
        const overriddenGlobals = await this.buildScriptContext();

        const vm = new NodeVM({
            timeout: EXECUTION_TIMEOUT,
            console: 'inherit',
            sandbox: overriddenGlobals,
            require: {
                // external: true,
                // builtin: ['stream', 'http', 'https', 'url', 'zlib', 'crypto'],
                builtin: ['*'],
                root: this.fsUtils.getActiveThemeDir(),
                mock: this.overriddenModules,
                // context: 'host',
                context: 'sandbox',
            },
        });
        const isolatedScript = await this.getVmScript(filePath);
        const result = await vm.run(isolatedScript);

        const evalDuration = Date.now() - evalStart;
        console.log(`vm2.run №${evalCounter}. Duration = ${evalDuration} ms`);
        sumEvalTime += evalDuration;
        minEvalTime = Math.min(evalDuration, minEvalTime);
        maxEvalTime = Math.max(evalDuration, maxEvalTime);
        console.log(
            // eslint-disable-next-line prettier/prettier
            `avgEvalDuration= ${sumEvalTime/evalCounter} ms, minEvalTime = ${minEvalTime} ms, maxEvalTime = ${maxEvalTime} ms`
        );

        return result;
    }
}

module.exports = VmUtils;
