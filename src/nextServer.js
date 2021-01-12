const createNextServer = require('next');
const process = require('process');
const path = require('path');
const fs = require('fs');
// const { parse } = require('url')

module.exports = async (req, res) => {
    // if (req.url === '') {
    //   req.url = '/'
    // }
    // const url = parse(req.url, true);

    fs.readFile('../../out/server-mode-output.txt', () => {});

    console.log('running NextServer in' + process.cwd());

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
