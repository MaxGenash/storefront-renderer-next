/* eslint-disable no-process-exit,global-require,import/no-dynamic-require,no-param-reassign,no-underscore-dangle,no-plusplus,no-unused-expressions */
// const { v4: generateId } = require('uuid');
const http = require('http');
const { Semaphore } = require('await-semaphore');
const NextServerUtils = require('./src/nextServerUtils');
const VmUtils = require('./src/vmUtils');
const FsUtils = require('./src/FsUtils');
const CustomNextServer = require('./src/CustomNextServer');

async function run() {
    // TODO: semaphore is used to avoid other requests influencing handling time
    const semaphore = new Semaphore(1);
    let reqIdsCounter = 0;
    let activeReqNumber = 0;
    const httpServer = new http.Server(async (req, res) => {
        const releaseLock = await semaphore.acquire();

        const reqId = ++reqIdsCounter;
        ++activeReqNumber;
        let fsUtils;
        let vmUtils;
        console.log(`\n[${reqId}] req.url = `, req.url);
        console.time(`[${reqId}]`);

        try {
            const storeId = NextServerUtils.getStoreId(req);
            console.log(`storeId: "${storeId}"`);

            fsUtils = new FsUtils(reqId, storeId, true);
            vmUtils = new VmUtils(fsUtils, 3000); // TODO: pass (3000 + activeReqNumber)

            const nextServer = await new CustomNextServer({
                reqId,
                vmUtils,
                nextServerUtils: new NextServerUtils(fsUtils),
                fsUtils,
            });
            await nextServer.run(req, res);
        } catch (e) {
            console.error(e.message);
            res.statusCode = 500;
            // res.setHeader('Retry-After', 1);
            res.end();
        }

        if (fsUtils) await fsUtils.clear();
        if (vmUtils) await vmUtils.clear();

        console.timeEnd(`[${reqId}]`);
        releaseLock();
        // eslint-disable-next-line no-unused-vars
        --activeReqNumber;
    });

    httpServer.listen(2222, (err) => {
        if (err) throw err;
        console.log('Listening on http://localhost:2222');
    });
}
run();

process.on('uncaughtException', (err) => {
    console.error('Unhandled exception: ', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection: ', err);
});
