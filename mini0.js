'option strict';
const cp = require('child_process'),
  $path = require('path'),
  https = require('https'),
  { URL } = require('url');
fs = require('fs'),
  net = require('net');

const exp = module.exports = { info: {}, exec, execSync, fetchFile };

const procs = [], sockets = [];
/**************************************************************************** */
// get info
/**************************************************************************** */
const info = exp.info;
info.abi = execSync('adb shell getprop ro.product.cpu.abi');
info.sdk = execSync('adb shell getprop ro.build.version.sdk');
[info.w, info.h] = execSync(`sh -c "adb shell dumpsys window | grep -Eo 'init=[0-9]+x[0-9]+'"`).match(/\d+/g)

let revertSettings = () => { };
if (process.argv.indexOf('-f') < 0) {
  let show_touches = execSync('adb shell settings get system show_touches');
  let scr_off_time = execSync('adb shell settings get system screen_off_timeout');
  let scr_bl_mode = execSync('adb shell settings get system screen_brightness_mode');
  let scr_bl = execSync('adb shell settings get system screen_brightness');
  execSync('adb shell settings put system show_touches 1');
  execSync('adb shell settings put system screen_off_timeout 2147483647');
  execSync('adb shell settings put system screen_brightness_mode 0');
  execSync('adb shell settings put system screen_brightness 0');

  revertSettings = () => {
    execSync(`adb shell settings put system show_touches ${show_touches}`);
    execSync(`adb shell settings put system screen_off_timeout ${scr_off_time}`);
    execSync(`adb shell settings put system screen_brightness ${scr_bl}`);
    execSync(`adb shell settings put system screen_brightness_mode ${scr_bl_mode}`);
  };
}
exp.onExit = () => {
  revertSettings();
  for (let socket of sockets) {
    if (socket.isOpen) {
      console.log(socket.name, 'closing socket');
      socket.end();
    }
    else console.log(socket.name, 'socket already closed');
  }
  for (let proc of procs) {
    if (proc.isRunning) {
      console.log(proc.name, 'killing process');
      proc.kill();
    } else console.log(proc.name, 'process already exited');
  }
};

/**************************************************************************** */
// port stuff
/**************************************************************************** */
exp.listPorts = () => {
  let fwd = execSync('adb forward --list');
  let rev = execSync('adb reverse --list');
  return `forward:\n${fwd}\n\nreverse:\n${rev}`;
};
exp.addPort = (port, rev) => {
  let type = rev ? 'reverse' : 'forward';
  let fwd = execSync(`adb ${type} tcp:${port} tcp:${port}`);
};

/**************************************************************************** */
// exec stuff
/**************************************************************************** */
function execSync(cmd, pwd) {
  console.log('execSync', cmd);
  let out = cp.execSync(cmd, { encoding: 'utf8', cwd: pwd || '.' }).trim();
  if (out) console.log('output', out);
  return out;
}

function exec(cmd, name, pwd) {
  console.log('exec', cmd);
  let proc = cp.exec(cmd, {
    encoding: 'utf8', cwd: pwd || '.'
  });
  proc.stdout.on('data', d => console.log(name, 'o', d));
  proc.stderr.on('data', d => console.log(name, 'e', d));
  proc.isRunning = true;
  proc.name = name || cmd;
  proc.on('exit', () => proc.isRunning = false);
  procs.push(proc);
  return proc;
}

exp.bindir = (base) => $path.join(base, info.abi, 'bin');
exp.libdir = (base) => $path.join(base, info.abi, 'lib', 'android-' + info.sdk);

exp.fwdAbs = (hport, absname) => execSync(`adb forward tcp:${hport} localabstract:${absname}`);
exp.fwdPort = (hport, aport) => execSync(`adb forward tcp:${hport} localabstract:${aport}`);

exp.execSocket = (cmd, port, name, cbData) => {
  exp.fwdAbs(port, name);
  const proc = exec(cmd, name);
  proc.stdout.on('data', d => {
    if (!proc.hasSocket) setTimeout(() => {
      if (proc.hasSocket) return;
      proc.hasSocket = true;
      trySocket(proc, port, name, cbData);
    }, 100);
  });
  return proc;
};

function trySocket(proc, port, name, cbData) {
  if (!proc.socketTry) proc.socketTry = 1;
  else proc.socketTry++;
  console.log('***** starting stream', port, name, proc.socketTry);
  proc.socket = net.connect({ port });
  proc.socket.on('data', cbData);
  proc.socket.on('error', err => console.log('stream error', port, name, err));
  proc.socket.isOpen = true;
  proc.socket.name = name;
  sockets.push(proc.socket);
  proc.socket.on('end', () => {
    proc.socket.isOpen = false;
    console.log(`socket ${port}/${name} has closed - program may need to be restarted.`);
    if (proc.socketTry < 5) setTimeout(() => {
      trySocket(proc, port, name, cbData);
    }, 2000);
  });
}

/**************************************************************************** */
// url fetch stuff
/**************************************************************************** */
function fetchFile(url, fname) {
  if (!fs.existsSync(fname)) {
    console.log('getting from github: ', fname);
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        if (res.statusCode === 302) return fetchFile(res.headers.location, fname);
        else if (res.statusCode === 200 && res.headers['content-type'] === "application/octet-stream") {
          let fstream = fs.createWriteStream(fname);
          res.pipe(fstream);
          res.on('end', () => {
            console.log('complete: ', fname);
            resolve(fname);
          });
        } else {
          var out = '';
          res.on('data', d => out += d.toString());
          res.on('end', () => {
            console.log('problem getting file', fname, out);
            reject(out);
          });
        }
      });
    });
  } else {
    console.log('using local copy:', fname);
    return Promise.resolve(fname);
  }
}
exp.fetchVersion = (url, def) => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 302) {
        const retval = res.headers.location.replace(/.*\/([^/?]+).*$/, '$1');
        resolve(retval);
      }
      else resolve(def);
    });
  });
}

