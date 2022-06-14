const fs = require('fs')
const path = require('path')
const {LVLWORLD_DB} = require('../utilities/env.js')
const METADATA_BASE = 'https://lvlworld.com/metadata/'

async function downloadAllMeta() {
  const currentYear = (new Date()).getFullYear()
  for(let y = 2004; y <= currentYear; y++) {
    let from = y
    let to = from + 1
    if(fs.existsSync(path.join(LVLWORLD_DB, from + '.json'))
      && y != currentYear && y != currentYear - 1)
    {
      continue
    }
    /*if(y == 1998) {
      from = 1969
      to = 1999
    }*/
    let response = await fetch(`${METADATA_BASE}from:${from}-01-01/to:${to}-01-01/extended`, {
      method: 'GET',
    })
    let json = await response.json()

    fs.writeFileSync(path.join(LVLWORLD_DB, from + '.json'), JSON.stringify(json, null, 2))
  }

  let response = await fetch(`https://lvlworld.com/zip-file-list`, {
    method: 'GET',
  })
  let json = await response.json()
  fs.writeFileSync(path.join(LVLWORLD_DB, 'maplist.json'), JSON.stringify(json, null, 2))
}

module.exports = {
  downloadAllMeta,
}
