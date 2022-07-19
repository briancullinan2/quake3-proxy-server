const fs = require('fs')
const path = require('path')

const { getGame, repackedCache } = require('../utilities/env.js')
const { paletteCmd } = require('../cmdServer/cmd-palette.js')
const { listPk3s } = require('../assetServer/layered.js')


async function makePalette(paletteNeeded, existingPalette) {
  let newPixels = await Promise.all(paletteNeeded.map(async function (absolute) {
    let localPath
    if(typeof absolute == 'object') {
      localPath = absolute.name
    } else {
      localPath = absolute.replace(/^.*?\.pk3.*?\//gi, '')
    }
    let paletteKey = localPath.replace(path.extname(localPath), '').toLocaleLowerCase()
    if(typeof existingPalette[paletteKey] != 'undefined') {
      return `  palette "${localPath}" ${existingPalette[paletteKey]}`
    }
    let paletteResult
    try {
      paletteResult = await paletteCmd(absolute)
    } catch (e) {
      console.log(e)
      return ''
    }
    return `  palette "${localPath}" ${paletteResult}`
  }))
  let newPalette = `palettes\/${getGame()}\n
  {\n
    ${newPixels.join('\n')}\n
  }\n`
  //if(fs.existsSync(path.join(repackedCache(), 'scripts'))) {
  //  let paletteFile = path.join(repackedCache(), '/scripts/palette.shader')
  //  fs.writeFileSync(paletteFile, newPalette)
  //}
  return newPalette
}


async function rebuildPalette(pk3files) {
  // TODO: get list of pk3s involved
  let pk3sOnly = (pk3files || [])
      .map(p => path.basename(p.replace(/\.pk3.*?$/gi, '.pk3')))
      .filter((p, i, arr) => p && arr.indexOf(p) == i).sort().reverse()
  if(pk3sOnly.length == 0) {
    pk3sOnly = (await listPk3s(getGame())).sort().reverse()
    // TODO: automatically add palette and built QVMs
  }

  let paletteFile = path.join(repackedCache(), pk3sOnly[0] + 'dir', '/scripts/palette.shader')
  fs.mkdirSync(path.dirname(paletteFile), { recursive: true })
  let {paletteNeeded, existingPalette} = await parseExisting(pk3sOnly)
  let newPalette = await makePalette(paletteNeeded, existingPalette)
  fs.writeFileSync(paletteFile, newPalette)
  // TODO: get complete list of images no matter the size from index, ugh, again

  // TODO: convert list of images to filtered list without extensions, 
  //   but leave the original extension from .pk3 on
  return paletteFile
}

module.exports = {
  rebuildPalette,
  makePalette,
}
