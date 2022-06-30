
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
const { findFile } = require('../contentServer/virtual.js')
const { getGame } = require('../utilities/env.js')
const { downloadCache, INDEX } = require('../utilities/env.js')
const { layeredDir } = require('../contentServer/content.js')
const { getIndex } = require('../utilities/zip.js')

const { LVLWORLD_DB } = require('../utilities/env.js')
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
const MAP_DICTIONARY = {}
const MAP_SOURCES = {}


async function sourcePk3Download(filename) {
  let mapname = path.basename(filename).replace('.pk3', '').toLocaleLowerCase()
  let source
  if (typeof MAP_SOURCES[mapname] != 'undefined') {
    return MAP_SOURCES[mapname]
  }

  if (typeof MAP_DICTIONARY[mapname] != 'undefined') {
    let pk3name = MAP_DICTIONARY[mapname]
    let cached = findFile(getGame() + '/' + pk3name)
    if (cached) {
      source = cached
    } else
      if ((cached = findFile('baseq3/' + pk3name))) {
        source = cached
      } else
        if (fs.existsSync(path.join(downloadCache(), pk3name))) {
          source = path.join(downloadCache(), pk3name)
        }
  }

  if (source) {
    MAP_SOURCES[mapname] = source
  }
  return source
}


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


async function serveDownload(request, response, next) {
  let filename = request.url.replace(/\?.*$/, '')
  if (filename.startsWith('/')) {
    filename = filename.substr(1)
  }
  let mapname = path.basename(filename).replace('.pk3', '').toLocaleLowerCase()
  await existingMaps()
  if (typeof MAP_DICTIONARY[mapname] == 'undefined') {
    return next(new Error('File not found: ' + filename))
  }
  if (MAP_DICTIONARY[mapname].substr(0, 3) == 'pak'
    && MAP_DICTIONARY[mapname].charCodeAt(3) - '0'.charCodeAt(0) < 9) {
    return next(new Error('Won\'t serve base file: ' + MAP_DICTIONARY[mapname]))
  }
  let newFile = path.join(downloadCache(), MAP_DICTIONARY[mapname])
  console.log('Downloading:', newFile)
  if (fs.existsSync(newFile)) {
    return response.sendFile(newFile, {
      headers: { 'content-disposition': `attachment; filename="${MAP_DICTIONARY[mapname]}"` }
    })
  } else {
    return next(new Error('File not found: ' + filename))
  }

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
  return await serveMapsReal(start, end, isJson, response)
}


async function serveMapsReal(start, end, isJson, response) {
  let mapsAvailable = await existingMaps()
  let maps = mapsAvailable.slice(start, end)
  if (isJson) {
    return response.json(maps)
  }

  let total = mapsAvailable.length
  let list = (await Promise.all(maps.map(map => renderMap(map)))).join('')
  let offset = INDEX.match('<body>').index + 6
  let index = INDEX.substring(0, offset)
      + `<ol id="map-list" class="stream-list">${list}</ol>
      <script>window.sessionLines=${JSON.stringify(maps)}</script>
      <script>window.sessionLength=${total}</script>
      <script>window.sessionCallback='/maps/'</script>
      <script async defer src="index.js"></script>
      ` + INDEX.substring(offset, INDEX.length)
  return response.send(index)
}


async function serveMaps(request, response, next) {
  let isJson = request.url.match(/\?json/)
  let start = 0
  let end = 100
  return await serveMapsReal(start, end, isJson, response)
}


async function renderMap(map) {
  let result = ''
  result += `<li style="background-image: url('${map.levelshot}')">`
  result += `<h3><a href="/maps/${map.bsp}">`
  result += `<span>${map.title}</span>`
  result +=  map.bsp && map.title != map.bsp
    ? '<small>' + map.bsp + '</small>' : '<small>&nbsp;</small>'
  result += `</a></h3>`
  result += `<img ${map.have ? '' : 'class="unknownmap"'} src="${map.levelshot}" />`
  result += `<a href="/maps/download/${map.bsp}">Download: ${map.pakname}`
  //result += map.pakname.includes('.pk3') ? '' : '.pk3'
  return result
}



module.exports = {
  MAP_DICTIONARY,
  //MAP_TITLES,
  //MAP_SOURCES,
  sourcePk3Download,
  serveMaps,
  serveDownload,
  serveMapsRange,
  existingMaps,
}
