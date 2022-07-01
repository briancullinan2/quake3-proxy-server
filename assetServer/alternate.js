
const { AUDIO_FORMATS, IMAGE_FORMATS } = require('../utilities/env.js')

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

module.exports = {
  alternateImage,
  alternateAudio,
}