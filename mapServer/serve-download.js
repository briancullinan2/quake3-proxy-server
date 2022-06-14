
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
const {LVLWORLD_DB} = require('../utilities/env.js')
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
const {findFile} = require('../contentServer/virtual.js')
const {getGame} = require('../utilities/env.js')
const {downloadCache, INDEX} = require('../utilities/env.js')
const {downloadAllMeta} = require('../utilities/metadata.js')
const {layeredDir} = require('../contentServer/content.js')
const {getIndex} = require('../utilities/zip.js')

/*
const MAP_DICTIONARY = {}
const MAP_TITLES = {}
const MAP_SOURCES = {}

let maps = Object.keys(MAP_LIST).sort()
for(let i = 0; i < maps.length; i++) {
  let mapname = MAP_LIST[maps[i]].includes.filter(i => typeof i['bsp'] != 'undefined')
  if(mapname.length == 0) {
    continue
  }
  if(typeof MAP_TITLES[mapname[0].bsp.toLocaleLowerCase()] != 'undefined') {
    continue
  }
  MAP_TITLES[mapname[0].bsp.toLocaleLowerCase()] = mapname[0].title
  MAP_DICTIONARY[mapname[0].bsp.toLocaleLowerCase()] = maps[i]
}
//console.log(MAP_DICTIONARY)
*/

async function sourcePk3Download(filename) {
  let mapname = path.basename(filename).replace('.pk3', '')
                    .toLocaleLowerCase()
  let source

  if(typeof MAP_SOURCES[mapname] != 'undefined') {
    return MAP_SOURCES[mapname]
  }

  // TODO: remove for testing
  if(mapname == 'sokam-bloody') {
    source = path.join(downloadCache(), 'sokam-bloody.pk3')
  }

  if(typeof MAP_DICTIONARY[mapname] != 'undefined') {
    let pk3name = MAP_DICTIONARY[mapname] + '.pk3'
    let cached = findFile(getGame() + '/' + pk3name)
    if(cached) {
      source = cached
    } else
    if((cached = findFile('baseq3/' + pk3name))) {
      source = cached
    } else
    if(fs.existsSync(path.join(downloadCache(), pk3name))) {
      source = path.join(downloadCache(), pk3name)
    }
  }

  if(source) {
    MAP_SOURCES[mapname] = source
  }

  return source
}

/*
async function getMapJson(maps) {
  let result = []
  let have = false
  for(let i = 0; i < maps.length; i++) {
    let levelshot
    if(typeof MAP_SOURCES[maps[i]] != 'undefined') {
      have = true
      levelshot = `/${getGame()}/${MAP_DICTIONARY[maps[i]]}.pk3dir/levelshots/${maps[i]}.jpg`
    } else {
      levelshot = '/unknownmap.jpg'
    }
    result.push({
      title: MAP_TITLES[maps[i]] || maps[i],
      levelshot: levelshot,
      bsp: maps[i],
      pakname: MAP_DICTIONARY[maps[i]],
      have: have
    })
  }
  return result
}
*/


async function getExistingMaps() {
  let basegame = getGame()
  //let pk3names = Object.values(MAP_LIST_LOWER)
  let gamedir = await layeredDir(basegame)
  let pk3files = gamedir.filter(file => file.endsWith('.pk3'))
  let maps = await Promise.all(pk3files.map(async function (pk3name) {
    let index = await getIndex(findFile(pk3name))
    let bsps = index.filter(item => item.key.endsWith('.bsp'))
    let maps = bsps.map(function (bsp) {
      let mapname = path.basename(bsp.key).replace(/\.bsp$/i, '')
      return {
        levelshot: `/${basegame}/${path.basename(pk3name)}dir/levelshots/`
            + mapname + '.jpg',

        pakname: path.basename(pk3name).replace('map-', '').replace('map_', ''),
        title: mapname,
        bsp: mapname,
      }
    })
    return maps
  }))
  return maps.flat(1)
}


async function serveDownload() {
  
}


async function serveMaps(request, response, next) {
  let isJson = request.url.match(/\?json/)
  let filename = request.url.replace(/\?.*$/, '')

  if(filename.includes('maps/download/')) {
    let mapname = path.basename(filename).replace('.pk3', '').toLocaleLowerCase()
    let newFile = path.join(downloadCache(), MAP_DICTIONARY[mapname] + '.pk3')
    console.log('Downloading:', newFile)
    if(fs.existsSync(newFile)) {
      return response.sendFile(newFile, {
        headers: { 'content-disposition': `attachment; filename="${MAP_DICTIONARY[mapname] + '.pk3'}"`}
      })
    } else {
      return next()
    }
  }
  if(filename.includes('maps/reload/')) {
    await downloadAllMeta()
    return response.send('Metadata downloaded.')
  }

  if(!filename.match(/^\/maps(\/?$|\/)/i)) {
    return next()
  }

  let rangeString = filename.split('\/maps\/')[1]
  let start = 0
  let end = 100
  if(rangeString && rangeString.includes('\/')) {
    start = parseInt(rangeString.split('\/')[0])
    end = parseInt(rangeString.split('\/')[1])
  } else 
  // display map info, desconstruct
  if(rangeString && rangeString.length > 0) {
    let pk3name = MAP_DICTIONARY[mapname] + '.pk3'
    let mapname = path.basename(filename).replace('.pk3', '')
        .toLocaleLowerCase()
    if(fs.existsSync(path.join(downloadCache(), pk3name))) {
      return getMapInfo(mapname)
    } else {
      return next()
    }
  }

  let mapsAvailable = await getExistingMaps()
  console.log(mapsAvailable)
  let maps = mapsAvailable.slice(start, end)
  if(isJson) {
    return response.json(maps)
  }
  let total = mapsAvailable.length
  let list = (await Promise.all(maps.map(map => renderMap(map)))).join('')
  let offset = INDEX.match('<body>').index
  let index = INDEX.substring(0, offset)
      + `
      <script>window.sessionLines=${JSON.stringify(maps)}</script>
      <script>window.sessionLength=${total}</script>
      <ol id="map-list">${list}</ol>
      <script async defer src="index.js"></script>
      `
      + INDEX.substring(offset, INDEX.length)
  return response.send(index
//    don't accept-ranges because it will request partial and we don't
//    feel like doing the math to figure out which part of the html based
//    list they need, so only accept ranges from the unacceptable ranges header
//    if javascript will allow, so the page doesn't get too large. 
//    headers: { 'accept-ranges': 'bytes'}
// Otherwise
//    show something like a cached best rated maps so it isn't enumerating
//    the entire database every request.
  )
}


async function renderMap(map) {
  let result = ''
  result += `<li style="background-image: url('${map.levelshot}')">`
  result += `<h3><a href="/maps/${map.bsp}">`
  result += `<span>${map.title}</span>`
  result += map.title != map.bsp 
        ? '<small>' + map.bsp + '</small>' : '<small>&nbsp;</small>'
  result += `</a></h3>`
  result += `<img ${map.have ? '' : 'class="unknownmap"'} src="${map.levelshot}" />`
  result += `<a href="/maps/download/${map.bsp}">Download: ${map.pakname}`
  result += map.pakname.includes('.pk3') ? '' : '.pk3'
  result += '</a></li>'
  return result
}



module.exports = {
  //MAP_DICTIONARY,
  //MAP_TITLES,
  //MAP_SOURCES,
  sourcePk3Download,
  serveMaps,
}
