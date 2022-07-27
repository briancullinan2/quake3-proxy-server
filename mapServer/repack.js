const fs = require('fs')
const path = require('path')

const { findFile } = require('../assetServer/virtual.js')
const { SUPPORTED_FORMATS, AUDIO_FORMATS, IMAGE_FORMATS, TEMP_DIR, getGame } = require('../utilities/env.js')
const { getMapInfo } = require('../mapServer/bsp.js')
const { listPk3s } = require('../assetServer/layered.js')
const { streamFileKey, streamKey, getIndex } = require('../utilities/zip.js')
const { zipCmd } = require('../cmdServer/cmd-zip.js')
const { unsupportedImage, unsupportedAudio } = require('../contentServer/unsupported.js')
const { opaqueCmd } = require('../cmdServer/cmd-identify.js')
const { convertCmd } = require('../cmdServer/cmd-convert.js')
const { encodeCmd } = require('../cmdServer/cmd-encode.js')
const { makePalette } = require('../assetServer/make-palette.js')
const { parsePalette } = require('../assetServer/list-palettes.js')
const { START_SERVICES } = require('../contentServer/features.js')
const { MAP_DICTIONARY, listMaps } = require('../assetServer/list-maps.js')
const { execLevelshot } = require('../mapServer/serve-lvlshot.js')



async function repackPk3(directory, newZip) {
  //let first = true
  let filesToRemove = []
  let filesInIndex = {}
  if (fs.existsSync(newZip)) {
    let existingTime = fs.statSync(newZip).mtime.getTime()
    let existingIndex = await getIndex(newZip)
    // TODO: remove already up to date items here not to slow down process server
    //   with redundant checks. stat everything as it's added and check if the time 
    //   and size is the exact same
    // TODO: diff / remove / update
    for(let i = 0; i < existingIndex.length; i++) {
      let file = existingIndex[i]
      let newFile = path.join(outputDir, file.name.toLocaleLowerCase())
      let directoryIndex = directory.indexOf(newFile)
      if(directoryIndex > -1) {
        directory.splice(directoryIndex, 1)
        filesToRemove.push(file)
      }
    }
    for(let i = 0; i < filesToRemove.length; i++) {
      console.log('Removing: ', filesToRemove[i].name)
      await zipCmd(filesToRemove[i].file + '/' + filesToRemove[i].name, '-d', newZip)
    }
    //return newZip
  }


  for (let i = 0; i < directory.length; i++) {
    if (await unsupportedImage(directory[i])) {
      continue
    }
    if (await unsupportedAudio(directory[i])) {
      continue
    }
    try {
      console.log('Adding: ', directory[i])
      await zipCmd(directory[i], '-u' /* !first */, newZip)
    } catch (e) {
      if (!e.message.includes('up to date')) {
        throw e
      }
    }
    //first = false
  }
  return newZip
}


async function repackBasemap(mapname) {
  // TODO: load the map in renderer, get list of loaded images / shaders available 
  //   on server, and package into new converted / compressed zip
  let pk3name = MAP_DICTIONARY[mapname]
  let newFile = findFile(getGame() + '/' + pk3name)
  let bspFile = path.join(mapname + 'dir', `/maps/${mapname}.bsp`)

  // extract the BSP because we might change it anyways
  if (!fs.existsSync(bspFile)) {
    fs.mkdirSync(path.dirname(bspFile), { recursive: true })
    const file = fs.createWriteStream(bspFile)
    if (!(await streamFileKey(newFile, `maps/${mapname}.bsp`, file))) {
      throw new Error('File not found: ' + `${newFile}/maps/${mapname}.bsp`)
    }
    file.close()
  }

  // TODO: get shader/sound/model information using RPC
  let images = (await execLevelshot(mapname, '-images.txt')).split('\n')

  console.log(images)
  //let mapInfo
  //try {
  //  mapInfo = await getMapInfo(mapname)
  //} catch (e) {
  //  console.error(e)
  //}

  //let {paletteNeeded, existingPalette} = await parseExisting()
  // TODO: include base files less than 512KB? and >= 128KB
  // TODO: include startup sounds?
  // TODO: include base models

}



// TODO: convert this function to work on any pack, basepack, basemap, or mappack
async function repackBasepack(modname) {
  const DEPLOY = START_SERVICES.includes('deploy')
  if (!modname) {
    modname = getGame()
  }
  let outputDir = path.join(TEMP_DIR, modname, 'pak0.pk3dir')
  console.log('Using temporary: ' + outputDir)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  let paletteFile = path.join(outputDir, 'scripts/palette.shader')
  let existingPalette = {}
  if(fs.existsSync(paletteFile)) {
    existingPalette = parsePalette(paletteFile)
  }

  let excludedSizes = {}
  let includedDates = {}
  let paletteNeeded = []
  let allPromises = []
  let maxMtime = 0

  let pk3s = (await listPk3s(modname)).sort().reverse().map(findFile).filter(f => f)

  for (let i = 0; i < pk3s.length; i++) {
    let newTime = fs.statSync(pk3s[i]).mtime.getTime()
    let index = await getIndex(pk3s[i])
    for (let j = 0; j < index.length; j++) {
      let file = index[j]
      let newFile = path.join(outputDir, file.name.toLocaleLowerCase())

      if (file.isDirectory) {
        continue
      }
      // only used to prevent adding an older version of a file that already exists
      //   and is to big, so the client is forced to download over HTTP normally.
      if (typeof excludedSizes[file.name.toLocaleLowerCase()] != 'undefined') {
        continue
      }
      let ext = path.extname(file.name.toLowerCase())
      if (!SUPPORTED_FORMATS.includes(ext)
        && !IMAGE_FORMATS.includes(ext)
        && !AUDIO_FORMATS.includes(ext)) {
        continue
      }

      // TODO: move size check below image format conversion?
      // big enough to include icons
      // still do conversions for images and audio because we will need it
      //   the deployment.
      if (!fs.existsSync(path.dirname(newFile))) {
        fs.mkdirSync(path.dirname(newFile), { recursive: true })
      }
      if (IMAGE_FORMATS.includes(ext)) {
        // TODO: palette file, combine with make-palette
        paletteNeeded.push(file)
      }


      // TODO: rewrite this to output files with new stream functions, saving on indexing
      if (!fs.existsSync(newFile) 
        || fs.statSync(newFile).mtime.getTime() < file.time) {
        if(DEPLOY 
          || SUPPORTED_FORMATS.includes(ext)
          || (file.compressedSize < 36 * 36 * 4 // max image size
          || file.size < 68 * 68 * 4))
        allPromises.push(file)
      } else {
        // TODO: statSync() for update checking
        let newTime = fs.statSync(newFile).mtime.getTime()
        if(newTime > file.time) {
          file.time = newTime
        }
      }

      if(file.time > maxMtime) {
        maxMtime = file.time
      }

      if ((SUPPORTED_FORMATS.includes(ext) && (
        file.compressedSize < 64 * 1024 // max image size
          || file.size < 128 * 1024
      ))
        || file.compressedSize < 36 * 36 * 4 // max image size
        || file.size < 68 * 68 * 4 // max image size
        || path.extname(file.name) == '.qvm') {
        if (typeof includedDates[newFile] == 'undefined') {
          includedDates[newFile] = Math.max(newTime, file.time)
        }
      } else {
        excludedSizes[file.name.toLocaleLowerCase()] = file.size
      }
    }
  }

  let newImages = await Promise.all(allPromises.map(new Promise(resolve => file => {
    let passThrough = streamAudioFile(file, null)
    if(!passThrough) {
      passThrough = streamImageFile(file, null)
    }
    if(!passThrough) {
      passThrough = streamKey(file, null)
    }
    if(passThrough) {
      let writeStream = fs.createWriteStream(path.join(outputDir, file));
      passThrough.pipe(writeStream)
      writeStream.on('finish', resolve)
    }
    return passThrough
  })))
  newImages.forEach(newFile => {
    includedDates[newFile] = maxMtime
  })

  // TODO: write current pak palette file
  // TODO: need to reload current palette to not duplicate work
  let newPalette = await makePalette(paletteNeeded, existingPalette)
  fs.writeFileSync(paletteFile, newPalette)
  includedDates[paletteFile] = maxMtime



  let newZip = path.join(TEMP_DIR, modname, 'pak0.pk3')

  await repackPk3(Object.keys(includedDates), newZip)
  return newZip
}



module.exports = {
  repackBasepack,
  repackBasemap,
  repackPk3,
}
