
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
const MAP_LIST = require('../utilities/lvlworld.json')
const {findFile} = require('../contentServer/virtual.js')
const {getGame} = require('../utilities/env.js')
const {downloadCache, INDEX} = require('../utilities/env.js')

const MAP_DICTIONARY = {}
const MAP_TITLES = {}

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

async function sourcePk3Download(filename) {
  let mapname = path.basename(filename).replace('.pk3', '')
                    .toLocaleLowerCase()
  let request
  let response
  
  // TODO: remove for testing
  if(mapname == 'sokam-bloody') {
    return path.join(downloadCache(), 'sokam-bloody.pk3')
  }

  if(typeof MAP_DICTIONARY[mapname] != 'undefined') {
    let cached = findFile(getGame() + '/' + MAP_DICTIONARY[mapname] + '.pk3')
    if(cached) {
      return cached
    } else
    if(fs.existsSync(path.join(downloadCache(), MAP_DICTIONARY[mapname] + '.pk3'))) {
      return path.join(downloadCache(), MAP_DICTIONARY[mapname] + '.pk3')
    }
  }

  return
  // GODDAMNIT PAN won't update API to be more like Google's
  //   rate limiter. Pan: "You should never have to redownload a file"
  // Because of this ITSM-anti-pattern around contributing
  //   changes to fit my need to ws.q3df.org, and voting on it
  //   publicly, I have to reinvent the wheel. "Not Invented Here"

  response = await new Promise(function (resolve, reject) {
    request = require('http').get(
      `http://ws.q3df.org/maps/download/${mapname}`,
    function(response) {
      if(response.statusCode != 200) {
        request.end()
        return reject(new Error('Could not download ' + mapname))
      }
      resolve(response)
    })
    request.on('error', reject)
  })

  let pk3header = response.headers['content-disposition']
  let pk3name = (/filename=["'\s]*([^"'\s]*)["'\s]*/i).exec(pk3header)
  let repacked = findFile(pk3name[1])
  if(repacked) {
    request.end()
    return repacked
  }

  newFile = path.join(downloadCache(), pk3name[1])
  if(fs.existsSync(newFile)) {
    request.end()
    return newFile
  }

  await new Promise(function (resolve, reject) {
    const file = fs.createWriteStream(newFile)
    response.pipe(file)
    file.on('finish', resolve)
  })
  // after download completed close filestream
  return newFile
}


async function getMapJson(maps) {
  let result = []
  for(let i = 0; i < maps.length; i++) {
    let levelshot
    let pk3name = await sourcePk3Download(maps[i])
    if(pk3name) {
      levelshot = `/${getGame()}/${MAP_DICTIONARY[maps[i]]}.pk3dir/levelshots/${maps[i]}.jpg`
    } else {
      levelshot = '/unknownmap.jpg'
    }
    result.push({
      title: MAP_TITLES[maps[i]] || maps[i],
      levelshot: levelshot,
      bsp: maps[i],
      pakname: MAP_DICTIONARY[maps[i]],
      have: !!pk3name
    })
  }
  return result
}


async function serveMaps(request, response, next) {
  let isJson = request.url.match(/\?json/)
  let filename = request.url.replace(/\?.*$/, '')

  if(filename.includes('maps/download/')) {
    let mapname = path.basename(filename).replace('.pk3', '')
        .toLocaleLowerCase()
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
  if(rangeString) {
    let mapname = path.basename(filename).replace('.pk3', '')
        .toLocaleLowerCase()
    if(fs.existsSync(path.join(downloadCache(), MAP_DICTIONARY[mapname] + '.pk3'))) {
      return getMapInfo(mapname)
    } else {
      return next()
    }
  }

  let total = Object.keys(MAP_DICTIONARY).length
  let maps = Object.keys(MAP_DICTIONARY).slice(start, end)
  let json = await getMapJson(maps)
  if(isJson) {
    return response.json(json)
  }
  let list = ''
  for(let i = 0; i < json.length; i++) {
    if(!json[i].have) {
      continue
    }
    list += `<li style="background-image: url('${json[i].levelshot}')">`
    list += `<h3><a href="/maps/${maps[i]}">`
    list += `<span>${json[i].title}</span>`
    list += json[i].title != json[i].bsp 
          ? '<small>' + maps[i] + '</small>' : '<small>&nbsp;</small>'
    list += `</a></h3>`
    list += `<img ${json[i].have ? '' : 'class="unknownmap"'} src="${json[i].levelshot}" />`
    list += `<a href="/maps/download/${maps[i]}">Download: ${json[i].pakname}.pk3</a>`
    list += '</li>'
  }
  let offset = INDEX.match('<body>').index
  let index = INDEX.substring(0, offset)
      + `
      <script>window.sessionLines=${JSON.stringify(json)}</script>
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


module.exports = {
  MAP_DICTIONARY,
  MAP_TITLES,
  sourcePk3Download,
  serveMaps,
}
