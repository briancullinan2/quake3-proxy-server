const fs = require('fs')
const path = require('path')

const { findFile } = require('../assetServer/virtual.js')
const { SUPPORTED_FORMATS, AUDIO_FORMATS, IMAGE_FORMATS, 
    TEMP_DIR, getGame } = require('../utilities/env.js')
const { listPk3s } = require('../assetServer/layered.js')
const { streamFileKey, streamKey, getIndex } = require('../utilities/zip.js')
const { zipCmd } = require('../cmdServer/cmd-zip.js')
const { unsupportedImage, unsupportedAudio } = require('../contentServer/unsupported.js')
const { streamImageFile, streamAudioFile, streamAndCache, 
    CONVERTED_FILES, streamFile } = require('../assetServer/stream-file.js')
const { makePalette } = require('../assetServer/make-palette.js')
const { parsePalette } = require('../assetServer/list-palettes.js')
const { START_SERVICES } = require('../contentServer/features.js')
const { MAP_DICTIONARY, listMaps } = require('../assetServer/list-maps.js')
const { execLevelshot } = require('../mapServer/serve-lvlshot.js')



async function repackPk3(directory, newZip) {
  //let first = true
  if(!directory || !directory.length) {
    throw new Error('Nothing to do!')
  }
  let outputDir = directory[0].replace(/\.pk3.*/gi, '.pk3dir')
  let filesToRemove = []
  let filesInIndex = {}
  if (fs.existsSync(newZip)) {
    let existingTime = fs.statSync(newZip).mtime.getTime()
    let existingIndex = await getIndex(newZip)
    // TODO: remove already up to date items here not to slow down process server
    //   with redundant checks. stat everything as it's added and check if the time 
    //   and size is the exact same
    // TODO: diff / remove / update
    for (let i = 0; i < existingIndex.length; i++) {
      let file = existingIndex[i]
      let newFile = path.join(outputDir, file.name.toLocaleLowerCase())
      let directoryIndex = directory.indexOf(newFile)
      if (directoryIndex == -1
        || await unsupportedImage(file.name)
        || await unsupportedAudio(file.name)) {
        directory.splice(directoryIndex, 1)
        filesToRemove.push(file)
      } else
      if(directoryIndex == -1) {
        // add 
      } else { // TODO: update files on change
        directory.splice(directoryIndex, 1)
      }
    }
    for (let i = 0; i < filesToRemove.length; i++) {
      if(START_SERVICES.includes('debug')) {
        console.log('Removing: ', filesToRemove[i].name)
      }
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
      if(START_SERVICES.includes('debug')) {
        console.log('Adding: ', directory[i])
      }
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


async function repackBasemap(modname, mapname) {
  const DEPLOY = START_SERVICES.includes('deploy')
  if (!modname) {
    modname = getGame()
  }
  let outputDir = path.join(TEMP_DIR, modname, 'pak0.pk3dir')
  console.log('Using temporary for map (' + mapname + '): ' + outputDir)
  // TODO: load the map in renderer, get list of loaded images / shaders available 
  //   on server, and package into new converted / compressed zip
  let pk3Name = findFile(getGame() + '/' + MAP_DICTIONARY[mapname])
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
  let images = []
  let models = []
  let sounds = []
  let fileResults = await execLevelshot(mapname, /-images\.txt|-models\.txt|-sounds\.txt/)
  if(fileResults && fileResults[0]) {
    images = fileResults[0].split('\n').map(img => img.toLocaleLowerCase()
        .replace(path.extname(img), ''))
  }
  if(fileResults && fileResults[1]) {
    models = fileResults[1].split('\n').map(img => img.toLocaleLowerCase()
        .replace(path.extname(img), ''))
  }
  if(fileResults && fileResults[2]) {
    sounds = fileResults[2].split('\n').map(img => img.toLocaleLowerCase()
        .replace(path.extname(img), ''))
  }

  let includedDates = {}
  let excludedSizes = {}
  let pk3Files = await listGameFiles(modname, pk3Name)
  let allPromises = []

  for (let i = 0; i < pk3Files.length; i++) {
    let file = pk3Files[i]
    let newTime = fs.statSync(file.file).mtime.getTime()
    let newFile = path.join(outputDir, file.name.toLocaleLowerCase())
    let newStripped = file.name.replace(path.extname(file.name), '').toLocaleLowerCase()
    if (typeof excludedSizes[newStripped] != 'undefined') {
      continue
    }

    // TODO: check for files the came from a pak[0-9] directory
    let isBasepak = file.file.match(/\/pak[0-9]+\.pk3/)
    if(isBasepak && filterBasepack(file)) {
      // skip files included in pak0
      continue
    }

    //   and switch pk3dir output paths to stay organized in case
    //   the user puts lots of pk3s in one directory
    if (!DEPLOY 
      // allow larger files from base paks and map pack
      && !filterBasemap(file)
      // but then also allow smaller files from map packs
      && !isBasepak && !filterBasepack(file)) {
      excludedSizes[newStripped] = file.size
      continue
    }

    // only include files required by the actual rendering; headless
    if(!images.includes(newStripped) 
      && !models.includes(newStripped) 
      && !sounds.includes(newStripped)
      && !newStripped.includes(mapname)) {
      continue
    }
    //if (!fs.existsSync(path.dirname(newFile))) {
    //  fs.mkdirSync(path.dirname(newFile), { recursive: true })
    //}
    allPromises.push(file)
    includedDates[newFile] = Math.max(newTime, file.time)
  }

  // new stream functions
  let newImages = await Promise.all(allPromises.map(file => {
    return Promise.resolve(exportFile(file, outputDir))
  }))

  // TODO: assert BSP file is included

  let newZip = path.join(TEMP_DIR, modname, mapname + '.pk3')
  // TODO: add converted names to output list
  await repackPk3(Object.keys(includedDates).concat(newImages), newZip)
  return newZip
  // TODO: include base files less than 512KB? and >= 128KB
  // TODO: include startup sounds?
  // TODO: include base models
}



function filterBasegame(file) {

  if (file.isDirectory) {
    return false
  }
  let ext = path.extname(file.name.toLowerCase())
  if (!SUPPORTED_FORMATS.includes(ext)
    && !IMAGE_FORMATS.includes(ext)
    && !AUDIO_FORMATS.includes(ext)) {
    return false
  }

  return true
}


function filterBasemap(file) {
  let ext = path.extname(file.name)
  if (
    // include map files
    path.extname(file.name) == '.bsp'
    || path.extname(file.name) == '.aas'
    // don't include images included in base pack
    //|| SUPPORTED_FORMATS.includes(ext)
    || ((file.compressedSize >= 36 * 36 * 4 // max image size
      || file.size >= 68 * 68 * 4)
    // include slightly large files in base map
    && (file.compressedSize < 128 * 1024 // max image size
      || file.size < 256 * 1024))
  ) {
    return true
  }
  return false
}


function filterBasepack(file) {
  // only used to prevent adding an older version of a file that already exists
  //   and is to big, so the client is forced to download over HTTP normally.
  let ext = path.extname(file.name)
  if ((SUPPORTED_FORMATS.includes(ext) && (
    file.compressedSize < 64 * 1024 // max image size
    || file.size < 128 * 1024
  ))
    // big enough to include icons
    || file.compressedSize < 36 * 36 * 4 // max image size
    || file.size < 68 * 68 * 4 // max image size
    || path.extname(file.name) == '.qvm')
    return true
}


async function exportFile(file, outputDir) {
  let newFile = path.join(outputDir, file.name.toLocaleLowerCase())
  if (!fs.existsSync(path.dirname(newFile))) {
    fs.mkdirSync(path.dirname(newFile), { recursive: true })
  }
  if(unsupportedImage(file.name)) {
    if(typeof CONVERTED_FILES[newFile.replace(path.extname(newFile), '.jpg')] != 'undefined') {
      return newFile.replace(path.extname(newFile), '.jpg')
    }
    if(typeof CONVERTED_FILES[newFile.replace(path.extname(newFile), '.png')] != 'undefined') {
      return newFile.replace(path.extname(newFile), '.png')
    }
    if(fs.existsSync(newFile.replace(path.extname(newFile), '.jpg'))) {
      return newFile.replace(path.extname(newFile), '.jpg')
    }
    if(fs.existsSync(newFile.replace(path.extname(newFile), '.png'))) {
      return newFile.replace(path.extname(newFile), '.png')
    }
  }
  if(unsupportedAudio(file.name)) {
    if(typeof CONVERTED_FILES[newFile.replace(path.extname(newFile), '.ogg')] != 'undefined') {
      return newFile.replace(path.extname(newFile), '.ogg')
    }
    if(fs.existsSync(newFile.replace(path.extname(newFile), '.ogg'))) {
      return newFile.replace(path.extname(newFile), '.ogg')
    }
  }
  if(fs.existsSync(newFile)) {
    return newFile
  }
  let passThrough = streamAndCache(newFile, CONVERTED_FILES, null)
  let fileName = await streamFile(file, passThrough)
  return await new Promise(resolve => {
    newFile = typeof fileName == 'string' 
    ? fileName.replace(/.*\.pk3.*?\//gi, outputDir + '/')
    : newFile
    let writeStream = fs.createWriteStream(newFile)
    passThrough.pipe(writeStream)
    passThrough.on('end', function () {
      writeStream.close()
      resolve(newFile)
    })
    return newFile
  })
}


// TODO: smells like the 5th time I've written this, 
//   probably can be combined with filteredPk3Directory?
async function listGameFiles(modname, pk3Name) {
  let directory = []
  if (!modname) {
    modname = getGame()
  }

  let pk3s = (await listPk3s(modname)).sort().reverse().map(findFile).filter(f => f)
  // TODO: add to pk3Files the mapname file specified, pk3name from MAP_DICTIONARY above
  if(pk3Name && !pk3s.includes(pk3Name)) {
    pk3s.push(pk3Name)
  }
  for (let i = 0; i < pk3s.length; i++) {
    let index = await getIndex(pk3s[i])
    for (let j = 0; j < index.length; j++) {
      if (!filterBasegame(index[j])) {
        continue
      }
      directory.push(index[j])
    }
  }
  return directory
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
  if (fs.existsSync(paletteFile)) {
    existingPalette = parsePalette(paletteFile)
  }

  let excludedSizes = {}
  let includedDates = {}
  let paletteNeeded = []
  let allPromises = []
  let maxMtime = 0

  let pk3Files = await listGameFiles(modname)
  for (let i = 0; i < pk3Files.length; i++) {
    let file = pk3Files[i]
    let newFile = path.join(outputDir, file.name.toLocaleLowerCase())
    let ext = path.extname(newFile)

    // TODO: move size check below image format conversion?
    if (IMAGE_FORMATS.includes(ext)) {
      // TODO: palette file, combine with make-palette
      paletteNeeded.push(file)
    }

    if (typeof excludedSizes[newFile] != 'undefined') {
      continue
    }
    if (!DEPLOY && !filterBasepack(file)) {
      excludedSizes[newFile] = file.size
      continue
    }


    // still do conversions for images and audio because we will need it
    //   the deployment.
    let newTime
    if (!fs.existsSync(newFile) 
        || fs.statSync(newFile).mtime.getTime() < file.time) {
      // output files with new stream functions, saving on indexing
      //   only export the first occurance of a filename
      if(typeof includedDates[newFile] == 'undefined') {
        allPromises.push(file)
      }
      newTime = file.time
    } else {
      // TODO: statSync() for update checking
      let newTime = fs.statSync(newFile).mtime.getTime()
      if (newTime > file.time) {
        file.time = newTime
      }
    }
    if (file.time > maxMtime) {
      maxMtime = file.time
    }
    if (typeof includedDates[newFile] == 'undefined') {
      includedDates[newFile] = Math.max(newTime, file.time)
    }
  }

  // new stream functions
  let newImages = await Promise.all(allPromises.map(file => {
    return Promise.resolve(exportFile(file, outputDir))
  }))
  //console.log('Exporting:', newImages)

  // TODO: write current pak palette file
  // TODO: need to reload current palette to not duplicate work
  let newPalette = await makePalette(paletteNeeded, existingPalette)
  fs.writeFileSync(paletteFile, newPalette)
  includedDates[paletteFile] = maxMtime

  let newZip = path.join(TEMP_DIR, modname, 'pak0.pk3')
  await repackPk3(Object.keys(includedDates).concat(newImages), newZip)
  return newZip
}



module.exports = {
  repackBasepack,
  repackBasemap,
  repackPk3,
}
