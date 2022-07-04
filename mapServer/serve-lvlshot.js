const path = require('path')
const fs = require('fs')

// use WASM renderer to screenshot uploaded maps
const { findFile, modDirectory } = require('../assetServer/virtual.js')
const { EXE_NAME, getGame } = require('../utilities/env.js')
const { repackedCache } = require('../utilities/env.js')
const { updatePageViewers } = require('../contentServer/session.js')
const { CHILD_PROCESS } = require('../utilities/exec.js')

const EXECUTING_MAPS = {}

// TODO: this is pretty lame, tried to make a screenshot, and a
//   bunch of stuff failed, now I have some arbitrary wait time
//   and it works okay, but a real solution would be "REAL-TIME"!
// TODO: open a control port and create a new master server. One
//   separate master control for every single map, split up and only
//   do 10 maps at a time, because of this.

// TODO: combine this master server serveDed()
async function lvlshotCmd(mapname, startArgs, callback) {
  // TODO: wait for the new dedicated process to connect to our specialized
  //   control port. Now we have a Quake 3 server command pipe. Send OOB
  //   RCON messages to control our own process remotely / asynchronously.
  // TODO: take the screenshots, run client commands using local dedicate 
  //   connected commands (side-effect, easily switch out client to a real
  //   server using the reconnect command).
  let client = findFile(EXE_NAME)
  const { execFile } = require('child_process')

  // prevent clients from making multiple requests on 
  //   the same map. just wait a few seconds
  if (typeof EXECUTING_MAPS[mapname] == 'undefined') {
    EXECUTING_MAPS[mapname] = []
  }
  if (EXECUTING_MAPS[mapname].length != 0) {
    return await new Promise(function (resolve, reject) {
      let rejectTimer = setTimeout(function () {
        reject(new Error('Level Shot service timed out.'))
      }, 10000)
      EXECUTING_MAPS[mapname].push(function (/* logs */) {
        clearTimeout(rejectTimer)
        resolve()
      })
    })
  }

  // TODO: CODE REVIEW, using the same technique in compress.js (CURRENTLY_UNPACKING)
  //   but the last resolve function would be here after the resolve(stderr)
  //   instead of after, in the encapsulating function call.
  return await new Promise(function (resolve, reject) {
    EXECUTING_MAPS[mapname].push('placeholder')
    let ps
    ps = execFile(client, startArgs,
      function (errCode, stdout, stderr) {
        if (errCode > 0) {
          reject(new Error(stderr))
        } else {
          resolve(stderr + stdout)
          for(let i = 1; i < EXECUTING_MAPS[mapname].length; i++) {
            EXECUTING_MAPS[mapname][i](stderr + stdout)
          }
          EXECUTING_MAPS[mapname].splice(0)
          delete CHILD_PROCESS[ps.pid]
          updatePageViewers('/process')
        }
      })
    let stderr = ''
    let stdout = ''
    ps.stderr.on('data', (data) => {
      stderr += data.toString('utf-8')
      if(callback) {
        callback(stderr + stdout)
      }
    })
    ps.stdout.on('data', (data) => {
      stdout += data.toString('utf-8')
      if(callback) {
        callback(stderr + stdout)
      }
    })
    CHILD_PROCESS[ps.pid] = [EXE_NAME].concat(['+map', mapname]).join(' ')
    updatePageViewers('/process')
  })

}

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
  if (levelshot && !levelshot.match(/\.pk3$/i)) {
    return response.sendFile(levelshot)
  }


  /*
  let gamedir = await layeredDir(basegame)
  let pk3files = gamedir.filter(file => file.match(/\.pk3$/i))
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
  EXECUTING_MAPS,
  lvlshotCmd,
  serveLevelshot,
}

