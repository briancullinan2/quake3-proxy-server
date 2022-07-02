const path = require('path')
const fs = require('fs')
const Fuse = require('fuse.js')
const {LVLWORLD_DB} = require('../quake3Utils/metadata.js')

var cache = fs.readdirSync(LVLWORLD_DB)
  .filter(d => d[0] != '.' && d.includes('.json'))
  .reduce((list, d) => {
    var maps = require(path.join(LVLWORLD_DB, d))
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
      keys: ['zip', 'includes.bsp'] // server status always set to bsp name nothing else
    }))
  }
  var response = searchMaps.search(bsp)
  return response
}

module.exports = {
  tokenSearch,
  mapSearch,
}
