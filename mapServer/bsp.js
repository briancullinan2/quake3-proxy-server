const path = require('path')
const fs = require('fs')

const { findFile } = require('../assetServer/virtual.js')
const { FS_GAMEHOME, getGame } = require('../utilities/env.js')
const { sourcePk3Download } = require('../mapServer/download.js')
const { repackedCache } = require('../utilities/env.js')
const { streamFileKey } = require('../utilities/zip.js')
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
  /*
  if (!foundBsp) {
    let bspFile = path.join(caches[0], path.basename(newFile) + 'dir', `/maps/${mapname}.bsp`)
    fs.mkdirSync(path.dirname(bspFile), { recursive: true })
    const file = fs.createWriteStream(bspFile)
    await streamFileKey(newFile, `maps/${mapname}.bsp`, file)
    file.close()
  }
  */

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
  let entities = await getEntities(basegame, mapname)
  let worldspawn = parseWorldspawn(entities)

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
    console.log(fileResults)
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
  let entities = await getEntities(basegame, mapname)
  let worldspawn = await parseWorldspawn(entities)
  return (worldspawn[0] || {}).message || mapname
}


module.exports = {
  getMapInfo,
  findMapname,
  parseWorldspawn,
  getEntities,

}
