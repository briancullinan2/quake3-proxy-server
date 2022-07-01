
const path = require('path')
const fs = require('fs')
const { PassThrough } = require('stream')
const { repackedCache } = require('../utilities/env.js')
const { streamFile } = require('../utilities/zip.js')

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

  let newFile = unsupportedFormat.replace(path.extname(unsupportedFormat), '.ogg')
  let newPath
  if (audioPath.includes('.pk3')) {
    newPath = path.join(repackedCache(), path.basename(pk3File) + 'dir', newFile)
  } else {
    newPath = path.join(repackedCache(), newFile)
  }
  if (fs.existsSync(newPath)) {
    //console.log('Skipping: ', newPath)
    return newPath
  }

  return encodeCmd(audioPath, unsupportedFormat, quality, newPath)
}



async function convertImage(imagePath, unsupportedFormat, quality) {
  // TODO: only convert the same output image once at a time not to clobber
  let pk3File = imagePath.replace(/\.pk3.*/gi, '.pk3')
  let isOpaque = await opaqueCmd()
  let newFile = unsupportedFormat.replace(unsupportedExt, isOpaque ? '.jpg' : '.png')
  let newPath
  if (imagePath.includes('.pk3')) {
    newPath = path.join(repackedCache(), path.basename(pk3File) + 'dir', newFile)
  } else {
    newPath = path.join(repackedCache(), newFile)
  }
  if (fs.existsSync(newPath)) {
    //console.log('Skipping: ', newPath)
    return newPath
  }
  fs.mkdirSync(path.dirname(newPath), { recursive: true })
  return await convertCmd(imagePath, unsupportedFormat, quality, newPath)
}

module.exports = {
  convertImage,
  convertAudio,
}
