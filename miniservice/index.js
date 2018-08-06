const { execSocket, execSync, fwdAbs } = require('../mini0'),
  ptool = require('path'),
  fs = require('fs'),
  https = require('https'),
  net = require('net'),
  pbsvc = require('./protobuf');


const exp = module.exports = {};

async function main() {
  var [pb] = await Promise.all([
    pbsvc.load(),
    loadStfService()
  ]);
  fnServiceStuff(pb);
}
main();


function fnServiceStuff(pb) {
  let dir = execSync(`adb shell pm path jp.co.cyberagent.stf`).trim().replace(/^.*:/, '');

  // install service and set it up for keyboard usage
  if (!dir) {
    execSync(`adb install STFService.apk`);
    dir = execSync(`adb shell pm path jp.co.cyberagent.stf`).trim().replace(/^.*:/, '');
  }

  execSync(`adb shell am stopservice --user 0 \
    -a jp.co.cyberagent.stf.ACTION_STOP \
    -n jp.co.cyberagent.stf/.Service`);

  let sPort = 1719, aPort = 1720;

  let service = execSocket(`adb shell am startservice --user 0 \
    -a jp.co.cyberagent.stf.ACTION_START \
    -n jp.co.cyberagent.stf/.Service`,
    sPort, 'stfservice', cbData, svcExit);

  let agent = execSocket(`adb shell export CLASSPATH="${dir}"\\; \
    exec app_process /system/bin jp.co.cyberagent.stf.Agent`,
    aPort, 'stfagent', cbData);

  function svcExit() {
    //execSync(`adb uninstall jp.co.cyberagent.stf`);
    execSync(`adb shell am stopservice --user 0 \
    -a jp.co.cyberagent.stf.ACTION_STOP \
    -n jp.co.cyberagent.stf/.Service`);
  };

  const dataBuff = new ArrayBuffer(0),
    respRes = ['blank'],
    addRes = (res, rej) => {
      let id = respRes.indexOf(null);
      if (id <= 0) id = respRes.length;
      respRes[id] = res;
      setTimeout(() => {
        if (respRes[id]) {
          respRes[id] = null;
          if (typeof rej === 'function') rej('service response timeout');
        }
      }, 10000);
      return id;
    },
    resolveRes = (id, retval) => {
      if (typeof id !== 'number' || id == 0) return;
      var cb = respRes[id];
      if (typeof cb === 'function') cb(retval);
      else console.log('could not match promise for service/agent response', id, retval);
      respRes[id] = null;
    };

  function cbData(d) {
    var msg=null;
    try { msg = pb.handleMessage(d); } catch (e) { }
    if(msg==null) return;
    resolveRes(msg.id, msg);
    if (msg && msg.type != 'BatteryEvent') console.log(JSON.stringify(msg));
  }

  exp.doPower = () => {
    var req = pb.doPower();
    agent.socket.write(req);
  };
  exp.onKey = (code, mods, isDown) => {
    var req = pb.doKey(code, mods, isDown);
    agent.socket.write(req);
  };
  exp.getClip = () => new Promise((res, rej) => {
    let id = addRes(res, rej);
    var req = pb.getClip(id);
    service.socket.write(req);
  });
  exp.setClip = (txt) => new Promise((res, rej) => {
    let id = addRes(res, rej);
    var req = pb.setClip(id, txt);
    service.socket.write(req);
  });

  // https://github.com/openstf/STFService.apk
  // https://github.com/openstf/STFService.apk/blob/master/app/src/main/proto/wire.proto
  // https://www.npmjs.com/package/protobufjs#using-proto-files

}

/**************************************************************************** */
// STFService.apk - download and install
/**************************************************************************** */
function loadStfService() {
  const fname = './STFService.apk';
  if (!fs.existsSync(fname)) {
    const url = 'https://github.com/openstf/stf/raw/master/vendor/STFService/STFService.apk';
    console.log('getting from github: ', fname);
    return fetchFile(url, fname, fnServiceStuff);
  }
  else return Promise.resolve(fname);
}

function fetchFile(url, fname, cbdone) {
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
}

