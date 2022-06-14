
const {sourcePk3Download, MAP_TITLES, MAP_DICTIONARY} = require('../mapServer/serve-download.js')
const {serveMaster, sendOOB, GAME_SERVERS} = require('../proxyServer/master.js')
const {createUDP} = require('../proxyServer/serve-udp.js')
const {lookupDNS} = require('../utilities/dns.js')
const {getGame, INDEX} = require('../utilities/env.js')

const MASTER_PORTS = [27950]
const UDP_SOCKETS = []
const MASTER_SERVERS = [
  'ws://master.quakejs.com:27950', 
  '207.246.91.235:27950', 
  'master.quake3arena.com',
]

function createMasters(mirror) {
  // udp
  for(let i = 0; i < MASTER_PORTS.length; i++) {
    UDP_SOCKETS[MASTER_PORTS[i]] = createUDP(MASTER_PORTS[i])
    UDP_SOCKETS[MASTER_PORTS[i]].on('message', 
    async function (message, rinfo) {
      try {
        await serveMaster(UDP_SOCKETS[MASTER_PORTS[i]], message, rinfo)
      } catch (e) {
        console.log(e)
      }
    })
  }

  // I think it would be very fullfuling for our species
  //   if we could all simultaneously imagine the apacolypse
  //   in 3D. So fullfilling, prophetic even. Then take off 
  //   the VR goggles and be over it.
  if(!mirror)
    return

  // preload our own master server with results from parent master servers
  //   TODO: does dpmaster do this?
  for(let i = 0; i < MASTER_SERVERS.length; i++) {
    if(MASTER_SERVERS[i].includes('ws:')) // TODO
      continue
    Promise.resolve(queryMaster(MASTER_SERVERS[i]))
  }
}

async function queryMaster(master) {
  let port = 27950
  let masterPort = (/\:([0-9]+)$/i).exec(master)
  if(masterPort) {
    port = parseInt(masterPort[1])
  }
  let address = master.split(':')[0]
  let resolved = await lookupDNS(address)
  sendOOB(UDP_SOCKETS[MASTER_PORTS[0]], 'getservers 68 ', {
    address: resolved,
    port: port,
  })
  sendOOB(UDP_SOCKETS[MASTER_PORTS[0]], 'getservers 72 ', {
    address: resolved,
    port: port,
  })
}



async function getGameJson(games) {
  let result = []
  for(let i = 0; i < games.length; i++) {
    if(!games[i].hostname || !games[i].mapname) {
      continue
    }
    let mapname = games[i].mapname.toLocaleLowerCase()
    let levelshot
    let pk3name = await sourcePk3Download(mapname)
    if(pk3name) {
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
    })
  }
  return result
}


async function serveGames(request, response, next) {
  let isJson = request.url.match(/\?json/)
  let filename = request.url.replace(/\?.*$/, '')
  //console.log(GAME_SERVERS)
  if(!filename.match(/^\/games\/?$/i)) {
    return next()
  }

  let rangeString = filename.split('\/maps\/')[1]
  let start = 0
  let end = 100
  if(rangeString) {
    start = parseInt(rangeString.split('\/')[0])
    end = parseInt(rangeString.split('\/')[1])
  }

  let total = Object.values(GAME_SERVERS).length
  let games = Object.values(GAME_SERVERS).slice(start, end)
  let json = await getGameJson(games)
  if(isJson) {
    return response.json(json)
  }
  let list = ''
  for(let i = 0; i < json.length; i++) {
    list += '<li>'
    list += `<h3><a href="/games/${json[i].address}">`
    list += `<span>${json[i].hostname}</span>`
    list += `</a></h3>`
    list += `<img ${json[i].have ? '' : 'class="unknownmap"'} src="${json[i].levelshot}" />`
    list += `<a href="/maps/download/${json[i].mapname}">${json[i].title}</a>`
    list += '</li>'
  }
  let offset = INDEX.match('<body>').index
  let index = INDEX.substring(0, offset)
      + `
      <script>window.sessionLines=${JSON.stringify(json)}</script>
      <script>window.sessionLength=${total}</script>
      <ol id="game-list">${list}</ol>
      <script async defer src="index.js"></script>
      `
      + INDEX.substring(offset, INDEX.length)
  return response.send(index)
}

module.exports = {
  MASTER_PORTS,
  createMasters,
  serveGames,
}