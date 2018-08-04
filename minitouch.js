const { exec, execSync, bindir } = require('./mini0'),
  ptool = require('path'),
  net = require('net');

const exp = module.exports = {
  port: 1718,
  adir: '/data/local/tmp/minitouch',
  webSockets: [],
  action: null
};
/**************************************************************************** */
// child process stuff
/**************************************************************************** */
let out = execSync(`adb shell rm -rf ${exp.adir}`);
out = execSync(`adb shell mkdir ${exp.adir}`);

const bdir = 'node_modules/minitouch-prebuilt/prebuilt';

let dir = bindir(bdir);
out = execSync(`adb push ${dir}/minitouch ${exp.adir}/`);

out = execSync(`adb forward tcp:${exp.port} localabstract:minitouch`);

const cpMinitouch = exec(`adb shell ${exp.adir}/minitouch`);
cpMinitouch.stdout.on('data', d => {
  setTimeout(() => {
    if (!cstrMinitouch.active) cstrMinitouch();
  }, 100);
});

/**************************************************************************** */
// stream stuff
/**************************************************************************** */
function cstrMinitouch() {
  cstrMinitouch.active = true;
  var stream = net.connect({
    port: exp.port
  });

  stream.on('error', function () {
    process.exit(1)
  });

  let tp, h, w, pr;
  stream.setEncoding('utf8');
  stream.on('data', d => {
    var x;
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
        suc = stream.write(txt);
        console.log('touch', type, x, y, suc);
      };

    } catch (e) { }
  });

}
/**************************************************************************** */
