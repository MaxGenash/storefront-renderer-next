/* eslint-disable no-process-exit,global-require,import/no-dynamic-require,no-param-reassign,no-underscore-dangle,no-plusplus,no-multi-assign */
const path = require('path');
const fs = require('fs');
const Module = require('module');

class FsUtils {
    constructor(reqId, storeId, originalFs = fs, originalRequire = Module.prototype.require) {
        this.reqId = reqId;
        this.storeId = storeId;
        this.originalFs = originalFs;
        this.overridenFs = fs;
        this.originalRequire = originalRequire;
        this.overridenRequire = Module.prototype.require;
        this.isFsOverriden = false;
    }

    getActiveThemeDir() {
        // return path.resolve(process.cwd(), `./themes/tmp/${this.reqId}/`);
        return path.resolve(process.cwd(), `./themes/${this.storeId}/`);
    }

    getSrcThemeDir() {
        return path.resolve(process.cwd(), `./themes/${this.storeId}/`);
    }

    withReadsChecking(fn, fnName = fn && fn.name) {
        const fsUtils = this;
        return function readsChecker(...args) {
            // args[0] - file path
            const filePath = args[0] && args[0].toString();

            // Here we can download the required files from Cloud Storage

            if (filePath && !filePath.includes('node_modules') && filePath.includes('themes')) {
                let fileSize = 0;
                try {
                    fileSize = (fs.statSync(filePath).size / 1024).toFixed(2);
                    // eslint-disable-next-line no-empty
                } catch (_) {}

                console.log(
                    `[${fsUtils.reqId}] called ${fnName}("${filePath}", ...). FileSize (${fileSize || 'N/A'} Kb)`,
                );
                // console.trace();
            }
            return fn(...args);
        };
    }

    withWritesChecking(fn, fnName = fn && fn.name) {
        const fsUtils = this;
        return function writesChecker(...args) {
            // args[0] - file path
            const filePath = args[0] && args[0].toString();

            // Here we can download the required files from Cloud Storage

            if (
                filePath // &&
                // !filePath.includes('node_modules') &&
                // filePath.includes('themes')
            ) {
                const fileSize = 0;
                // TODO: check file size after it's written
                // try {
                //     fileSize = (fs.statSync(filePath).size / 1024).toFixed(2);
                //     // eslint-disable-next-line no-empty
                // } catch (_) {}

                console.log(
                    `[${fsUtils.reqId}] called ${fnName}("${filePath}", ...). FileSize (${fileSize || 'N/A'} Kb)`,
                );
                // console.trace();
            }
            return fn(...args);
        };
    }

    overrideRequires(mocks) {
        // this.originalRequire = Module.prototype.require;
        const fsUtils = this;
        this.overridenRequire = Module.prototype.require = function overridenRequire(...args) {
            const name = args[0];

            if (mocks[name]) {
                return mocks[name];
            }

            return fsUtils.withReadsChecking(
                fsUtils.originalRequire.bind(this),
                'require',
            )(...args);
        };
        return Module;
    }

    revertRequires() {
        Module.prototype.require = this.originalRequire;
        return Module;
    }

    overrideFs() {
        this.fsOverrides = {
            createReadStream: this.withReadsChecking(this.originalFs.createReadStream),
            read: this.withReadsChecking(this.originalFs.read),
            readSync: this.withReadsChecking(this.originalFs.readSync),
            readdir: this.withReadsChecking(this.originalFs.readdir),
            readdirSync: this.withReadsChecking(this.originalFs.readdirSync),
            readFile: this.withReadsChecking(this.originalFs.readFile),
            readFileSync: this.withReadsChecking(this.originalFs.readFileSync),
            readlink: this.withReadsChecking(this.originalFs.readlink),
            readlinkSync: this.withReadsChecking(this.originalFs.readlinkSync),
            readv: this.withReadsChecking(this.originalFs.readv),
            readvSync: this.withReadsChecking(this.originalFs.readvSync),

            appendFile: this.withWritesChecking(this.originalFs.appendFile),
            appendFileSync: this.withWritesChecking(this.originalFs.appendFileSync),
            createWriteStream: this.withWritesChecking(this.originalFs.createWriteStream),
            write: this.withWritesChecking(this.originalFs.write),
            writeFile: this.withWritesChecking(this.originalFs.writeFile),
            writeFileSync: this.withWritesChecking(this.originalFs.writeFileSync),
            writeSync: this.withWritesChecking(this.originalFs.writeSync),
            writev: this.withWritesChecking(this.originalFs.writev),
            writevSync: this.withWritesChecking(this.originalFs.writevSync),
        };
        this.fsPromisesOverrides = {
            read: this.withReadsChecking(this.originalFs.promises.read, 'promises.read'),
            readFile: this.withReadsChecking(this.originalFs.promises.readFile, 'promises.readFile'),
            readdir: this.withReadsChecking(this.originalFs.promises.readdir, 'promises.readdir'),
            readlink: this.withReadsChecking(this.originalFs.promises.readlink, 'promises.readlink'),

            appendFile: this.withWritesChecking(this.originalFs.promises.appendFile, 'promises.appendFile'),
            write: this.withWritesChecking(this.originalFs.promises.write, 'promises.write'),
            writeFile: this.withWritesChecking(this.originalFs.promises.writeFile, 'promises.writeFile'),
        };

        const backup = {
            promises: {},
        };
        for (const [key, fn] of Object.entries(this.fsOverrides)) {
            backup[key] = this.originalFs[key];
            this.overridenFs[key] = fs[key] = fn;
        }
        for (const [key, fn] of Object.entries(this.fsPromisesOverrides)) {
            backup.promises[key] = this.originalFs.promises[key];
            this.overridenFs.promises[key] = fs.promises[key] = fn;
        }

        this.originalFs = {
            ...this.originalFs,
            ...backup,
            promises: {
                ...this.originalFs.promises,
                ...backup.promises,
            },
        };

        this.isFsOverriden = true;

        return this.overridenFs;
    }

    revertFs() {
        if (!this.isFsOverriden) {
            return this.originalFs;
        }
        for (const key of Object.keys(this.fsOverrides)) {
            this.overridenFs[key] = fs[key] = this.originalFs[key];
        }
        for (const key of Object.keys(this.fsPromisesOverrides)) {
            this.overridenFs.promises[key] = fs.promises[key] = this.originalFs.promises[key];
        }

        this.isFsOverriden = false;

        return this.originalFs;
    }
}

module.exports = FsUtils;
