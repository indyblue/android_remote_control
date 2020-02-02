'option strict';
const { trySocket, fwdAbs } = require('./mini0'),
  ptool = require('path'),
  net = require('net');

const name = 'minitouchagent';
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
fwdAbs(exp.port, name);
const procMT = {};
trySocket(procMT, exp.port, name, cbData);

function cbData(d) {
  d = d.toString();
  let x, tp, h, w, pr;
  try {
    [x, tp, w, h, pr] = d.match(/\^ (\d+) (\d+) (\d+) (\d+)/);
    console.log(d.trim());

    exp.action = function(type, x, y) {
      if (['u', 'm', 'd'].indexOf(type) < 0) return;

      var suc = false, txt = '', c = '\nc\n';
      if (type === 'u') txt = `u 0 ${c}`;
      else {
        if (x < 0 || y < 0 || x > w || y > h) return;
        if (x < 1) x = Math.round(x * w); //pct
        if (y < 1) y = Math.round(y * h); //pct
        txt = `${type} 0 ${x} ${y} 50 ${c}`;
      }
      suc = procMT.socket.write(txt);
      if (exp.debug) console.log('touch', type, x, y, suc);
    };

  } catch (e) { }
}
