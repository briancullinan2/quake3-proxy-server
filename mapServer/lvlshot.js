
const { updatePageViewers } = require('../contentServer/session.js')
const { dedicatedCmd } = require('../cmdServer/cmd-dedicated.js')
const { RESOLVE_DEDICATED, EXECUTING_MAPS, GAME_SERVERS } = require('../gameServer/processes.js')
const { RESOLVE_LOGS, UDP_SOCKETS, MASTER_PORTS, sendOOB } = require('../gameServer/master.js')
const buildChallenge = require('../quake3Utils/generate-challenge.js')


// TODO: this is pretty lame, tried to make a screenshot, and a
//   bunch of stuff failed, now I have some arbitrary wait time
//   and it works okay, but a real solution would be "REAL-TIME"!
// TODO: open a control port and create a new master server. One
//   separate master control for every single map, split up and only
//   do 10 maps at a time, because of this.

const GAMEINFO_TIMEOUT = 60 * 1000
const RESOLVE_INTERVAL = 1000
const LVLSHOT_TIMEOUT = 5000
const RENDERER_TIMEOUT = 10000
const MAX_RENDERERS = 2
const EXECUTING_LVLSHOTS = {}
let lvlshotTimer
let RUNCMD = 0

async function processQueue() {
  // TODO: keep track of levelshot servers separately, sort / priorize by 
  //   Object.keys(EXECUTING_LVLSHOTS) == mapname, then prioritize by list
  //   i.e. if there are 2 maps with 2 tasks, there should be 4 servers running
  //   in parallel with 2 redundant maps loaded.
  if (!lvlshotTimer) {
    console.log('Starting renderer service.')
    lvlshotTimer = setInterval(processQueue, 1000 / 60)
    return
  }
  
  // sort by if the existing stack has less than <MAX_RENDERERS> commands
  //   and if the time is less than <RENDERER_TIMEOUT> from the request
  let mapNames = Object.keys(EXECUTING_LVLSHOTS)
  let mapNamesFiltered = mapNames.sort(function (a, b) {
    // sort by the average minimum * number of tasks
    EXECUTING_LVLSHOTS[a].sort((c, d) => (d.subscribers || 0) - (c.subscribers || 0))
    EXECUTING_LVLSHOTS[b].sort((c, d) => (d.subscribers || 0) - (c.subscribers || 0))
    let aTasks = EXECUTING_LVLSHOTS[a].slice(0, MAX_RENDERERS)
    let bTasks = EXECUTING_LVLSHOTS[b].slice(0, MAX_RENDERERS)
    let aSum = aTasks.reduce((sum, task) => (sum + task.created), 0)
    let bSum = bTasks.reduce((sum, task) => (sum + task.created), 0)
    return aSum / aTasks.length - bSum / bTasks.length
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
        let notTimedOut = renderers.filter(map => {
          let SERVER = Object.values(GAME_SERVERS).filter(info => info.qps_serverId == map.challenge)[0]
          let updateTime = 0
          if(SERVER && SERVER.sv_maxRate) {
            updateTime = parseInt(SERVER.sv_maxRate)
          }
          if(updateTime < GAMEINFO_TIMEOUT) {
            updateTime = GAMEINFO_TIMEOUT
          }        
          return !SERVER || !SERVER.timedout
            // still include the server in the list unless it has failed a few times
            //   to hit that higher GAMEINFO_TIMEOUT
            || (Date.now() - SERVER.timeUpdated) < Math.max(updateTime)
        })
        if(notTimedOut.length >= MAX_RENDERERS) {
          //console.log('Max servers: ' + mapname)
          continue // can't do anything
        } else { // start another server
          Promise.resolve(serveLvlshot(mapname))
          continue
        }
      } else {
        //console.log('Delegate: ' + mapname)
        continue // wait for another renderer to pick it up
      }
    } else {

      let serversAvailable = freeRenderers
          .sort((a, b) => (b.mapname == mapname ? 1 : 0) - (a.mapname == mapname ? 1 : 0))
          .map(map => Object.values(GAME_SERVERS).filter(info => info.qps_serverId == map.challenge)[0])
          .filter(server => server)

      let SERVER
      if (!serversAvailable || serversAvailable.length == 0) {
        console.log('None available: ' + mapname)
        continue
      } else {
        SERVER = EXECUTING_MAPS[serversAvailable[0].qps_serverId]
      }

      if(serversAvailable[0].mapname != mapname  &&  EXECUTING_LVLSHOTS[mapname].length > 4) {
        // TODO: send map-switch to  <freeRenderer>  command if there is more than 4 tasks
        console.log('Switching maps: ' + mapname)
        sendOOB(UDP_SOCKETS[MASTER_PORTS[0]], 'rcon password1 devmap ' + mapname, serversAvailable[0])
        // so it doesn't try and change all servers
        SERVER.working = true
        // this will be updated by the time the server switches
        //SERVER.mapname = mapname
        continue
      } else {
        // TODO: use RCON interface to control servers and get information
        let task = EXECUTING_LVLSHOTS[mapname][0]
        if(!task || task.done) {
          //console.log('No tasks: ' + mapname)
          if(task) {
            EXECUTING_LVLSHOTS[mapname].shift()
          }
          continue
        }
        if(await updateSubscribers(mapname, serversAvailable[0].logs, task)) {
          EXECUTING_LVLSHOTS[mapname].shift()
          continue // already done, don't command
        }
        // TODO: add a checkin and a timeout to retry the task


        SERVER.working = task
        task.subscribers.push(function () {
          if(task.timedout) {
            console.log('Task timedout. Retrying.')
          } else {
            EXECUTING_LVLSHOTS[mapname].shift()
            console.log('Task completed: took ' + (Date.now() - task.created) / 1000 + ' seconds')
          }
          SERVER.working = false
        })
        task.started = Date.now()
        // when we get a print response, let waiting clients know about it
        if(typeof RESOLVE_LOGS[serversAvailable[0].challenge] == 'undefined') {
          RESOLVE_LOGS[serversAvailable[0].challenge] = []
        }
        RESOLVE_LOGS[serversAvailable[0].challenge].push(function (logs) {
          updateSubscribers(mapname, logs, task)
        })

        console.log('Starting renderer task: ', task)
        ++RUNCMD
        sendOOB(UDP_SOCKETS[MASTER_PORTS[0]], 'rcon password1 set command' + RUNCMD + ' "' + task.cmd + '"', serversAvailable[0])
        sendOOB(UDP_SOCKETS[MASTER_PORTS[0]], 'rcon password1 vstr command' + RUNCMD, serversAvailable[0])
        sendOOB(UDP_SOCKETS[MASTER_PORTS[0]], 'rcon password1 status', serversAvailable[0])
      }
    }
  }


  Object.values(EXECUTING_MAPS).forEach(map => {
    if(typeof map.working != 'object') {
      return
    }
    if(map.working.updated && Date.now() - map.working.updated < RESOLVE_INTERVAL) {
      return
    }
    map.working.updated = Date.now()
    let SERVER = Object.values(GAME_SERVERS).filter(info => info.qps_serverId == map.challenge)[0]
    if(Date.now() - map.working.started > RENDERER_TIMEOUT) {
      map.timedout = true
      map.working.timedout = true
    }
    if(SERVER) {
      updateSubscribers(map.mapname, SERVER.logs, map.working)
    } else {
      updateSubscribers(map.mapname, map.logs, map.working)
    }
  })
}


// TODO: turn this into some sort of temporary cfg script
async function serveLvlshot(mapname, waitFor) {
  // TODO: wait for the new dedicated process to connect to our specialized
  //   control port. Now we have a Quake 3 server command pipe. Send OOB
  //   RCON messages to control our own process remotely / asynchronously.
  // TODO: take the screenshots, run client commands using local dedicate 
  //   connected commands (side-effect, easily switch out client to a real
  //   server using the reconnect command).
  if(Object.values(EXECUTING_MAPS).filter(map => map.renderer).length >= MAX_RENDERERS) {
    return
  }

  // only start one dedicated server at a time
  let challenge = Object.keys(RESOLVE_DEDICATED).filter(list => RESOLVE_DEDICATED[list].length > 0)[0]
  if(challenge) {
    if(waitFor) {
      return await new Promise(resolve => RESOLVE_DEDICATED[challenge].push(resolve))
    } else {
      return
    }
  }

  try {
    
    let challenge = buildChallenge()
    RESOLVE_DEDICATED[challenge] = []
    RESOLVE_DEDICATED[challenge].push(function () {
      console.log('Renderer started.')
      updatePageViewers('/games')
    })
    EXECUTING_MAPS[challenge] = {
      renderer: true,
      challenge: challenge,
      mapname: mapname,
      logs: ''
    }
    let ps = await dedicatedCmd([
      '+set', 'sv_pure', '0', 
      '+set', 'dedicated', '0',
      '+set', 'developer', '0',
      '+set', 'r_headless', '1',
      '+set', 'in_mouse', '0',
      '+set', 'sv_master2', '""',
      '+set', 'sv_master3', '""',
      '+sets', 'qps_serverId', '"' + challenge + '"',
      '+sets', 'qps_renderer', '1',
      '+set', 'com_maxfps', '60',
      '+set', 'rconPassword2', 'password1',
      '+set', 'sv_dlURL', '"//maps/repacked/%1"',
      '+devmap', mapname,
      '+exec', `".config/levelinfo.cfg"`,
      '+vstr', 'resetLvlshot',
      '+wait', '240', '+heartbeat',
      // TODO: run a few frames to load images before
      //   taking a screen shot and exporting canvas
      //   might also be necessary for aligning animations.
    ], function (lines) {
      EXECUTING_MAPS[challenge].logs += lines + '\n'
      if(typeof EXECUTING_MAPS[challenge].working == 'object') {
        updateSubscribers(EXECUTING_MAPS[challenge].mapname, 
                          EXECUTING_MAPS[challenge].logs,
                          EXECUTING_MAPS[challenge].working)
      }
    })
    EXECUTING_MAPS[challenge].pid = ps.pid
    ps.on('close', function () {
      delete EXECUTING_MAPS[challenge]
    })
    if(typeof EXECUTING_LVLSHOTS[mapname] == 'undefined') {
      EXECUTING_LVLSHOTS[mapname] = []
    }
  } catch (e) {
    console.error('DEDICATED:', e)
  }

}


// break up the processing of specific events from the logs
//   to allow clients to subscribe
async function updateSubscribers(mapname, logs, cmd) {
  if(cmd.done) {
    return true
  }
  let isResolved = await cmd.resolve(logs, cmd)
  if(!isResolved && !cmd.timedout) {
    return false
  }

  if(!cmd.timedout) {
    cmd.done = true
  }
  if(!lvlshotTimer) {
    throw new Error('Task completed before service started.')
  }
  if(cmd.subscribers) {
    for(let j = 0; j < cmd.subscribers.length; ++j) {
      cmd.subscribers[j](logs)
    }
    cmd.subscribers.splice(0)
  } else {
    throw new Error('No subscribers!')
  }
  updatePageViewers('\/maps\/' + mapname)
  return true
}


module.exports = {
  EXECUTING_LVLSHOTS,
  processQueue,
}

