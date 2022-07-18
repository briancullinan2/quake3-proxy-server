
const path = require('path')
const fs = require('fs')

const { FS_BASEPATH, FS_GAMEHOME, LVLSHOTS } = require('../utilities/env.js')
const { convertImage } = require('../contentServer/convert.js')
const { getGame } = require('../utilities/env.js')
const { repackedCache } = require('../utilities/env.js')
const { lvlshotCmd } = require('../mapServer/serve-lvlshot.js')
const { START_SERVICES } = require('../contentServer/features.js')
const { updatePageViewers } = require('../contentServer/session.js')

const EXECUTING_LVLSHOTS = {}


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
  let screenName = path.basename(task.test).replace(path.extname(task.test), '')
  let match
  while (match = WROTE_SCREENSHOT.exec(logs)) {
    let outputEnts = path.join(FS_GAMEHOME, getGame(), match[1])
    if (!fs.existsSync(outputEnts)) {
      if(START_SERVICES.includes('convert')) {
        console.error(new Error('WARNING: output image not found ' + match[1]))
      }
      continue
    }
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
  let outputEnts = path.join(FS_GAMEHOME, getGame(), task.test)
  if (fs.existsSync(outputEnts)) {
    fs.renameSync(outputEnts, path.join(repackedCache()[0], task.test))
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
    fs.writeFileSync(path.join(repackedCache()[0], task.test), images)
  }
  
}


async function execLevelshot(mapname) {
  let newVstr = ''
  let caches = repackedCache()
  let basegame = getGame()

  if(typeof EXECUTING_LVLSHOTS[mapname] != 'undefined') {
    return await Promise.all(EXECUTING_LVLSHOTS[mapname]
    .map(cmd => new Promise(resolve => {
      if(typeof cmd.subscribers == 'undefined') {
        cmd.subscribers = []
      }
      cmd.subscribers.push(resolve)
    })))
  }

  // figure out which images are missing and do it in one shot
  let LVL_COMMANDS = [{
    mapname: mapname,
    cmd: ' ; vstr setupLevelshot ;  ; vstr takeLevelshot ; ',
    resolve: resolveScreenshot,
    test: path.join('levelshots', mapname + '.jpg')
  }, {
    mapname: mapname,
    // special exception
    cmd: ' ; vstr setupLevelshot ;  ; vstr takeLevelshotFullsize ; ',
    resolve: resolveScreenshot,
    test: path.join('screenshots', mapname + '_screenshot0001.jpg')
  }, {
    mapname: mapname,
    // special exception
    cmd: ' ; vstr screenshotBirdsEyeView ; ',
    resolve: resolveScreenshot,
    test: path.join('screenshots', mapname + '_screenshot0002.jpg')
  }]
  // TODO: take screenshot from every camera position
  // TODO: export all BLUEPRINTS and all facets through sv_bsp_mini
  // TODO: palette pastel full levelshot

  const TRACEMAPS = {
    1: ' ; vstr exportAreaMask ; ',
    2: ' ; vstr exportHeightMap ; ',
    3: ' ; vstr exportSkybox ; ',
    4: ' ; vstr exportBottomup ; ',
    5: ' ; vstr exportGroundheight ; ',
    6: ' ; vstr exportSkyboxVolume ; ',
    7: ' ; vstr exportSkyboxVolume2 ; ',
    8: ' ; vstr exportSkyboxVolume3 ; ',

  }
  LVL_COMMANDS.push.apply(LVL_COMMANDS, Object.keys(TRACEMAPS).map(i => {
    let tracename = `${mapname}_tracemap${String(i).padStart(4, '0')}.jpg`
    return {
      mapname: mapname,
      // special exception
      cmd: TRACEMAPS[i],
      resolve: resolveScreenshot,
      test: path.join('maps', tracename)
    }
  }))

  // TODO: export / write entities / mapname.ents file
  LVL_COMMANDS.push({
    mapname: mapname,
    // special exception
    cmd: ' ; saveents ; ',
    resolve: resolveEnts,
    test: path.join('maps', mapname + '.ent')
  })

  LVL_COMMANDS.push({
    mapname: mapname,
    // special exception
    cmd: ' ; imagelist ; ',
    resolve: resolveImages,
    test: path.join('maps', mapname + '-images.txt')
  })

  if(START_SERVICES.includes('cache')) {
    fs.mkdirSync(path.join(repackedCache()[0], '/maps/'), { recursive: true })
  }

  for(let i = 0; i < LVL_COMMANDS.length; i++) {
    for(let j = 0; j < caches.length; j++) {
      if(fs.existsSync(path.join(caches[j], LVL_COMMANDS[i].test))) {
        LVL_COMMANDS[i].done = true
        break
      }
    }

    if(LVL_COMMANDS[i].done) {
      continue
    }

    // resolve based on filename and no logs? 
    //   i.e. output already exists, but not converted
    if(await LVL_COMMANDS[i].resolve('', LVL_COMMANDS[i])) {
      LVL_COMMANDS[i].done = true
      continue
    }

    newVstr += LVL_COMMANDS[i].cmd
    // TODO: queue the commands for the map and wait for individual success
  }

  /*
  let shaderFile = path.join(REPACKED_MAPS, mapname + '-shaders.txt')
  if (!fs.existsSync(shaderFile)) {
    newVstr += ' ; shaderlist ; '
  }
  */

  if (newVstr.length == 0) {
    return
  }

  const screenshotCommands = [
    '+set', 'fs_basepath', FS_BASEPATH,
    '+set', 'fs_homepath', FS_GAMEHOME,
    '+set', 'bot_enable', '0',
    '+set', 'developer', '0',
    // Ironically, the thing I learned working for the radio station about
    //   M$ Windows not being able to run without a video card for remote
    //   desktop, but Xvfb working fine with remote desktop, has suddenly
    //   become relevant, and now I understand why.
    // https://stackoverflow.com/questions/12482166/creating-opengl-context-without-window
    '+set', 'r_headless', '1',

    // TODO: run a few frames to load images before
    //   taking a screen shot and exporting canvas
    //   might also be necessary for aligning animations.
    '+set', 'lvlshotCommands', `"${newVstr}"`,
    '+exec', `".config/levelinfo_${mapname}.cfg"`,
    '+vstr', 'resetLvlshot',
    '+devmap', mapname,
    '+heartbeat',
    '+vstr', 'lvlshotCommands',
    '+wait', '200', '+quit'
  ]



  fs.mkdirSync(path.join(FS_GAMEHOME, basegame, '/maps/'), { recursive: true })
  fs.mkdirSync(path.join(FS_GAMEHOME, basegame, '.config'), { recursive: true })
  let lvlconfig = path.join(FS_GAMEHOME, basegame, '.config/levelinfo_' + mapname + '.cfg')
  fs.writeFileSync(lvlconfig, LVLSHOTS.replace(/\$\{mapname\}/ig, mapname))
  
  // TODO: filtered to a specific task listed above based 
  //   on where the mapinfo request came from
  EXECUTING_LVLSHOTS[mapname] = LVL_COMMANDS

  Promise.resolve(lvlshotCmd(mapname, screenshotCommands, logs => {
    Promise.all(LVL_COMMANDS.map(updateSubscribers.bind(null, mapname, logs)))
  })).then(logs => {
    fs.unlinkSync(lvlconfig)
    updatePageViewers('\/maps\/' + mapname)
    delete EXECUTING_LVLSHOTS[mapname]
  })

  return await Promise.all(LVL_COMMANDS
    .filter(cmd => cmd.cmd.includes('saveents') || cmd.cmd.includes('imagelist'))
    .map(cmd => new Promise(resolve => {
      if(typeof cmd.subscribers == 'undefined') {
        cmd.subscribers = []
      }
      cmd.subscribers.push(resolve)
    })))
}


// break up the processing of specific events from the logs
//   to allow clients to subscribe
async function updateSubscribers(mapname, logs, cmd) {
  if(cmd.done) {
    return
  }
  let isResolved = await cmd.resolve(logs, cmd)
  if(!isResolved) {
    return
  }

  cmd.done = true
  if(cmd.subscribers) {
    for(let j = 0; j < cmd.subscribers.length; ++j) {
      cmd.subscribers[j](logs)
    }
  }
  updatePageViewers('\/maps\/' + mapname)
}


module.exports = {
  EXECUTING_LVLSHOTS,
  execLevelshot,
}

