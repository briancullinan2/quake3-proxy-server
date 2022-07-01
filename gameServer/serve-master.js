const { lookupDNS } = require('../utilities/dns.js')
const { serveMaster, sendOOB } = require('./master.js')
const { HTTP_LISTENERS, HTTP_PORTS, createRedirect } = require('../contentServer/express.js')

const MASTER_PORTS = [27950]
const UDP_SOCKETS = []
const MASTER_SERVERS = [
  'ws://master.quakejs.com:27950',
  '207.246.91.235:27950',
  'master.quake3arena.com',
]

function createMasters(mirror) {
  const { createServer } = require('http')
  const { createSocket } = require('dgram')
  let redirectApp
  if (HTTP_PORTS.length > 0) {
    redirectApp = createRedirect()
  }
  for (let i = 0; i < MASTER_PORTS.length; i++) {
    // udp
    UDP_SOCKETS[MASTER_PORTS[i]] = createSocket('udp4')
    UDP_SOCKETS[MASTER_PORTS[i]].bind(MASTER_PORTS[i], '0.0.0.0')
    UDP_SOCKETS[MASTER_PORTS[i]].on('message',
      async function (message, rinfo) {
        try {
          await serveMaster(UDP_SOCKETS[MASTER_PORTS[i]], message, rinfo)
        } catch (e) {
          console.log(e)
        }
      })
    // since we have an http server to redirect to, if someone visits a service
    //   port redirect them to a web interface, for their convenience
    if (HTTP_PORTS.length > 0) {
      // http
      HTTP_LISTENERS[MASTER_PORTS[i]] = createServer(redirectApp).listen(MASTER_PORTS[i])
    }
  }

  // I think it would be very fullfuling for our species
  //   if we could all simultaneously imagine the apacolypse
  //   in 3D. So fullfilling, prophetic even. Then take off 
  //   the VR goggles and be over it.
  if (!mirror)
    return

  // preload our own master server with results from parent master servers
  //   TODO: does dpmaster do this?
  for (let i = 0; i < MASTER_SERVERS.length; i++) {
    if (MASTER_SERVERS[i].includes('ws:')) // TODO
      continue
    Promise.resolve(queryMaster(MASTER_SERVERS[i]))
  }
}

async function queryMaster(master) {
  let port = 27950
  let masterPort = (/\:([0-9]+)$/i).exec(master)
  if (masterPort) {
    port = parseInt(masterPort[1])
  }
  let address = master.split(':')[0]
  let resolved = await lookupDNS(address)
  sendOOB(UDP_SOCKETS[MASTER_PORTS[0]], 'getservers 68 ', {
    address: resolved,
    port: port,
  })
  sendOOB(UDP_SOCKETS[MASTER_PORTS[0]], 'getservers 72 ', {
    address: resolved,
    port: port,
  })
}

module.exports = {
  MASTER_PORTS,
  createMasters,
}
