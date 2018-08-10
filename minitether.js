'option strict';
const { exec, execSync, fetchFile, fetchVersion } = require('./mini0'),
  name = 'gnirehtet',
  v = 'v2.2.1',
  baseUrl = 'https://github.com/Genymobile/gnirehtet/releases',
  vUrl = `${baseUrl}/latest`,
  url = v => `${baseUrl}/download/${v}/gnirehtet-rust-linux64-${v}.zip`,
  exp = module.exports = {};

async function main() {
  //var cv = await fetchVersion(vUrl, defv);
  var zipname = `${name}-${v}.zip`;
  var file = await fetchFile(url(v), zipname);
  execSync(`unzip -ojd ${name} ${zipname}`);

  exp.onExit = () => {
    console.log('stopping reverse tether:');
    execSync(`./${name} stop`, `./${name}/`);
    try {
      execSync(`killall -qs SIGKILL gnirehtet`);
    } catch (e) { }
    if (process.argv.indexOf('-u') > 0)
      execSync(`./${name} uninstall`, `./${name}/`);
  };
  exp.onExit();

  let proc = exec(`./${name} run`, name, `./${name}/`);
}
main();

function fnServiceStuff() {
};