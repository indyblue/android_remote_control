const { exec, execSync, fwdAbs } = require('./mini0'),
  ptool = require('path'),
  fs = require('fs'),
  https = require('https'),
  net = require('net'),
  protobuf = require("protobufjs");

async function main() {
  var [pbroot] = await Promise.all([
    protobuf.load('./wire.proto'),
    loadStfService()
  ]);
  var pb = pbSetup(pbroot);
  fnServiceStuff(pb);
}
main();

function pbSetup(root) {
  var t = { root, package: 'jp.co.cyberagent.stf.proto' };
  var lt = n => t.root.lookupType(t.package + '.' + n);
  var le = n => t.root.lookupEnum(t.package + '.' + n);
  t.envelope = lt("Envelope");
  t.messageName = le("MessageName");
  t.handleMessage = (m, isReq) => {
    var req = isReq ? 'Request' : 'Response',
      env = t.envelope.decodeDelimited(m),
      type = (t.messageName.valuesById[env.type] || '').replace(/_$/, req),
      message = '';
    if (type) message = lt(type).decode(env.message);
    return { type, message };
  };
  return t;
}

function fnServiceStuff(pb) {

  let dir = execSync(`adb shell pm path jp.co.cyberagent.stf`).trim().replace(/^.*:/, '');

  // install service and set it up for keyboard usage
  if (!dir) {
    execSync(`adb install STFService.apk`);
    dir = execSync(`adb shell pm path jp.co.cyberagent.stf`).trim().replace(/^.*:/, '');
  }

  let sPort = 1719, aPort = 1720;

  fwdAbs(sPort, 'stfservice');
  let service = exec(`adb shell am startservice --user 0 \
    -a jp.co.cyberagent.stf.ACTION_START \
    -n jp.co.cyberagent.stf/.Service`);


  fwdAbs(aPort, 'stfservice');
  let agent = exec(`adb shell export CLASSPATH="${dir}"\; \
    exec app_process /system/bin jp.co.cyberagent.stf.Agent`);

  var svcStream = net.connect({ port: sPort });
  svcStream.on('data', d => {
    console.log(pb.handleMessage(d));
    //var msg = pbEnvelope.decode(d);
  });

  var agtStream = net.connect({ port: aPort });
  agtStream.on('data', d => {
    console.log(pb.handleMessage(d));
    //var msg = pbEnvelope.decode(d);
  });

  /*
  //other option is, but it's slow:
  adb shell input keyevent nnn
  adb shell input text \"text\\\" asdf\'... \"
  
  https://github.com/openstf/STFService.apk
  https://github.com/openstf/STFService.apk/blob/master/app/src/main/proto/wire.proto
  https://www.npmjs.com/package/protobufjs#using-proto-files

  // register service to be uninstalled on process end/SIGTERM
  adb uninstall jp.co.cyberagent.stf
  */

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
