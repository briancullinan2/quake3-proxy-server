const path = require('path')
const fs = require('path')

const { getGame } = require('../utilities/env.js')
const { getIndex } = require('../utilities/zip.js')
const { findFile } = require('./virtual.js')
const { listPk3s } = require('../assetServer/layered.js')
const { findMapname } = require('../mapServer/bsp.js')
const { MAP_DICTIONARY } = require('../mapServer/download.js')

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
  let zeroTimer = new Promise(resolve => setTimeout(
    resolve, 200))

  let basegame = getGame()
  let bsps = await listMaps(basegame)
  let mapNames = await Promise.all(bsps.map(async map => Promise.any([findMapname(basegame, map), zeroTimer.then(() => map)])))
  let maps = bsps.map(function (mapname, i) {
    let basename = MAP_DICTIONARY[mapname]
    return {
      link: `maps/${mapname}`,
      // TODO: findAlt() and get the file time of the file that will be displayed
      // TODO: need some cache busting technique here
      levelshot: `/${basegame}/screenshots/` + mapname + '_screenshot0001.jpg?alt',
      pakname: basename.match(/pak[0-9]\.pk3/) 
          ? void 0
          : 'Download: ' + basename.replace('map-', '').replace('map_', ''),
      title: mapNames[i],
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
  filteredMaps,
  listMaps,
}