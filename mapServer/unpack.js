const fs = require('fs')
const path = require('path')

const { IMAGE_FORMATS, AUDIO_FORMATS, SUPPORTED_FORMATS, repackedCache } = require('../utilities/env.js')
const { findFile } = require('../contentServer/virtual.js')
const { convertImage, convertAudio } = require('../contentServer/convert.js')
const { getGame } = require('../utilities/env.js')
const { layeredDir, unsupportedImage, unsupportedAudio } = require('../contentServer/content.js')
const { getIndex, streamFile } = require('../utilities/zip.js')


async function alternateAudio(pk3InnerPath, response, next) {
  let altFile = pk3InnerPath.replace(path.extname(pk3InnerPath), '')

  let gamedir = await layeredDir(getGame())
  let pk3files = gamedir.filter(file => file.endsWith('.pk3')).sort().reverse()  
  for(let i = 0; i < AUDIO_FORMATS.length; i++) {
    if(unsupportedAudio(AUDIO_FORMATS[i])) {
      continue
    }
    let newFile = findFile(altFile + AUDIO_FORMATS[i])
    if(newFile && !newFile.endsWith('.pk3')) {
      console.log(newFile)
      return response.sendFile(newFile)
    }
  }

  for(let i = 0; i < pk3files.length; i++) {
    for(let j = 0; j < AUDIO_FORMATS.length; j++) {
      if(unsupportedAudio(AUDIO_FORMATS[j])) {
        continue
      }
      let altPath = path.join(repackedCache(), path.basename(pk3files[i]) + 'dir', altFile + AUDIO_FORMATS[j])
      if(fs.existsSync(altPath)) {
        console.log(altPath)
        return response.sendFile(altPath)
      }
    }
  }

  for(let i = 0; i < pk3files.length; i++) {
    try {
      let newFile = findFile(pk3files[i])
      let newImage = await convertAudio(newFile, pk3InnerPath)
      return response.sendFile(newImage)
    } catch (e) {
      if(!e.message.startsWith('File not found')) {
        console.log(e)
      }
    }

    for(let j = 0; j < AUDIO_FORMATS.length; j++) {
      try {
        let newImage = await convertAudio(findFile(pk3files[i]), altFile + AUDIO_FORMATS[j])
        return response.sendFile(newImage)
      } catch (e) {
        if(!e.message.startsWith('File not found')) {
          console.log(e)
        }
      }
    }
  }

  return next()
}


async function alternateImage(pk3InnerPath, response, next) {
  let altFile = pk3InnerPath.replace(path.extname(pk3InnerPath), '')
  let isUnsupported = unsupportedImage(pk3InnerPath)

  // TODO: this isn't quite right
  //   needs to loop through all pk3s looking
  //   for the best alternative, and most reliable
  //   source first.
  

  let gamedir = await layeredDir(getGame())
  let pk3files = gamedir.filter(file => file.endsWith('.pk3')).sort().reverse()  
  for(let i = 0; i < IMAGE_FORMATS.length; i++) {
    if(unsupportedImage(IMAGE_FORMATS[i])) {
      continue
    }
    let newFile = findFile(altFile + IMAGE_FORMATS[i])
    if(newFile && !newFile.endsWith('.pk3')) {
      return response.sendFile(newFile)
    }
  }

  for(let i = 0; i < pk3files.length; i++) {
    for(let j = 0; j < IMAGE_FORMATS.length; j++) {
      if(unsupportedImage(IMAGE_FORMATS[j])) {
        continue
      }
      let altPath = path.join(repackedCache(), path.basename(pk3files[i]) + 'dir', altFile + IMAGE_FORMATS[j])
      if(fs.existsSync(altPath)) {
        return response.sendFile(altPath)
      }
    }
  }

  for(let i = 0; i < pk3files.length; i++) {
    try {
      let newFile = findFile(pk3files[i])
      let newImage = await convertImage(newFile, pk3InnerPath)
      return response.sendFile(newImage)
    } catch (e) {
      if(!e.message.startsWith('File not found')) {
        console.log(e)
      }
    }

    for(let j = 0; j < IMAGE_FORMATS.length; j++) {
      try {
        let newImage = await convertImage(findFile(pk3files[i]),
        altFile + IMAGE_FORMATS[j])
        return response.sendFile(newImage)
      } catch (e) {
        if(!e.message.startsWith('File not found')) {
          console.log(e)
        }
      }
    }
  }

  return next()

  /*
  TODO: load base pk3 here, load alt-path images from loadImage()
  TODO: load images/sounds async based on some sort of minimized compressed graph
      of all 3,000+ maps.
  TODO: validate pk3 data, remove QVMs, check for improper overrides,
      reference all BSP textures, and re-merge working lazy load, trigger 
      downloads from Sys_FOpen like before. 
  TODO: Try to get this working through NextDownload() but with the download
      progress displayed in latency graph, micro-manage Ranges to not affect ping. 
      Add to native.
  */

}

async function unpackBasegame(newZip) {
  // start extracting other zips simultaneously,
  //   then wait for all of them to resolve
  let directory = []
  let virtualPaths = []
  let gamedir = await layeredDir(getGame())
  // TODO: automatically add palette and built QVMs
  let pk3files = gamedir.filter(file => file.endsWith('.pk3')).sort().reverse()
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
  alternateImage,
  alternateAudio,
}