

// < 100 LoC
const express = require('express')
express.static.mime.types['wasm'] = 'application/wasm'
express.static.mime.types['pk3'] = 'application/octet-stream'
express.static.mime.types['bsp'] = 'application/octet-stream'

function createRedirect() {
  const express = require('express')
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

function createVirtual() {
  const app = express()
  app.use(serveRepacked) // /maps/download/%1
  app.use(serveLive) // version.json and /build
  app.use(serveVirtual) // /home fs for updates
  return app
}

// http
function createHTTP(app, port) {
  const {createServer} = require('http')
  return createServer(app).listen(port)
}




/*
Theory: instead of trying to modify qcommon/files.c
 to get it to load different PK3s, I'll provide the 
 pk3s the server thinks the client should have from
 the proxy server. This would simplify repacking, 
 but wont necessarily help UDP downloads unless I
 added some sort of mod_rewrite type setting for pk3s.
Server admin control over pk3 content is a long 
 outstanding issue.
*/
async function serveVirtual(request, response, next) {
  let isJson = request.url.match(/\?json/)
  //    || request.
  let filename = request.url.replace(/\?.*$/, '')

  // TODO: server a file from inside a pk3 to the pk3dirs
  let directory = layeredDir(filename)
  // TODO: move to layeredDir()?
  if(filename.includes('.pk3')) {
    let pk3directory = await serveVirtualPk3dir(filename)
    if(!directory) {
      directory = []
    }
    for(let i = 0; i < pk3directory.length; i++) {
      if(!directory.includes(pk3directory[i])) {
        directory.push(pk3directory[i])
      }
    }
  }

  // duck out early
  if(!directory) {
    return next()
  }

  // TODO: if findFile() returns a pk3, pipe the file out replace a few files
  // TODO: on backend, convert formats on the fly to/from assets directory
  for(let i = 0; i < directory.length; i++) {
    let isUnsupportedImage = directory[i].match(/\.tga$|\.dds$/gi)
    if(isUnsupportedImage) {
      let alternateImages = [
        directory[i].replace(isUnsupportedImage[0], '.jpg'),
        directory[i].replace(isUnsupportedImage[0], '.png'),
      ]
      if(directory.includes(alternateImages[0]) 
          || directory.includes(alternateImages[1])) {
        directory.splice(i, 1)
        i--
        continue
      }  
      let imagePath = findFile(directory[i])
      await convertImage(imagePath)
      directory.splice(i, 1)
      i--
      if(!directory.includes(newFile)) {
        directory.push(newFile)
      }
      continue
    }

    let isUnsupportedAudio = directory[i].match(/\.wav$|\.mp3$/gi)
    if(isUnsupportedAudio) {
    }

    // create a virtual directory that makes the pk3 but with files converted
    //   individual files can be served dynamically. I did this kind of stuff 
    //   with this media-server I worked on for 10 years.
    let isPk3 = directory[i].match(/\.pk3$/gi)
    if(isPk3) {
      if(!directory.includes(directory[i] + 'dir')) {
        directory.push(directory[i] + 'dir')
      }
    }

    // TODO: remove lightmaps from BSPs and rely on vertext lighting

  }

  directory.sort()

  // at least one directory exists
  if(isJson) {
    return response.json(directory)
  } else {
    return response.send(directory.map(node => 
      `<li><a href="/${node}">${node}</a></li>`).join('\n'))
  }
}

function serveLive(request, response, next) {
  let isJson = request.url.match(/\?json/)
  let filename = request.url.replace(/\?.*$/, '')
  let pk3File = filename.replace(/\.pk3.*/gi, '.pk3')
  let newFile = findFile(filename)

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
