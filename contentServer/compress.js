const path = require('path')
const fs = require('fs')
const { repackedCache } = require('../utilities/env.js')
const { getIndex, streamFile } = require('../utilities/zip.js')
const {PassThrough} = require('stream')

const CURRENTLY_UNPACKING = {

}


async function extractPk3(pk3Path) {
  const StreamZip = require('node-stream-zip')
  const zip = new StreamZip({
    file: pk3Path,
    storeEntries: true,
    skipEntryNameValidation: true,
  })
  let newZip = path.join(repackedCache(), path.basename(pk3Path))
  if(typeof CURRENTLY_UNPACKING[newZip] == 'undefined') {
    CURRENTLY_UNPACKING[newZip] = []
  }

  // only extract the same pk3 once, even if multiple page loads initiates it
  if(CURRENTLY_UNPACKING[newZip].length > 0) {
    return await new Promise(function (resolve, reject) {
      let rejectTimer = setTimeout(function () {
        reject(new Error('Already extracting timed out.'))
        rejectTimer = null
      }, 3000)
      CURRENTLY_UNPACKING[newZip].push(function (directoryIndex) {
        if(rejectTimer) {
          cancelTimeout(rejectTimer)
          resolve(directoryIndex)
        }
      })
    })
  }

  // make a new zip, filter out everything but text files
  //   (e.g. menus, cfgs, shaders)
  //   and very small images from shaders/gfx/sfx
  // generate new palette
  let index = await getIndex(pk3Path)
  for (let i = 0; i < index.length; i++) {
    if (index[i].isDirectory)
      continue

    let outFile = path.join(newZip + 'dir', index[i].name)
    if (fs.existsSync(outFile)) {
      continue;
    }
  
    console.log('Extracting', index[i].key, '->', outFile)
    fs.mkdirSync(path.dirname(outFile), { recursive: true })

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

  return await new Promise(resolve => {
    resolve(index)
    for(let i = 0; i < CURRENTLY_UNPACKING[newZip].length; i++) {
      CURRENTLY_UNPACKING[newZip](index)
    }
    CURRENTLY_UNPACKING[newZip].splice(0)
  })
}


module.exports = {
  extractPk3,
}