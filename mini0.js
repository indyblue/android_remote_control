const cp = require('child_process'),
  ptool = require('path');

const abi = execSync('adb shell getprop ro.product.cpu.abi');
const sdk = execSync('adb shell getprop ro.build.version.sdk');

function execSync(cmd) {
  console.log('execSync', cmd);
  let out = cp.execSync(cmd, { encoding: 'utf8' }).trim();
  console.log('output', out);
  return out;
}

function exec(cmd) {
  console.log('exec', cmd);
  let proc = cp.exec(cmd, {
    encoding: 'utf8'
  });
  proc.stdout.on('data', console.log);
  proc.stderr.on('data', console.log);
  const killCP = () => {
    console.log('stopping cp:' + cmd);
    proc.kill();
  };
  process.on('exit', killCP);
  process.on('SIGTERM', killCP);
  return proc;
}

module.exports = {
  exec, execSync,
  bindir: (base) => ptool.join(base, abi, 'bin'),
  libdir: (base) => ptool.join(base, abi, 'lib', 'android-' + sdk)
};