

const path = require('path')
const { PassThrough } = require('stream')

const { START_SERVICES } = require('../contentServer/features.js')
const { execCmd } = require('../utilities/exec.js')
const { streamFileKey, streamFile } = require('../utilities/zip.js')

const CONVERTED_IMAGES = {}

async function convertCmd(imagePath, unsupportedFormat, quality, outFile, supportedExt) {

  let unsupportedExt = path.extname(unsupportedFormat)
  if (typeof imagePath == 'object' || imagePath.match(/\.pk3$/i)) {
    console.log('Converting: ', unsupportedFormat)
    let passThrough = new PassThrough()
    if(typeof imagePath == 'object') {
      streamFile(imagePath, passThrough)
    } else {
      streamFileKey(imagePath, unsupportedFormat, passThrough)
    }
    return await execCmd('convert', ['-strip', '-interlace',
      'Plane', '-sampling-factor', '4:2:0', '-quality',
      quality ? quality : '20%', '-auto-orient',
      unsupportedExt.substring(1) + ':-', 
      typeof outFile == 'string' ? outFile : (supportedExt.substring(1) + ':-')
    ], {
      once: path.join(typeof imagePath == 'object' 
        ? imagePath.file : imagePath, unsupportedFormat),
      write: typeof outFile == 'string' ? void 0 : outFile,
      pipe: passThrough,
      later: !START_SERVICES.includes('all')
          && !START_SERVICES.includes('convert')
    })
  } else {
    console.log('Converting: ', imagePath)
    return await execCmd('convert', ['-strip', '-interlace',
      'Plane', '-sampling-factor', '4:2:0', '-quality',
      quality ? quality : '20%', '-auto-orient', imagePath, 
      typeof outFile == 'string' ? outFile : (supportedExt.substring(1) + ':-')
    ], {
      once: imagePath,
      write: typeof outFile == 'string' ? void 0 : outFile,
      later: !START_SERVICES.includes('all')
          && !START_SERVICES.includes('convert')
    })
    // ${isOpaque ? ' -colorspace RGB ' : ''} 
  }
  // TODO: don't wait for anything?
}


module.exports = {
  CONVERTED_IMAGES,
  convertCmd,
}
