/* eslint-disable no-process-exit,global-require,import/no-dynamic-require,no-param-reassign,no-underscore-dangle,no-plusplus */
// const { v4: generateId } = require('uuid');
const http = require('http');
const { Semaphore } = require('await-semaphore');
const NextServerUtils = require('./src/nextServerUtils');
const { buildMocks, getVmScript, buildScriptContext } = require('./src/vmUtils');
const FsUtils = require('./src/FsUtils');
const CustomNextServer = require('./src/CustomNextServer');

console.log('running index. process.cwd() =', process.cwd());
// console.log('  __dirname =', __dirname);
// console.log('  __filename =', __filename);
// console.log('  module.children =', module.children);
// console.log('  module.filename =', module.filename);
// console.log('  module.id =', module.id);
// console.log('  module.path =', module.path);

async function run() {
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
            const storeId = NextServerUtils.getStoreId(req);
            console.log(`storeId: "${storeId}"`);

            fsUtils = new FsUtils(reqId, storeId, originalFs, originalRequire, true);
            const activeDir = fsUtils.getActiveThemeDir();
            const nextServerUtils = new NextServerUtils(fsUtils);

            const overriddenFs = fsUtils.overrideFs();
            originalFs = fsUtils.originalFs;
            const overriddenModules = buildMocks(
                {
                    fs: overriddenFs,
                },
                activeDir,
            );
            fsUtils.overrideRequires(overriddenModules);
            originalRequire = fsUtils.originalRequire;
            const overriddenGlobals = {
                require,
            };
            const context = await buildScriptContext(overriddenModules, overriddenGlobals);
            const vmUtils = {
                getVmScript,
                context,
            };

            await fsUtils.prepareReqDir();

            const nextServer = await new CustomNextServer({
                activeDir,
                reqId,
                vmUtils,
                nextServerUtils,
                fsUtils,
            });
            await nextServer.run(req, res);
        } catch (e) {
            console.err(e.message);
            res.statusCode = 500;
            res.setHeader('Retry-After', 1);
            res.end();
        }

        if (fsUtils) {
            await fsUtils.clearReqDir();
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
