
const { EXE_NAME, DED_NAME } = require('../utilities/env.js')
const { findFile } = require('../assetServer/virtual.js')
const { execCmd } = require('../utilities/exec.js')
const { FS_GAMEHOME, FS_BASEPATH } = require('../utilities/env.js')

const RESOLVE_DEDICATED = []
const SERVER_STARTTIME = 5000

async function dedicatedCmd(startArgs) {

  let dedicated = findFile(EXE_NAME)
  if (!dedicated) {
    dedicated = findFile(DED_NAME)
  }
  if (!dedicated) {
    throw new Error(DED_NAME + ' not found, build first')
  }

  return await new Promise(async function (resolve, reject) {
    let logs
    let cancelTimer = setTimeout(function () {
      reject(new Error('Start server timed out.', logs))
    }, SERVER_STARTTIME)
    console.log('Starting ', dedicated)
    logs = await execCmd(dedicated, [
      '+set', 'fs_basepath', FS_BASEPATH,
      '+set', 'fs_homepath', FS_GAMEHOME,
      '+set', 'r_headless', '1',
      '+set', 'bot_enable', '0',
      '+set', 'developer', '0',
      '+set', 'sv_master1', '"127.0.0.1:27950"',

      // TODO: turn this into some sort of temporary cfg script



      /*
      '+set', 'lvlshotCommands', `"${newVstr}"`,
      '+exec', `".config/levelinfo_${mapname}.cfg"`,
      '+vstr', 'resetLvlshot',
      '+devmap', mapname,
      '+heartbeat',
      '+vstr', 'lvlshotCommands',
      '+wait', '200', '+quit'
      */


    ].concat(startArgs), {
      detached: true,
    })

    RESOLVE_DEDICATED.push(function () {
      clearTimeout(cancelTimer)
      console.log('Dedicated started.')
      resolve(logs)
    })
  })
}


module.exports = {
  RESOLVE_DEDICATED,
  dedicatedCmd
}