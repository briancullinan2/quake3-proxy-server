// TODO: need to distill SOCKS proxy so we can add cool features
// Needs to work with Native network settings and browser proxy settings alike.
// Needs to supplement Web-sockets.
// NEW: need to act as a routable HTTP proxy after a BIND-CONNECT sequence.
// Needs to support servers incoming and clients outgoing for reverse-proxy access.
// Every client has authenticated access to the proxy server
// Then every port opened has authenticated access matching the game password 
//   to track client guids
const fs = require('fs')
const path = require('path')

const { createWebServers } = require('./contentServer/express.js')
const { createMasters } = require('./gameServer/serve-master.js')
const { SUPPORTED_SERVICES, START_SERVICES } = require('./contentServer/features.js')
const { contentWatcher, projectWatcher, watchDirectory } = require('./utilities/watch.js')
const { EXECUTING_MAPS, GAME_SERVERS } = require('./gameServer/processes.js')
const { log: previousLog, error: previousError } = require('console')
const { EXECUTING_LVLSHOTS, listJobs } = require('./mapServer/lvlshot.js')
const { parseAguments } = require('./utilities/parse-args.js')
const { PROJECTS } = require('./utilities/env.js')
const { buildDirectories } = require('./assetServer/virtual.js')

const REDIRECTED_LOGS = []
const REDIRECTED_ERRORS = []

const CLI_COMMANDS = {
  'logs': printLogs,
  'log': printLogs,
  'error': printLogs,
  'errors': printLogs,
  'quit': process.exit,
  'exit': process.exit,
  'kill': process.exit,
  'games': function () {
    previousLog(GAME_SERVERS)
  },
  'maps': function () {
    previousLog('Renderers:', EXECUTING_MAPS)
    let jobs = listJobs()
    previousLog('All keys', Object.keys(EXECUTING_LVLSHOTS))
    previousLog('Map w/ Jobs:', jobs)
    previousLog('Running:', jobs.map(mapname => EXECUTING_LVLSHOTS[mapname][0]))
  }
}


function printLogs(cmd) {
  if (cmd == 'logs' || cmd == 'log') {
    for (let i = 0; i < REDIRECTED_LOGS.length; i++) {
      previousLog(...REDIRECTED_LOGS[i])
    }
    REDIRECTED_LOGS.splice(0)
  } else
    if (cmd == 'error' || cmd == 'errors') {
      for (let i = 0; i < REDIRECTED_ERRORS.length; i++) {
        previousError(...REDIRECTED_ERRORS[i])
      }
      REDIRECTED_ERRORS.splice(0)
    }
}


isInside = false
function exceptionHandler(ex) {
  debugger
  if (isInside) {
    isInside = false
    REDIRECTED_ERRORS.push([ex])
    previousError(REDIRECTED_ERRORS.length, 'unhandled:',
      (ex + '').substring(0, 100))
    return
  }
  isInside = true
  throw ex // bubble up, make sure it is uncaught?
}


function errorConsole(...args) {
  REDIRECTED_ERRORS.push(args)
  if(START_SERVICES.includes('deploy')) {
    previousError(REDIRECTED_ERRORS.length, args)
  } else {
    previousError(REDIRECTED_ERRORS.length, 'errors:',
    args.join(' ').substring(0, 100))
  }
}


function addCommands(features) {
  if (!process.stdin.isTTY) {
    return
  }
  let readline = require('readline')
  let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  })
  process.stdout.write(': ')
  console.error = errorConsole
  rl.on('line', function (line) {
    line = line.trim()
    if (line.startsWith('\\')) {
      line = line.substring(1)
    }
    let cmd = (((/\w+/gi).exec(line) || [])[0] || '').toLocaleLowerCase()
    let cmds = Object.keys(CLI_COMMANDS)
    let found = false
    for (let i = 0; i < cmds.length; i++) {
      if (cmds[i] == cmd) {
        CLI_COMMANDS[cmd](cmd, line)
        found = true
        break
      }
    }
    if (!found && cmd.length > 0) {
      previousLog('Command not recognized: ' + cmd)
    }
    process.stdout.write('\n: ')
  })
}




function main() {

  if (!START_SERVICES.includes('holdup')
    && (START_SERVICES.includes('all')
      || START_SERVICES.includes('live'))) {

    process.on('unhandledRejection', exceptionHandler)
    process.on('uncaughtException', exceptionHandler)

    if(!START_SERVICES.includes('debug')
      && (!START_SERVICES.includes('deploy')
      || START_SERVICES.includes('live'))
    ) {
      let BUILD_ORDER = buildDirectories()
      console.log(BUILD_ORDER)
      for (let i = 0; i < BUILD_ORDER.length; i++) {
        watchDirectory(BUILD_ORDER[i], projectWatcher, false)
        if(fs.existsSync(BUILD_ORDER[i]) && fs.statSync(BUILD_ORDER[i]).isDirectory()) {
          let directory = fs.readdirSync(BUILD_ORDER[i])
          for(let j = 0; j < directory.length; j++) {
            let fullPath = path.join(BUILD_ORDER[i], directory[j])
            if(fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
              watchDirectory(fullPath, projectWatcher, false)
            }
          }
        }
      }
      projectWatcher()
      return
    }
  }


  if (START_SERVICES.includes('all')
    || START_SERVICES.includes('master')) {
    Promise.resolve(createMasters(START_SERVICES.includes('mirror')))
  }

  if (START_SERVICES.length > 0) {
    createWebServers(START_SERVICES)
  }

  if (START_SERVICES.includes('all')
    || START_SERVICES.includes('tty')) {
    addCommands(START_SERVICES)
  }

  if (START_SERVICES.includes('all')
    || START_SERVICES.includes('live')) {
    contentWatcher()
  }


}


// create servers
let isCLI = false
let runServer = false
let holdup = false

for (let i = 0; i < process.argv.length; i++) {
  let a = process.argv[i]
  if (a.includes('node')) {
    isCLI = true
  } else
    if (a.match(__filename)) {
      runServer = true
    } else
      if (SUPPORTED_SERVICES.includes(a)) {
        START_SERVICES.push(a)
      }
}
if (START_SERVICES.length == 0) {
  START_SERVICES.push('all')
}

if (runServer) {
  if (START_SERVICES.includes('holdup')) {

    parseAguments(process.argv)
    PROJECTS.push(__dirname)

    if (fs.existsSync(path.join(__dirname, 'settings.json'))) {
      parseAguments(require(path.join(__dirname, 'settings.json')))
    }

    setTimeout(main, 2000)
  } else {
    main()
  }
} else {
  module.exports = {
    main
  }
}
