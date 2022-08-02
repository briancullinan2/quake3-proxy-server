const { PassThrough, Readable } = require('stream')

const { EXE_NAME, DED_NAME, getGame } = require('../utilities/env.js')
const { findFile } = require('../assetServer/virtual.js')
const { execCmd } = require('../utilities/exec.js')
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
    console.log('ENGINE: ', lines)
    if(callback) {
      callback(lines)
    }
  })
  console.log('Starting ', dedicated)
  ps = await execCmd(dedicated, [
    // Ironically, the thing I learned working for the radio station about
    //   M$ Windows not being able to run without a video card for remote
    //   desktop, but Xvfb working fine with remote desktop, has suddenly
    //   become relevant, and now I understand why.
    // https://stackoverflow.com/questions/12482166/creating-opengl-context-without-window
    '+set', 'bot_enable', '0',
    '+set', 'logfile', '4',
    // TODO: fix and remove this
    '+set', 'fs_excludeReference', 'baseq3/pak8a demoq3/pak8a',
    '+set', 'sv_allowDownload', '5', // NO UDP DOWNLOAD
  ].concat(startArgs), {
    //shell: true,
    detached: true,
    background: true,
    write: passThrough,
    error: passThrough,
  })
  ps.on('close', function () {
    console.log('Stopping server')
  })
  ps.unref()
  return ps
}


module.exports = {
  dedicatedCmd
}