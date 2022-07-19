const fs = require('fs')
const path = require('path')

const { findFile } = require('../assetServer/virtual.js')
const { MAP_DICTIONARY } = require('../mapServer/serve-download.js')
const { streamFileKey } = require('../utilities/zip.js')
const { SUPPORTED_FORMATS, AUDIO_FORMATS, IMAGE_FORMATS, TEMP_DIR, getGame } = require('../utilities/env.js')
const { getMapInfo } = require('../mapServer/bsp.js')
const { listPk3s } = require('../assetServer/layered.js')
const { streamFile, getIndex } = require('../utilities/zip.js')
const { zipCmd } = require('../cmdServer/cmd-zip.js')
const { unsupportedImage, unsupportedAudio } = require('../contentServer/unsupported.js')


async function repackPk3(directory, newZip) {
  let first = true
  for (let i = 0; i < directory.length; i++) {
    if(await unsupportedImage(directory[i])) {
      continue
    }
    if(await unsupportedAudio(directory[i])) {
      continue
    }
    await zipCmd(directory[i], !first, newZip)
    first = false
  }
  return newZip
}


async function repackBasemap(mapname) {
  // TODO: load the map in renderer, get list of loaded images / shaders available 
  //   on server, and package into new converted / compressed zip
  let pk3name = MAP_DICTIONARY[mapname]
  let newFile = findFile(getGame() + '/' + pk3name)
  let newZip = path.join(repackedCache(), path.basename(pk3name))
  let bspFile = path.join(newZip + 'dir', `/maps/${mapname}.bsp`)

  // extract the BSP because we might change it anyways
  if(!fs.existsSync(bspFile)) {
    fs.mkdirSync(path.dirname(bspFile), { recursive: true })
    const file = fs.createWriteStream(bspFile)
    if(!(await streamFileKey(newFile, `maps/${mapname}.bsp`, file))) {
      throw new Error('File not found: ' + `${newFile}/maps/${mapname}.bsp`)
    }
    file.close()
  }

  let mapInfo
  try {
    mapInfo = await getMapInfo(mapname)
  } catch (e) {
    console.error(e)
  }

  let {palettesNeeded, existingPalette} = await parseExisting()
  console.log(mapInfo.images)

  return path.join(repackedCache(), mapname + '.pk3')
}


async function repackBasepack(modname) {
  if(!modname) {
    modname = getGame()
  }
  let outputDir = path.join(TEMP_DIR, modname, 'pak0.pk3dir')
  if(!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, {recursive: true})
  }
  let excluded = []
  let included = []
  let pk3s = (await listPk3s(modname)).sort().reverse().map(findFile).filter(f => f)
  let indexes = await Promise.all(pk3s.map(getIndex))
  for(let i = 0; i < indexes.length; i++) {
    let index = indexes[i]
    for(let j = 0; j < index.length; j++) {
      let file = index[j]
      let newFile = path.join(outputDir, file.name)
      if(file.isDirectory) {
        continue
      }
      if(excluded.includes(file.name.toLocaleLowerCase())
        || included.includes(newFile.toLocaleLowerCase())
      ) {
        continue
      }

      let ext = path.extname(file.name.toLowerCase())
      if(!SUPPORTED_FORMATS.includes(ext)
        && !IMAGE_FORMATS.includes(ext)
        && !AUDIO_FORMATS.includes(ext)) {
        continue
      }

      if(file.compressedSize < 128 * 1024 || file.size < 256 * 1024) {
        if(!fs.existsSync(path.dirname(newFile))) {
          fs.mkdirSync(path.dirname(newFile), {recursive: true})
        }
        if(!fs.existsSync(newFile)) {
          let writeStream = fs.createWriteStream(newFile)
          await streamFile(file, writeStream)
          writeStream.close()
        }
        included.push(newFile.toLocaleLowerCase())
      } else {
        excluded.push(file.name.toLocaleLowerCase())
      }
    }
  }

  let newZip = path.join(TEMP_DIR, modname, 'pak0.pk3')
  if(fs.existsSync(newZip) ) {
    // TODO: diff / remove / update
    return newZip
  }
  await repackPk3(included, newZip)
  return newZip
}



module.exports = {
  repackBasepack,
  repackBasemap,
  repackPk3,
}
