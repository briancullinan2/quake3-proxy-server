const path = require('path')
const fs = require('fs')

const { findFile } = require('../assetServer/virtual.js')
const { getGame } = require('../utilities/env.js')
const { MAP_DICTIONARY } = require('../assetServer/list-maps.js')
const { sourcePk3Download } = require('../mapServer/download.js')
const { repackedCache } = require('../utilities/env.js')
const { streamFileKey } = require('../utilities/zip.js')
const { layeredDir } = require('../assetServer/layered.js')
const { execLevelshot } = require('../mapServer/lvlshot.js')
const { ScanAndLoadShaderFiles } = require('../assetServer/shaders.js')

const GAME_ARENAS = {

}

const MAP_ARENAS = {

}


async function getMapInfo(mapname) {
  let basegame = getGame()
  // TODO: make sure BSP file is available synchronously first
  let newFile = await sourcePk3Download(mapname)
  await ScanAndLoadShaderFiles()

  let newZip = path.join(repackedCache(), path.basename(newFile))
  let bspFile = path.join(newZip + 'dir', `/maps/${mapname}.bsp`)
  let pk3Path = `/${basegame}/${path.basename(newFile)}dir`

  // extract the BSP because we might change it anyways
  if (!fs.existsSync(bspFile)) {
    fs.mkdirSync(path.dirname(bspFile), { recursive: true })
    const file = fs.createWriteStream(bspFile)
    await streamFileKey(newFile, `maps/${mapname}.bsp`, file)
    file.close()
  }

  let levelshotPath = path.join(pk3Path, '/levelshots/', mapname + '.jpg')
  let levelshot = findFile(levelshotPath)
  if (levelshot.endsWith('.pk3')) {
    //newFile = await extractPk3(newFile)
  }


  let scripts = layeredDir(path.join(pk3Path, '/scripts/'))
  if (typeof GAME_ARENAS[basegame] == 'undefined') {
    let baseArenas = findFile(path.join(basegame, '/pak0.pk3/scripts/arenas.txt'))

  }


  let entities = ''
  let entityFile = path.join(repackedCache(), '/maps/', mapname + '.ent')
  if (!fs.existsSync(entityFile)) {
    Promise.resolve(execLevelshot(mapname)).then(console.log).catch(console.error)
    console.error('WARNING: entities not found: ' + mapname)
  } else {
    entities = fs.readFileSync(entityFile).toString('utf-8')
  }


  let images = []
  let imagesFile = path.join(repackedCache(), '/maps/', mapname + '-images.txt')
  if (!fs.existsSync(imagesFile)) {
    Promise.resolve(execLevelshot(mapname)).then(console.log).catch(console.error)
    console.error('WARNING: images not found: ' + mapname)
  } else {
    images = fs.readFileSync(imagesFile).toString('utf-8').split('\n')
  }


  let worldspawn = []
  let entityStr = entities
  entityStr.replace(/\{([^}]*)\}/mg, function ($0, entitySrc) {
    var entity = {
      classname: 'unknown'
    };

    entitySrc.replace(/"(.+)" "(.+)"$/mg, function ($0, key, value) {
      entity[key] = value
    })

    worldspawn.push(entity)
  })

  return {
    bsp: mapname,
    levelshot: levelshotPath,
    entities: entities + '\n' + (scripts || []).join('\n'),
    worldspawn: worldspawn[0],
    title: (worldspawn[0] || {}).message || mapname,
    images: images,
    pakname: MAP_DICTIONARY[mapname]
  }

}

module.exports = {
  getMapInfo,
}
