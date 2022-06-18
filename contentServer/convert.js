
const path = require('path')
const fs = require('fs')
const {PassThrough} = require('stream')
const {repackedCache} = require('../utilities/env.js')
const {execCmd} = require('../utilities/exec.js')

async function convertImage(imagePath, unsupportedFormat) {
  let isOpaque
  let unsupportedExt = path.extname(unsupportedFormat)
  let pk3File = imagePath.replace(/\.pk3.*/gi, '.pk3')
  if(imagePath.endsWith('.pk3')) {
    let passThrough = new PassThrough()
    isOpaque = (await Promise.all([
      streamFileKey(pk3File, unsupportedFormat, passThrough),
      execCmd(`identify -format '%[opaque]' ${unsupportedExt.substring(1)}:-`, passThrough)
    ]))[1]
  } else {
    isOpaque = await execCmd(`identify -format '%[opaque]' "${imagePath}"`)
  }
  if(typeof isOpaque != 'string') {
    isOpaque = 'False'
  }
  if(unsupportedFormat.match(/\/.png$/i)
    || unsupportedFormat.match(/levelshots\//i)) {
    isOpaque = 'True'
  }

  let newFile = unsupportedFormat.replace(unsupportedExt, 
    isOpaque.match(/true/ig) ? '.jpg' : '.png')
  let newPath
  if(imagePath.includes('.pk3')) {
    newPath = path.join(repackedCache(), path.basename(pk3File) + 'dir', newFile)
  } else {
    newPath = path.join(repackedCache(), newFile)
  }
  if(!fs.existsSync(newPath)) {
    console.log('Converting: ', newPath)
    //console.assert(newFile.localeCompare(
    //  request, 'en', { sensitivity: 'base' }) == 0)
    fs.mkdirSync(path.dirname(newPath), { recursive: true })
    if(imagePath.endsWith('.pk3')) {
      let passThrough = new PassThrough()
      streamFileKey(pk3File, unsupportedFormat, passThrough)
      await execCmd(`convert -strip -interlace Plane \
          -sampling-factor 4:2:0 -quality 20% -auto-orient \
          ${unsupportedFormat.substring(1)}:- "${newPath}"`, passThrough)
    } else {
      await execCmd(`convert -strip -interlace Plane -sampling-factor 4:2:0 \
      -quality 20% -auto-orient ${isOpaque ? ' -colorspace RGB ' : ''} \
      "${imagePath}" "${newPath}"`)
    }
    // don't wait for anything
  }
  return newPath
}

module.exports = {
  convertImage,
}
