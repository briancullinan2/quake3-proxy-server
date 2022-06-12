
const {EXE_NAME} = require('../utilities/env.js')
const {findFile} = require('../contentServer/content.js')
const RESOLVE_DEDICATED = []

function execDed(dedicated) {
  const {execFile} = require('child_process')
  let ps = execFile(dedicated, [
    '+set', 'fs_basepath', GAME_DIRECTORY,
    '+set', 'dedicated', '2',
    '+set', 'bot_enable', '0',
    '+set', 'developer', '1',
    '+set', 'sv_master1', '"127.0.0.1:27950"',
    '+set', 'sv_master2', '"207.246.91.235:27950"',
    '+set', 'sv_master3', '"ws://master.quakejs.com:27950"',

    '+map', 'lsdm3_v1', '+wait', '+heartbeat'
  ])
  ps.stderr.on('data', console.error);
  ps.stdout.on('data', console.log);
}


async function serveDedicated() {
  let dedicated = findFile(EXE_NAME)
  if(!dedicated) {
    throw new Error(EXE_NAME + ' not found, build first')
  }
  return await new Promise(function (resolve, reject) {
    let cancelTimer = setTimeout(function () {
      reject(new Error('Start server timed out.'))
    }, 3000)
    try {
      if(RESOLVE_DEDICATED.length == 0) {
        console.log('Starting ', dedicated)
        execDed()
      }
      RESOLVE_DEDICATED.push(function () {
        clearTimeout(cancelTimer)
        console.log('Dedicated started.')
        resolve()
      })
    } catch (e) {
      console.log(e)
      clearTimeout(cancelTimer)
      return reject(e)
    }
  })
}

module.exports = {
  RESOLVE_DEDICATED,
  serveDedicated,
}
