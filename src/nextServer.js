/* eslint-disable no-process-exit,global-require,import/no-dynamic-require,no-param-reassign,no-underscore-dangle,no-plusplus */

const createNextServer = require('next');
const process = require('process');

module.exports = (rendererApi) => async (req, res) => {
    const { activeDir, reqId, nextConfig } = rendererApi;

    console.log('running NextServer. process.cwd() =', process.cwd());
    // console.log('  process.cwd() =', process.cwd());
    // console.log('  __dirname =', __dirname);
    // console.log('  __filename =', __filename);
    // console.log('  module.children =', module.children);
    // console.log('  module.filename =', module.filename);
    // console.log('  module.id =', module.id);
    // console.log('  module.path =', module.path);

    const nextServer = createNextServer({
        dev: false,
        dir: activeDir,
        conf: nextConfig,
    });

    await nextServer.getRequestHandler()(req, res);
};
