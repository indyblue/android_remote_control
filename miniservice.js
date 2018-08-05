const { execSocket, execSync, fwdAbs } = require('./mini0'),
  ptool = require('path'),
  fs = require('fs'),
  https = require('https'),
  net = require('net'),
  pbsvc = require('./service/');


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

  let sPort = 1719, aPort = 1720;

  let service = execSocket(`adb shell am startservice --user 0 \
    -a jp.co.cyberagent.stf.ACTION_START \
    -n jp.co.cyberagent.stf/.Service`,
    sPort, 'stfservice', svcData, svcExit);

  let agent = execSocket(`adb shell export CLASSPATH="${dir}"\\; \
    exec app_process /system/bin jp.co.cyberagent.stf.Agent`,
    aPort, 'stfagent', agtData);

  function svcData(d) {
    console.log('svc', pb.handleMessage(d));
  }
  function svcExit() {
    execSync(`adb uninstall jp.co.cyberagent.stf`);
  };

  function agtData(d) {
    console.log('agt', pb.handleMessage(d));
  }

  exp.onKey = (code, mods, isDown) => {
    var kp = pb.doKey(code, mods, isDown);
    agent.socket.write(kp);
  };

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
  return new Promise((res, rej) => {
    https.get(url, (res) => {
      if (res.statusCode === 302) return fetchFile(res.headers.location, fname);
      else if (res.statusCode === 200 && res.headers['content-type'] === "application/octet-stream") {
        let fstream = fs.createWriteStream(fname);
        res.pipe(fstream);
        res.on('end', () => {
          console.log('complete: ', fname);
          res(fname);
        });
      } else {
        var out = '';
        res.on('data', d => out += d.toString());
        res.on('end', () => {
          console.log('problem getting file', fname, out);
          rej(out);
        });
      }
    });
  });
}

