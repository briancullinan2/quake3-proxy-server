const path = require('path')
const fs = require('fs')

const { findFile } = require('../assetServer/virtual.js')
const { FS_GAMEHOME, getGame } = require('../utilities/env.js')
const { sourcePk3Download } = require('../mapServer/download.js')
const { layeredDir } = require('../assetServer/layered.js')
const { execLevelshot } = require('../mapServer/serve-lvlshot.js')
const { ScanAndLoadShaderFiles } = require('../assetServer/shaders.js')
const { START_SERVICES } = require('../contentServer/features.js')
const { MAP_DICTIONARY } = require('../mapServer/download.js')

const GAME_ARENAS = {

}

const MAP_ARENAS = {

}

const MAP_ENTITIES = {}



// TODO: rewrite this completely use read BSP files directly or use WASM functionally
async function getMapInfo(mapname) {
  let basegame = getGame()
  // TODO: make sure BSP file is available synchronously first
  let newFile = await sourcePk3Download(mapname)
  await ScanAndLoadShaderFiles()

  let pk3Path = `/${basegame}/${path.basename(newFile)}dir`

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
  let images = []

  // TODO: contribute to lvlshot database cached locally
  if(images.length == 0 || entities.length == 0) {
    //let fileResults = await execLevelshot(mapname, /-images\.txt|-models\.txt|-sounds\.txt/)
    //if(fileResults.length) {
    //  images = fileResults[0].split('\n').map(img => img.toLocaleLowerCase()
    //      .replace(path.extname(img), ''))
    //}
  }
  let entities
  let worldspawn = await Promise.any([
    Promise.resolve(getEntities(basegame, mapname)).then(
    function (ents) {
      entities = ents
      return parseWorldspawn(entities)
    }),
    new Promise(resolve => setTimeout(resolve.bind(null, []), 200))
  ])

  return {
    bsp: mapname,
    levelshot: levelshotPath,
    entities: entities + '\n' + (scripts || []).join('\n'),
    worldspawn: worldspawn[0],
    title: await findMapname(basegame, mapname),
    images: images,
    pakname: MAP_DICTIONARY[mapname]
  }

}

async function getEntities(basegame, mapname) {
  let entities = ''
  if(typeof  MAP_ENTITIES[basegame + '/' + mapname] != 'undefined') {
    return MAP_ENTITIES[basegame + '/' + mapname]
  }
  let entityFile = path.join(FS_GAMEHOME, basegame, 'maps', mapname + '.ent')
  if (fs.existsSync(entityFile)) {
    entities = fs.readFileSync(entityFile).toString('utf-8')
  } else
  // TODO: contribute to lvlshot database cached locally
  if(START_SERVICES.includes('deploy')) {
    let fileResults = await execLevelshot(mapname, /saveents/)
    console.log('Entities:', fileResults)
    if(fileResults.length && fileResults[0]) {
      entities = fileResults[0]
    }
  }

  // TODO: alternatively extract from bytes and BSP file
  MAP_ENTITIES[basegame + '/' + mapname] = entities
  return entities
}


async function parseWorldspawn(entities) {
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
  return worldspawn
}


async function findMapname(basegame, mapname) {
  let worldspawn = await Promise.any([
    Promise.resolve(getEntities(basegame, mapname)).then(parseWorldspawn),
    new Promise(resolve => setTimeout(resolve.bind(null, []), 200))
  ])
  return (worldspawn[0] || {}).message || mapname
}


module.exports = {
  getMapInfo,
  findMapname,
  parseWorldspawn,
  getEntities,

}
