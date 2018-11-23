'option strict';
var WebSocketServer = require('ws').Server
  , http = require('http')
  , fs = require('fs')
  , ptool = require('path')
  , minicap = require('./minicap')
  , minitouch = require('./minitouch')
  , minisvc = require('./miniservice')
  //  , minitether = require('./minitether')
  , mini0 = require('./mini0')
  , { addPort, listPorts } = require('./mini0');

var PORT = process.env.PORT || 9002

const page = ptool.join(__dirname, 'index.html');
function requestListener(req, res) {
  console.log('request', req.url);
  var fstream = fs.createReadStream(page);
  fstream.pipe(res);
};

var server = http.createServer(requestListener);
var wss = new WebSocketServer({ server: server });

var sockets = mini0.webSockets;
wss.on('connection', function (ws) {
  ws.sendObj = o => ws.send(JSON.stringify(o));
  sockets.push(ws);
  console.info('Got a client');

  minicap.sendLastFrame();

  ws.on('message', function (d) {
    //console.log(d);
    let j = null;
    try { j = JSON.parse(d); } catch (e) { }
    if (j) {
      if (j.event === 'mouse') minitouch.action(j.t, j.x, j.y);
      else if (j.event === 'power') minisvc.doPower();
      else if (j.event === 'minicap') minicap.toggle();
      else if (j.event === 'key') minisvc.onKey(j.key, j.mods, j.isDown);
      else if (j.event === 'getclip') minisvc.getClip().then(msg =>
        ws.sendObj(msg));
      else if (j.event === 'setclip') minisvc.setClip(j.text);
      else if (j.event === 'listports')
        ws.sendObj({ type: 'ports', data: listPorts() });
      else if (j.event === 'addport') {
        for (var p of j.port.split(',')) addPort(p, j.rev);
        ws.sendObj({ type: 'ports', data: listPorts() });
      }
      else if (j.event === 'debug') {
        console.log('debug', j.val);
        minicap.debug = j.val;
        minitouch.debug = j.val;
      }
    }
  });
  ws.on('close', function () {
    var idx = sockets.indexOf(ws);
    if (idx >= 0) sockets.splice(idx, 1);
    console.info('lost a client: ' + idx);
  });

  minicap.start();
  minisvc.cbRotate = () => minicap.restart(true);
});

server.listen(PORT);
console.info('Listening on port %d', PORT);

process.stdin.setEncoding('utf8');
process.stdin.resume();
process.stdin.on('data', d => {
  d = d.trim();
  console.log(d, d === 'q');
  if (d === 'q') process.exit();
});

const onExit = () => {
  console.log('stopping server', PORT);
  minicap.onExit();
  minitouch.onExit();
  minisvc.onExit();
  //  minitether.onExit();
  server.close();
  mini0.onExit();
  if (process.argv.indexOf('-u') < 0) {
    console.log('*** TO FINISH UNINSTALL ***');
    console.log(`adb uninstall jp.co.cyberagent.stf`);
    console.log(`cd ./gnirehtet; ./gnirehtet uninstall`);
  }

};
process.on('exit', onExit);
process.on('SIGTERM', () => process.exit(1));
process.on('SIGINT', () => process.exit(1));

