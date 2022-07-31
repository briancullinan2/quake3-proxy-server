

const path = require('path')
const { PassThrough } = require('stream')

const { START_SERVICES } = require('../contentServer/features.js')
const { execCmd } = require('../utilities/exec.js')
const { streamFileKey, streamKey } = require('../utilities/zip.js')

const CONVERTED_IMAGES = {}

async function convertCmd(imagePath, unsupportedFormat, quality, outFile, supportedExt, wait) {

  let unsupportedExt = path.extname(unsupportedFormat)
  if (typeof imagePath == 'object' || imagePath.match(/\.pk3$/i)) {
    if(START_SERVICES.includes('debug')) {
      console.log('Converting: ', unsupportedFormat)
    }
    let passThrough = new PassThrough()
    if(typeof imagePath == 'object') {
      unsupportedExt = path.extname(imagePath.name)
      streamKey(imagePath, passThrough)
    } else {
      streamFileKey(imagePath, unsupportedFormat, passThrough)
    }
    return await execCmd('convert', ['-strip', '-interlace',
      'Plane', '-sampling-factor', '4:2:0', '-quality',
      quality ? quality : '20%',
      unsupportedExt.substring(1) + ':-', 
      typeof outFile == 'string' ? outFile : (supportedExt.substring(1) + ':-')
    ], {
      shell: true,
      once: path.join(typeof imagePath == 'object' 
        ? imagePath.file : imagePath, unsupportedFormat),
      write: typeof outFile == 'string' ? void 0 : outFile,
      pipe: passThrough,
      later: !START_SERVICES.includes('all')
          && !START_SERVICES.includes('convert'),
      wait: wait,
    })
  } else {
    if(START_SERVICES.includes('debug')) {
      console.log('Converting: ', imagePath)
    }
    return await execCmd('convert', ['-strip', '-interlace',
      'Plane', '-sampling-factor', '4:2:0', '-quality',
      quality ? quality : '20%',  '"' + imagePath + '"', 
      typeof outFile == 'string' ? outFile : (supportedExt.substring(1) + ':-')
    ], {
      shell: true,
      wait: wait,
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
