const path = require('path')
const fs = require('fs')

// use WASM renderer to screenshot uploaded maps
const { findFile } = require('../assetServer/virtual.js')
const { EXECUTING_LVLSHOTS, processQueue } = require('../mapServer/lvlshot.js')
const { MODS_NAMES, FS_GAMEHOME, setGame, getGame } = require('../utilities/env.js')
const { updatePageViewers } = require('../contentServer/session.js')
const { CONVERTED_FILES, streamFile } = require('../assetServer/stream-file.js')
const { START_SERVICES } = require('../contentServer/features.js')

const LVLSHOTS = path.resolve(__dirname + '/../utilities/levelinfo.cfg')


async function serveLevelshot(request, response, next) {
  let basegame = getGame()
  let filename = request.originalUrl.replace(/\?.*$/, '')
  if (filename.startsWith('/')) {
    filename = filename.substr(1)
  }
  let modname = filename.split('/')[0].toLocaleLowerCase()
  if(modname && MODS_NAMES.includes(modname)) {
    basegame = modname
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
  if (!matchName) {
    matchName = mapname
  } else {
    matchName = matchName[0]
  }

  // still can't find a levelshot or screenshot, execute the engine to generate
  let timeout = new Promise(resolve => setTimeout(resolve, 500))
  let previousGame = getGame()
  setGame(basegame)
  let outFile = await Promise.any([execLevelshot(mapname, matchName), timeout])
  setGame(previousGame)
  if (outFile && outFile[0] && (await streamFile(outFile[0], response))) {
    return
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
  let screenName = task.outFile.replace(path.extname(task.outFile), '.tga')
  let newFile = findFile(screenName)
  if (newFile && fs.existsSync(newFile)) {
    return true
  }
  let match
  while (match = WROTE_SCREENSHOT.exec(logs)) {
    let outputEnts = path.join(FS_GAMEHOME, getGame(), match[1])
    if (!fs.existsSync(outputEnts)) {
      if (START_SERVICES.includes('convert')) {
        console.error(new Error('WARNING: output image not found ' + match[1]))
      }
      continue
    }
    return newFile
  }
  return false
}


async function resolveEnts(logs, task) {
  let outputEnts = path.join(FS_GAMEHOME, task.outFile)
  if (fs.existsSync(outputEnts)) {
    return outputEnts
  }
  return false
}


const MATCH_FILELIST = /(Rcon from[^\n]*?command[0-9]+|name-------)\n([\s\S]*?)Total (models|images|resident)/gi


async function resolveImages(logs, task) {
  if (typeof CONVERTED_FILES[task.outFile] != 'undefined') {
    // TODO: also check repackedCache() / tmp?
    return CONVERTED_FILES[task.outFile]
  }

  let IMAGE_LIST = /-name-------\n([\s\S]*?)total images/gi
  let imageList = IMAGE_LIST.exec(logs)
  //console.log(logs)
  if (!imageList) {
    return false
  }

  let images = imageList[0].split('\n').slice(1, -3)
    .map(line => (' ' + line).split(/\s+/ig).pop().replace(/\^3/gi, '').trim())
    .join('\n')
  CONVERTED_FILES[task.outFile] = images
  if (START_SERVICES.includes('cache')) {
    // save to repacked cache?
    return CONVERTED_FILES[task.outFile]
  }
}


async function resolveModels(logs, task) {
  if (typeof CONVERTED_FILES[task.outFile] != 'undefined') {
    // TODO: also check repackedCache() / tmp?
    return CONVERTED_FILES[task.outFile]
  }

  let search = MATCH_FILELIST
  let match
  let modelList
  while (match = search.exec(logs)) {
    if (match[0].includes('Total models')) {
      modelList = match
    }
  }
  if (!modelList) {
    return false
  }

  let models = modelList[0].split('\n').slice(1, -3)
    .map(line => (' ' + line).split(/\s+/ig).pop().replace(/\^3/gi, '').trim())
    .join('\n')
  CONVERTED_FILES[task.outFile] = models
  if (START_SERVICES.includes('cache')) {
    // save to repacked cache?
    return CONVERTED_FILES[task.outFile]
  }
}


async function resolveSounds(logs, task) {
  if (typeof CONVERTED_FILES[task.outFile] != 'undefined') {
    // TODO: also check repackedCache() / tmp?
    return CONVERTED_FILES[task.outFile]
  }

  let search = MATCH_FILELIST
  let match
  let modelList
  while (match = search.exec(logs)) {
    if (match[0].includes('Total resident')) {
      modelList = match
    }
  }
  if (!modelList) {
    return false
  }

  let sounds = modelList[0].split('\n').slice(1, -3)
    .map(line => (' ' + line.replace('[resident ]', ''))
      .split(/\s+/ig).pop().replace(/\^3/gi, '').trim())
    .join('\n')
  CONVERTED_FILES[task.outFile] = sounds
  if (START_SERVICES.includes('cache')) {
    // save to repacked cache?
    return CONVERTED_FILES[task.outFile]
  }
}



async function execLevelshot(mapname, waitFor) {
  let basegame = getGame()

  if (mapname == 'nomap') {
    return
  }

  if (typeof EXECUTING_LVLSHOTS[mapname] == 'undefined') {
    EXECUTING_LVLSHOTS[mapname] = []
  }

  let promises = []

  function queueTask(task) {
    let existing = EXECUTING_LVLSHOTS[mapname].filter(map => map.cmd == task.cmd)
    let newTask
    if (existing.length > 0) {
      newTask = existing[0]
    } else {
      newTask = Object.assign({}, task, {
        mapname: mapname,
        created: Date.now(),
        subscribers: [],
        cmd: task.cmd,
        game: getGame(),
      })
    }
    if (existing.length == 0) {
      EXECUTING_LVLSHOTS[mapname].push(newTask)
    }
    if (newTask.cmd.match(waitFor)
      || newTask.outFile.match(waitFor)) {
      promises.push(newTask)
    }
    return newTask
  }

  // TODO: this will need to be an API controllable by utilities/watch.js
  let lvlconfig = path.join(FS_GAMEHOME, basegame, '.config/levelinfo.cfg')
  if (!fs.existsSync(lvlconfig) 
    || fs.statSync(LVLSHOTS).mtime.getTime() > fs.statSync(lvlconfig).mtime.getTime()) {
    fs.mkdirSync(path.join(FS_GAMEHOME, basegame, '.config'), { recursive: true })
    fs.writeFileSync(lvlconfig, fs.readFileSync(LVLSHOTS))
  }
  fs.mkdirSync(path.join(FS_GAMEHOME, basegame, 'screenshots'), { recursive: true })
  fs.mkdirSync(path.join(FS_GAMEHOME, basegame, 'levelshots'), { recursive: true })
  fs.mkdirSync(path.join(FS_GAMEHOME, basegame, 'maps'), { recursive: true })

  // figure out which images are missing and do it in one shot
  queueTask({
    cmd: ' ; vstr setupLevelshot ; levelshot ; wait 20 ; screenshot levelshot ; ',
    resolve: resolveScreenshot,
    outFile: path.join(basegame, 'levelshots', mapname + '.tga')
  })
  queueTask({
    // special exception
    cmd: ` ; vstr setupLevelshot ; levelshot ; wait 20 ; screenshot ${mapname}_screenshot0001 ; `,
    resolve: resolveScreenshot,
    outFile: path.join(basegame, 'screenshots', mapname + '_screenshot0001.tga')
  })
  queueTask({
    // special exception
    cmd: ` ; vstr setupBirdseye ; wait 20 ; screenshot ${mapname}_screenshot0002 ; vstr resetBirdseye ; `,
    resolve: resolveScreenshot,
    outFile: path.join(basegame, 'screenshots', mapname + '_screenshot0002.tga')
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
  for (let i = 0; i < TRACEMAPS.length; i++) {
    queueTask({
      // special exception
      cmd: ` ; minimap ${TRACEMAPS[i]} ${mapname}_tracemap${String(i + 1).padStart(4, '0')} ; `,
      resolve: resolveScreenshot,
      outFile: path.join(basegame, 'maps', `${mapname}_tracemap${String(i + 1).padStart(4, '0')}.tga`)
    })
  }

  // TODO: FIX THIS, by checking logs? only if I absolutely have to!



  // TODO: export / write entities / mapname.ents file
  queueTask({
    // special exception
    cmd: ' ; saveents ; ',
    resolve: resolveEnts,
    outFile: path.join(basegame, 'maps', mapname + '.ent')
  })


  // TODO: figure out how to resolve a client command
  queueTask({
    // special exception
    cmd: ' ; imagelist ; ',
    resolve: resolveImages,
    outFile: path.join(basegame, 'maps', mapname + '-images.txt')
  })

  queueTask({
    // special exception
    cmd: ' ; modellist ; ',
    resolve: resolveModels,
    outFile: path.join(basegame, 'maps', mapname + '-models.txt')
  })

  queueTask({
    // special exception
    cmd: ' ; s_list ; ',
    resolve: resolveSounds,
    outFile: path.join(basegame, 'maps', mapname + '-sounds.txt')
  })

  // return promise wait on filtered tasks
  if (waitFor) {
    if (promises.length == 0) {
      Promise.resolve(processQueue())
      return
    } else {
      let count = promises.length
      return await new Promise(resolve => {
        let result = []
        function countdown(i, logs, task) {
          count--
          result[i] = logs
          if (count == 0) {
            resolve(result)
          }
        }
        promises.forEach((task, i) => {
          task.subscribers.push(countdown.bind(null, i))
        })
        Promise.resolve(processQueue())
        updatePageViewers('\/maps')
      })
    }
  } else {
    Promise.resolve(processQueue())
  }
  // TODO: filtered to a specific task listed above based 
  //   on where the mapinfo request came from
  //return await Promise.all(EXECUTING_LVLSHOTS[mapname]
  //.filter(cmd => )
  //.map(async cmd => )
}


module.exports = {
  serveLevelshot,
  execLevelshot,
}

