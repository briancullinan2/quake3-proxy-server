const fs = require('fs')
const path = require('path')

const { findFile } = require('../assetServer/virtual.js')
const { MAP_DICTIONARY } = require('../mapServer/serve-download.js')
const { streamFileKey } = require('../utilities/zip.js')
const { unsupportedImage, unsupportedAudio } = require('../contentServer/serve-virtual.js')
const { getGame } = require('../utilities/env.js')
const { getMapInfo } = require('../mapServer/bsp.js')


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


async function repackBasepack() {

}



module.exports = {
  repackBasepack,
  repackBasemap,
  repackPk3,
}
