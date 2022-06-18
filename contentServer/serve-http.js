
const {serveGames} = require('../gameServer/serve-games.js')
const {serveMaps, serveDownload, serveMapsRange} = require('../mapServer/serve-download.js')
const {serveLevelshot} = require('../mapServer/review.js')
const {serveMapInfo} = require('../mapServer/review.js')
const {serveVirtual} = require('../contentServer/content.js')
const {serveRepacked, serveFinished} = require('../mapServer/repack.js')
const {STYLES, UNKNOWN, SCRIPTS} = require('../utilities/env.js')
const { downloadAllMeta } = require('../utilities/metadata.js')

// < 100 LoC
const express = require('express')
express.static.mime.types['wasm'] = 'application/wasm'
express.static.mime.types['pk3'] = 'application/octet-stream'
express.static.mime.types['bsp'] = 'application/octet-stream'

function createRedirect(forward) {
  const app = express()
  app.enable('etag')
  app.set('etag', 'strong')

  app.use(function (request, response, next) {
    let newLocation = forward
    if(!forward) {
      newLocation = request.headers['host']
        .replace(/\:[0-9]+$/, '') + http[0]
    }
    newLocation += request.url || ''
    return response.redirect(newLocation)
  })
  return app
}

function serveLive(request, response, next) {
  let isJson = request.url.match(/\?json/)
  let filename = request.url.replace(/\?.*$/, '')
  let pk3File = filename.replace(/\.pk3.*/gi, '.pk3')
  let newFile = findFile(filename)
  debugger

  if(newFile && newFile.endsWith('.pk3') 
      && pk3File.length < filename.length) {
    // probably meant to request a file inside the pk3, this script is just for updated
    // TODO: check directory times?
    return next()
  } else
  if(newFile && !fs.statSync(newFile).isDirectory()) {
    return response.sendFile(newFile)
  } else 
  if (newFile && !isJson) {
    let indexFile = findFile(path.join(filename, 'index.html'))
    if(indexFile && indexFile.endsWith('.pk3') 
        && pk3File.length < filename.length) {
      return next()
    } else
    if(indexFile) {
      return response.sendFile(indexFile)
    }
    return next() // TODO: VIRTUAL
    throw new Error('Directories not implemented')
  } else
  // cache busting for clients
  if(filename.includes('version.json')) {
    // create a virtual version file based on the max time
    //   of all our search directories, if any one of them 
    //   changed from new build files, the version.json
    //   check will break the IDBFS cache.
    let BUILD_ORDER = buildDirectories()
    let latest = 0
    let time
    for(let i = 0; i < BUILD_ORDER.length; i++) {
      let newPath = path.join(BUILD_ORDER[i], filename)
      if(fs.existsSync(newPath)) {
        let newTime = fs.statSync(newPath).mtime
        if(newTime.getTime() > latest) {
          latest = newTime.getTime()
          time = newTime
        }
      }
    }
    if(latest > 0) {
      return response.json([time, time])
    }
  }
  // TODO: send refresh signal over websocket/proxy
  //   in a POSIX similar way? This would be cool
  //   because then all remote clients will refresh
  //   and reconnect to existing game

  return next()
}

function createApplication(features) {
  const app = express()
  app.enable('etag')
  app.set('etag', 'strong')

  app.use(function (req, res, next) {
    let filename = req.url.replace(/\?.*$/, '')
    if(filename.match('/index.css')) {
      return res.sendFile(STYLES)
    }
    if(filename.match('/unknownmap.jpg')) {
      return res.sendFile(UNKNOWN)
    }
    if(filename.match('/index.js')) {
      return res.sendFile(SCRIPTS)
    }
    next()
  })

  if(features.includes('repack')) {
    app.use('/maps/repacked', serveFinished) // /maps/download/%1
    app.use(serveRepacked) // /maps/download/%1
  }

  if(features.includes('live')) {
    app.use(serveLive) // version.json and /build
  }

  if(features.includes('virtual')) {
    app.use(serveVirtual) // /home fs for updates
  }

  if(features.includes('games')) {
    app.use('/games', serveGames)
  }

  if(features.includes('maps')) {
    app.use('/maps/reload', downloadAllMeta)
    app.use('/maps/download', serveDownload)
    app.use(/\/maps\/[0-9]+\/[0-9]+/i, serveMapsRange)
    app.use(/\/maps\/.+/, serveMapInfo)
    app.use('/maps/?', serveMaps)
  }

  app.use('/*/*/levelshots/*.jpg', serveLevelshot)

  return app
}


module.exports = {
  createRedirect,
  createApplication,
}
