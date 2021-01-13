/* eslint-disable no-underscore-dangle */
const fs = require('fs');

console.log('\nrunning myModule:');
console.log('  process.cwd() =', process.cwd());
console.log('  __dirname =', __dirname);
console.log('  __filename =', __filename);
console.log('  module.children =', module.children);
console.log('  module.filename =', module.filename);
console.log('  module.id =', module.id);
console.log('  module.path =', module.path);

function run() {
    console.log('called myModule.run');
    fs.readFile('../../../out/serverless-mode-output.txt', () => {});
}

module.exports.run = run;
