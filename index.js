// TODO: need to distill SOCKS proxy so we can add cool features
// Needs to work with Native network settings and browser proxy settings alike.
// Needs to supplement Web-sockets.
// NEW: need to act as a routable HTTP proxy after a BIND-CONNECT sequence.
// Needs to support servers incoming and clients outgoing for reverse-proxy access.
// Every client has authenticated access to the proxy server
// Then every port opened has authenticated access matching the game password 
//   to track client guids

const SUPPORTED_SERVICES = [
  'proxy', 'maps', 'master', 'redirect', 'games', 'content', 'repack', 'discord'
]
const START_SERVICES = []

function parseAguments() {

}

function main() {
  if(START_SERVICES.length > 0) {

  }
}


// create servers
let isCLI = false
let noFS = false
let runServer = false
let forwardIP = ''
let httpPort = [8080]
let masterPort = [27950]



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
  } else
  switch(a) {
    case '--proxy-ip':
      console.log('Forwarding ip address: ', process.argv[i+1])
      forwardIP = process.argv[i+1]
      i++
      break
    case '--http-port':
      console.log('HTTP ports: ', process.argv[i+1])
      httpPort = process.argv[i+1].split(',').map(p => parseInt(p))
      i++
      break
    case '--master-port':
      console.log('Master port: ', process.argv[i+1])
      masterPort = process.argv[i+1].split(',').map(p => parseInt(p))
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
      basegame = process.argv[i+1]
      console.log('Basegame: ', basegame)
      i++
      break
    case '--repack-cache':
      console.log('Repack cache: ', process.argv[i+1])
      repackedCache = process.argv[i+1]
      if(!fs.existsSync(repackedCache)) {
        console.log('WARNING: directory does not exist, unexpect behavior.')
      }
      i++
      break
    case '--download-cache':
      console.log('Download cache: ', process.argv[i+1])
      downloadCache = process.argv[i+1]
      if(!fs.existsSync(downloadCache)) {
        console.log('WARNING: directory does not exist, unexpect behavior.')
      }
      i++
      break
  }
}

if(runServer) {
  main()
}
