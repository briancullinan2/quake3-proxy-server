const path = require('path')
const fs = require('fs')

const { MAP_DICTIONARY } = require('../assetServer/list-maps.js')
const { sourcePk3Download } = require('../mapServer/download.js')
const { getGame } = require('../utilities/env.js')
const { renderIndex, renderList, renderMenu } = require('../utilities/render.js')
const { UDP_SOCKETS, MASTER_PORTS, INFO_TIMEOUT, 
  RESOLVE_STATUS, sendOOB } = require('./master.js')
const { lookupDNS } = require('../utilities/dns.js')
const { updatePageViewers } = require('../contentServer/session.js')
const { GAME_SERVERS, SERVER_LOGS } = require('../gameServer/processes.js')

const GAMEINFO_TIMEOUT = 60 * 1000

/*
  if (rangeString && rangeString.includes(':')) {
    let address = rangeString.split(':')[0]
    let port = rangeString.split(':')[1]
    return next()
  }
*/

async function gameInfo(serverInfo) {
  if (!serverInfo.hostname || !serverInfo.mapname) {
    return
  }
  let mapname = serverInfo.mapname.toLocaleLowerCase()
  let levelshot
  let pk3name = await sourcePk3Download(mapname)
  if (pk3name) {
    levelshot = `/${getGame()}/${MAP_DICTIONARY[mapname]}.pk3dir/levelshots/${mapname}.jpg`
  } else {
    levelshot = '/unknownmap.jpg'
  }
  return {
    title: serverInfo.hostname,
    levelshot: levelshot,
    bsp: mapname,
    pakname: MAP_DICTIONARY[mapname],
    have: !!pk3name,
    mapname: mapname,
    link: `games/${serverInfo.address}:${serverInfo.port}`,
  }
}


async function serveGames(request, response, next) {
  let isJson = request.originalUrl.match(/\?json/)
  let start = 0
  let end = 100
  return serveGamesReal(start, end, isJson, response, next)
}


async function serveGamesRange(request, response, next) {
  let filename = request.originalUrl.replace(/\?.*$/, '')
  let isJson = request.originalUrl.match(/\?json/)
  let rangeString = filename.split('\/games\/')[1]
  let start = 0
  let end = 100
  if (rangeString && rangeString.includes('\/')) {
    start = parseInt(rangeString.split('\/')[0])
    end = parseInt(rangeString.split('\/')[1])
  }
  return serveGamesReal(start, end, isJson, response, next)
}


async function serveGamesReal(start, end, isJson, response, next) {
  // TODO: filter games by game type
  let games = await Promise.all(Object.values(GAME_SERVERS)
      .slice(start, end).map(game => gameInfo(game)))
  if (isJson) {
    return response.json(games)
  }
  let total = Object.values(GAME_SERVERS).length
  let index = renderIndex(renderList('/games/', games, total, 'game-list'))
  return response.send(index)
}


async function serveList(request, response, next) {
  let isJson = request.originalUrl.match(/\?json/)
  let start = 0
  let end = 100
  // TODO: add filtering
  return response.json(Object.values(GAME_SERVERS))

  // TODO: add list HTML display, same for processes, for many details

}


async function serveRcon(request, response, next) {
  let filename = path.basename(request.originalUrl)
  let modname = path.basename(filename).toLocaleLowerCase()
  let serverInfo = GAME_SERVERS[filename]
  if(!serverInfo) { // try to lookup by domain name
    let address = await lookupDNS(filename.split(':')[0])
    serverInfo = GAME_SERVERS[address + ':' + filename.split(':')[1]]
  }
  if(!serverInfo) {
    return next(new Error('Game not found.'))
  }

  if(request.method == 'POST') {
    sendOOB(UDP_SOCKETS[MASTER_PORTS[0]], 'rcon password1 ' + request.body.command, serverInfo)
    return response.json({})
  }


  let basegame = getGame()
  let mapname
  let levelshot
  if(serverInfo.mapname) {
    mapname = serverInfo.mapname.toLocaleLowerCase()
    levelshot = path.join(basegame, 'pak0.pk3dir/levelshots/', mapname + '.jpg')
  } else {
    levelshot = 'unknownmap.jpg'
  }

  let logs = '(no logs to show)'
  if(serverInfo.qps_serverId) {
    logs = SERVER_LOGS[serverInfo.qps_serverId]
  }

  return response.send(renderIndex(`
    ${renderGamesMenu(filename)}
    <div class="loading-blur"><img src="/${levelshot}" /></div>
    <div id="rcon-info" class="info-layout">
    <h2>RCon: <a href="/games/${basegame}/?index">${basegame}</a> / ${modname}</h2>
    <textarea id="rcon-output" readonly="readonly">${logs}</textarea>
    <textarea id="rcon-command" placeholder="Command (newline to send)"></textarea>
    </div>
    `))

}

function renderGamesMenu(filename) {
  return renderMenu([{
    title: 'Games',
    link: 'games'
  }, {
    title: 'Game Info',
    link: 'games/' + filename
  }, {
    title: 'Connect',
    link: 'index.html?connect%20' + filename
  }, {
    title: 'RCon',
    link: 'rcon/' + filename
  }, {
    title: 'Links',
    link: 'games/' + filename + '#links'
  }, {
    title: 'Screenshots',
    link: 'games/' + filename + '#screenshots'
  }], 'asset-menu')
}



async function serveGameInfo(request, response, next) {
  let filename = path.basename(request.originalUrl)
  let isJson = request.originalUrl.match(/\?json/)
  let modname = path.basename(filename).toLocaleLowerCase()
  let serverInfo = GAME_SERVERS[filename]
  if(!serverInfo) { // try to lookup by domain name
    let address = await lookupDNS(filename.split(':')[0])
    serverInfo = GAME_SERVERS[address + ':' + filename.split(':')[1]]
  }
  if(!serverInfo) {
    return next(new Error('Game not found.'))
  }
  let basegame = getGame()
  let mapname
  let levelshot
  if(serverInfo.mapname) {
    mapname = serverInfo.mapname.toLocaleLowerCase()
    levelshot = path.join(basegame, 'pak0.pk3dir/levelshots/', mapname + '.jpg')
  } else {
    levelshot = 'unknownmap.jpg'
  }

  let updateTime = 0
  if(serverInfo.sv_maxRate) {
    updateTime = parseInt(serverInfo.sv_maxRate)
  }
  if(updateTime < GAMEINFO_TIMEOUT) {
    updateTime = GAMEINFO_TIMEOUT
  }

  if(MASTER_PORTS.length > 0
    && serverInfo.challenge
    && (!serverInfo.timeUpdated || Date.now() - serverInfo.timeUpdated > updateTime)) {
    Promise.resolve(new Promise((resolve, reject) => {
      let cancelTimer = setTimeout(function () {
        reject(new Error('Game status timed out.'))
      }, INFO_TIMEOUT)
      RESOLVE_STATUS[serverInfo.challenge] = function (info) {
        clearTimeout(cancelTimer)
        updatePageViewers('/games')
        resolve(info)
      }
      sendOOB(UDP_SOCKETS[MASTER_PORTS[0]], 'getstatus ' + serverInfo.challenge, serverInfo)
    }))
  }


  return response.send(renderIndex(`
    ${renderGamesMenu(filename)}
    <div class="loading-blur"><img src="/${levelshot}" /></div>
    <div id="game-info" class="info-layout">
    <h2>Games: <a href="/games/${basegame}/?index">${basegame}</a> / ${modname}</h2>
    <h3><a name="links">Links</a></h3>
    ${renderList('/menu/', [
      {
        title: 'Connect',
        link: 'index.html?connect%20' + filename,
      },
      {
        title: 'Maps',
        link: modname + '/?index',
      },
      {
        title: 'Stats',
        link: modname + '/?index',
      },
      {
        title: 'Assets',
        link: modname + '/?index',
      },
    ], 3)}
    <h3><a name="screenshots">Screenshots</a></h3>
    <ol class="screenshots">
      <li class="title"><span>Levelshot</span></li>
      <li><img src="/${basegame}/screenshots/${mapname}_screenshot0001.jpg" />
      <a href="/${basegame}/screenshots/${mapname}_screenshot0001.jpg">
      Full resolution levelshot</a></li>
      <li class="title"><span>Birds-eye</span></li>
      <li><img src="/${basegame}/screenshots/${mapname}_screenshot0002.jpg" />
      <a href="/${basegame}/screenshots/${mapname}_screenshot0002.jpg">
      Top-down Full color</a></li>
    </ol>
    </div>
    `))
}

module.exports = {
  serveGames,
  serveGamesRange,
  serveList,
  serveGameInfo,
  serveRcon,
}