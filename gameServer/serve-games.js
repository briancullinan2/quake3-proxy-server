
const { MAP_DICTIONARY } = require('../assetServer/list-maps.js')
const { sourcePk3Download, MAP_TITLES } = require('../mapServer/serve-download.js')
const { serveMaster, sendOOB, GAME_SERVERS } = require('./master.js')
const { lookupDNS } = require('../utilities/dns.js')
const { getGame, INDEX } = require('../utilities/env.js')

const MASTER_PORTS = [27950]

async function getGameJson(games) {
  let result = []
  for (let i = 0; i < games.length; i++) {
    if (!games[i].hostname || !games[i].mapname) {
      continue
    }
    let mapname = games[i].mapname.toLocaleLowerCase()
    let levelshot
    let pk3name = await sourcePk3Download(mapname)
    if (pk3name) {
      levelshot = `/${getGame()}/${MAP_DICTIONARY[mapname]}.pk3dir/levelshots/${mapname}.jpg`
    } else {
      levelshot = '/unknownmap.jpg'
    }
    result.push({
      title: MAP_TITLES[mapname] || mapname,
      levelshot: levelshot,
      bsp: mapname,
      pakname: MAP_DICTIONARY[mapname],
      have: !!pk3name,
      mapname: mapname,
      hostname: games[i].hostname,
      address: games[i].address,
      port: games[i].port,
    })
  }
  return result
}


async function serveGames(request, response, next) {
  let isJson = request.url.match(/\?json/)
  let filename = request.originalUrl.replace(/\?.*$/, '')
  //console.log(GAME_SERVERS)
  if (!filename.match(/^\/games(\/?$|\/)/i)) {
    return next()
  }

  let rangeString = filename.split('\/games\/')[1]
  let start = 0
  let end = 100
  if (rangeString && rangeString.includes('\/')) {
    start = parseInt(rangeString.split('\/')[0])
    end = parseInt(rangeString.split('\/')[1])
  } else
    if (rangeString && rangeString.includes(':')) {
      let address = rangeString.split(':')[0]
      let port = rangeString.split(':')[1]
      return next()
    }

  let total = Object.values(GAME_SERVERS).length
  let games = Object.values(GAME_SERVERS).slice(start, end)
  let json = await getGameJson(games)
  if (isJson) {
    return response.json(json)
  }
  let list = ''
  for (let i = 0; i < json.length; i++) {
    list += '<li>'
    list += `<h3><a href="/games/${json[i].address}:${json[i].port}">`
    list += `<span>${json[i].hostname}</span>`
    list += `</a></h3>`
    list += `<img ${json[i].have ? '' : 'class="unknownmap"'} src="${json[i].levelshot}" />`
    list += `<a href="/maps/download/${json[i].mapname}">${json[i].title}</a>`
    list += '</li>'
  }
  let offset = INDEX.match('<body>').index + 6
  let index = INDEX.substring(0, offset)
    + `<ol id="game-list" class="stream-list">${list}</ol>
      <script>window.sessionLines=${JSON.stringify(json)}</script>
      <script>window.sessionLength=${total}</script>
      <script>window.sessionCallback='/games/'</script>
      <script async defer src="index.js"></script>
      ` + INDEX.substring(offset, INDEX.length)
  return response.send(index)
}

module.exports = {
  MASTER_PORTS,
  serveGames,
}