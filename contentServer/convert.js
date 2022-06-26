
const path = require('path')
const fs = require('fs')
const {PassThrough} = require('stream')
const {repackedCache} = require('../utilities/env.js')
const {execCmd} = require('../utilities/exec.js')
const { fileKey, streamFile, streamFileKey } = require('../utilities/zip.js')

const CURRENTLY_CONVERTING = {}





async function convertImage(imagePath, unsupportedFormat, quality) {
  // TODO: only convert the same output image once at a time not to clobber
  




  let isOpaque
  let unsupportedExt = path.extname(unsupportedFormat)
  let pk3File = imagePath.replace(/\.pk3.*/gi, '.pk3')
  if(imagePath.endsWith('.pk3')) {
    let file = await fileKey(imagePath, unsupportedFormat)
    if(file) {
      let passThrough = new PassThrough()
      isOpaque = (await Promise.all([
        streamFile(file, passThrough),
        execCmd('identify', ['-format', '\'%[opaque]\'', 
            unsupportedExt.substring(1) + ':-'], {pipe: passThrough})
      ]))[1]
    } else {
      throw new Error('File not found: ' + unsupportedFormat)
    }
  } else {
    isOpaque = await execCmd('identify', ['-format', '\'%[opaque]\'', imagePath])
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
  if(fs.existsSync(newPath)) {
    //console.log('Skipping: ', newPath)
    return newPath
  }
  fs.mkdirSync(path.dirname(newPath), { recursive: true })
  if(imagePath.endsWith('.pk3')) {
    console.log('Converting: ', imagePath, unsupportedFormat)
    let passThrough = new PassThrough()
    streamFileKey(pk3File, unsupportedFormat, passThrough)
    await execCmd('convert', ['-strip', '-interlace', 
        'Plane', '-sampling-factor', '4:2:0', '-quality', 
        quality ? quality : '20%', '-auto-orient', 
        unsupportedExt.substring(1) + ':-', newPath], {pipe: passThrough})
  } else {
    console.log('Converting: ', imagePath)
    await execCmd('convert', ['-strip', '-interlace',
        'Plane', '-sampling-factor', '4:2:0', '-quality', 
        quality ? quality : '20%', '-auto-orient', imagePath, newPath])
    // ${isOpaque ? ' -colorspace RGB ' : ''} 
  }
  // TODO: don't wait for anything?
  return newPath
}

module.exports = {
  convertImage,
}
