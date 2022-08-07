
// TODO: OMG SO MANY FILES!
// serve-finished are pk3 files, 
//   serve-repacked are virtual files that would only exist after conversion
const path = require('path')
const fs = require('fs')

const { getGame, getGames } = require('../utilities/env.js')
const { sourcePk3Download } = require('../mapServer/download.js')
const { repackBasemap, repackBasepack } = require('../mapServer/repack.js')
const { listMaps } = require('../assetServer/list-maps.js')
const { findFile } = require('../assetServer/virtual.js')
const { MAP_DICTIONARY } = require('../mapServer/download.js')
const { EXPORT_DIRECTORY, setGame } = require('../utilities/env.js')
const { setOutput } = require('../mapServer/repack.js')
const { START_SERVICES } = require('../contentServer/features.js')
const { SESSION_GAMES } = require('../contentServer/session.js')


async function filterMappack(file) {
  // specific folder?
}


async function repackMappak(modname, mapname) {
  // same thing except with additional individual pk3 assets
  return await repackBasemap(modname, mapname)
}


async function serveFinished(request, response, next) {
  let filename = request.originalUrl.replace(/\?.*$/, '')
  if (filename.startsWith('/')) {
    filename = filename.substr(1)
  }
  let modname = path.basename(path.dirname(filename))
  if (modname == 'repacked') {
    modname = getGame()
  }
  if (request.query && typeof request.query.game != 'undefined') {
    // TODO: validate
    modname = request.query.game
  } else
    if (request.cookies && SESSION_GAMES[request.cookies['__planet_quake_sess']]) {
      modname = SESSION_GAMES[request.cookies['__planet_quake_sess']]
    }

  let previousGame = getGame()
  let gameNames = getGames()
  if (!gameNames.includes(modname.toLocaleLowerCase())) {
    modname = previousGame
  }

  if (modname == 'baseq3' || modname == 'demoq3') {
    //if (START_SERVICES.includes('deploy')) {
    modname = 'demoq3'
    let outputDir = path.join(EXPORT_DIRECTORY, 'baseq3/pak0.pk3dir')
    setOutput(outputDir)
    setGame('demoq3')
    //}
  } else {
    let outputDir = path.join(EXPORT_DIRECTORY, modname, 'pak0.pk3dir')
    setOutput(outputDir)
    setGame(modname)
  }

  // TODO: lookup modname like in stream-file
  let mapname = path.basename(filename).replace(path.extname(filename), '').toLocaleLowerCase()

  await listMaps(modname)

  let newZip
  if (path.basename(filename).match(/^pak0\.pk3$|^pak0$/i)) {
    newZip = await repackBasepack(modname)
  } else
    if (typeof MAP_DICTIONARY[mapname] != 'undefined') {
      if (MAP_DICTIONARY[mapname].startsWith('pak')) {
        newZip = await repackBasemap(modname, mapname)
      } else {
        newZip = await repackMappak(modname, mapname)
      }
    }

  if (!newZip || !fs.existsSync(newZip)) {
    newZip = findFile(getGame() + '/' + mapname + '.pk3')
    //newZip = await repackPk3(newZip)
  }
  if (START_SERVICES.includes('deploy')) {
    setGame(previousGame)
  }

  if (!newZip) {
    return next(new Error('File not found: ' + filename))
  }

  return response.sendFile(newZip, {
    headers: {
      'content-disposition':
        `attachment; filename="${mapname}.pk3"`
    }
  })

}

module.exports = {
  serveFinished,

}