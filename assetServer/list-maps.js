const path = require('path')

const { getGame } = require('../utilities/env.js')
const { getIndex } = require('../utilities/zip.js')
const { findFile } = require('./virtual.js')
const { layeredDir } = require('../assetServer/layered.js')
const MAP_DICTIONARY = {}

async function existingMaps() {
  let basegame = getGame()
  let gamedir = await layeredDir(basegame)
  let pk3files = gamedir.filter(file => file.endsWith('.pk3')).sort().reverse()
  let maps = (await Promise.all(pk3files.map(async function (pk3name) {
    let basename = path.basename(pk3name)
    let index = await getIndex(findFile(pk3name))
    let bsps = index.filter(item => item.key.endsWith('.bsp'))
    let pakname = basename.replace('map-', '').replace('map_', '')
    return bsps.map(function (bsp) {
      let mapname = path.basename(bsp.key).replace(/\.bsp/ig, '').toLocaleLowerCase()
      MAP_DICTIONARY[mapname] = basename
      return {
        link: `maps/download/${mapname}`,
        levelshot: `/${basegame}/${basename}dir/levelshots/` + mapname + '.jpg',
        pakname: basename.replace('map-', '').replace('map_', ''),
        title: mapname,
        bsp: mapname,
        have: true,
      }
      //return `/${basegame}/${pakname}dir/maps/${mapname}.bsp`
    })
  }))).flat(1)
  let mapsNames = maps.map(m => m.bsp)
  let uniqueMaps = maps.filter((m, i) => mapsNames.indexOf(m.bsp) == i)
  uniqueMaps.sort()
  return uniqueMaps
}


module.exports = {
  MAP_DICTIONARY,
  existingMaps,
}