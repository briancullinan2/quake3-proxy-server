

const path = require('path')
const { PassThrough } = require('stream')

const { execCmd } = require('../utilities/exec.js')
const { streamFileKey } = require('../utilities/zip.js')

async function convertCmd(imagePath, unsupportedFormat, quality, outFile) {
  let unsupportedExt = path.extname(unsupportedFormat)
  if (imagePath.endsWith('.pk3')) {
    console.log('Converting: ', imagePath, unsupportedFormat)
    let passThrough = new PassThrough()
    streamFileKey(imagePath, unsupportedFormat, passThrough)
    await execCmd('convert', ['-strip', '-interlace',
      'Plane', '-sampling-factor', '4:2:0', '-quality',
      quality ? quality : '20%', '-auto-orient',
      unsupportedExt.substring(1) + ':-', outFile], { pipe: passThrough })
  } else {
    console.log('Converting: ', imagePath)
    await execCmd('convert', ['-strip', '-interlace',
      'Plane', '-sampling-factor', '4:2:0', '-quality',
      quality ? quality : '20%', '-auto-orient', imagePath, outFile])
    // ${isOpaque ? ' -colorspace RGB ' : ''} 
  }
  // TODO: don't wait for anything?
  return outFile
}


module.exports = {
  convertCmd,
}
