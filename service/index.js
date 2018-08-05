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
      type = (obj.messageName.valuesById[env.type] || '').replace(/_$/, req),
      message = '',
      ltType = lt(type);

    if (type) {
      message = ltType.decode(env.message);
      message = ltType.toObject(message);
      message = JSON.stringify(message);
    }

    return { type, message };
  };

  obj.doKey = (code, [s, c, a, m, cl], isDown = true) => {
    if (typeof code === 'string') code = code.toUpperCase().charCodeAt(0);
    var kt = le('KeyEvent').values;
    var ker = lt('KeyEventRequest');
    var event = {
      event: isDown ? kt.DOWN : kt.UP,
      keyCode: keycodes.mapToAndroid(code),
      shiftKey: s == 1, ctrlKey: c == 1, altKey: a == 1, metaKey: m == 1,
      capsLockKey: cl == 1
    };
    var data = ker.encode(event).finish();
    var env = obj.envelope.encodeDelimited({
      id: Date.now(),
      type: obj.messageName.values['KeyEvent_'],
      message: data
    }).finish();
    return env;
  };

  return obj;
}

