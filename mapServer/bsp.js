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
  let caches = repackedCache()
  // TODO: make sure BSP file is available synchronously first
  let newFile = await sourcePk3Download(mapname)
  await ScanAndLoadShaderFiles()

  let pk3Path = `/${basegame}/${path.basename(newFile)}dir`
  let foundBsp = false
  for(let i = 0; i < caches.length; i++) {
    let newZip = path.join(caches[i], path.basename(newFile))
    let bspFile = path.join(newZip + 'dir', `/maps/${mapname}.bsp`)
    if(fs.existsSync(bspFile)) {
      foundBsp = true
    }
  }
  // extract the BSP because we might change it anyways
  if (!foundBsp) {
    let bspFile = path.join(caches[0], path.basename(newFile) + 'dir', `/maps/${mapname}.bsp`)
    fs.mkdirSync(path.dirname(bspFile), { recursive: true })
    const file = fs.createWriteStream(bspFile)
    await streamFileKey(newFile, `maps/${mapname}.bsp`, file)
    file.close()
  }

  let levelshotPath = path.join(pk3Path, '/levelshots/', mapname + '.jpg')
  let levelshot = findFile(levelshotPath)
  if (levelshot.match(/\.pk3$/i)) {
    //newFile = await extractPk3(newFile)
  }


  let scripts = layeredDir(path.join(pk3Path, '/scripts/'))
  if (typeof GAME_ARENAS[basegame] == 'undefined') {
    let baseArenas = findFile(path.join(basegame, '/pak0.pk3/scripts/arenas.txt'))

  }


  // TODO: combine with BSP loop above
  let entities = ''
  let images = []
  for(let i = 0; i < caches.length; i++) {

    let entityFile = path.join(caches[i], '/maps/', mapname + '.ent')
    if (fs.existsSync(entityFile)) {
      entities = fs.readFileSync(entityFile).toString('utf-8')
    }


    let imagesFile = path.join(caches[i], '/maps/', mapname + '-images.txt')
    if (fs.existsSync(imagesFile)) {
      images = fs.readFileSync(imagesFile).toString('utf-8').split('\n')
    }

  }
  if(images.length == 0 || entities.length == 0) {
    Promise.resolve(execLevelshot(mapname)).then(console.log).catch(console.error)
  }
  if(images.length == 0) {
    // async
    console.error('WARNING: images not found: ' + mapname)
  }
  if(entities.length == 0) {
    console.error('WARNING: entities not found: ' + mapname)
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
