/* eslint-disable no-process-exit,global-require,import/no-dynamic-require,no-param-reassign,no-underscore-dangle,no-plusplus,no-multi-assign */

const path = require('path');
const fs = require('fs');
const Module = require('module');

function getActiveThemeDir(storeId) {
    return path.resolve(process.cwd(), `./themes/${storeId}/`);
}

function withReadsChecking(fn, fnName = fn && fn.name) {
    return function readsChecker(...args) {
        // args[0] - file path
        const filePath = args[0] && args[0].toString();

        // Here we can download the required files from Cloud Storage

        if (
            filePath &&
            !filePath.includes('node_modules') &&
            filePath.includes('themes')
        ) {
            let fileSize = 0;
            try {
                fileSize = (fs.statSync(filePath).size / 1024).toFixed(2);
                // eslint-disable-next-line no-empty
            } catch (_) {}

            console.log(`called ${fnName}("${filePath}", ...). FileSize (${fileSize || 'N/A'} Kb)`);
            // console.trace();
        }
        return fn(...args);
    };
}

function withWritesChecking(fn, fnName = fn && fn.name) {
    return function writesChecker(...args) {
        // args[0] - file path
        const filePath = args[0] && args[0].toString();

        // Here we can download the required files from Cloud Storage

        if (
            filePath // &&
            // !filePath.includes('node_modules') &&
            // filePath.includes('themes')
        ) {
            let fileSize = 0;
            // TODO: check file size after it's written
            // try {
            //     fileSize = (fs.statSync(filePath).size / 1024).toFixed(2);
            //     // eslint-disable-next-line no-empty
            // } catch (_) {}

            console.log(`called ${fnName}("${filePath}", ...). FileSize (${fileSize || 'N/A'} Kb)`);
            // console.trace();
        }
        return fn(...args);
    };
}

function overrideRequires(mocks) {
    const originalRequire = Module.prototype.require;
    Module.prototype.require = function overridenRequire(...args) {
        const name = args[0];

        if (mocks[name]) {
            return mocks[name];
        }

        return withReadsChecking(originalRequire.bind(this), 'require')(...args);
    };
    return Module;
}

function overrideFs() {
    fs.createReadStream = withReadsChecking(fs.createReadStream);
    fs.read = withReadsChecking(fs.read);
    fs.readSync = withReadsChecking(fs.readSync);
    fs.readdir = withReadsChecking(fs.readdir);
    fs.readdirSync = withReadsChecking(fs.readdirSync);
    fs.readFile = withReadsChecking(fs.readFile);
    fs.readFileSync = withReadsChecking(fs.readFileSync);
    fs.readlink = withReadsChecking(fs.readlink);
    fs.readlinkSync = withReadsChecking(fs.readlinkSync);
    fs.readv = withReadsChecking(fs.readv);
    fs.readvSync = withReadsChecking(fs.readvSync);

    // (path, ...)
    fs.appendFile = withWritesChecking(fs.appendFile);
    fs.appendFileSync = withWritesChecking(fs.appendFileSync);
    fs.createWriteStream = withWritesChecking(fs.createWriteStream);
    fs.write = withWritesChecking(fs.write);
    fs.writeFile = withWritesChecking(fs.writeFile);
    fs.writeFileSync = withWritesChecking(fs.writeFileSync);
    fs.writeSync = withWritesChecking(fs.writeSync);
    fs.writev = withWritesChecking(fs.writev);
    fs.writevSync = withWritesChecking(fs.writevSync);

    fs.promises = {
        ...fs.promises,
        read: withReadsChecking(fs.promises.read),
        readFile: withReadsChecking(fs.promises.readFile),
        readdir: withReadsChecking(fs.promises.readdir),
        readlink: withReadsChecking(fs.promises.readlink),

        appendFile: withWritesChecking(fs.promises.appendFile),
        write: withWritesChecking(fs.promises.write),
        writeFile: withWritesChecking(fs.promises.writeFile),
    };

    return fs;
}

module.exports = {
    getActiveThemeDir,
    overrideFs,
    overrideRequires,
};
