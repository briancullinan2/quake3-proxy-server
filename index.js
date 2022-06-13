// TODO: need to distill SOCKS proxy so we can add cool features
// Needs to work with Native network settings and browser proxy settings alike.
// Needs to supplement Web-sockets.
// NEW: need to act as a routable HTTP proxy after a BIND-CONNECT sequence.
// Needs to support servers incoming and clients outgoing for reverse-proxy access.
// Every client has authenticated access to the proxy server
// Then every port opened has authenticated access matching the game password 
//   to track client guids
const fs = require('fs')
const {createProxies} = require('./proxyServer/serve-web.js')
const {createMasters, MASTER_PORTS} = require('./gameServer/serve-games.js')
const {serveDedicated} = require('./gameServer/serve-process.js')
const {setDownload, setRepack, downloadCache, repackedCache} = require('./utilities/env.js')

const SUPPORTED_SERVICES = [
  'proxy', 'maps', 'master', 'mirror', 'dedicated', 
  'redirect', 'games', 'content', 'repack', 'discord',
  'virtual'
]
const START_SERVICES = []

let forward = 'http://locahost:8080'
let forwardIP = ''
let noFS = false

function parseAguments() {

  for(let i = 0; i < process.argv.length; i++) {
    let a = process.argv[i]
    switch(a) {
    case '--proxy-ip':
      console.log('Forwarding ip address: ', process.argv[i+1])
      forwardIP = process.argv[i+1]
      i++
      break
    case '--http-port':
      console.log('HTTP ports: ', process.argv[i+1])
      HTTP_PORTS.splice(0)
      for(let i = 0; i < newPorts.length; i++) {
        HTTP_PORTS.push(parseInt(newPorts[i]))
      }
      i++
      break
    case '--master-port':
      console.log('Master port: ', process.argv[i+1])
      MASTER_PORTS.splice(0)
      let newPorts = process.argv[i+1].split(',')
      for(let i = 0; i < newPorts.length; i++) {
        MASTER_PORTS.push(parseInt(newPorts[i]))
      }
      i++
      break
    case '--masters':
      console.log('Master servers: ', process.argv[i+1])
      masters = process.argv[i+1].split(',')
      i++
      break
    case '--no-fs':
      console.log('Turning off file-system access.')
      noFS = true
      break
    case '--game':
      console.log('Basegame: ', process.argv[i+1])
      setGame(process.argv[i+1])
      i++
      break
    case '--repack-cache':
      console.log('Repack cache: ', process.argv[i+1])
      setRepack(process.argv[i+1])
      if(!fs.existsSync(repackedCache())) {
        console.log('WARNING: directory does not exist, unexpected behavior.')
      }
      i++
      break
    case '--download-cache':
      console.log('Download cache: ', process.argv[i+1])
      setDownload(process.argv[i+1])
      if(!fs.existsSync(downloadCache())) {
        console.log('WARNING: directory does not exist, unexpect behavior.')
      }
      i++
      break
    }
  }
}

function main() {
  parseAguments()

  if(START_SERVICES.includes('master')) {
    createMasters(START_SERVICES.includes('mirror'))
  }

  if(START_SERVICES.length > 0) {
    createProxies(START_SERVICES, forward)
  }

  if(START_SERVICES.includes('dedicated')) {
    serveDedicated()
  }
}


// create servers
let isCLI = false
let runServer = false

for(let i = 0; i < process.argv.length; i++) {
  let a = process.argv[i]
  if(a.includes('node')) {
    isCLI = true
  } else 
  if(a.match(__filename)) {
    runServer = true
  } else
  if(SUPPORTED_SERVICES.includes(a)) {
    START_SERVICES.push(a)
  }
}

if(runServer) {
  main()
}
