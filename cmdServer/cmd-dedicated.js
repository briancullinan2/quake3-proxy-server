const { PassThrough, Readable } = require('stream')

const { EXE_NAME, DED_NAME } = require('../utilities/env.js')
const { findFile } = require('../assetServer/virtual.js')
const { execCmd } = require('../utilities/exec.js')
const { FS_GAMEHOME, FS_BASEPATH } = require('../utilities/env.js')
const { MASTER_PORTS } = require('../gameServer/master.js')



async function dedicatedCmd(startArgs, callback) {

  let dedicated = findFile(EXE_NAME)
  if (!dedicated) {
    dedicated = findFile(DED_NAME)
  }
  if (!dedicated) {
    throw new Error(DED_NAME + ' not found, build first')
  }

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
    '+set', 'sv_pure', '1', 
    '+set', 'developer', '1',
    '+set', 'sv_master1', `"127.0.0.1:${MASTER_PORTS[0]}"`,
    '+set', 'fs_excludeReference', 'baseq3/pak8a demoq3/pak8a',
    '+set', 'sv_allowDownload', '5', // NO UDP DOWNLOAD
  ].concat(startArgs), {
    background: true,
    write: passThrough,
    error: passThrough,
  })

  return ps
}


module.exports = {
  dedicatedCmd
}