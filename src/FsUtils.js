/* eslint-disable no-process-exit,global-require,import/no-dynamic-require,no-param-reassign,no-underscore-dangle,no-plusplus,no-multi-assign */
const path = require('path');
const fs = require('fs');

class FsUtils {
    constructor(reqId, storeId, isIsolatedDir) {
        this.reqId = reqId;
        this.storeId = storeId;
        this.isIsolatedDir = isIsolatedDir;
        this.relativeSrcThemeDir = `themes/${this.storeId}/`;
        this.relativeActiveThemeDir = isIsolatedDir
            ? `themes/tmp/${this.reqId}/`
            : this.relativeSrcThemeDir;
        this.fullSrcThemeDir = path.resolve(process.cwd(), this.relativeSrcThemeDir);
        this.fullActiveThemeDir = path.resolve(process.cwd(), this.relativeActiveThemeDir);

        this.prepareReqDir();
    }

    async moveToActiveDir(filePath, newName) {
        const srcFilePath = path.resolve(this.fullSrcThemeDir, filePath);
        const oldName = path.basename(filePath);
        const newFilePath = path.resolve(this.fullActiveThemeDir, newName || oldName);

        await fs.promises.copyFile(srcFilePath, newFilePath);
    }

    prepareReqDir() {
        // TODO: keeping the data in memory will be more effective
        if (this.isIsolatedDir) {
            fs.mkdirSync(this.fullActiveThemeDir, { recursive: true });
        }
    }

    clear() {
        if (this.isIsolatedDir) {
            fs.rmdirSync(this.fullActiveThemeDir, { recursive: true });
        }
    }
}

module.exports = FsUtils;
