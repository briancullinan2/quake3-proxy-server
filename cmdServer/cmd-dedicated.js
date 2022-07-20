const { PassThrough, Readable } = require('stream')

const { EXE_NAME, DED_NAME } = require('../utilities/env.js')
const { findFile } = require('../assetServer/virtual.js')
const { execCmd } = require('../utilities/exec.js')
const { FS_GAMEHOME, FS_BASEPATH } = require('../utilities/env.js')


const EXECUTING_MAPS = {}
const RESOLVE_DEDICATED = []
const SERVER_STARTTIME = 5000

async function dedicatedCmd(startArgs, callback) {

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
    const passThrough = new PassThrough()
    const readable = Readable.from(passThrough)
    readable.on('data', function (data) {
      let lines = Array.from(data).map(c => String.fromCharCode(c)).join('').trim()
      //console.log('ENGINE: ', lines)
      if(callback) {
        callback(lines)
      }
    })
    console.log('Starting ', dedicated)
    ps = await execCmd(dedicated, [
      '+set', 'fs_basepath', FS_BASEPATH,
      '+set', 'fs_homepath', FS_GAMEHOME,
      '+set', 'r_headless', '1',
      '+set', 'bot_enable', '0',
      // TODO: fix and remove this
      '+set', 'sv_pure', '0', 
      '+set', 'developer', '1',
      '+set', 'sv_master1', '"127.0.0.1:27950"',
      '+set', 'fs_excludeReference', 'baseq3/pak8a.pk3',
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
      background: true,
      write: passThrough,
      error: passThrough,
    })

    RESOLVE_DEDICATED.push(function () {
      clearTimeout(cancelTimer)
      console.log('Dedicated started.')
      resolve(ps)
    })
  })
}


module.exports = {
  EXECUTING_MAPS,
  RESOLVE_DEDICATED,
  dedicatedCmd
}