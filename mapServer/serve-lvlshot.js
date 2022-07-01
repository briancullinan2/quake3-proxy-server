const path = require('path')
const fs = require('fs')

// use WASM renderer to screenshot uploaded maps
const { findFile, modDirectory } = require('../assetServer/virtual.js')
const { getGame } = require('../utilities/env.js')
const { repackedCache } = require('../utilities/env.js')


async function serveLevelshot(request, response, next) {
  let basegame = getGame()
  let filename = request.originalUrl.replace(/\?.*$/, '')
  if (filename.startsWith('/')) {
    filename = filename.substr(1)
  }

  let match
  if (!(match = (/levelshots\/|screenshots\/|maps\//i).exec(filename))) {
    return next()
  }
  match = match[0].toLocaleLowerCase()

  if (filename.match('/unknownmap.jpg')) {
    return response.sendFile(UNKNOWN)
  }

  let mapname = path.basename(filename).replace('.jpg', '')
    .replace(/_screenshot[0-9]+/gi, '')
    .replace(/_tracemap[0-9]+/gi, '')
  // replace the full pk3 name that we looked up in another service with
  //   the simpler output pathname, i.e. /baseq3/pak0.pk3/levelshots/q3dm0.jpg
  //   is also an alias for the path /baseq3/levelshots/q3dm0.jpg
  // we're assuming there aren't duplicate bsp names to worry about in the 
  //   levelshots/ and screenshots/ directories.
  let localLevelshot = path.join(basegame, match, path.basename(filename))
  let levelshot = findFile(localLevelshot)
  if (levelshot) {
    return response.sendFile(levelshot)
  }


  let modname = modDirectory(filename)
  if (modname) {
    repackedFile = path.join(repackedCache(), match, path.basename(filename))
    if (fs.existsSync(repackedFile)) {
      return response.sendFile(repackedFile)
    }
    repackedFile = path.join(repackedCache(), filename.substr(modname.length))
    if (fs.existsSync(repackedFile)) {
      return response.sendFile(repackedFile)
    }
  }


  levelshot = findFile(filename)
  if (levelshot && !levelshot.endsWith('.pk3')) {
    return response.sendFile(levelshot)
  }


  /*
  let gamedir = await layeredDir(basegame)
  let pk3files = gamedir.filter(file => file.endsWith('.pk3'))
  let maps = (await Promise.all(pk3files.map(async function (pk3name) {
    let basename = path.basename(pk3name)
    let index = await getIndex(findFile(pk3name))
  */


  // still can't find a levelshot or screenshot, execute the engine to generate
  try {
    let logs = await execLevelshot(mapname)
    console.log(logs)
    levelshot = findFile(localLevelshot)
    if (levelshot) {
      return response.sendFile(levelshot)
    }
  } catch (e) {
    console.error(e)
  }

  next()
}


module.exports = {
  serveLevelshot,
}

