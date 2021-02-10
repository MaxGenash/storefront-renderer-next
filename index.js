/* eslint-disable no-process-exit,global-require,import/no-dynamic-require,no-param-reassign,no-underscore-dangle,no-plusplus */
// const { v4: generateId } = require('uuid');
const http = require('http');
const { Semaphore } = require('await-semaphore');
const NextServerUtils = require('./src/nextServerUtils');
const VmUtils = require('./src/vmUtils');
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
    // TODO: we no longer need semaphore after we stop overriding FS and require since vm2 implements own require and FS
    const semaphore = new Semaphore(1);
    let reqIdsCounter = 0;
    let originalFs;
    let originalRequire;
    const httpServer = new http.Server(async (req, res) => {
        const releaseLock = await semaphore.acquire();

        const reqId = ++reqIdsCounter;
        let fsUtils;
        let vmUtils;
        console.log(`\n[${reqId}] req.url = `, req.url);
        console.time(`[${reqId}]`);

        try {
            const storeId = NextServerUtils.getStoreId(req);
            console.log(`storeId: "${storeId}"`);

            fsUtils = new FsUtils(reqId, storeId, originalFs, originalRequire, true);
            // TODO: we no longer need to override FS and require since vm2 implements own require and FS
            fsUtils.overrideFs();

            const nextServerUtils = new NextServerUtils(fsUtils);
            vmUtils = new VmUtils(fsUtils);

            // Build mocks and override modules
            const mocks = vmUtils.buildMocks();
            fsUtils.overrideRequires(mocks);
            originalRequire = fsUtils.originalRequire;

            await fsUtils.prepareReqDir();

            const nextServer = await new CustomNextServer({
                reqId,
                vmUtils,
                nextServerUtils,
                fsUtils,
            });
            await nextServer.run(req, res);
        } catch (e) {
            console.error(e.message);
            res.statusCode = 500;
            // res.setHeader('Retry-After', 1);
            res.end();
        }

        if (fsUtils) {
            await fsUtils.clearReqDir();
        }
        if (vmUtils) {
            await vmUtils.clear();
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

process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection: ', err);
});
