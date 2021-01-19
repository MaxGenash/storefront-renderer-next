/* eslint-disable no-process-exit,global-require,import/no-dynamic-require,no-param-reassign,no-underscore-dangle,no-plusplus */
const vm = require('vm');
const path = require('path');
const fs = require('fs');
const { NEXT_SERVER_FILE_PATH } = require('./constants');
const { PARSING_TIMEOUT } = require('./constants');

function buildMocks(extraMocks) {
    // TODO: mock everything that can lead to stealing / modifying data of other themes
    return {
        process: {
            ...process,
            // cwd: () => activeThemeDir,
            chdir: () => {
                throw new Error('chdir is restricted');
            },
        },
        path: {
            ...path,
            // resolve: (...paths) => {
            //     // const result = path.join(activeThemeDir, ...paths);
            //     // console.log('activeThemeDir =');
            //     // console.log('called path.resolve with', paths, '. Result =', result);
            //     return result;
            // },
        },
        ...extraMocks,
    };
}

async function getNextServerScript() {
    try {
        const src = await fs.promises.readFile(NEXT_SERVER_FILE_PATH, 'utf8');
        // const scopedSrc = "'use strict';\nrendererApi => {\n" + src + '\n};';

        return new vm.Script(src, { timeout: PARSING_TIMEOUT });
    } catch (e) {
        console.dir(e);
        process.exit(1);
    }
}

async function buildScriptContext(modules, globals) {
    // const activeThemeDir = getActiveThemeDir(storeId);

    // TODO: add Object.freeze to the provided context fields to avoid hacking

    const context = {
        // ...global,
        console,
        // __dirname: activeThemeDir,
        // __filename: path.join(activeThemeDir, './nextServer.js'),
        module: {},
        process: modules.process,
        ...globals,
    };
    // context.module.require = context.require;

    context.global = context;
    return vm.createContext(context);
}

module.exports = {
    buildMocks,
    getNextServerScript,
    buildScriptContext,
};
