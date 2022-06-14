const fs = require('fs')
const path = require('path')
const {LVLWORLD_DB} = require('../utilities/env.js')
var METADATA_BASE = 'https://lvlworld.com/metadata/'

async function downloadAllMeta() {
  var currentYear = (new Date()).getFullYear()
  for(var y = 2004; y <= currentYear; y++) {
    var from = y
    var to = from + 1
    if(fs.existsSync(path.join(LVLWORLD_DB, from + '.json'))
      && y != currentYear)
      continue
    /*if(y == 1998) {
      from = 1969
      to = 1999
    }*/
    var outgoing = {
      method: 'GET',
      url: `${METADATA_BASE}from:${from}-01-01/to:${to}-01-01/extended`
    }
    var response = await fetch(outgoing)
    let json = await response.json()

    fs.writeFileSync(path.join(LVLWORLD_DB, from + '.json'), JSON.stringify(json, null, 2))
  }
}

module.exports = {
  downloadAllMeta,
}
