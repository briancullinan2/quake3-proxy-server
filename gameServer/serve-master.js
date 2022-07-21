const { lookupDNS } = require('../utilities/dns.js')
const { UDP_SOCKETS, MASTER_PORTS, serveMaster, sendOOB } = require('./master.js')
const { HTTP_LISTENERS, HTTP_PORTS, createRedirect } = require('../contentServer/express.js')
const { RESOLVE_DEDICATED } = require('../cmdServer/cmd-dedicated.js')
const { serveDedicated } = require('../gameServer/serve-process.js')
const { updatePageViewers } = require('../contentServer/session.js')
const { GAME_SERVERS } = require('../gameServer/processes.js')


const MASTER_SERVERS = [
  'ws://master.quakejs.com:27950',
  '207.246.91.235:27950',
  'master.quake3arena.com',
]

async function createMasters(mirror) {
  const { createServer } = require('http')
  const { createSocket } = require('dgram')
  if(!MASTER_PORTS || !MASTER_PORTS.length) {
    return
  }
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
    UDP_SOCKETS[MASTER_PORTS[i]].on('error', function () {
      console.log('MASTER:', arguments)
    })
    await new Promise(resolve => UDP_SOCKETS[MASTER_PORTS[i]].once('listening', resolve))

    // since we have an http server to redirect to, if someone visits a service
    //   port redirect them to a web interface, for their convenience
    if (HTTP_PORTS.length > 0) {
      // http
      HTTP_LISTENERS[MASTER_PORTS[i]] = createServer(redirectApp).listen(MASTER_PORTS[i])
    }
  }

  setTimeout(function () {
    // don't hold up own local server on loading itself
    if (Object.keys(GAME_SERVERS).length == 0
      && (RESOLVE_DEDICATED.length == 0
      || address != '127.0.0.1')) {
      serveDedicated()
      RESOLVE_DEDICATED.push(function () {
        updatePageViewers('/games')
      })
    }
  }, 3000)

  for (let i = 0; i < 10; i++) {
    //UDP_SOCKETS[MASTER_PORTS[0]].setMulticastTTL(128);
    //UDP_SOCKETS[MASTER_PORTS[0]].setMulticastInterface('127.0.0.1');
    //UDP_SOCKETS[MASTER_PORTS[0]].addMembership('255.255.255.255', '127.0.0.1');
    Promise.resolve(queryMaster('127.0.0.1:' + (27960 + i)))
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
  createMasters,
}
