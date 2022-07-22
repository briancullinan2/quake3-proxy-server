
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
        sendOOB(UDP_SOCKETS[MASTER_PORTS[0]], 'rcon password1 ' + task.cmd, freeRenderer)
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
      //Promise.all(LVL_COMMANDS.map(updateSubscribers.apply(null, server.mapname, server.logs)))

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
}

