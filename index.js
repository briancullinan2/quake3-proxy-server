// TODO: need to distill SOCKS proxy so we can add cool features
// Needs to work with Native network settings and browser proxy settings alike.
// Needs to supplement Web-sockets.
// NEW: need to act as a routable HTTP proxy after a BIND-CONNECT sequence.
// Needs to support servers incoming and clients outgoing for reverse-proxy access.
// Every client has authenticated access to the proxy server
// Then every port opened has authenticated access matching the game password 
//   to track client guids
const fs = require('fs')
const { HTTP_PORTS, createWebServers } = require('./contentServer/express.js')
const { MASTER_PORTS, createMasters } = require('./gameServer/serve-master.js')
const { serveDedicated } = require('./gameServer/serve-process.js')
const { 
  setDownload, setRepack, downloadCache, repackedCache, setGame 
} = require('./utilities/env.js')

const SUPPORTED_SERVICES = [
  'proxy', 'maps', 'master', 'mirror', 'dedicated',
  'redirect', 'games', 'content', 'repack', 'discord',
  'virtual', 'live', 'mods', 'all'
]
const START_SERVICES = ['all']

let forwardIP = ''
let noFS = false

function parseAguments() {

  for (let i = 0; i < process.argv.length; i++) {
    let a = process.argv[i]
    switch (a) {
      case '--proxy-ip':
        console.log('Forwarding ip address: ', process.argv[i + 1])
        forwardIP = process.argv[i + 1]
        i++
        break
      case '--http-port':
        console.log('HTTP ports: ', process.argv[i + 1])
        HTTP_PORTS.splice(0)
        for (let i = 0; i < newPorts.length; i++) {
          HTTP_PORTS.push(parseInt(newPorts[i]))
        }
        i++
        break
      case '--master-port':
        console.log('Master port: ', process.argv[i + 1])
        MASTER_PORTS.splice(0)
        let newPorts = process.argv[i + 1].split(',')
        for (let i = 0; i < newPorts.length; i++) {
          MASTER_PORTS.push(parseInt(newPorts[i]))
        }
        i++
        break
      case '--masters':
        console.log('Master servers: ', process.argv[i + 1])
        masters = process.argv[i + 1].split(',')
        i++
        break
      case '--no-fs':
        console.log('Turning off file-system access.')
        noFS = true
        break
      case '--game':
        console.log('Basegame: ', process.argv[i + 1])
        setGame(process.argv[i + 1])
        i++
        break
      case '--repack-cache':
        console.log('Repack cache: ', process.argv[i + 1])
        setRepack(process.argv[i + 1])
        if (!fs.existsSync(repackedCache())) {
          console.log('WARNING: directory does not exist, unexpected behavior.')
        }
        i++
        break
      case '--download-cache':
        console.log('Download cache: ', process.argv[i + 1])
        setDownload(process.argv[i + 1])
        if (!fs.existsSync(downloadCache())) {
          console.log('WARNING: directory does not exist, unexpect behavior.')
        }
        i++
        break
    }
  }
}

const { GAME_SERVERS } = require('./gameServer/master.js')
const {log: previousLog, error: previousError} = require('console')

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
  if(cmd == 'logs' || cmd == 'log') {
    for(let i = 0; i < REDIRECTED_LOGS.length; i++) {
      previousLog(...REDIRECTED_LOGS[i])
    }
    REDIRECTED_LOGS.splice(0)
  } else
  if(cmd == 'error' || cmd == 'errors') {
    for(let i = 0; i < REDIRECTED_ERRORS.length; i++) {
      previousError(...REDIRECTED_ERRORS[i])
    }
    REDIRECTED_ERRORS.splice(0)
  }
}



function addCommands(features) {
  if(!process.stdin.isTTY) {
    return
  }
  let readline = require('readline')
  let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  })
  process.stdout.write(': ')
  console.log = function (...args) {
    REDIRECTED_LOGS.push(args)
    //previousLog(...args)
  }
  console.error = function (...args) {
    REDIRECTED_ERRORS.push(args)
    previousError(REDIRECTED_ERRORS.length, 'errors:', 
        args.join(' ').substring(0, 100))
  }
  rl.on('line', function(line){
    line = line.trim()
    if(line.startsWith('\\')) {
      line = line.substring(1)
    }
    let cmd = (((/\w+/gi).exec(line) || [])[0] || '').toLocaleLowerCase()
    let cmds = Object.keys(CLI_COMMANDS)
    let found = false
    for(let i = 0; i < cmds.length; i++) {
      if(cmds[i] == cmd) {
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
  parseAguments()

  if (START_SERVICES.includes('all')
    || START_SERVICES.includes('master')) {
    createMasters(START_SERVICES.includes('all') 
        || START_SERVICES.includes('mirror'))
  }

  if (START_SERVICES.length > 0) {
    createWebServers(START_SERVICES)
  }

  if (START_SERVICES.includes('all')
    || START_SERVICES.includes('dedicated')) {
    serveDedicated().catch(e => console.error(e))
  }

  if(START_SERVICES.includes('all')
    || START_SERVICES.includes('tty')) {
    addCommands(START_SERVICES)
  }
}


// create servers
let isCLI = false
let runServer = false

for (let i = 0; i < process.argv.length; i++) {
  let a = process.argv[i]
  if (a.includes('node')) {
    isCLI = true
  } else
    if (a.match(__filename)) {
      runServer = true
    } else
      if (SUPPORTED_SERVICES.includes(a)) {
        if (START_SERVICES.length == 1 && START_SERVICES[0] == 'all') {
          START_SERVICES.pop()
        }
        START_SERVICES.push(a)
      }
}

if (runServer) {
  main()
}
