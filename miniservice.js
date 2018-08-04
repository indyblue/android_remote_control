const { exec, execSync, bindir } = require('./mini0'),
  ptool = require('path'),
  fs = require('fs'),
  https = require('https'),
  net = require('net');

function fnServiceStuff() {
  // install service and set it up for keyboard usage
  /*
  //other option is, but it's slow:
  adb shell input keyevent nnn
  adb shell input text \"text\\\" asdf\'... \"
  
  
  https://github.com/openstf/STFService.apk
  https://github.com/openstf/STFService.apk/blob/master/app/src/main/proto/wire.proto
  https://www.npmjs.com/package/protobufjs#using-proto-files
  
  adb install STFService.apk 
  
  adb shell am startservice --user 0 \
      -a jp.co.cyberagent.stf.ACTION_START \
      -n jp.co.cyberagent.stf/.Service
  
  adb forward tcp:1100 localabstract:stfservice
  
  // this can be used also to see if apk has been installed
  adb shell pm path jp.co.cyberagent.stf
  
  
  adb shell export CLASSPATH="/data/app/jp.co.cyberagent.stf-1/base.apk"\; \
      exec app_process /system/bin jp.co.cyberagent.stf.Agent
  
  // register service to be uninstalled on process end/SIGTERM
  adb uninstall jp.co.cyberagent.stf
  
  */


}


/**************************************************************************** */
// STFService.apk - download and install
/**************************************************************************** */
const fname = './STFService.apk';
if (!fs.existsSync(fname)) {
  const url = 'https://github.com/openstf/stf/raw/master/vendor/STFService/STFService.apk';
  console.log('getting from github: ', fname);
  fetchFile(url, fname, fnServiceStuff);
}

function fetchFile(url, fname, cbdone) {
  https.get(url, (res) => {
    if (res.statusCode === 302) return fetchFile(res.headers.location, fname);
    else if (res.statusCode === 200 && res.headers['content-type'] === "application/octet-stream") {
      let fstream = fs.createWriteStream(fname);
      res.pipe(fstream);
      res.on('end', () => {
        console.log('complete: ', fname);
        if (typeof cbdone === 'function') cbdone();
      });
    } else {
      var out = '';
      res.on('data', d => out += d.toString());
      res.on('end', () => {
        console.log('problem getting file', fname, out);
      });
    }
  });
}
