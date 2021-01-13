/* eslint-disable no-process-exit,global-require,import/no-dynamic-require,no-param-reassign,no-underscore-dangle */
const path = require('path');
const http = require('http');
const { createRequire } = require('module');
// const { parse } = require('url')
const fs = require('fs');
const vm = require('vm');

const PARSING_TIMEOUT = 1000;
const EXECUTION_TIMEOUT = 5000;
const NEXT_SERVER_FILE_PATH = require.resolve('./src/nextServer.js');

console.log('running index:');
console.log('  process.cwd() =', process.cwd());
console.log('  __dirname =', __dirname);
console.log('  __filename =', __filename);
console.log('  module.children =', module.children);
console.log('  module.filename =', module.filename);
console.log('  module.id =', module.id);
console.log('  module.path =', module.path);

async function getNextServerScript() {
    try {
        const src = await fs.promises.readFile(NEXT_SERVER_FILE_PATH, 'utf8');
        // const scopedSrc = "'use strict';\nrendererApi => {\n" + src + '\n};';

        return new vm.Script(src, { timeout: PARSING_TIMEOUT });
    } catch (e) {
        console.dir(e);
        console.log('Parsing timeout');
        process.exit(1);
    }
}

const withImportChecking = (fn, activeThemeDir) => (...args) => {
    // args[0] - file path

    // Here we can download the required files from Cloud Storage

    // We need to resolve directories because the running next.js server
    // doesn't know which themeId its handling and correspondingly where the theme files are located
    if (activeThemeDir && args[0].includes('/')) {
        args[0] = path.resolve(activeThemeDir, args[0]);
    }

    let fileSize;
    try {
        fileSize = (fs.statSync(args[0]).size / 1024).toFixed(2);
        // eslint-disable-next-line no-empty
    } catch (_) {}
    console.log(`called ${fn.name} with "${args}". FileSize (${fileSize || 'N/A'} Kb)`);

    return fn(...args);
};

async function buildScriptContext(storeId) {
    const activeThemeDir = path.resolve(process.cwd(), `./themes/${storeId}/`);

    // TODO: add Object.freeze to the provided context fields to avoid hacking

    const mocks = {
        fs: {
            ...fs,
            createReadStream: withImportChecking(fs.createReadStream, activeThemeDir),
            read: withImportChecking(fs.read, activeThemeDir),
            readSync: withImportChecking(fs.readSync, activeThemeDir),
            readdir: withImportChecking(fs.readdir, activeThemeDir),
            readdirSync: withImportChecking(fs.readdirSync, activeThemeDir),
            readFile: withImportChecking(fs.readFile, activeThemeDir),
            readFileSync: withImportChecking(fs.readFileSync, activeThemeDir),
            readlink: withImportChecking(fs.readlink, activeThemeDir),
            readlinkSync: withImportChecking(fs.readlinkSync, activeThemeDir),
            readv: withImportChecking(fs.readv, activeThemeDir),
            readvSync: withImportChecking(fs.readvSync, activeThemeDir),
            promises: {
                ...fs.promises,
                read: withImportChecking(fs.promises.read, activeThemeDir),
                readFile: withImportChecking(fs.promises.readFile, activeThemeDir),
                readdir: withImportChecking(fs.promises.readdir, activeThemeDir),
                readlink: withImportChecking(fs.promises.readlink, activeThemeDir),
            },
        },
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
                // console.log('activeThemeDir =', activeThemeDir);
                // console.log('called path.resolve with', paths, '. Result =', result);
                return result;
            },
        },
    };

    const newRequire = createRequire(NEXT_SERVER_FILE_PATH);
    const context = {
        ...global,
        console,
        module: newRequire('module'),
        require: (name) => {
            console.log(`called require("${name}")`);
            if (mocks[name]) {
                return mocks[name];
            }
            if (name.includes('.next') || name.includes('public')) {
                return withImportChecking(newRequire);
            }
            return newRequire(name);
        },
        rendererApi: {
            storeId,
        },
        __dirname: activeThemeDir,
        __filename: path.join(activeThemeDir, './nextServer.js'),
        process: mocks.process,
    };
    context.module.require = context.require;

    context.global = context;
    return vm.createContext(context);
}

async function run() {
    const nextServerScript = await getNextServerScript();

    const httpServer = new http.Server(async (req, res) => {
        console.log('\nreq.url = ', req.url);

        try {
            const storeId = req.headers['x-bc-storeid'];
            console.log(`storeId: "${storeId}"`);
            const sandbox = await buildScriptContext(storeId);
            const isolatedNextServer = nextServerScript.runInNewContext(sandbox, {
                timeout: EXECUTION_TIMEOUT,
                filename: 'nextServer.js',
            });
            await isolatedNextServer(/* (sandbox.rendererApi) */ req, res);
            // const exported = sandbox.module.exports;
            // console.dir({ exported });

            // TODO: remove the theme files after the request is handled to avoid running out of memory
        } catch (e) {
            console.dir(e);
            console.log('Execution timeout');
            process.exit(1);
        }
    });

    httpServer.listen(3000, (err) => {
        if (err) throw err;
        console.log('Listening on http://localhost:3000');
    });
}
run();

process.on('uncaughtException', (err) => {
    console.log('Unhandled exception: ' + err);
});
