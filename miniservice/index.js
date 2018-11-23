'option strict';
const { execSocket, execSync, fetchFile, info } = require('../mini0'),
  pbsvc = require('./protobuf');


const exp = module.exports = { debug: false };

async function main() {
  var [pb] = await Promise.all([
    pbsvc.load(),
    loadStfService()
  ]);
  fnServiceStuff(pb);
}
main();


function fnServiceStuff(pb) {
  let dir = execSync(`adb shell -x pm path jp.co.cyberagent.stf`).trim().replace(/^.*:/, '');

  // install service and set it up for keyboard usage
  if (!dir) {
    execSync(`adb install STFService.apk`);
    dir = execSync(`adb shell pm path jp.co.cyberagent.stf`).trim().replace(/^.*:/, '');
  }

  execSync(`adb shell -x am stopservice \
    -a jp.co.cyberagent.stf.ACTION_STOP \
    -n jp.co.cyberagent.stf/.Service`);

  let sPort = 1719, aPort = 1720;

  let service = execSocket(`adb shell -x am startservice \
    -a jp.co.cyberagent.stf.ACTION_START \
    -n jp.co.cyberagent.stf/.Service`,
    sPort, 'stfservice', cbData);

  let agent = execSocket(`adb shell -x export CLASSPATH="${dir}"\\; \
    exec app_process /system/bin jp.co.cyberagent.stf.Agent`,
    aPort, 'stfagent', cbData);

  exp.onExit = () => {
    execSync(`adb shell -x am stopservice \
      -a jp.co.cyberagent.stf.ACTION_STOP \
      -n jp.co.cyberagent.stf/.Service`);
    if (process.argv.indexOf('-u') > 0)
      execSync(`adb uninstall jp.co.cyberagent.stf`);
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
      if (typeof cb === 'function') {
        cb(retval);
        respRes[id] = null;
        return true;
      } else console.log('could not match promise for service/agent response', id, retval);
      return false;
    };

  exp.cbRotate = rot => { console.log('no rotation callback', rot); };
  function cbData(d) {
    var msg = null;
    try { msg = pb.handleMessage(d); } catch (e) { }
    if (msg == null) return;
    var success = resolveRes(msg.id, msg);
    switch (msg.type) {
      case 'RotationEvent':
        info.rot = msg.message.rotation;
        exp.cbRotate(msg.message.rotation);
        // exp.getDispl()
        //   .then(x => console.log(x))
        //   .catch(e => console.log(e));
        break;
      case 'ConnectivityEvent':
      case 'BrowserPackageEvent':
      case 'BatteryEvent':
        break;
      default:
        console.log(JSON.stringify(msg));
    }
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

  exp.getDispl = () => new Promise((res, rej) => {
    let id = addRes(res, rej);
    var req = pb.getDispl(id);
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
  const url = 'https://github.com/openstf/stf/raw/master/vendor/STFService/STFService.apk';
  console.log('getting from github: ', fname);
  return fetchFile(url, fname, fnServiceStuff);
}