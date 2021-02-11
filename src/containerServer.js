const http = require('http');
// eslint-disable-next-line import/no-unresolved,node/no-missing-require
const routeHandler = require('./routeHandler');

const httpServer = new http.Server(async (req, res) => {
    try {
        if (routeHandler.render) {
            // Page route
            return await routeHandler.render(req, res);
        }
        // API route
        return await routeHandler.default(req, res);
    } catch (e) {
        console.error(e);
        res.statusCode = 500;
        res.end();
    }
    return null;
});

httpServer.listen(3000, (err) => {
    if (err) throw err;
    console.log('Listening on http://localhost:3000');
});

process.on('uncaughtException', (err) => {
    console.error('Unhandled exception: ', err);
});
process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection: ', err);
});
