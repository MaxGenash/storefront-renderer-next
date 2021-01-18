/* eslint-disable global-require,import/no-dynamic-require */
const path = require('path');

function getStoreId(req) {
    const storeId = req.headers['x-bc-storeid'];
    if (!storeId) {
        throw new Error('Empty storeId in headers');
    }
    return storeId;
}

async function getNextConfig(themeDir) {
    // TODO: download from Cloud Storage
    // TODO: next.config.js should be processed by bundle service,
    // so in the Bucket we have only an ultimate normalized and validated json file.
    // It will help to avoid vulnerabilities in storefront-renderer-next and will reduce response time

    return require(path.join(themeDir, './next.config.js'));
}

module.exports = {
    getStoreId,
    getNextConfig,
};
