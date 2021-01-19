/* eslint-disable no-process-exit,global-require,import/no-dynamic-require,no-param-reassign,no-underscore-dangle,no-plusplus */
// const { v4: generateId } = require('uuid');
const http = require('http');
const { Semaphore } = require('await-semaphore');
const { NEXT_SERVER_FILE_PATH } = require('./src/constants');
// const { EXECUTION_TIMEOUT } = require('./src/constants');
const { getStoreId, getNextConfig } = require('./src/nextServerUtils');
const { buildMocks, getNextServerScript, buildScriptContext } = require('./src/vmUtils');
const FsUtils = require('./src/FsUtils');

console.log('running index. process.cwd() =', process.cwd());
// console.log('  __dirname =', __dirname);
// console.log('  __filename =', __filename);
// console.log('  module.children =', module.children);
// console.log('  module.filename =', module.filename);
// console.log('  module.id =', module.id);
// console.log('  module.path =', module.path);

async function run() {
    // const nextServerScript = await getNextServerScript();
    // TODO: try avoiding locking the whole request handler
    const semaphore = new Semaphore(1);
    let reqIdsCounter = 0;
    let originalFs;
    let originalRequire;
    const httpServer = new http.Server(async (req, res) => {
        const releaseLock = await semaphore.acquire();

        const reqId = ++reqIdsCounter;
        let fsUtils;
        console.log(`\n[${reqId}] req.url = `, req.url);
        console.time(`[${reqId}]`);

        try {
            const storeId = getStoreId(req);
            console.log(`storeId: "${storeId}"`);

            fsUtils = new FsUtils(reqId, storeId, originalFs, originalRequire);

            const overriddenFs = fsUtils.overrideFs();
            originalFs = fsUtils.originalFs;
            const overriddenModules = buildMocks({
                fs: overriddenFs,
            });
            fsUtils.overrideRequires(overriddenModules);
            originalRequire = fsUtils.originalRequire;
            // const overriddenGlobals = {
            //     require,
            // };
            // const context = await buildScriptContext(overriddenModules, overriddenGlobals);
            // const isolatedNextServer = nextServerScript.runInNewContext(context, {
            //     timeout: EXECUTION_TIMEOUT,
            //     filename: 'nextServer.js',
            // });
            const isolatedNextServer = require(NEXT_SERVER_FILE_PATH);

            const activeDir = fsUtils.getActiveThemeDir();
            originalFs.mkdirSync(activeDir, { recursive: true });
            const nextConfig = await getNextConfig(activeDir);

            await isolatedNextServer({ activeDir, reqId, nextConfig })(req, res);
        } catch (e) {
            console.dir(e);
        }

        if (fsUtils) {
            originalFs.rmdirSync(fsUtils.getActiveThemeDir(), { recursive: true });
        }
        console.timeEnd(`[${reqId}]`);
        releaseLock();
    });

    httpServer.listen(3000, (err) => {
        if (err) throw err;
        console.log('Listening on http://localhost:3000');
    });
}
run();

process.on('uncaughtException', (err) => {
    console.error('Unhandled exception: ', err);
});
