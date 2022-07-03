

const path = require('path')
const { PassThrough } = require('stream')

const { execCmd } = require('../utilities/exec.js')
const { streamFile } = require('../utilities/zip.js')


const CURRENTLY_IDENTIFYING = {}


async function opaqueCmd(imagePath, unsupportedFormat) {
  let isOpaque

  if(typeof CURRENTLY_IDENTIFYING[imagePath] != 'undefined'
    && CURRENTLY_IDENTIFYING[imagePath].length > 0) {
    await new Promise(resolve => {
      CURRENTLY_IDENTIFYING[imagePath].push(resolve)
    })
  }
  CURRENTLY_IDENTIFYING[imagePath] = ['placeholder']

  let unsupportedExt = path.extname(unsupportedFormat)
  if (imagePath.match(/\.pk3$/i)) {
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
  return await new Promise(resolve => {
    let result = isOpaque.match(/true/ig)
    resolve(result)
    for(let i = 1; i < CURRENTLY_IDENTIFYING[imagePath].length; ++i) {
      CURRENTLY_IDENTIFYING[imagePath](result)
    }
    CURRENTLY_IDENTIFYING[imagePath].splice(0)
  })
}

module.exports = {
  opaqueCmd
}
