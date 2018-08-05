const protobuf = require("protobufjs"),
  keycodes = require('./keycodes-service'),
  ptool = require('path');

const exp = module.exports = {};

exp.load = async () => {
  var root = await protobuf.load(ptool.join(__dirname, './wire.proto'));
  var obj = { root, package: 'jp.co.cyberagent.stf.proto' };
  var lt = n => obj.root.lookupType(obj.package + '.' + n);
  var le = n => obj.root.lookupEnum(obj.package + '.' + n);
  obj.envelope = lt("Envelope");
  obj.messageName = le("MessageName");
  obj.handleMessage = (m, isReq) => {
    var req = isReq ? 'Request' : 'Response',
      env = obj.envelope.decodeDelimited(m),
      id = env.id,
      type = (obj.messageName.valuesById[env.type] || '').replace(/_$/, req),
      message = '',
      ltType = lt(type);

    if (type) {
      message = ltType.decode(env.message);
      message = ltType.toObject(message);
      //message = JSON.stringify(message);
    }

    return { id, type, message };
  };

  var tKey = le('KeyEvent').values;
  obj.doKey = (code, [s, c, a, m, cl], isDown = true) => {
    if (typeof code === 'string') code = code.toUpperCase().charCodeAt(0);
    var event = {
      event: isDown ? tKey.DOWN : tKey.UP,
      keyCode: keycodes.mapToAndroid(code),
      shiftKey: s == 1, ctrlKey: c == 1, altKey: a == 1, metaKey: m == 1,
      capsLockKey: cl == 1
    };
    return encType('KeyEventRequest', event);
  };
  obj.doPower = () => {
    var event = { event: tKey.PRESS, keyCode: 26 };
    return encType('KeyEventRequest', event);
  };

  var tClip = le('ClipboardType').values;
  obj.setClip = (id, text) => {
    return encType('SetClipboardRequest', {
      type: tClip.TEXT,
      text: text
    }, id);
  };
  obj.getClip = (id) => {
    return encType('GetClipboardRequest', { type: tClip.TEXT }, id);
  };

  function encType(type, oType, id) {
    let pbType = lt(type);
    let verify = pbType.verify(oType);
    if (verify) return console.log('protobuf', type, 'validation error', verify);
    let message = pbType.encode(oType).finish();
    return encEnvelope(type, message, id);
  }

  function encEnvelope(type, message, id) {
    if (typeof type === 'string') {
      let type2 = type.replace(/Request|Response/, '_');
      let type3 = obj.messageName.values[type2];
      if (typeof type3 === 'number') type = type3;
      else return console.log('envelope type invalid', type, type2, type3);
    }
    var oEnv = { id, message, type };
    var verify = obj.envelope.verify(oEnv);
    if (verify) return console.log('envelope validation error', verify);
    return obj.envelope.encodeDelimited(oEnv).finish();
  }

  return obj;
}

