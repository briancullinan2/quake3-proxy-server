

const path = require('path')
const { PassThrough } = require('stream')

const { execCmd } = require('../utilities/exec.js')
const { streamFile } = require('../utilities/zip.js')

async function opaqueCmd(imagePath, unsupportedFormat) {
  let isOpaque
  let unsupportedExt = path.extname(unsupportedFormat)
  if (imagePath.endsWith('.pk3')) {
    let file = await fileKey(imagePath, unsupportedFormat)
    if (file) {
      let passThrough = new PassThrough()
      isOpaque = (await Promise.all([
        streamFile(file, passThrough),
        execCmd('identify', ['-format', '\'%[opaque]\'',
          unsupportedExt.substring(1) + ':-'], { pipe: passThrough })
      ]))[1]
    } else {
      throw new Error('File not found: ' + unsupportedFormat)
    }
  } else {
    isOpaque = await execCmd('identify', ['-format', '\'%[opaque]\'', imagePath])
  }
  if (typeof isOpaque != 'string') {
    isOpaque = 'False'
  }
  if (unsupportedFormat.match(/\/.png$/i)
    || unsupportedFormat.match(/levelshots\//i)) {
    isOpaque = 'True'
  }
  return isOpaque.match(/true/ig)
}

module.exports = {
  opaqueCmd
}
