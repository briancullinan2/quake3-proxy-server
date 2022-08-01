const path = require('path')
const fs = require('fs')

const { GAME_SERVERS } = require('../gameServer/processes.js')
const { listMaps } = require('../assetServer/list-maps.js')
const { sourcePk3Download } = require('../mapServer/download.js')
const { getGame } = require('../utilities/env.js')
const { renderIndex, renderList, renderMenu, renderEngine,
  renderFeature } = require('../utilities/render.js')
const { UDP_SOCKETS, MASTER_PORTS, INFO_TIMEOUT,
  RESOLVE_STATUS, sendOOB } = require('./master.js')
const { lookupDNS } = require('../utilities/dns.js')
const { updatePageViewers } = require('../contentServer/session.js')
const { MAP_DICTIONARY } = require('../mapServer/download.js')

const GAMEINFO_TIMEOUT = 60 * 1000

/*
  if (rangeString && rangeString.includes(':')) {
    let address = rangeString.split(':')[0]
    let port = rangeString.split(':')[1]
    return next()
  }
*/

async function gameInfo(serverInfo) {
  if (!serverInfo.mapname) {
    return
  }
  await listMaps(getGame())
  let mapname = serverInfo.mapname.toLocaleLowerCase()
  let levelshot
  let pk3name = await sourcePk3Download(mapname)
  if (pk3name) {
    levelshot = `/${getGame()}/${MAP_DICTIONARY[mapname]}.pk3dir/levelshots/${mapname}.jpg`
  } else {
    levelshot = '/unknownmap.jpg'
  }
  let isRenderer = !!parseInt(serverInfo.qps_renderer)
  let isDedicated = !!parseInt(serverInfo.qps_dedicated)
  return {
    title: (isRenderer ? '(renderer) '
      : (isDedicated ? '(dedicated) ' : ''))
      + (serverInfo.hostname || serverInfo.sv_hostname),
    levelshot: levelshot,
    bsp: mapname,
    pakname: !MAP_DICTIONARY[mapname]
      || MAP_DICTIONARY[mapname].match(/pak[0-9]\.pk3/)
      ? void 0
      : 'Download: ' + MAP_DICTIONARY[mapname],
    have: !!pk3name,
    mapname: mapname,
    // TODO: change to nomap check?
    link: serverInfo.address ? `${isDedicated || isRenderer
      ? 'rcon' : 'games'}/${serverInfo.address}:${serverInfo.port}` : void 0,
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
    .filter(game => !game.removed)
    .slice(start, end).map(gameInfo))
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
  let filename = request.originalUrl.replace(/\?.*$/, '')
  let modname = path.basename(filename).toLocaleLowerCase()
  if (!modname.match(/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\:[0-9]+/)) {
    return next()
  }
  let serverInfo = GAME_SERVERS[modname]
  if (!serverInfo) { // try to lookup by domain name
    let address = await lookupDNS(modname.split(':')[0])
    serverInfo = GAME_SERVERS[address + ':' + modname.split(':')[1]]
  }
  if (!serverInfo) {
    return next(new Error('Game not found.'))
  }

  if (request.method == 'POST') {
    console.log('Sending RCON:', modname, request.body.command)
    sendOOB(UDP_SOCKETS[MASTER_PORTS[0]], 'rcon password1 ' + request.body.command + '  \n', serverInfo)
    response.setHeader('expires', Date.now())
    return response.json({})
  }


  let basegame = getGame()
  let mapname
  let levelshot
  if (serverInfo.mapname) {
    mapname = serverInfo.mapname.toLocaleLowerCase()
    levelshot = path.join(basegame, 'pak0.pk3dir/levelshots/', mapname + '.jpg')
  } else {
    levelshot = 'unknownmap.jpg'
  }

  // update the server with a status once every 60 seconds to make sure we are still alive
  let updateTime = 0
  if (serverInfo.sv_maxRate) {
    updateTime = parseInt(serverInfo.sv_maxRate)
  }
  if (updateTime < GAMEINFO_TIMEOUT) {
    updateTime = GAMEINFO_TIMEOUT
  }

  if (!serverInfo.timeUpdated || Date.now() - serverInfo.timeUpdated > updateTime) {
    sendOOB(UDP_SOCKETS[MASTER_PORTS[0]], 'getstatus ' + serverInfo.challenge, serverInfo)
  }

  let logs = serverInfo.logs || '(no logs to show)'

  return response.send(renderIndex(
    renderGamesMenu(modname, serverInfo)
    + `<div class="loading-blur"><img src="/${levelshot}" /></div>
    <div id="rcon-info" class="info-layout">
    <h2>RCon: <a href="/games/${basegame}/?index">${basegame}</a> / ${modname}</h2>
    <textarea id="rcon-output" readonly="readonly">${logs}</textarea>
    <textarea id="rcon-command" placeholder="Command (newline to send)"></textarea>
    </div>
    `))

}

function renderGamesMenu(filename, serverInfo) {
  let isRenderer = !!parseInt(serverInfo.qps_renderer)
  let isDedicated = !!parseInt(serverInfo.qps_dedicated)
  let GAME_MENU = [{
    title: 'Games',
    link: 'games'
  }]
  if (!isRenderer && !isDedicated) {
    GAME_MENU.push.apply(GAME_MENU, [{
      title: 'Game Info',
      link: 'games/' + filename
    }, {
      title: 'Connect',
      link: 'index.html?connect%20' + filename
    }])
  }
  GAME_MENU.push({
    title: 'RCon',
    link: 'rcon/' + filename
  })
  if (!isRenderer) {
    GAME_MENU.push.apply(GAME_MENU, [{
      title: 'Player Info',
      link: 'games/' + filename + '#players'
    }, {
      title: 'Server Info',
      link: 'games/' + filename + '#info'
    }, {
      title: 'Links',
      link: 'games/' + filename + '#links'
    }, {
      title: 'Screenshots',
      link: 'games/' + filename + '#screenshots'
    }])
  }
  return renderMenu(GAME_MENU, 'games-menu')
}



async function serveGameInfo(request, response, next) {
  let filename = request.originalUrl.replace(/\?.*$/, '')
  let isJson = request.originalUrl.match(/\?json/)
  let modname = path.basename(filename).toLocaleLowerCase()
  if (!modname.match(/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\:[0-9]+/)) {
    return next()
  }
  let serverInfo = GAME_SERVERS[modname]
  if (!serverInfo) { // try to lookup by domain name
    let address = await lookupDNS(modname.split(':')[0])
    serverInfo = GAME_SERVERS[address + ':' + modname.split(':')[1]]
  }

  if (!serverInfo) {
    return next(new Error('Game not found.'))
  }
  let basegame = getGame()
  let mapname
  let levelshot
  if (serverInfo.mapname) {
    mapname = serverInfo.mapname.toLocaleLowerCase()
    levelshot = path.join(basegame, 'pak0.pk3dir/levelshots/', mapname + '.jpg')
  } else {
    levelshot = 'unknownmap.jpg'
  }

  let updateTime = 0
  if (serverInfo.sv_maxRate) {
    updateTime = parseInt(serverInfo.sv_maxRate)
  }
  if (updateTime < GAMEINFO_TIMEOUT) {
    updateTime = GAMEINFO_TIMEOUT
  }

  if (MASTER_PORTS.length > 0
    && serverInfo.challenge
    && (!serverInfo.timeUpdated || Date.now() - serverInfo.timeUpdated > updateTime)) {
    Promise.resolve(new Promise((resolve, reject) => {
      let cancelTimer = setTimeout(function () {
        console.error(new Error('Game status timed out.'))
      }, INFO_TIMEOUT)
      if (typeof RESOLVE_STATUS[serverInfo.challenge] == 'undefined') {
        RESOLVE_STATUS[serverInfo.challenge] = []
      }
      RESOLVE_STATUS[serverInfo.challenge].push(function (info) {
        clearTimeout(cancelTimer)
        updatePageViewers('/games')
        resolve(info)
      })
      sendOOB(UDP_SOCKETS[MASTER_PORTS[0]], 'getstatus ' + serverInfo.challenge, serverInfo)
    }))
  }


  return response.send(renderIndex(
    renderGamesMenu(modname, serverInfo)
    + renderEngine()
    + `<div class="loading-blur"><img src="/${levelshot}" /></div>
    <div id="game-info" class="info-layout">
    <h2>Games: <a href="/games/${basegame}/?index">${basegame}</a> / ${modname}</h2>

    <h3><a name="players">Player Info</a></h3>

    <h3><a name="info">Server Info</a></h3>

    <h3><a name="links">Links</a></h3>
    <ol class="menu-list">
    ${[{
      title: 'Connect',
      link: 'index.html?connect%20' + modname,
    }, {
      title: 'Maps',
      link: modname + '/?index',
    }, {
      title: 'Stats',
      link: modname + '/?index',
    }, {
      title: 'Assets',
      link: modname + '/?index',
    }].map(renderFeature).join('\n')}</ol>
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