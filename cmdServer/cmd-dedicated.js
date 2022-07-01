
function dedicatedCmd(dedicated, mapname) {
  const {execFile} = require('child_process')
  let ps = execFile(dedicated, [
    '+set', 'fs_basepath', FS_BASEPATH,
    '+set', 'fs_homepath', FS_GAMEHOME,
    '+set', 'dedicated', '2',
    '+set', 'bot_enable', '0',
    '+set', 'developer', '1',
    '+set', 'sv_master1', '"127.0.0.1:27950"',
    '+set', 'sv_master2', '"207.246.91.235:27950"',
    '+set', 'sv_master3', '"ws://master.quakejs.com:27950"',

    '+map', mapname, 
    '+wait', '+heartbeat'
  ])
  ps.stderr.on('data', console.error);
  ps.stdout.on('data', console.log);
}

module.exports = {
  dedicatedCmd
}