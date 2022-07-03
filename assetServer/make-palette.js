const fs = require('fs')
const path = require('path')
const { getGame, repackedCache } = require('../utilities/env.js')
const { paletteCmd } = require('../cmdServer/cmd-palette.js')


async function makePalette(palettesNeeded, existingPalette) {
  let newPixels = await Promise.all(palettesNeeded.map(async function ({absolute}) {
    let localPath = absolute.replace(/^.*?\.pk3.*?\//gi, '')
    if(typeof existingPalette[localPath.replace(path.extname(localPath), '').toLocaleLowerCase()] != 'undefined') {
      return `  palette "${localPath}" ${existingPalette[localPath.replace(path.extname(localPath), '').toLocaleLowerCase()]}`
    }
    return `  palette "${localPath}" ${await paletteCmd(absolute)}`
  }))
  let newPalette = `palettes\/${getGame()}\n
  {\n
    ${newPixels.join('\n')}\n
  }\n`
  if(fs.existsSync(path.join(repackedCache(), 'scripts'))) {
    let paletteFile = path.join(repackedCache(), '/scripts/palette.shader')
    fs.writeFileSync(paletteFile, newPalette)
  }
  return newPalette
}


async function rebuildPalette(pk3files) {
  // TODO: get list of pk3s involved
  let pk3sOnly = (pk3files || [])
      .map(p => path.basename(p.replace(/\.pk3.*?$/gi, '.pk3')))
      .filter((p, i, arr) => p && arr.indexOf(p) == i).sort().reverse()
  if(pk3sOnly.length == 0) {
    let gamedir = await layeredDir(getGame())
    // TODO: automatically add palette and built QVMs
    pk3sOnly = gamedir.filter(file => file.match(/\.pk3$/i))
        .map(p => path.basename(p)).sort().reverse()
  }

  let paletteFile = path.join(repackedCache(), pk3sOnly[0] + 'dir', '/scripts/palette.shader')
  fs.mkdirSync(path.dirname(paletteFile), { recursive: true })
  let {palettesNeeded, existingPalette} = await parseExisting(pk3sOnly)
  let newPalette = await makePalette(palettesNeeded, existingPalette)
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
