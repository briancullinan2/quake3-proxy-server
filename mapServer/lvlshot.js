
const path = require('path')
const fs = require('fs')

const { FS_BASEPATH, FS_GAMEHOME, LVLSHOTS } = require('../utilities/env.js')
const { convertImage } = require('../contentServer/convert.js')
const { getGame } = require('../utilities/env.js')
const { repackedCache } = require('../utilities/env.js')
const { START_SERVICES } = require('../contentServer/features.js')
const { updatePageViewers } = require('../contentServer/session.js')
const { dedicatedCmd } = require('../cmdServer/cmd-dedicated.js')
const { EXECUTING_MAPS } = require('../gameServer/processes.js')
const { UDP_SOCKETS, MASTER_PORTS, sendOOB } = require('../gameServer/master.js')


// TODO: this is pretty lame, tried to make a screenshot, and a
//   bunch of stuff failed, now I have some arbitrary wait time
//   and it works okay, but a real solution would be "REAL-TIME"!
// TODO: open a control port and create a new master server. One
//   separate master control for every single map, split up and only
//   do 10 maps at a time, because of this.

const LVLSHOT_TIMEOUT = 5000
const RENDERER_TIMEOUT = 10000
const MAX_RENDERERS = 4
const EXECUTING_LVLSHOTS = {}
let lvlshotTimer

async function processQueue() {
  // TODO: keep track of levelshot servers separately, sort / priorize by 
  //   Object.keys(EXECUTING_LVLSHOTS) == mapname, then prioritize by list
  //   i.e. if there are 2 maps with 2 tasks, there should be 4 servers running
  //   in parallel with 2 redundant maps loaded.
  if (!lvlshotTimer) {
    lvlshotTimer = setInterval(processQueue, 1000 / 60)
  }
  
  // sort by if the existing stack has less than <MAX_RENDERERS> commands
  //   and if the time is less than <RENDERER_TIMEOUT> from the request
  let mapNames = Object.keys(EXECUTING_LVLSHOTS)
  let mapNamesFiltered = mapNames.sort(function (a, b) {
    // sort by the average minimum * number of tasks
    let aTasks = EXECUTING_LVLSHOTS[a].slice(0, MAX_RENDERERS)
    let bTasks = EXECUTING_LVLSHOTS[b].slice(0, MAX_RENDERERS)
    let aSum = aTasks.reduce((sum, task) => (sum + task.time), 0)
    let bSum = bTasks.reduce((sum, task) => (sum + task.time), 0)
    return bSum / bTasks.length - aSum / aTasks.length
  }).slice(0, MAX_RENDERERS)

  for(let i = 0; i < mapNamesFiltered.length; ++i) {
    // out of these <MAX_RENDERERS> maps, queue up to <MAX_RENDERERS> tasks for each
    //   of the <MAX_RENDERERS> servers to perform simultaneously.
    let mapname = mapNamesFiltered[i]
    let renderers = Object.values(EXECUTING_MAPS).filter(map => map.renderer)
    let mapRenderers = renderers.filter(map => map.mapname == mapname)
    let freeRenderers = renderers.filter(map => !map.working)
    if(freeRenderers.length == 0) {
      if(mapRenderers.length == 0) {
        if(renderers.length >= 4) {
          continue // can't do anything
        } else { // start another server
          serveLvlshot(mapname)
          continue
        }
      } else {
        continue // wait for another renderer to pick it up
      }
    } else {
      let mapRenderer = freeRenderers.filter(map => map.mapname == mapname)[0]
      if (!mapRenderer || EXECUTING_LVLSHOTS[mapname].length > 4) {
        // TODO: send map-switch to  <freeRenderer>  command if there is more than 4 tasks
        sendOOB(UDP_SOCKETS[MASTER_PORTS[0]], 'rcon password1 devmap ' + mapname, freeRenderers[0])
        continue
      } else {
        // TODO: use RCON interface to control servers and get information
        let task = EXECUTING_LVLSHOTS[mapname].shift()
        sendOOB(UDP_SOCKETS[MASTER_PORTS[0]], 'rcon password1 ' + task.command, freeRenderer)
      }
    }
  }

  // return promise wait on filtered tasks
}


// TODO: turn this into some sort of temporary cfg script
async function serveLvlshot(mapname) {
  // TODO: wait for the new dedicated process to connect to our specialized
  //   control port. Now we have a Quake 3 server command pipe. Send OOB
  //   RCON messages to control our own process remotely / asynchronously.
  // TODO: take the screenshots, run client commands using local dedicate 
  //   connected commands (side-effect, easily switch out client to a real
  //   server using the reconnect command).
  if(Object.values(EXECUTING_MAPS).filter(map => map.renderer).length >= 4) {
    return
  }

  // only start one dedicated server at a time
  let challenge = Object.keys(RESOLVE_DEDICATED).filter(list => list.length > 0)[0]
  if(challenge) {
    return await new Promise(resolve => RESOLVE_DEDICATED[challenge].push(resolve))
  }

  try {
    
    let challenge = buildChallenge()
    RESOLVE_DEDICATED[challenge] = []
    RESOLVE_DEDICATED[challenge].push(function () {
      console.log('Dedicated started.')
      updatePageViewers('/games')
    })

    let ps = await dedicatedCmd([
      '+set', 'dedicated', '1',
      '+set', 'sv_master2', '""',
      '+set', 'sv_master3', '""',
      '+sets', 'qps_serverId', challenge,
      '+set', 'rconPassword2', 'password1',
      '+set', 'sv_dlURL', '//maps/repacked/%1',
      '+devmap', mapname,
      '+wait', '300', '+heartbeat',
      // TODO: run a few frames to load images before
      //   taking a screen shot and exporting canvas
      //   might also be necessary for aligning animations.
      // '+exec', `".config/levelinfo_${mapname}.cfg"`,
    ], function (lines) {
      let server = Object.values(GAME_SERVERS).filter(s => s.qps_serverId == challenge)[0]
      if(!server) {
        //console.log(lines)
      } else {
        if(typeof server.logs == 'undefined') {
          server.logs = ''
        }
        server.logs += lines + '\n'
        updatePageViewers('/rcon')
      }
    })
    ps.on('close', function () {
      delete EXECUTING_MAPS[challenge]
    })
    EXECUTING_MAPS[challenge] = {
      renderer: true,
      challenge: challenge,
      pid: ps.pid,
      mapname: mapname,
    }
    EXECUTING_LVLSHOTS[mapname] = []
  } catch (e) {
    console.error('DEDICATED:', e)
  }

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

  fs.mkdirSync(path.join(FS_GAMEHOME, basegame, '/maps/'), { recursive: true })
  fs.mkdirSync(path.join(FS_GAMEHOME, basegame, '.config'), { recursive: true })
  let lvlconfig = path.join(FS_GAMEHOME, basegame, '.config/levelinfo_' + mapname + '.cfg')
  fs.writeFileSync(lvlconfig, LVLSHOTS.replace(/\$\{mapname\}/ig, mapname))

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
    let tracename = `${mapname}_tracemap${String(i).padStart(4, '0')}.tga`
    // set exportAreaMask "wait 30 ; minimap ${TRACEMAPS[i]} ${mapname}_tracemap0001 ; "

  }

  LVL_COMMANDS.push.apply(LVL_COMMANDS, Object.keys(TRACEMAPS).map(i => {
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

  /*
  let shaderFile = path.join(REPACKED_MAPS, mapname + '-shaders.txt')
  if (!fs.existsSync(shaderFile)) {
    newVstr += ' ; shaderlist ; '
  }
  */

  if(START_SERVICES.includes('cache')) {
    fs.mkdirSync(path.join(repackedCache()[0], '/maps/'), { recursive: true })
  }



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

