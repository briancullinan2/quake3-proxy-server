const { lookupDNS, reverseLookup } = require('../utilities/dns.js')

const UDP_SERVERS = []
const UDP_CLIENTS = {0: []}
const WS_FORWARDS = []
const SESSION_IDS = {}
const SESSION_URLS = {}


async function lookupClient(socket) {
  let ports = Object.keys(UDP_CLIENTS)
  for(let i = 0; i < ports.length; i++) {
    let index = UDP_CLIENTS[ports[i]].indexOf(socket)
    if(index > -1) {
      return [ports[i], index]
    }
  }
}


async function serveUDP(socket, address, port, redirectApp, sessionId) {
  const { Server } = require('ws')
  const { createServer } = require('http')
  const { createSocket } = require('dgram')
  console.log('UDP associate: ' + address + ':' + port)
  if(typeof SESSION_IDS[sessionId] != 'undefined') {
    if(port === 0) {
      port = SESSION_IDS[sessionId]
    }
  }
  // if we don't catch the error, it will become unhandled
  let thrown = false
  function catchError(err) {
    console.error(err)
    thrown = true
  }
  if (port === 0 || typeof UDP_SERVERS[port] == 'undefined') {
    let newServer = createSocket('udp4')
    newServer.on('error', catchError)
    newServer.bind(port, '0.0.0.0')
    if(port === 0) {
      port = await new Promise(resolve => {
        newServer.on('listening', () => {
          resolve(newServer.address().port)
        })  
      })
    }
    if(sessionId) {
      SESSION_IDS[sessionId] = port
    }
    UDP_SERVERS[port] = newServer
    UDP_SERVERS[port].on('message', function (message, rinfo) {
      //console.log('Forwarding: ', message)
      return forwardMessage(port, false /* isWS */, message, rinfo)
    })
  }
  if(thrown) {
    return [0x05, 0x01 /* REP.GENFAIL */]
  }

  if(typeof UDP_SERVERS[port] == 'undefined') {
    let httpServer = createServer(redirectApp).listen(port)
    WS_FORWARDS[port] = new Server({ server: httpServer })
    WS_FORWARDS[port].on('message', function (message, rinfo) {
      return forwardMessage(port, true /* isWS */, message, rinfo)
    })
  }


  // instead of using on() event listeners, just use a list
  let clientI = await lookupClient(socket)
  if(clientI) {
    UDP_CLIENTS[clientI[0]].splice(clientI[1], 1)
  }
  if(typeof UDP_CLIENTS[port] == 'undefined') {
    UDP_CLIENTS[port] = []
  }
  UDP_CLIENTS[port].push(socket)

  let bindIP = await lookupDNS(socket._socket.localAddress)
  let IPsegments = bindIP.split('.').map(seg => parseInt(seg))

  return [
    0x05, 0x00 /* REP.SUCCESS */, 0x00, 0x01 /* ATYP.IPv4 */
    // for simplicity, the mock DNS service inside the browser
    //   only deals in IPv4, so addresses are converted back.
  ].concat(IPsegments).concat([
    (port & 0xF0 >> 8), (port & 0xF)
  ])
}

function forwardMessage(port, isWS, message, rinfo) {
  let domain = reverseLookup(isWS, rinfo.address)
  let buffer
  if (!domain) {
    let localbytes = rinfo.address.replace('::ffff:', '')
      .split('.').map(seg => parseInt(seg))
    buffer = Buffer.alloc(4 + localbytes.length + 2 /* port */).fill(0)
    buffer[3] = 0x01 // ATYP.IPv4
    for (let i = 0, p = 4; i < localbytes.length; ++i, ++p) {
      buffer[p] = localbytes[i]
    }
    buffer.writeUInt16LE(rinfo.port, 8, true)
  } else {
    buffer = Buffer.alloc(4 + 1 /* for strlen */ + domain.length + 1 /* \0 null */ + 2 /* port */).fill(0)
    buffer[3] = 0x03 // ATYP.NAME
    buffer[4] = domain.length + 1
    buffer.write(domain, 5)
    buffer.writeUInt16LE(rinfo.port, 5 + buffer[4], true)
  }
  buffer[0] = 0x05
  buffer[1] = message === true ? REP.SUCCESS : 0x00
  buffer[2] = 0x00
  if (UDP_CLIENTS[port])
    UDP_CLIENTS[port].forEach(socket => socket.send(message === true
      ? buffer : Buffer.concat([buffer, message]),
      { binary: true }))
}


module.exports = {
  SESSION_URLS,
  SESSION_IDS,
  UDP_SERVERS,
  UDP_CLIENTS,
  serveUDP,
  lookupClient,
}
