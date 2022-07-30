const path = require('path')
const fs = require('fs')
const { findFile } = require('../assetServer/virtual.js')
const { downloadCache, getGame } = require('../utilities/env.js')

const MAP_SOURCES = {}
const MAP_DICTIONARY = {}

// https://efservers.com/games/baseEF/



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
      if ((cached = findFile(getGame() + '/' + pk3name))) {
        source = cached
      } else {
        let caches = downloadCache()
        for(let i = 0; i < caches.length; i++) {
          if(fs.existsSync(path.join(caches[i], pk3name))) {
            source = path.join(caches[i], pk3name)
            break
          }
        }
      }
  }

  if (source) {
    MAP_SOURCES[mapname] = source
  }
  return source
}

module.exports = {
  MAP_DICTIONARY,
  sourcePk3Download
}

