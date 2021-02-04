/* eslint-disable global-require,import/no-dynamic-require */
const path = require('path');

class NextServerUtils {
    constructor(fsUtils) {
        this.fsUtils = fsUtils;
    }

    static getStoreId(req) {
        const storeId = req.headers['x-bc-store-id'];
        if (!storeId) {
            throw new Error('Empty x-bc-store-id in headers');
        }
        return storeId;
    }

    async loadStoreConfigFile(file) {
        // TODO: download from Cloud Storage
        // TODO: next.config.js should be processed by bundle service,
        // so in the Bucket we have only an ultimate normalized and validated json file.
        // It will help to avoid vulnerabilities in storefront-renderer-next and will reduce response time

        return require(path.join(this.fsUtils.getSrcThemeDir(), file));
    }
}

module.exports = NextServerUtils;
