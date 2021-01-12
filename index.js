/* eslint-disable no-process-exit,global-require,import/no-dynamic-require */
const path = require('path');
const http = require('http');
// const { parse } = require('url')
const fs = require('fs');
const vm = require('vm');

const PARSING_TIMEOUT = 1000;
const EXECUTION_TIMEOUT = 5000;

async function getNextServerScript() {
    try {
        const src = await fs.promises.readFile('./src/nextServer.js', 'utf8');
        return new vm.Script(src, { timeout: PARSING_TIMEOUT });
    } catch (e) {
        console.dir(e);
        console.log('Parsing timeout');
        process.exit(1);
    }
}

const addImportChecking = (fn /* , processDir */) => (...args) => {
    // args[0] - file path
    // if (args[0].includes('/')) {
    //   args[0] = path.resolve(processDir, args[0]);
    // }

    let fileSize;
    try {
        fileSize = (fs.statSync(args[0]).size / 1024).toFixed(2);
        // eslint-disable-next-line no-empty
    } catch (_) {}
    console.log(`called ${fn.name} with "${args}". FileSize (${fileSize || 'N/A'} Kb)`);

    return fn(...args);
};

async function buildScriptContext(storeId) {
    const processDir = path.resolve(process.cwd(), `./themes/${storeId}/`);

    // TODO: addObject.freeze to everything to avoid hacking

    const fsMock = {
        ...fs,
        createReadStream: addImportChecking(fs.createReadStream, processDir),
        read: addImportChecking(fs.read, processDir),
        readSync: addImportChecking(fs.readSync, processDir),
        readdir: addImportChecking(fs.readdir, processDir),
        readdirSync: addImportChecking(fs.readdirSync, processDir),
        readFile: addImportChecking(fs.readFile, processDir),
        readFileSync: addImportChecking(fs.readFileSync, processDir),
        readlink: addImportChecking(fs.readlink, processDir),
        readlinkSync: addImportChecking(fs.readlinkSync, processDir),
        readv: addImportChecking(fs.readv, processDir),
        readvSync: addImportChecking(fs.readvSync, processDir),
        promises: {
            ...fs.promises,
            read: addImportChecking(fs.promises.read, processDir),
            readFile: addImportChecking(fs.promises.readFile, processDir),
            readdir: addImportChecking(fs.promises.readdir, processDir),
            readlink: addImportChecking(fs.promises.readlink, processDir),
        },
    };

    const processMock = {
        ...process,
        cwd: () => processDir,
        chdir: () => {
            throw new Error('chdir is restricted');
        },
    };

    const pathMock = {
        ...path,
        resolve: (...paths) => {
            const result = path.join(processDir, ...paths);
            // console.log('processDir =', processDir);
            // console.log('called path.resolve with', paths, '. Result =', result);
            return result;
        },
    };

    const context = {
        ...global,
        module: {},
        console,
        require: (name) => {
            console.log(`called require("${name}")`);
            if (name === 'fs') {
                return fsMock;
            }
            if (name === 'path') {
                return pathMock;
            }
            if (name === 'process') {
                return processMock;
            }
            if (name.includes('.next') || name.includes('public')) {
                return addImportChecking(require);
            }
            return require(name);
        },
        rendererApi: {
            storeId,
        },
        __dirname: processDir,
        process: processMock,
    };

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
            await isolatedNextServer(req, res);
            // const exported = sandbox.module.exports;
            // console.dir({ exported });
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
