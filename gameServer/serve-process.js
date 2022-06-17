
const path = require('path')
const {DED_NAME, FS_BASEPATH, FS_GAMEHOME} = require('../utilities/env.js')
const {findFile} = require('../contentServer/virtual.js')
const RESOLVE_DEDICATED = []

function execDed(dedicated, mapname) {
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


async function serveDedicated(mapname) {
  let dedicated = findFile(DED_NAME)
  if(!dedicated) {
    throw new Error(DED_NAME + ' not found, build first')
  }
  return await new Promise(function (resolve, reject) {
    let cancelTimer = setTimeout(function () {
      reject(new Error('Start server timed out.'))
    }, 3000)
    try {
      if(RESOLVE_DEDICATED.length == 0) {
        console.log('Starting ', dedicated)
        execDed(dedicated, mapname)
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


async function serveProcess() {
  // show basic process runner like Github Actions
  
}


module.exports = {
  RESOLVE_DEDICATED,
  serveDedicated,
}
