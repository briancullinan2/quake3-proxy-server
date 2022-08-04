

const path = require('path')
const { PassThrough } = require('stream')

const { execCmd } = require('../utilities/exec.js')
const { fileKey, streamKey } = require('../utilities/zip.js')


async function opaqueCmd(imagePath, unsupportedFormat, wait) {
  let isOpaque

  if (typeof imagePath == 'object' || imagePath.match(/\.pk3$/i)) {
    let file = typeof imagePath == 'object' 
        ? imagePath : await fileKey(imagePath, unsupportedFormat)
    if (file) {
      isOpaque = await execCmd('identify', ['-format', '\'%[opaque]\'',
      path.extname(file.name).substring(1) + ':-'], { 
          shell: true,
          wait: wait,
          pipe: await streamKey(file, null),
          once: path.join(file.file, unsupportedFormat),
        })
    } else {
      throw new Error('File not found: ' + unsupportedFormat)
    }
  } else {
    isOpaque = await execCmd('identify', ['-format', '\'%[opaque]\'', imagePath], {
      shell: true,
      wait: wait,
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
