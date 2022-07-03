const fs = require('fs')
const path = require('path')

const { IMAGE_FORMATS, AUDIO_FORMATS, SUPPORTED_FORMATS, repackedCache } = require('../utilities/env.js')
const { findFile } = require('../assetServer/virtual.js')
const { convertImage, convertAudio } = require('../contentServer/convert.js')
const { getGame } = require('../utilities/env.js')
const { layeredDir, unsupportedImage, unsupportedAudio } = require('../contentServer/serve-virtual.js')
const { getIndex, streamFile } = require('../utilities/zip.js')




async function unpackBasegame(newZip) {
  // start extracting other zips simultaneously,
  //   then wait for all of them to resolve
  let directory = []
  let virtualPaths = []
  let gamedir = await layeredDir(getGame())
  // TODO: automatically add palette and built QVMs
  let pk3files = gamedir.filter(file => file.match(/\.pk3$/i)).sort().reverse()
  for (let j = 0; j < pk3files.length; j++) {
    let newFile = findFile(pk3files[j])
    let index = await getIndex(newFile)
    for(let i = 0; i < index.length; i++) {
      if(index[i].isDirectory) {
        continue
      }
      if (
        !SUPPORTED_FORMATS.includes(path.extname(index[i].name))
        //&& index[i].size > 128 * 128
        && index[i].size >  64 * 64
        && index[i].compressedSize > 64 * 64) {
        continue
      }
      let pk3Path = path.join(repackedCache(), path.basename(newFile))
      let outFile = path.join(pk3Path + 'dir', index[i].name)
      if (unsupportedImage(index[i].name)) {
        if(fs.existsSync(outFile.replace(path.extname(outFile), '.jpg'))) {
          virtualPaths.push(index[i].name.replace(path.extname(outFile), '.jpg'))
          directory.push(outFile.replace(path.extname(outFile), '.jpg'))
        } else
        if(fs.existsSync(outFile.replace(path.extname(outFile), '.png'))) {
          virtualPaths.push(index[i].name.replace(path.extname(outFile), '.png'))
          directory.push(outFile.replace(path.extname(outFile), '.png'))
        } else {
          let newImage = await convertImage(newFile, index[i].name)
          virtualPaths.push(index[i].name.replace(path.extname(index[i].name), path.extname(newImage)))
          directory.push(newImage)
        }
      }
      if(unsupportedAudio(index[i].name)) {
        if(fs.existsSync(outFile.replace(path.extname(outFile), '.ogg'))) {
          virtualPaths.push(index[i].name.replace(path.extname(outFile), '.ogg'))
          directory.push(outFile.replace(path.extname(outFile), '.ogg'))
        } else {
          let newAudio = await convertAudio(newFile, index[i].name)
          virtualPaths.push(index[i].name.replace(path.extname(outFile), '.ogg'))
          directory.push(newAudio)
        }
      }
      //if(SUPPORTED_FORMATS.includes(path.extname(index[i].name))
      //    || IMAGE_FORMATS.includes(path.extname(index[i].name))
      //    || AUDIO_FORMATS.includes(path.extname(index[i].name))) {
      if(!fs.existsSync(outFile)) {
        fs.mkdirSync(path.dirname(outFile), { recursive: true })
        const file = fs.createWriteStream(outFile)
        await streamFile(index[i], file)
        file.close()
      }
      //}
      //console.log(path.join(newZip, index[i].name))
      virtualPaths.push(index[i].name.toLocaleLowerCase())
      directory.push(outFile)
    }
  }
  let filtered = directory.filter((a, i, arr) => 
      virtualPaths.indexOf(virtualPaths[i]) == i)
  return filtered
}

module.exports = {
  unpackBasegame,
}