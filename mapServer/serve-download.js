
// This lvlworld dictionary is a full dump of the database from
//   Tig https://lvlworld.com/metadata/from:2021-04-01/extended
// Although lvlworld has been extremely helpful. The database 
//   design, comment system, none of it is open source, so it 
//   can't be supplemented with filters for specific mods, 
//   custom templates for admins to use, or this chat program
//   from https://efservers.com/
// There are multiple conversations on how nice it would be to 
//   have their own open source version of lvlworld or ws.q3df.org
//   Philosophically, I see this like the fork-tree-of-life.
//   A project gets forked dozens of times, people make their 
//   modifications, and only the greatest ideas are filtered
//   by upstream. 
// Since idSoftware isn't accepting PRs, the 
//   most upstream is ioq3, and I'm banned. A new form of 
//   "Not Invented Here", I'm not allowed to contribute. ioq3
//   has administration problems, I'm blocked from forking, even
//   though there is a path to cleaning up ioq3. NuclearMonster 
//   could easily create a new repository that is based on the 
//   previous repository. Obviously, the question arises, "what
//   happens to all those people relying on updates to code?".
//   Rename the old repository to something like ioq3_old, and
//   then rename the new repository back to ioq3. Maintainers 
//   will still get updates, but the overloaded list of forks
//   on Github will be reset.
const fs = require('fs')
const path = require('path')

const { LVLWORLD_DB, downloadCache, getGame } = require('../utilities/env.js')
const { MAP_DICTIONARY, filteredMaps } = require('../assetServer/list-maps.js')
const { renderIndex, renderList, renderMenu } = require('../utilities/render.js')
const { renderFilelist } = require('../contentServer/serve-settings.js')
const { listPk3s, filterPk3 } = require('../assetServer/layered.js')
const { findFile } = require('../assetServer/virtual.js')
const { ASSET_FEATURES } = require('../contentServer/serve-settings.js')


const MAP_LIST = require(path.join(LVLWORLD_DB, 'maplist.json'))
  .reduce((obj, item) => {
    obj[item.id] = item.fileName
    return obj
  }, {})
const MAP_LIST_LOWER = Object.keys(MAP_LIST)
  .reduce((obj, key) => {
    obj[key] = MAP_LIST[key].toLocaleLowerCase()
    return obj
  }, {})



async function serveDownload(request, response, next) {
  let filename = request.url.replace(/\?.*$/, '')
  if (filename.startsWith('/')) {
    filename = filename.substr(1)
  }
  let mapname = path.basename(filename).replace('.pk3', '').toLocaleLowerCase()
  let caches = downloadCache()

  // handle pk3 files by name directly
  let newFile = findFile(getGame() + '/' + path.basename(filename))
  if(newFile && newFile.match(/\.pk3$/i)) {
    console.log('Downloading:', newFile)
    return response.sendFile(newFile, {
      headers: { 'content-disposition': `attachment; filename="${path.basename(filename)}"` }
    })
  }

  for(let i = 0; i < caches.length; i++) {
    let pk3File = path.join(caches[i], path.basename(filename))
    if(fs.existsSync(pk3File) && pk3File.match(/\.pk3$/i)) {
      console.log('Downloading:', pk3File)
      return response.sendFile(pk3File, {
        headers: { 'content-disposition': `attachment; filename="${path.basename(filename)}"` }
      })
    }
  }

  // try to figure out pk3 name using indexing features, 
  //   because it doesn't always match map name
  await filteredMaps()

  if (typeof MAP_DICTIONARY[mapname] == 'undefined') {
    return next(new Error('File not found: ' + filename))
  }
  if (MAP_DICTIONARY[mapname].substr(0, 3) == 'pak'
    && MAP_DICTIONARY[mapname].charCodeAt(3) - '0'.charCodeAt(0) < 9) {
    return next(new Error('Won\'t serve base file: ' + MAP_DICTIONARY[mapname]))
  }


  for(let i = 0; i < caches.length; i++) {
    let newFile = path.join(caches[i], MAP_DICTIONARY[mapname])
    if(fs.existsSync(newFile)) {
      console.log('Downloading:', newFile)
      return response.sendFile(newFile, {
        headers: { 'content-disposition': `attachment; filename="${MAP_DICTIONARY[mapname]}"` }
      })
    }
  }

  return next(new Error('File not found: ' + filename))
}


async function serveMapsRange(request, response, next) {
  let isJson = request.url.match(/\?json/)
  let filename = request.originalUrl.replace(/\?.*$/, '')
  let start = 0
  let end = 100
  let rangeString = filename.split(/\/maps\//i)[1]
  if (rangeString && rangeString.includes('\/')) {
    start = parseInt(rangeString.split('\/')[0])
    end = parseInt(rangeString.split('\/')[1])
  }
  let basegame = getGame()
  if(request.query && typeof request.query.game != 'undefined') {
    // TODO: validate
    basegame = request.query.game
  }
  return await serveMapsReal(start, end, isJson, basegame, response)
}


async function serveMapsReal(start, end, isJson, game, response) {
  let mapsAvailable = await filteredMaps(game)
  let maps = mapsAvailable.slice(start, end)
  if (isJson) {
    return response.json(maps)
  }

  let total = mapsAvailable.length
  let basegame = getGame()
  let index = renderIndex(renderList('/maps' 
    + (game != basegame ? ('?game=' + game) : ''), maps, total, 'map-list'))
  return response.send(index)
}


async function serveMaps(request, response, next) {
  let isJson = request.url.match(/\?json/)
  let start = 0
  let end = 100
  let basegame = getGame()
  if(request.query && typeof request.query.game != 'undefined') {
    // TODO: validate
    basegame = request.query.game
  }
  return await serveMapsReal(start, end, isJson, basegame, response)
}


async function listDownloads() {

  // TODO: list downloaded and not downloaded pk3s
  let pk3Names = (await listPk3s(getGame())).map(findFile)
  let downloads = downloadCache()
  for(let i = 0; i < downloads.length; i++) {
    if(fs.existsSync(downloads[i])) {
      pk3Names.push.apply(pk3Names, fs.readdirSync(downloads[i])
          .filter(filterPk3).map(file => path.join(downloads[i], file)))
    }
  }
  let pk3sFiltered = pk3Names.filter(pk3 => !path.basename(pk3).startsWith('pak'))
  return pk3sFiltered
}


async function describePk3(absolute) {
  let stat = fs.statSync(absolute)
  return {
    name: path.basename(absolute).replace(/\.pk3$/i, ''),
    mtime: stat.mtime,
    size: stat.size,
    absolute: absolute,
    link: '/maps/download/' + path.basename(absolute)
  }
}


let DOWNLOADS_MENU = [{
  title: 'Downloads',
  link: 'downloads',
  subtitle: 'Downloaded Maps / Add-ons'
}, {
  title: 'Missing',
  link: 'missing',
  subtitle: 'Missing Maps / Fetch'
}, {
  title: 'Sources',
  link: 'sources',
  subtitle: 'Remote Sources / Hosting'
}, {
  title: 'Queue',
  link: 'queue',
  subtitle: 'Download Queue / Active'
}]


async function serveDownloadList(request, response, next) {
  let isIndex = request.originalUrl.match(/\?index/)
  let isJson = request.originalUrl.match(/\?json/)
  let filename = request.originalUrl.replace(/\?.*$/, '')
  if(filename.startsWith('/')) {
    filename = filename.substring(1)
  }
  if(filename.endsWith('/')) {
    filename = filename.substring(0, filename.length - 1)
  }

  // TODO: make async
  let pk3sPaths = await listDownloads()
  // TODO: compare pk3 name with known pk3s from remotes
  let pk3sFiltered
  if(filename.match(/missing/i)) {
    let allMaps = Object.values(MAP_LIST)
    let exitingNames = pk3sPaths.map(map => path.basename(map).replace(/^map[-_]/i, '').replace(/\.pk3/i, '').toLocaleLowerCase())
    pk3sFiltered = allMaps.filter(map => !exitingNames.includes(map.replace(/^map[-_]/i, '').toLocaleLowerCase())).map(map => ({
      name: map || '',
      absolute: ''
    }))
    console.log(pk3sFiltered)
  } else {
    pk3sFiltered = await Promise.all(pk3sPaths.slice(0, 100).map(describePk3))
  }


  return response.send(renderIndex(
  renderMenu(DOWNLOADS_MENU, 'downloads-menu')
  + `<div class="info-layout">
  <h2>${filename.match(/missing/i) ? 'Missing' : 'Downloads'}</h2>
  <ol class="directory-list">${pk3sFiltered.map(renderFilelist).join('\n')}
  </ol>
  </div>
  `))
}



module.exports = {
  serveMaps,
  serveDownload,
  serveMapsRange,
  serveDownloadList,
}
