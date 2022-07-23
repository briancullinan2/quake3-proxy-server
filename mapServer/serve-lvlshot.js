const path = require('path')
const fs = require('fs')

// use WASM renderer to screenshot uploaded maps
const { findFile } = require('../assetServer/virtual.js')
const { getGame } = require('../utilities/env.js')
const { EXECUTING_LVLSHOTS, processQueue } = require('../mapServer/lvlshot.js')
const { FS_GAMEHOME } = require('../utilities/env.js')
const { RESOLVE_DEDICATED } = require('../gameServer/processes.js')


const LVLSHOTS = path.resolve(__dirname + '/../utilities/levelinfo.cfg')


async function serveLevelshot(request, response, next) {
  let basegame = getGame()
  let filename = request.originalUrl.replace(/\?.*$/, '')
  if (filename.startsWith('/')) {
    filename = filename.substr(1)
  }

  let match
  if (!(match = (/levelshots|screenshots|maps/i).exec(path.dirname(filename)))) {
    return next()
  }
  match = match[0].toLocaleLowerCase()

  // replace the full pk3 name that we looked up in another service with
  //   the simpler output pathname, i.e. /baseq3/pak0.pk3/levelshots/q3dm0.jpg
  //   is also an alias for the path /baseq3/levelshots/q3dm0.jpg
  // we're assuming there aren't duplicate bsp names to worry about in the 
  //   levelshots/ and screenshots/ directories.
  let mapname = path.basename(filename).replace(path.extname(filename), '')
    .replace(/_screenshot[0-9]+/gi, '')
    .replace(/_tracemap[0-9]+/gi, '')
  let localLevelshot = path.join(basegame, match, path.basename(filename))
  let matchName = (/screenshot[0-9]+|levelshot[0-9]+/).exec(filename)
  if(!matchName && filename.match(mapname)) {
    matchName = mapname
  } else {
    matchName = matchName[0]
  }

  // still can't find a levelshot or screenshot, execute the engine to generate
  try {
    let logs = await execLevelshot(mapname, matchName)
    levelshot = findFile(localLevelshot)
    if (levelshot) {
      return response.sendFile(levelshot)
    }
  } catch (e) {
    console.error('LVLSHOT:', e)
  }

  next()
}

// TODO: treat each task as a separate unit of work, 
//   but only wait on the one that is requested, even if 
//   many are running in a single instance.
//   sort by requested count
// TODO: run engine for specific tasks and connect back the 
//   isolated master server, send RCON commands instead of
//   running separate processes for every map, run 4 instances
//   and rotate maps between them.

async function resolveScreenshot(logs, task) {

  // convert TGAs to JPG.
  // TODO: transparent PNGs with special background color?
  let WROTE_SCREENSHOT = /^Wrote\s+((levelshots\/|screenshots\/|maps\/).*?)$/gmi
  let screenName = path.basename(task.outFile).replace(path.extname(task.outFile), '')
  let match
  while (match = WROTE_SCREENSHOT.exec(logs)) {
    let outputEnts = path.join(FS_GAMEHOME, getGame(), match[1])
    if (!fs.existsSync(outputEnts)) {
      if(START_SERVICES.includes('convert')) {
        console.error(new Error('WARNING: output image not found ' + match[1]))
      }
      continue
    }
    return true

    // TODO: don't wait for anything?
    if(match[1].match(screenName)) {
      await convertImage(outputEnts, match[1], '80%')
      return true
    } else {
      convertImage(outputEnts, match[1], '80%')
    }
  }

}


async function resolveEnts(logs, task) {
  let outputEnts = path.join(FS_GAMEHOME, getGame(), task.outFile)
  if (fs.existsSync(outputEnts)) {
    fs.renameSync(outputEnts, path.join(repackedCache()[0], task.outFile))
    return true
  }

}


async function resolveImages(logs, task) {

  let IMAGE_LIST = /-name-------\n([\s\S]*?)total images/gi
  let imageList = IMAGE_LIST.exec(logs)
  if (!imageList) {
    return
  }
  let images = imageList[0].split('\n').slice(1, -3)
    .map(line => (' ' + line).split(/\s+/ig).pop()).join('\n')
  if(START_SERVICES.includes('cache')) {
    fs.writeFileSync(path.join(repackedCache()[0], task.outFile), images)
  }
  
}


async function execLevelshot(mapname, waitFor) {
  let basegame = getGame()

  if(typeof EXECUTING_LVLSHOTS[mapname] == 'undefined') {
    EXECUTING_LVLSHOTS[mapname] = []
  }

  function queueTask(task) {
    let existing = EXECUTING_LVLSHOTS[mapname].filter(map => map.cmd == task.cmd)
    if(existing.length > 0) {
      return
    }
    EXECUTING_LVLSHOTS[mapname].push(Object.assign(task, {
      mapname: mapname,
      time: Date.now(),
      subscribers: [],
      working: false,
    }))
  }

  // TODO: this will need to be an API controllable by utilities/watch.js
  let lvlconfig = path.join(FS_GAMEHOME, basegame, '.config/levelinfo.cfg')
  if(!fs.existsSync(lvlconfig) || fs.statSync(lvlconfig).mtime > fs.statSync(LVLSHOTS).mtime) {
    fs.mkdirSync(path.join(FS_GAMEHOME, basegame, '.config'), { recursive: true })
    fs.writeFileSync(lvlconfig, fs.readFileSync(LVLSHOTS))
  }

  // figure out which images are missing and do it in one shot
  queueTask({
    cmd: ' ; vstr setupLevelshot ; wait 30 ; levelshot ; wait 30 ; screenshot levelshot ; ',
    resolve: resolveScreenshot,
    outFile: path.join('levelshots', mapname + '.tga')
  })
  queueTask({
    // special exception
    cmd: ` ; vstr setupLevelshot ; wait 30 ; levelshot ; wait 30 ; screenshot ${mapname}_screenshot0001 ; `,
    resolve: resolveScreenshot,
    outFile: path.join('screenshots', mapname + '_screenshot0001.tga')
  })
  queueTask({
    // special exception
    cmd: ` ; vstr setupBirdseye ; screenshot ${mapname}_screenshot0002 ; vstr resetBirdseye ; `,
    resolve: resolveScreenshot,
    outFile: path.join('screenshots', mapname + '_screenshot0002.tga')
  })

  // TODO: take screenshot from every camera position
  // TODO: export all BLUEPRINTS and all facets through sv_bsp_mini
  // TODO: palette pastel full levelshot
  const TRACEMAPS = [
    'areamask',
    'heightmap',
    'skybox',
    'bottomup',
    'groundheight',
    'skyboxvolume',
    'skyboxvolume2',
    'skyboxvolume3',
  ]
  for(let i = 0; i < TRACEMAPS.length; i++) {
    queueTask({
      // special exception
      cmd: ` ; wait 30 ; minimap ${TRACEMAPS[i]} ${mapname}_tracemap${String(i).padStart(4, '0')} ; `,
      resolve: resolveScreenshot,
      outFile: path.join('maps', `${mapname}_tracemap${String(i).padStart(4, '0')}.tga`)
    })
  }

  // TODO: export / write entities / mapname.ents file
  queueTask({
    // special exception
    cmd: ' ; saveents ; ',
    resolve: resolveEnts,
    outFile: path.join('maps', mapname + '.ent')
  })

  queueTask({
    // special exception
    cmd: ' ; imagelist ; ',
    resolve: resolveImages,
    outFile: path.join('maps', mapname + '-images.txt')
  })

  /*
  let shaderFile = path.join(REPACKED_MAPS, mapname + '-shaders.txt')
  if (!fs.existsSync(shaderFile)) {
    newVstr += ' ; shaderlist ; '
  }
  */

  Promise.resolve(processQueue())
  
  if(!waitFor) {
    return
  }

  // TODO: filtered to a specific task listed above based 
  //   on where the mapinfo request came from
  return await Promise.all(EXECUTING_LVLSHOTS[mapname]
  .filter(cmd => cmd.cmd.match(waitFor))
  .map(cmd => new Promise(resolve => {
    if(typeof cmd.subscribers == 'undefined') {
      cmd.subscribers = []
    }
    cmd.subscribers.push(resolve)
  })))
}


module.exports = {
  serveLevelshot,
}

