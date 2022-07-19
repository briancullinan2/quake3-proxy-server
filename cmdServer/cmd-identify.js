

const path = require('path')
const { PassThrough } = require('stream')

const { execCmd } = require('../utilities/exec.js')
const { fileKey, streamFile } = require('../utilities/zip.js')


async function opaqueCmd(imagePath, unsupportedFormat) {
  let isOpaque

  let unsupportedExt = path.extname(unsupportedFormat)
  if (typeof imagePath == 'object' || imagePath.match(/\.pk3$/i)) {
    let file = typeof imagePath == 'object' 
        ? imagePath : await fileKey(imagePath, unsupportedFormat)
    if (file) {
      let passThrough = new PassThrough()
      isOpaque = (await Promise.all([
        streamFile(file, passThrough),
        execCmd('identify', ['-format', '\'%[opaque]\'',
          unsupportedExt.substring(1) + ':-'], { 
            pipe: passThrough,
            once: path.join(file.file, unsupportedFormat),
          })
      ]))[1]
    } else {
      throw new Error('File not found: ' + unsupportedFormat)
    }
  } else {
    isOpaque = await execCmd('identify', ['-format', '\'%[opaque]\'', imagePath], {
      once: imagePath,
    })
  }
  if (typeof isOpaque != 'string') {
    isOpaque = 'False'
  }
  if (unsupportedFormat.match(/\/.png$/i)
    || unsupportedFormat.match(/levelshots\//i)) {
    isOpaque = 'True'
  }

  // TODO: template?
  return !!isOpaque.match(/true/ig)
}

module.exports = {
  opaqueCmd
}
