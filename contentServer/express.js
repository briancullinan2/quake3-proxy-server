const { INDEX, STYLES, UNKNOWN, SCRIPTS, redirectAddress } = require('../utilities/env.js')
const { setupExtensions, serveFeatures } = require('../contentServer/serve-http.js')
const { renderIndex } = require('../utilities/render.js')
const { createSOCKS } = require('../proxyServer/socks5.js')
const { UDP_CLIENTS, SESSION_IDS, SESSION_URLS } = require('../proxyServer/serve-udp.js')
const { HTTP_PORTS, HTTP_LISTENERS, WEB_SOCKETS,
  updatePageViewers, restoreSession, parseCookies } = require('../contentServer/session.js')

// < 100 LoC
const express = require('express')
express.static.mime.types['wasm'] = 'application/wasm'
express.static.mime.types['pk3'] = 'application/octet-stream'
express.static.mime.types['bsp'] = 'application/octet-stream'

// basic application with a default function to share index files
// TODO: list included features in it's own index
function createApplication(features) {
  const app = express()
  app.enable('etag')
  app.set('etag', 'strong')

  app.use(function serveIndex(req, res, next) {
    let filename = req.originalUrl.replace(/\?.*$/, '')
    if (filename.match('/index.css')) {
      return res.sendFile(STYLES)
    }
    if (filename.match('/unknownmap.jpg')) {
      return res.sendFile(UNKNOWN)
    }
    if (filename.match('/frontend.js')) {
      return res.sendFile(SCRIPTS)
    }
    if (filename.length <= 1 || filename.match('/index.html')) {
      return serveFeatures(features, res)
    }

    restoreSession(req, res)

    next()
  })

  app.use(/\/features\/?$/i, function (req, res, next) {
    return serveFeatures(features, res)
  })

  setupExtensions(features, app)

  app.use(unhandledResponse)

  app.use('*', function (req, res, next) {
    return unhandledResponse(void 0, req, res, next)
  })


  return app
}


function unhandledResponse(err, req, res, next) {
  if(err) {
    console.error(err)
  }
  if (req.headers['accept']
    && !req.headers['accept'].includes('text/html')
    && req.headers['accept'].includes('application/json')) {
    return res.json({ error: `Cannot ${req.method} ${req.originalUrl}` })
  } else
    if (req.headers['accept']
      && !req.headers['accept'].includes('text/html')
      && req.headers['accept'].includes('image/')) {
      return res.sendFile(UNKNOWN)
    }
  // index page
  let index = renderIndex(`<div><p>
  ${err ? `<br />${err.message}` : `Cannot ${req.method} ${req.originalUrl}`}
  ${err ? `<br /><pre>${err.stack}</pre>` : ''}</p></div>`)
  return res.status(404).send(index)
}


function createRedirect() {
  const app = express()
  app.enable('etag')
  app.set('etag', 'strong')

  app.use(function (request, response, next) {
    let newLocation = redirectAddress()
    if (!newLocation) {
      newLocation = request.headers['host']
        .replace(/\:[0-9]+$/, '') + http[0]
    }
    newLocation += request.url || ''
    return response.redirect(newLocation)
  })
  return app
}

let redirectApp

function socketConnect(socket, request) {
  UDP_CLIENTS[0].push(socket)
  let cookies = parseCookies(request.headers['cookie'])
  let sessionId = cookies['__planet_quake_sess']
  function updateSession(newUrl) {
    if(Object.values(UDP_CLIENTS).filter(multicast => {
      return multicast.indexOf(socket) == 0
    }).length > 0) {
      if(!SESSION_URLS[sessionId]) {
        updatePageViewers(newUrl) // make sure a fresh copy of the page is sent
      }
      SESSION_URLS[sessionId] = newUrl
    }
    if(!newUrl.match(/proxy/i)) {
      updatePageViewers('/proxy')
    }
  }
  socket.on('message', async function (message, binary) {
    if (binary) {
      return
    }
    let newUrl = message.toString('utf-8')
    updateSession(newUrl)
    let response = await fetch(newUrl)
    let html = await response.text()
    socket.send(html, { binary: false })
  })
  socket.on('close', function () {
    let ports = Object.keys(UDP_CLIENTS)
    for (let i = 0; i < ports.length; i++) {
      let index = UDP_CLIENTS[ports[i]].indexOf(socket)
      if(index > -1) {
        UDP_CLIENTS[ports[i]].splice(index, 1)
      }
    }
  })
  updateSession(request.url.includes('://') ? request.url 
    : ('http://localhost:' + HTTP_PORTS[0] + request.url))
  createSOCKS(socket, redirectApp, sessionId)
  updatePageViewers('/proxy')
  // if we haven't gotten a URL, the websocket is probably working, but 
  //   the client never got a page, try to set one after a second
  setTimeout(function () {
    //console.log(sessionId, SESSION_URLS[sessionId], UDP_CLIENTS[SESSION_IDS[sessionId]])
    if (typeof SESSION_URLS[sessionId] == 'undefined'
      && UDP_CLIENTS[SESSION_IDS[sessionId]]) {
      for(let i = 0; i < UDP_CLIENTS[SESSION_IDS[sessionId]].length; i++) {
        UDP_CLIENTS[SESSION_IDS[sessionId]][i].send('URL: ', { binary: false })
      }
    }
  }, 2000)
}



function createWebServers(services) {
  const { createServer } = require('http')
  const virtualApp = createApplication(services)
  if(!redirectApp) {
    redirectApp = createRedirect(redirectAddress())
  }

  for (let i = 0; i < HTTP_PORTS.length; i++) {
    // http
    let httpServer = createServer(virtualApp).listen(HTTP_PORTS[i])
    HTTP_LISTENERS[HTTP_PORTS[i]] = httpServer
    if (services.includes('all')
      || services.includes('socks')) {
      const { Server } = require('ws')
      WEB_SOCKETS[HTTP_PORTS[i]] = new Server({ server: httpServer })
      WEB_SOCKETS[HTTP_PORTS[i]].on('connection', socketConnect)
    }
  }

}

module.exports = {
  HTTP_PORTS,
  HTTP_LISTENERS,
  createWebServers,
  createRedirect,
  createApplication,
}