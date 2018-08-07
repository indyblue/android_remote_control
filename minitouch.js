const { execSocket, execSync, bindir, fwdAbs } = require('./mini0'),
  ptool = require('path'),
  net = require('net');

const name = 'minitouch';
const exp = module.exports = {
  port: 1718,
  adir: '/data/local/tmp/' + name,
  webSockets: [],
  action: () => { },
  debug: false
};
/**************************************************************************** */
// child process stuff
/**************************************************************************** */
cbExit();
let out = execSync(`adb shell mkdir ${exp.adir}`);

const bdir = 'node_modules/minitouch-prebuilt/prebuilt';

let dir = bindir(bdir);
out = execSync(`adb push ${dir}/${name} ${exp.adir}/`);

const procMT = execSocket(`adb shell -x ${exp.adir}/${name}`,
  exp.port, name, cbData, cbExit);

function cbExit() {
  execSync(`adb shell -x killall ${name}`);
  execSync(`adb shell rm -rf ${exp.adir}`);
}

function cbData(d) {
  d = d.toString();
  let x, tp, h, w, pr;
  try {
    [x, tp, w, h, pr] = d.match(/\^ (\d+) (\d+) (\d+) (\d+)/);
    console.log(d.trim());

    exp.action = function (type, x, y) {
      if (['u', 'm', 'd'].indexOf(type) < 0) return;

      var suc = false, txt = '', c = '\nc\n';
      if (type === 'u') txt = `u 0 ${c}`;
      else {
        if (x < 0 || y < 0 || x > w || y > h) return;
        if (x < 1) x = Math.round(x * w); //pct
        if (y < 1) y = Math.round(y * h); //pct
        txt = `\n${type} 0 ${x} ${y} 50 ${c}`;
      }
      suc = procMT.socket.write(txt);
      if (exp.debug) console.log('touch', type, x, y, suc);
    };

  } catch (e) { }
}
