const { STYLES, UNKNOWN, SCRIPTS } = require('../utilities/env.js')
const {serveExtensions} = require('../contentServer/serve-http.js')

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

  app.use(function (req, res, next) {
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
      return serveIndex(features, res)
    }
    next()
  })

  serveExtensions(features, app)

  return app
}

function createRedirect(forward) {
  const app = express()
  app.enable('etag')
  app.set('etag', 'strong')

  app.use(function (request, response, next) {
    let newLocation = forward
    if (!forward) {
      newLocation = request.headers['host']
        .replace(/\:[0-9]+$/, '') + http[0]
    }
    newLocation += request.url || ''
    return response.redirect(newLocation)
  })
  return app
}

module.exports = {
  createRedirect,
  createApplication,

}