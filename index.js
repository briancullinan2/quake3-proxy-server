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

const { HTTP_PORTS, createWebServers } = require('./contentServer/express.js')
const { createMasters } = require('./gameServer/serve-master.js')
const { MASTER_PORTS } = require('./gameServer/master.js')
const { serveDedicated } = require('./gameServer/serve-process.js')
const {
  setDownload, setRepack, downloadCache, repackedCache, setGame,
  addDownload, setWatcherPID, addRepacked, addGame,
} = require('./utilities/env.js')
const { SUPPORTED_SERVICES, START_SERVICES } = require('./contentServer/features.js')
const { projectWatcher, contentWatcher } = require('./utilities/watch.js')

let forwardIP = ''
let noFS = false

function parseAguments(startArgs) {

  for (let i = 0; i < startArgs.length; i++) {
    let a = startArgs[i]
    switch (a) {
      case '--proxy-ip':
        console.log('Forwarding ip address: ', startArgs[i + 1])
        forwardIP = startArgs[i + 1]
        i++
        break
      case '--http-port':
        console.log('HTTP ports: ', startArgs[i + 1])
        HTTP_PORTS.splice(0)
        for (let i = 0; i < newPorts.length; i++) {
          HTTP_PORTS.push(parseInt(newPorts[i]))
        }
        i++
        break
      case '--master-port':
        console.log('Master port: ', startArgs[i + 1])
        MASTER_PORTS.splice(0)
        let newPorts = startArgs[i + 1].split(',')
        for (let i = 0; i < newPorts.length; i++) {
          MASTER_PORTS.push(parseInt(newPorts[i]))
        }
        i++
        break
      case '--masters':
        console.log('Master servers: ', startArgs[i + 1])
        masters = startArgs[i + 1].split(',')
        i++
        break
      case '--no-fs':
        console.log('Turning off file-system access.')
        noFS = true
        break
      case '--game':
        console.log('Basegame: ', startArgs[i + 1])
        setGame(startArgs[i + 1])
        i++
        break
      case '--add-mod':
      case '--add-game':
        console.log('Game mod: ', startArgs[i + 1])
        addGame(startArgs[i + 1])
        i++
        break
      case '--repack-cache':
        console.log('Repack cache: ', startArgs[i + 1])
        setRepack(startArgs[i + 1])
        if (!fs.existsSync(repackedCache()[0])) {
          console.log('WARNING: directory does not exist, unexpected behavior.')
        }
        i++
        break
      case '--download-cache':
        console.log('Download cache: ', startArgs[i + 1])
        setDownload(startArgs[i + 1])
        if (!fs.existsSync(downloadCache()[0])) {
          console.log('WARNING: directory does not exist, unexpect behavior.')
        }
        i++
        break
      case '--watcher-pid':
        console.log('Watcher PID: ', startArgs[i + 1])
        setWatcherPID(startArgs[i + 1])
        i++
        break
      case '--add-downloads':
        console.log('Download cache: ', startArgs[i + 1])
        addDownload(startArgs[i + 1])
        if (!fs.existsSync(startArgs[i + 1])) {
          console.log('WARNING: directory does not exist, unexpect behavior.')
        }
        i++
        break
      case '--add-repacked':
        console.log('Repacked cache: ', startArgs[i + 1])
        addRepacked(startArgs[i + 1])
        if (!fs.existsSync(startArgs[i + 1])) {
          console.log('WARNING: directory does not exist, unexpect behavior.')
        }
        i++
        break
    }
  }
}

const { GAME_SERVERS } = require('./gameServer/processes.js')
const { log: previousLog, error: previousError } = require('console')

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
  if (isInside) {
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
  previousError(REDIRECTED_ERRORS.length, 'errors:',
    args.join(' ').substring(0, 100))
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

    return projectWatcher()
  }

  parseAguments(process.argv)

  if (fs.existsSync(path.join(__dirname, 'settings.json'))) {
    parseAguments(require(path.join(__dirname, 'settings.json')))
  }

  if (START_SERVICES.includes('all')
    || START_SERVICES.includes('master')) {
    Promise.resolve(createMasters(START_SERVICES.includes('mirror')))
  }

  if (START_SERVICES.length > 0) {
    createWebServers(START_SERVICES)
  }

  //if (START_SERVICES.includes('all')
  //  || START_SERVICES.includes('dedicated')) {
  //  serveDedicated()
  //}

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
    setTimeout(main, 2000)
  } else {
    main()
  }
}
