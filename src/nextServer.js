/* eslint-disable no-underscore-dangle */
const createNextServer = require('next');
const process = require('process');
const path = require('path');
const fs = require('fs');
const myModule = require('./my-module-index');
// const { parse } = require('url')

console.log('\nrunning NextServer:');
console.log('  process.cwd() =', process.cwd());
console.log('  __dirname =', __dirname);
console.log('  __filename =', __filename);
console.log('  module.children =', module.children);
console.log('  module.filename =', module.filename);
console.log('  module.id =', module.id);
console.log('  module.path =', module.path);

module.exports = async (req, res) => {
    // if (req.url === '') {
    //   req.url = '/'
    // }
    // const url = parse(req.url, true);

    myModule.run();

    fs.readFile('../../out/server-mode-output.txt', () => {});

    const nextServer = createNextServer({ dev: false, dir: path.resolve('./') });

    // if (url.pathname === '/a') {
    //   await nextServer.render(req, res, url.pathname, url.query);
    // } else if (url.pathname === '/b') {
    //   await nextServer.render(req, res, url.pathname, url.query);
    // } else {
    await nextServer.getRequestHandler()(req, res);
    // }

    // let handler;
    // switch (req.url) {
    //   case '/':
    //     handler = require('./themes/.next/serverless/pages/index.js');
    //     break
    // }
    // handler.render(req, res);
};
