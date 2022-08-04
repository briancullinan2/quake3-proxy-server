const fs = require('fs')
const path = require('path')

const { findFile } = require('../assetServer/virtual.js')
const { SUPPORTED_FORMATS, AUDIO_FORMATS, IMAGE_FORMATS,
  TEMP_DIR, DOMAIN, getGame } = require('../utilities/env.js')
const { listPk3s } = require('../assetServer/layered.js')
const { getIndex, streamKey } = require('../utilities/zip.js')
const { zipCmd } = require('../cmdServer/cmd-zip.js')
const { unsupportedImage, unsupportedAudio } = require('../contentServer/unsupported.js')
const { streamAndCache, CONVERTED_FILES, findAlt, streamFile } = require('../assetServer/stream-file.js')
const { makePalette } = require('../assetServer/make-palette.js')
const { parsePalette } = require('../assetServer/list-palettes.js')
const { START_SERVICES } = require('../contentServer/features.js')
const { execLevelshot } = require('../mapServer/serve-lvlshot.js')
const { MAP_DICTIONARY } = require('../mapServer/download.js')
const { PassThrough, Readable } = require('stream')


let REPACKED_OUTPUT = path.join(TEMP_DIR, getGame(), 'pak0.pk3dir')

function setOutput(out) {
  REPACKED_OUTPUT = out
}


function getOutput() {
  return REPACKED_OUTPUT
}


async function repackPk3(directory, newZip) {
  //let first = true
  if (!directory || !directory.length) {
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
      } else if (directoryIndex > -1) { 
        // TODO: update files on change
        if(fs.existsSync(newFile) && fs.statSync(newFile).mtime.getTime() > existingTime) {

        } else {
          directory.splice(directoryIndex, 1)
        }
      } else {
        
      }
    }
    for (let i = 0; i < filesToRemove.length; i++) {
      if (START_SERVICES.includes('debug')) {
        console.log('Removing: ', filesToRemove[i].name)
      }
      await zipCmd(outputDir + '/' + filesToRemove[i].key, '-d', newZip)
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
      if (START_SERVICES.includes('debug')) {
        console.log('Adding: ', directory[i])
      }
      await zipCmd(directory[i].replace('.jpeg', '.jpg'), '-u' /* !first */, newZip)
    } catch (e) {
      if (!e.message.includes('up to date')) {
        console.error(e)
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
  } else {

  }
  let outputDir = getOutput()
  console.log('Using temporary for map (' + mapname + '): ' + outputDir)
  // TODO: load the map in renderer, get list of loaded images / shaders available 
  //   on server, and package into new converted / compressed zip
  let pk3Name = findFile(modname + '/' + MAP_DICTIONARY[mapname])
  if (!pk3Name) {
    throw new Error('pk3 File not found: ' + modname + '/' + MAP_DICTIONARY[mapname])
  }
  //let bspFile = path.join(mapname + 'dir', `/maps/${mapname}.bsp`)

  // TODO: get shader/sound/model information using RPC
  let images = []
  let models = []
  let sounds = []
  let fileResults = await execLevelshot(mapname, /-images\.txt|-models\.txt|-sounds\.txt/)

  if (fileResults && fileResults[0]) {
    images = fileResults[0].split('\n').map(img => img.toLocaleLowerCase()
      .replace(path.extname(img), ''))
  }
  if (fileResults && fileResults[1]) {
    models = fileResults[1].split('\n').map(img => img.toLocaleLowerCase()
      .replace(path.extname(img), ''))
  }
  if (fileResults && fileResults[2]) {
    sounds = fileResults[2].split('\n').map(img => img.toLocaleLowerCase()
      .replace(path.extname(img), ''))
  }

  let includedDates = {}
  let excludedSizes = {}
  let pk3Files = await listGameFiles(modname, pk3Name)
  let allPromises = []
  let allExports = []
  for (let i = 0; i < pk3Files.length; i++) {
    let file = pk3Files[i]
    let newTime = fs.statSync(file.file).mtime.getTime()
    let newFile = path.join(outputDir, file.name.toLocaleLowerCase())
    let ext = path.extname(newFile)
    let newStripped = file.name.replace(path.extname(file.name), '').toLocaleLowerCase()
    if (typeof includedDates[newFile] != 'undefined') {
      continue
    }
    if (typeof excludedSizes[newFile] != 'undefined') {
      continue
    }

    // TODO: check for files the came from a pak[0-9] directory
    let isBasepak = file.file.match(/\/pak[0-9]+\.pk3/)
    if (isBasepak && filterBasepack(file)) {
      // skip files included in pak0
      continue
    }

    //   and switch pk3dir output paths to stay organized in case
    //   the user puts lots of pk3s in one directory
    if (!DEPLOY
      // allow larger files from base paks and map pack
      && !filterBasemap(file)
      // but then also allow smaller files from map packs
      && !filterBasepack(file)) {
      excludedSizes[newFile] = file.size
      continue
    }
    // export and convert the file but don't include the results in the pk3
    if (!filterBasemap(file) && !filterBasepack(file)) {
      if (IMAGE_FORMATS.includes(ext) || AUDIO_FORMATS.includes(ext)) {
        allExports.push(file)
      }
      continue
    }

    // only include files required by the actual rendering; headless
    if (!images.includes(newStripped)
      && !models.includes(newStripped)
      && !sounds.includes(newStripped)
      && !newStripped.includes(mapname)) {
      continue
    }
    //if (!fs.existsSync(path.dirname(newFile))) {
    //  fs.mkdirSync(path.dirname(newFile), { recursive: true })
    //}
    allPromises.push(file)
    // but then also allow smaller files from map packs
    includedDates[newFile] = Math.max(newTime, file.time)
  }

  // new stream functions
  let newImages = []
  for(let i = 0; i < allPromises.length; i++) {
    try {
      newImages.push(await exportFile(allPromises[i], outputDir))
    } catch(err) {
      console.error(err)
    }
  }
  for(let i = 0; i < allExports.length; i++) {
    try {
      await exportFile(allExports[i], outputDir)
    } catch(err) {
      console.error(err)
    }
  }
  // TODO: assert BSP file is included

  let newZip = path.join(path.dirname(outputDir), mapname + '.pk3')
  // TODO: add converted names to output list
  let uniqueFiles = Object.keys(includedDates).concat(newImages).filter((f, i, arr) => arr.indexOf(f) == i)
  await repackPk3(uniqueFiles, newZip)
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
  let ext = path.extname(file.name.toLocaleLowerCase())
  if (
    // include map files
    ext == '.bsp' || ext == '.aas'
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
  //let newFile = path.join(outputDir, typeof file == 'object'
  //  ? file.name.toLocaleLowerCase() : file.toLocaleLowerCase())
  let newFile = typeof file == 'object'
    ? file.name.toLocaleLowerCase() : file.toLocaleLowerCase()
  newFile = newFile.replace(/.*\.pk3.*?\//gi, outputDir + '/')
  if(!newFile.includes(outputDir)) {
    newFile = path.join(outputDir, newFile)
  }

  if (!fs.existsSync(path.dirname(newFile))) {
    fs.mkdirSync(path.dirname(newFile), { recursive: true })
  }
  if (unsupportedImage(typeof file == 'object' ? file.name : file)) {
    if (typeof CONVERTED_FILES[newFile.replace(path.extname(newFile), '.jpg')] != 'undefined') {
      return newFile.replace(path.extname(newFile), '.jpg')
    }
    if (typeof CONVERTED_FILES[newFile.replace(path.extname(newFile), '.png')] != 'undefined') {
      return newFile.replace(path.extname(newFile), '.png')
    }
    if (fs.existsSync(newFile.replace(path.extname(newFile), '.jpg'))) {
      return newFile.replace(path.extname(newFile), '.jpg')
    }
    if (fs.existsSync(newFile.replace(path.extname(newFile), '.png'))) {
      return newFile.replace(path.extname(newFile), '.png')
    }
  }
  if (unsupportedAudio(typeof file == 'object' ? file.name : file)) {
    if (typeof CONVERTED_FILES[newFile.replace(path.extname(newFile), '.ogg')] != 'undefined') {
      return newFile.replace(path.extname(newFile), '.ogg')
    }
    if (fs.existsSync(newFile.replace(path.extname(newFile), '.ogg'))) {
      return newFile.replace(path.extname(newFile), '.ogg')
    }
  }
  if(newFile.includes('default.cfg')) {
    debugger
  }
  if (fs.existsSync(newFile)) {
    let pk3Name = outputDir.replace(/.*\.pk3.*?\//gi, outputDir + '/')
    let pk3InnerPath = newFile.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '').toLocaleLowerCase()
    let localName = path.join(path.relative(path.dirname(path.dirname(pk3Name)), pk3Name), pk3InnerPath)
    let altFile = await findAlt(localName)
    if(typeof altFile == 'string' && altFile.includes('.qvm')) {
      console.log('Developing: ', altFile)
    }
    let stat = fs.statSync( typeof altFile == 'object' 
        ? altFile.file : altFile || newFile)
    if(stat.size > 1 && 
      ((typeof altFile == 'object' && !altFile.file.includes('build'))
      || (typeof altFile == 'string' && !altFile.includes('build')))){
      return newFile
    }
    if(altFile) {
      console.log('Re-exporting:', typeof altFile == 'object' 
          ? (altFile.file + '/' + altFile.name) : altFile)
    }
  }
  let passThrough
  let writeStream
  if(typeof CONVERTED_FILES[newFile] == 'undefined') {
    passThrough = streamAndCache(newFile, CONVERTED_FILES, null)
    let fileName = await streamFile(file, passThrough)
    newFile = typeof fileName == 'string'
    ? fileName.toLocaleLowerCase().replace(/.*\.pk3.*?\//gi, outputDir + '/')
    : newFile
    writeStream = fs.createWriteStream(newFile)
    passThrough.pipe(writeStream)
    await new Promise(resolve => passThrough.on('end', resolve))
    writeStream.close()
  } else {
    fs.writeFileSync(newFile, CONVERTED_FILES[newFile])
  }
  return newFile
}


// TODO: smells like the 5th time I've written this, 
//   probably can be combined with filteredPk3Directory?
async function listGameFiles(modname, pk3Name) {
  let directory = []
  if (!modname) {
    modname = getGame()
  }

  let pk3s = (await listPk3s(modname)).sort().reverse().map(findFile).filter(f => f)
  console.log('games', pk3s)
  // TODO: add to pk3Files the mapname file specified, pk3name from MAP_DICTIONARY above
  if (pk3Name && !pk3s.includes(pk3Name)) {
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
  // TODO: add files from Github game checkout


  return directory
}



// TODO: convert this function to work on any pack, basepack, basemap, or mappack
async function repackBasepack(modname) {
  const DEPLOY = START_SERVICES.includes('deploy')
  if (!modname) {
    modname = getGame()
  }
  let outputDir = getOutput()
  console.log('Using temporary: ' + outputDir)
  fs.mkdirSync(path.join(outputDir, 'scripts'), { recursive: true })

  let paletteFile = path.join(outputDir, 'scripts/palette.shader')
  let existingPalette = {}
  if (fs.existsSync(paletteFile)) {
    existingPalette = parsePalette(paletteFile)
  }

  let excludedSizes = {}
  let includedDates = {}
  let paletteNeeded = []
  let allPromises = []
  let allExports = []
  let maxMtime = 0

  let pk3Files = await listGameFiles(modname)
  for (let i = 0; i < pk3Files.length; i++) {
    let file = pk3Files[i]
    let newFile = path.join(outputDir, file.name.toLocaleLowerCase())
    let ext = path.extname(newFile)

    if (typeof includedDates[newFile] != 'undefined') {
      continue
    }
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
    if (!filterBasepack(file)) {
      if (IMAGE_FORMATS.includes(ext) || AUDIO_FORMATS.includes(ext)) {
        allExports.push(file)
      }
      continue
    }


    // still do conversions for images and audio because we will need it
    //   the deployment.
    let newTime
    allPromises.push(file)
    if (!fs.existsSync(newFile)
      || fs.statSync(newFile).mtime.getTime() < file.time) {
      // output files with new stream functions, saving on indexing
      //   only export the first occurance of a filename
      //if(typeof includedDates[newFile] == 'undefined') {
      //}
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
  // TODO: for loop instead
  //   ALL? something is wrong with zip extraction maybe it can't do paralell on the same object
  let newImages = []
  for(let i = 0; i < allPromises.length; i++) {
    try {
      newImages.push(await exportFile(allPromises[i], outputDir))
    } catch(err) {
      console.error(err)
    }
  }
  for(let i = 0; i < allExports.length; i++) {
    try {
      await exportFile(allExports[i], outputDir)
    } catch(err) {
      console.error(err)
    }
  }
  //console.log('Exporting:', newImages)

  // TODO: inject cl_dlURL to correct game configured on game server
  //let defaultPath = await findAlt(modname + '/default.cfg')
  await exportFile(modname + '/pak0.pk3dir/default.cfg', outputDir)
  let defaultCfg = fs.readFileSync(path.join(outputDir, 'default.cfg')).toString('utf-8')
  if(defaultCfg.trim().length < 1) {
    throw new Error('default.cfg is missing: ' + path.join(outputDir, 'default.cfg'))
  }
  await exportFile(modname + '/pak0.pk3dir/vm/cgame.qvm', outputDir)
  await exportFile(modname + '/pak0.pk3dir/vm/qagame.qvm', outputDir)
  await exportFile(modname + '/pak0.pk3dir/vm/ui.qvm', outputDir)

  //console.log(defaultCfg)
  defaultCfg = defaultCfg.replace(/^.*cl_dlUrl.*$/gi, '')
  defaultCfg += '\nseta cl_dlURL "' + DOMAIN + '/maps/' + modname + '/%1"\n'
  fs.writeFileSync(path.join(outputDir, 'default.cfg'), defaultCfg)
  includedDates[path.join(outputDir, 'default.cfg')] = Date.now()
  // TODO: replace .cfg font files with .png images



  // TODO: write current pak palette file
  // TODO: need to reload current palette to not duplicate work
  let newPalette = await makePalette(paletteNeeded, existingPalette)
  fs.writeFileSync(paletteFile, newPalette)
  includedDates[paletteFile] = maxMtime

  let newZip = path.join(path.dirname(outputDir), 'pak0.pk3')
  let uniqueFiles = Object.keys(includedDates).concat(newImages).filter((f, i, arr) => arr.indexOf(f) == i)
  await repackPk3(uniqueFiles, newZip)
  return newZip
}



module.exports = {
  repackBasepack,
  repackBasemap,
  repackPk3,
  setOutput,
  getOutput,
  exportFile,
}
