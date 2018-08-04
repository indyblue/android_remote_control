var WebSocketServer = require('ws').Server
  , http = require('http')
  , fs = require('fs')
  , ptool = require('path')
  , minicap = require('./minicap')
  , minitouch = require('./minitouch');

var PORT = process.env.PORT || 9002



const page = ptool.join(__dirname, 'index.html');
function requestListener(req, res) {
  console.log('request', req.url);
  var fstream = fs.createReadStream(page);
  fstream.pipe(res);
};

var server = http.createServer(requestListener);
var wss = new WebSocketServer({ server: server });

var sockets = minicap.webSockets;
wss.on('connection', function (ws) {
  sockets.push(ws);
  console.info('Got a client')

  minicap.sendLastFrame(ws);

  ws.on('message', function (d) {
    //console.log(d);
    let j = null;
    try { j = JSON.parse(d); } catch (e) { }
    if (typeof minitouch.action === 'function' && j && j.t) {
      minitouch.action(j.t, j.x, j.y);
    }
  });
  ws.on('close', function () {
    var idx = sockets.indexOf(ws);
    if (idx >= 0) sockets.splice(idx, 1);
    console.info('lost a client: ' + idx);
  })
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
  server.close();
};
process.on('exit', onExit);
process.on('SIGTERM', onExit);

