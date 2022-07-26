
const path = require('path')
const fs = require('fs')
const { PassThrough } = require('stream')
const { streamKey } = require('../utilities/zip.js')

// for some reason image magick doesn't like TGA with variable 
//   length header specifed by the 3rd and 4th bytes
async function cleanTGA() {

  // stupid TGAs
  if (outFile.match(/\.tga$/i)) {
    let passThrough = new PassThrough()
    let tgaFile = (await Promise.all([
      streamKey(index[i], passThrough),
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
    await streamKey(index[i], file)
    file.close()
  }
}


module.exports = {
  cleanTGA,
}
