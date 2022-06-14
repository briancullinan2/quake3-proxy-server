var path = require('path')
var fs = require('fs')
var Fuse = require('fuse.js')

var TEMP_DIR = process.env.LVLWORLD || path.join(process.env.HOME || process.env.HOMEPATH 
  || process.env.USERPROFILE || os.tmpdir(), '/quake3-discord-bot/lvlworldDB')

var cache = fs.readdirSync(TEMP_DIR)
  .filter(d => d[0] != '.' && d.includes('.json'))
  .reduce((list, d) => {
    var maps = require(path.join(TEMP_DIR, d))
    return list.concat(Object.values(maps))
  }, [])

var FUSE_CONFIG = {
  caseSensitive: false,
  findAllMatches: true,
  distance: 50,
  threshold: 0.5,
  tokenize: true,
  shouldSort: true,
  keys: ['zip', 'author', 'includes.bsp', 'includes.title', 'gameMode.0', 'gameMode.1', 'gameMode.2'],
  id: '1'
}
var searchAll
var searchMaps

function tokenSearch(search) {
  if(!searchAll) {
    searchAll = new Fuse(cache, FUSE_CONFIG)
  }
  var response = searchAll.search(search)
  return response
}

function mapSearch(bsp) {
  if(!searchMaps) {
    searchMaps = new Fuse(cache, Object.assign({}, FUSE_CONFIG, {
      keys: ['includes.bsp'] // server status always set to bsp name nothing else
    }))
  }
  var response = searchMaps.search(bsp)
  return response
}

module.exports = {
  tokenSearch,
  mapSearch,
}
