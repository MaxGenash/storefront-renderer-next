/* eslint-disable no-process-exit,global-require,import/no-dynamic-require,no-param-reassign,no-underscore-dangle,no-plusplus,consistent-return */

const process = require('process');
const path = require('path');
const http = require('http');
const fs = require('fs');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({
    changeOrigin: true,
});

// const createNextServer = require('next');
// const { loadComponents } = require('next/dist/next-server/server/load-components.js');

class CustomNextServer {
    constructor({ nextServerUtils, vmUtils, fsUtils }) {
        this.nextServerUtils = nextServerUtils;
        this.vmUtils = vmUtils;
        this.fsUtils = fsUtils;

        this.activeDir = fsUtils.fullActiveThemeDir;

        return this.init();
    }

    async init() {
        this.nextConfig = await this.nextServerUtils.loadStoreConfigFile('next.config.js');
        this.pagesManifest = await this.nextServerUtils.loadStoreConfigFile(
            './_next/serverless/pages-manifest.json',
        );

        return this;
    }

    async handleDataReq(req, res) {
        // TODO: should load a page handler instead
        const relativeFilePath = req.parsedUrl.pathname.replace(
            /\/_next\/data\/\w+\//,
            './_next/serverless/pages/',
        );
        const fullFilePath = path.resolve(this.activeDir, relativeFilePath);

        try {
            const payload = await fs.promises.readFile(fullFilePath);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Length', Buffer.byteLength(payload));
            res.end(payload);
        } catch (err) {
            console.log(err.message);
        }
    }

    async handleNextImageReq(req, res) {
        const imageLink = req.parsedUrl.searchParams.get('url');

        res.statusCode = 302;
        res.setHeader('Location', imageLink);
        res.end();
    }

    async handleApiReq(req, res) {
        const relativeFilePath = this.pagesManifest[req.parsedUrl.pathname];
        if (!relativeFilePath) {
            return;
        }
        const fullFilePath = path.resolve(this.activeDir, './_next/serverless/', relativeFilePath);

        try {
            const routeHandler = await this.vmUtils.runInIsolatedVm(fullFilePath);

            // we use "default" since it's an ES module
            return await routeHandler.default(req, res);
        } catch (err) {
            console.error(err.message);
        }
        return null;
    }

    async handlePageReq(req, res) {
        // TODO: handle dynamic routes
        let filePath = this.pagesManifest[req.parsedUrl.pathname];
        // TODO tmp check
        if (!filePath && req.parsedUrl.pathname.includes('/product')) {
            filePath = 'pages/product/[slug].js';
        }
        if (!filePath) {
            return;
        }
        try {
            const relativeFilePath = './_next/serverless/' + filePath;
            await this.vmUtils.runInIsolatedVm(relativeFilePath);

            proxy.web(req, res, { target: `http://localhost:${this.vmUtils.containerPort}` });

            return new Promise((resolve, reject) => {
                proxy.on('error', (err) => {
                    console.error(err);
                    reject(err);
                });
                proxy.on('proxyRes', (proxyRes) => {
                    console.log('done');
                    res.writeHead(proxyRes.statusCode, proxyRes.headers);
                    proxyRes.pipe(res, { end: true });
                    resolve();
                });
            });
        } catch (err) {
            console.error(err);
        }
        return null;
    }

    // TODO: We don't need it when deployed because there will be CDN for files from public directory
    async handleStaticFiles(req, res) {
        const fileDir = path.resolve(
            this.fsUtils.fullSrcThemeDir,
            'public',
            '.' + req.parsedUrl.pathname,
        );

        try {
            const data = await fs.promises.readFile(fileDir);
            // res.setHeader('Content-type', map[ext] || 'text/plain' );
            res.end(data);
        } catch (err) {
            return null;
        }
    }

    async run(req, res) {
        console.log('running NextServer. process.cwd() =', process.cwd());

        req.parsedUrl = new URL('http://localhost:3000' + req.url);

        if (req.parsedUrl.pathname.includes('/data')) {
            await this.handleDataReq(req, res);
        } else if (req.parsedUrl.pathname.includes('/image')) {
            await this.handleNextImageReq(req, res);
        } else if (req.parsedUrl.pathname.includes('/api')) {
            await this.handleApiReq(req, res);
        } else {
            await this.handlePageReq(req, res);
        }

        if (!res.finished) {
            // TODO: We don't need it when deployed because there will be CDN for files from public directory
            await this.handleStaticFiles(req, res);
        }

        if (!res.finished) {
            res.statusCode = 404;
            const page404Path = path.resolve(
                this.fsUtils.fullSrcThemeDir,
                './_next/serverless/pages/404.html',
            );
            const pageFile = await fs.promises.readFile(page404Path);
            res.end(pageFile);
        }
    }
}

module.exports = CustomNextServer;
