const fs = require('fs')
const path = require('path')
const { getGame, repackedCache } = require('../utilities/env.js')


function makePalette(palettesNeeded, existingPalette) {
  return Promise.all(palettesNeeded.map(async function ({absolute}) {
    let localPath = absolute.replace(/^.*?\.pk3.*?\//gi, '')
    if(typeof existingPalette[localPath.replace(path.extname(localPath), '').toLocaleLowerCase()] != 'undefined') {
      return `  palette "${localPath}" ${existingPalette[localPath.replace(path.extname(localPath), '').toLocaleLowerCase()]}`
    }
    return `  palette "${localPath}" ${await paletteCmd(absolute)}`
  }))
}


async function rebuildPalette(pk3files) {
  // TODO: get list of pk3s involved
  let pk3sOnly = (pk3files || [])
      .map(p => path.basename(p.replace(/\.pk3.*?$/gi, '.pk3')))
      .filter((p, i, arr) => p && arr.indexOf(p) == i).sort().reverse()
  if(pk3sOnly.length == 0) {
    let gamedir = await layeredDir(getGame())
    // TODO: automatically add palette and built QVMs
    pk3sOnly = gamedir.filter(file => file.endsWith('.pk3'))
        .map(p => path.basename(p)).sort().reverse()
  }

  let paletteFile = path.join(repackedCache(), pk3sOnly[0] + 'dir', '/scripts/palette.shader')
  fs.mkdirSync(path.dirname(paletteFile), { recursive: true })
  let {palettesNeeded, existingPalette} = await parseExisting(pk3sOnly)
  let newPixels = await makePalette(palettesNeeded, existingPalette)
  let newPalette = `palettes\/${getGame()}\n
  {\n
    ${newPixels.join('\n')}\n
  }\n`
  fs.writeFileSync(paletteFile, newPalette)
  // TODO: get complete list of images no matter the size from index, ugh, again

  // TODO: convert list of images to filtered list without extensions, 
  //   but leave the original extension from .pk3 on
  return paletteFile
}

module.exports = {
  rebuildPalette,
}
