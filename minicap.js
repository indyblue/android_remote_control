const { exec, execSync, bindir, libdir } = require('./mini0'),
  ptool = require('path'),
  net = require('net');

const exp = module.exports = {
  port: 1717,
  adir: '/data/local/tmp/minicap',
  webSockets: [],
  debug: false
};
/**************************************************************************** */
// child process stuff
/**************************************************************************** */
let out = execSync(`adb shell rm -rf ${exp.adir}`);
out = execSync(`adb shell mkdir ${exp.adir}`);

const [w, h] = execSync(`sh -c "adb shell dumpsys window | grep -Eo 'init=[0-9]+x[0-9]+'"`).match(/\d+/g)

const bdir = 'node_modules/minicap-prebuilt/prebuilt';

let dir = bindir(bdir);
out = execSync(`adb push ${dir}/minicap ${exp.adir}/`);

dir = libdir(bdir);
out = execSync(`adb push ${dir}/minicap.so ${exp.adir}/`);

out = execSync(`adb forward tcp:${exp.port} localabstract:minicap`);

let w2 = Math.round(w / 2), h2 = Math.round(h / 2);
let args = `-P ${w}x${h}@${w2}x${h2}/0 -S`;

const cpMinicap = exec(`adb shell LD_LIBRARY_PATH=${exp.adir}/ ${exp.adir}/minicap ${args}`);
cpMinicap.stdout.on('data', d => {
  setTimeout(() => {
    if (!cstrMinicap.active) cstrMinicap();
  }, 100);
});

/**************************************************************************** */
// stream stuff
/**************************************************************************** */
function cstrMinicap() {
  cstrMinicap.active = true;
  var stream = net.connect({
    port: exp.port
  });

  stream.on('error', function () {
    console.error('Be sure to run `adb forward tcp:1717 localabstract:minicap`')
    process.exit(1)
  });

  let readBannerBytes = 0,
    bannerLength = 2,
    readFrameBytes = 0,
    frameBodyLength = 0,
    frameBody = new Buffer(0),
    banner = {
      version: 0
      , length: 0
      , pid: 0
      , realWidth: 0
      , realHeight: 0
      , virtualWidth: 0
      , virtualHeight: 0
      , orientation: 0
      , quirks: 0
    };

  stream.on('readable', tryRead)

  function tryRead() {
    for (var chunk; (chunk = stream.read());) {
      if (exp.debug) console.info('chunk(length=%d)', chunk.length);
      for (var cursor = 0, len = chunk.length; cursor < len;) {
        if (readBannerBytes < bannerLength) {
          switch (readBannerBytes) {
            case 0:
              // version
              banner.version = chunk[cursor]
              break
            case 1:
              // length
              banner.length = bannerLength = chunk[cursor]
              break
            case 2:
            case 3:
            case 4:
            case 5:
              // pid
              banner.pid +=
                (chunk[cursor] << ((readBannerBytes - 2) * 8)) >>> 0
              break
            case 6:
            case 7:
            case 8:
            case 9:
              // real width
              banner.realWidth +=
                (chunk[cursor] << ((readBannerBytes - 6) * 8)) >>> 0
              break
            case 10:
            case 11:
            case 12:
            case 13:
              // real height
              banner.realHeight +=
                (chunk[cursor] << ((readBannerBytes - 10) * 8)) >>> 0
              break
            case 14:
            case 15:
            case 16:
            case 17:
              // virtual width
              banner.virtualWidth +=
                (chunk[cursor] << ((readBannerBytes - 14) * 8)) >>> 0
              break
            case 18:
            case 19:
            case 20:
            case 21:
              // virtual height
              banner.virtualHeight +=
                (chunk[cursor] << ((readBannerBytes - 18) * 8)) >>> 0
              break
            case 22:
              // orientation
              banner.orientation += chunk[cursor] * 90
              break
            case 23:
              // quirks
              banner.quirks = chunk[cursor]
              break
          }

          cursor += 1
          readBannerBytes += 1

          if (readBannerBytes === bannerLength) {
            if (exp.debug) console.log('banner', banner)
          }
        }
        else if (readFrameBytes < 4) {
          frameBodyLength += (chunk[cursor] << (readFrameBytes * 8)) >>> 0
          cursor += 1
          readFrameBytes += 1
          if (exp.debug) console.info('headerbyte%d(val=%d)', readFrameBytes, frameBodyLength)
        }
        else {
          if (len - cursor >= frameBodyLength) {
            if (exp.debug) console.info('bodyfin(len=%d,cursor=%d)', frameBodyLength, cursor)

            frameBody = Buffer.concat([
              frameBody
              , chunk.slice(cursor, cursor + frameBodyLength)
            ])

            // Sanity check for JPG header, only here for debugging purposes.
            if (frameBody[0] !== 0xFF || frameBody[1] !== 0xD8) {
              console.error(
                'Frame body does not start with JPG header', frameBody)
              process.exit(1)
            }

            for (let ws of exp.webSockets) ws.send(frameBody, {
              binary: true
            })

            cursor += frameBodyLength
            frameBodyLength = readFrameBytes = 0
            frameBody = new Buffer(0)
          }
          else {
            if (exp.debug) console.info('body(len=%d)', len - cursor)

            frameBody = Buffer.concat([
              frameBody
              , chunk.slice(cursor, len)
            ])

            frameBodyLength -= len - cursor
            readFrameBytes += len - cursor
            cursor = len
          }
        }
      }
    }
  }
}

/**************************************************************************** */

