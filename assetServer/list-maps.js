const path = require('path')

const { getGame } = require('../utilities/env.js')
const { getIndex } = require('../utilities/zip.js')
const { findFile } = require('./virtual.js')
const { listPk3s } = require('../assetServer/layered.js')
const MAP_DICTIONARY = {}

async function listMaps(basegame) {
  let pk3files = (await listPk3s(basegame)).sort().reverse()
  let maps = (await Promise.all(pk3files.map(async function (pk3name) {
    let newFile = findFile(pk3name)
    if(!newFile) {
      return []
    }
    let index = await getIndex(newFile)
    let bsps = index.filter(item => item.key.endsWith('.bsp'))
    //let pakname = basename.replace('map-', '').replace('map_', '')
    return bsps.map(function (bsp) {
      let mapname = path.basename(bsp.key).replace(/\.bsp/ig, '').toLocaleLowerCase()
      MAP_DICTIONARY[mapname] = path.basename(pk3name)
      return mapname
    })
  }))).flat(1)
  return maps
}

async function filteredMaps() {
  let basegame = getGame()
  let bsps = await listMaps(basegame)
  let maps = bsps.map(function (mapname) {
    let basename = MAP_DICTIONARY[mapname]
    return {
      link: `maps/${mapname}`,
      levelshot: `/${basegame}/${basename}dir/levelshots/` + mapname + '.jpg',
      pakname: 'Download: ' + basename.replace('map-', '').replace('map_', ''),
      title: mapname,
      bsp: mapname,
      have: true,
    }
  })
  let mapsNames = maps.map(m => m.bsp)
  let uniqueMaps = maps.filter((m, i) => mapsNames.indexOf(m.bsp) == i)
  uniqueMaps.sort()
  return uniqueMaps
}


module.exports = {
  MAP_DICTIONARY,
  filteredMaps,
  listMaps,
}