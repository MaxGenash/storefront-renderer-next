/* eslint-disable no-process-exit,global-require,import/no-dynamic-require,no-param-reassign,no-underscore-dangle,no-plusplus */
// const { v4: generateId } = require('uuid');
const http = require('http');
// const { NEXT_SERVER_FILE_PATH } = require("./src/constants");
const { EXECUTION_TIMEOUT } = require('./src/constants');
const { getStoreId, getNextConfig } = require('./src/nextServerUtils');
const { buildMocks, getNextServerScript, buildScriptContext } = require('./src/vmUtils');
const { getActiveThemeDir, overrideFs, overrideRequires } = require('./src/FsUtils');

console.log('running index. process.cwd() =', process.cwd());
// console.log('  __dirname =', __dirname);
// console.log('  __filename =', __filename);
// console.log('  module.children =', module.children);
// console.log('  module.filename =', module.filename);
// console.log('  module.id =', module.id);
// console.log('  module.path =', module.path);

async function run() {
    const nextServerScript = await getNextServerScript();

    const overriddenFs = overrideFs();
    const overriddenModules = buildMocks({
        fs: overriddenFs,
    });
    overrideRequires(overriddenModules);
    const overriddenGlobals = {
        require,
    };

    let reqIdsCounter = 0;
    const httpServer = new http.Server(async (req, res) => {
        const reqId = ++reqIdsCounter;
        console.log(`\n[${reqId}] req.url = `, req.url);

        try {
            const storeId = getStoreId(req);
            console.log(`storeId: "${storeId}"`);

            const context = await buildScriptContext(overriddenModules, overriddenGlobals);
            const isolatedNextServer = nextServerScript.runInNewContext(context, {
                timeout: EXECUTION_TIMEOUT,
                filename: 'nextServer.js',
            });
            // const isolatedNextServer = require(NEXT_SERVER_FILE_PATH);
            const activeDir = getActiveThemeDir(storeId);
            const nextConfig = await getNextConfig(activeDir);
            await isolatedNextServer({ activeDir, reqId, nextConfig })(req, res);

            // TODO: remove the theme files after the request is handled to avoid running out of memory
        } catch (e) {
            console.dir(e);
        }
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
