const { INDEX, STYLES, UNKNOWN, SCRIPTS, redirectAddress } = require('../utilities/env.js')
const { setupExtensions, serveFeatures } = require('../contentServer/serve-http.js')
const { renderIndex } = require('../utilities/render.js')
const { createSOCKS } = require('../proxyServer/socks5.js')

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
    let filename = req.url.replace(/\?.*$/, '')
    if (filename.match('/index.css')) {
      return res.sendFile(STYLES)
    }
    if (filename.match('/unknownmap.jpg')) {
      return res.sendFile(UNKNOWN)
    }
    if (filename.match('/index.js')) {
      return res.sendFile(SCRIPTS)
    }
    if (filename.length <= 1 || filename.match('/index.html')) {
      return serveFeatures(features, res)
    }
    next()
  })

  app.use(/\/features\/?$/i, function (req, res, next) {
    return serveFeatures(features, res)
  })

  setupExtensions(features, app)

  app.use('*', function (req, res, next) {
    if(req.headers['accept'] 
      && !req.headers['accept'].includes('text/html')
      && req.headers['accept'].includes('application/json')) {
      return res.json({error: `Cannot ${req.method} ${req.originalUrl}`})
    } else
    if(req.headers['accept'] 
      && !req.headers['accept'].includes('text/html')
      && req.headers['accept'].includes('image/')) {
      return res.sendFile(UNKNOWN)
    }
    // index page
    let index = renderIndex(`Cannot ${req.method} ${req.originalUrl}`)
    return res.status(404).send(index)
  })

  return app
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

const HTTP_PORTS = [8080]
const HTTP_LISTENERS = []
const WEB_SOCKETS = []

function createWebServers(services) {
  const { createServer } = require('http')
  const virtualApp = createApplication(services)
  const { createRedirect } = require('../contentServer/express.js')
  const redirectApp = createRedirect(redirectAddress())
  
  for (let i = 0; i < HTTP_PORTS.length; i++) {
    // http
    let httpServer = createServer(virtualApp).listen(HTTP_PORTS[i])
    HTTP_LISTENERS[HTTP_PORTS[i]] = httpServer
    if (services.includes('all')
      || services.includes('socks')) {
      const { Server } = require('ws')
      WEB_SOCKETS[HTTP_PORTS[i]] = new Server({ server: httpServer })
      WEB_SOCKETS[HTTP_PORTS[i]].on('connection', function (socket) {
        createSOCKS(socket, redirectApp)
      })
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