const path = require('path')
const fs = require('fs')
const { findFile } = require('../assetServer/virtual.js')
const { downloadCache, getGame } = require('../utilities/env.js')
const { MAP_DICTIONARY } = require('../assetServer/list-maps.js')

const MAP_SOURCES = {}

async function sourcePk3Download(filename) {
  let mapname = path.basename(filename).replace('.pk3', '').toLocaleLowerCase()
  let source
  if (typeof MAP_SOURCES[mapname] != 'undefined') {
    return MAP_SOURCES[mapname]
  }

  if (typeof MAP_DICTIONARY[mapname] != 'undefined') {
    let pk3name = MAP_DICTIONARY[mapname]
    let cached = findFile(getGame() + '/' + pk3name)
    if (cached) {
      source = cached
    } else
      if ((cached = findFile('baseq3/' + pk3name))) {
        source = cached
      } else
        if (fs.existsSync(path.join(downloadCache(), pk3name))) {
          source = path.join(downloadCache(), pk3name)
        }
  }

  if (source) {
    MAP_SOURCES[mapname] = source
  }
  return source
}

module.exports = {
  sourcePk3Download
}

