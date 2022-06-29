
const path = require('path')
const fs = require('fs')
const {PassThrough} = require('stream')
const {repackedCache} = require('../utilities/env.js')
const {execCmd} = require('../utilities/exec.js')
const { fileKey, streamFile, streamFileKey } = require('../utilities/zip.js')

const CURRENTLY_CONVERTING = {}

// for some reason image magick doesn't like TGA with variable 
//   length header specifed by the 3rd and 4th bytes
async function cleanTGA() {

  // stupid TGAs
  if (outFile.match(/\.tga$/i)) {
    let passThrough = new PassThrough()
    let tgaFile = (await Promise.all([
      streamFile(index[i], passThrough),
      streamToBuffer(passThrough)
    ]))[1]
    //fs.writeFileSync(outFile + '_orig', tgaFile)
    if (tgaFile[0] > 0) {
      tgaFile = Array.from(tgaFile)
      tgaFile.splice(18, tgaFile[0])
      tgaFile[0] = 0
      tgaFile = Buffer.from(tgaFile)
    }
    fs.writeFileSync(outFile, tgaFile)
  } else {
    const file = fs.createWriteStream(outFile)
    await streamFile(index[i], file)
    file.close()
  }
}


async function convertAudio(audioPath, unsupportedFormat, quality) {
  let pk3File = audioPath.replace(/\.pk3.*/gi, '.pk3')
  let cmd
  let file
  let passThrough
  let startArgs = []
  if(audioPath.endsWith('.pk3')) {
    file = await fileKey(audioPath, unsupportedFormat)
    if(file) {
      passThrough = new PassThrough()
    } else {
      throw new Error('File not found: ' + unsupportedFormat)
    }
  }

  let newFile = unsupportedFormat.replace(path.extname(unsupportedFormat), '.ogg')
  let newPath
  if(audioPath.includes('.pk3')) {
    newPath = path.join(repackedCache(), path.basename(pk3File) + 'dir', newFile)
  } else {
    newPath = path.join(repackedCache(), newFile)
  }
  if(fs.existsSync(newPath)) {
    //console.log('Skipping: ', newPath)
    return newPath
  }


  if(path.extname(audioPath).match(/\.mp3/gi)) {
    cmd = 'ffmpeg'
    startArgs = ['-i', file]
    if(passThrough) {
      startArgs.push('-')
    } else {
      startArgs.push(audioPath)
    }
    startArgs.push.apply(startArgs, [
      '-c:a', 'libvorbis', '-q:a', '4', newPath
    ])
  } else {
    cmd = 'oggenc'
    startArgs = [
      '-q', '7', '--downmix', '--resample',
      '11025', '--quiet'
    ]
    if(passThrough) {
      startArgs.push('-')
    } else {
      startArgs.push(audioPath)
    }
    startArgs.push.apply(startArgs, [
      '-o', newPath
    ])
  }

  console.log('Transcoding: ', audioPath, unsupportedFormat)
  let logs
  if(passThrough) {
    logs = (await Promise.all([
      streamFile(file, passThrough),
      execCmd(cmd, startArgs, {pipe: passThrough})
    ]))[1]
  } else {
    logs = await execCmd(cmd, startArgs)
  }
  //console.log(logs)
  return newPath
}



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
  convertAudio,
}
