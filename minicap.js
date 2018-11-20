'option strict';
const { execSocket, execSync, bindir, libdir, fwdAbs, info } = require('./mini0'),
  ptool = require('path'),
  net = require('net');

const name = 'minicap';
const exp = module.exports = {
  port: 1717,
  adir: '/data/local/tmp/' + name,
  webSockets: [],
  debug: false,
  superDebug: false
};
/**************************************************************************** */
// child process stuff
/**************************************************************************** */
exp.onExit = () => {
  execSync(`adb shell -x killall ${name}`);
  execSync(`adb shell rm -rf ${exp.adir}`);
  execSync(`adb shell -x ls ${exp.adir}`);
};
exp.onExit();

let out = execSync(`adb shell mkdir ${exp.adir}`);

const bdir = 'node_modules/minicap-prebuilt/prebuilt';

let dir = bindir(bdir);
out = execSync(`adb push ${dir}/${name} ${exp.adir}/`);

dir = libdir(bdir);
out = execSync(`adb push ${dir}/${name}.so ${exp.adir}/`);

out = execSync(`adb shell -x chmod +x ${exp.adir}/${name}`);

let w = info.w, h = info.h, w2 = Math.round(w / 2), h2 = Math.round(h / 2);
let args = `-P ${w}x${h}@${w2}x${h2}/0 -S`;

const cpMinicap = execSocket(`adb shell -x LD_LIBRARY_PATH=${exp.adir}/ ${exp.adir}/${name} ${args}`,
  exp.port, name, cbData);


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

let lastFrame = null;
exp.sendLastFrame = ws => {
  if (lastFrame) {
    console.log('sending initial frame', lastFrame.length);
    ws.send(lastFrame, { binary: true });
  }
};

function cbData(chunk) {
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
      if (exp.superDebug) console.info('headerbyte%d(val=%d)', readFrameBytes, frameBodyLength)
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

        lastFrame = frameBody;
        for (let ws of exp.webSockets) ws.send(frameBody, {
          binary: true
        })

        cursor += frameBodyLength
        frameBodyLength = readFrameBytes = 0
        frameBody = new Buffer(0)
      }
      else {
        if (exp.superDebug) console.info('body(len=%d)', len - cursor)

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
