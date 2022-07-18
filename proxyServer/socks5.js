
const { lookupDNS } = require('../utilities/dns.js')
const { UDP_SERVERS, lookupClient, serveUDP } = require('../proxyServer/serve-udp.js')

const WS_CONNECTIONS = []

const CMD = {
  CONNECT: 0x01,
  BIND: 0x02,
  UDP: 0x03,
  WS: 0x04
}

const ATYP = {
  IPv4: 0x01,
  NAME: 0x03,
  IPv6: 0x04
}

const REP = {
  SUCCESS: 0x00,
  GENFAIL: 0x01,
  DISALLOW: 0x02,
  NETUNREACH: 0x03,
  HOSTUNREACH: 0x04,
  CONNREFUSED: 0x05,
  TTLEXPIRED: 0x06,
  CMDUNSUPP: 0x07,
  ATYPUNSUPP: 0x08
}

function createSOCKS(socket, redirectApp, sessionId) {
  socket.on('message', async function (message, binary) {
    if(!binary) {
      return
    }
    try {
      let response = await parseSOCKS(sessionId, redirectApp, socket, message)
      socket.send(Buffer.from(response), { binary: true })
    } catch (e) {
      console.error(e)
      socket.send(Buffer.from([0x05, REP.GENFAIL]), { binary: true })
    }
  })
  WS_CONNECTIONS.push(socket)
  socket.on('close', function () {
    let index = WS_CONNECTIONS.indexOf(socket)
    WS_CONNECTIONS.splice(index, 1)
  })
}

function parseLegacyEmscriptPort(buffer) {
  if (Array.from(buffer).slice(0, 4).map(c => String.fromCharCode(c)).join('') == 'port') {
    return buffer.slice(4)
  }
}

function parseOOB(buffer) {
  if (buffer[0] === 0xFF
    && buffer[1] === 0xFF
    && buffer[2] === 0xFF
    && buffer[3] === 0xFF) {
    return buffer.slice(4)
  }
}

async function parseAddress(message) {
  if (message[0] == ATYP.IPv4) {
    return {
      buffer: message.slice(5),
      address: message.slice(1, 5).join('.'),
    }
  } else
    if (message[0] == ATYP.IPv6) {
      let ipv6str = ''
      for (let b = 0; b < 16; ++b) {
        if (b % 2 === 0 && b > 0)
          ipv6str += ':'
        ipv6str += message[b + 1].toString(16)
      }
      return {
        buffer: message.slice(17),
        address, ipv6str,
      }
    } else
      if (message[0] == ATYP.NAME) {
        let nameView = Array.from(message.slice(2, message[1] + 2))
        let newAddress = nameView.map(c => String.fromCharCode(c)).join('')
        let resolved = await lookupDNS(newAddress)
        return {
          buffer: message.slice(message[1] + 2),
          address: resolved,
          named: newAddress,
        }
      } else
        throw new Error('Invalid address type: ' + message[0])
}

function parsePort(buffer) {
  return (buffer[0] << 8) + buffer[1]
}

async function parseSOCKS(sessionId, redirectApp, socket, message) {
  let buffer = new Uint8Array(message)

  if (!message) {
    throw new Error('wtf?')
  }

  if ((buffer = parseOOB(message))
    && (buffer = parseLegacyEmscriptPort(buffer))) {
    // reconnect client, automatically associate
    let port = parsePort(buffer)
    socket.bound = true
    await serveUDP(socket, '0.0.0.0', port, redirectApp, sessionId)
    console.log('Switching to UDP listener.', socket._socket.remotePort)
    return [0x05, 0x00]
  } else

    // implied 0x05 version
    if (!(socket.authed && message[0] == 0x00) && message[0] != 0x05) {
      throw new Error('Incompatible version: ' + message[0])
    } else

      if (!socket.authed) {
        if (message[1] != 0x01 && message[1] != 0x02) {
          throw new Error('Unexpected methods: ' + message[1])
        } else {
          console.log('Authorizing anonymous.')
          socket.authed = true
          return [0x05, 0x00 /* no auth */]
        }
      } else


        // =======================================================================
        /*
          +----+-----+-------+------+----------+----------+
          |VER | CMD |  RSV  | ATYP | DST.ADDR | DST.PORT |
          +----+-----+-------+------+----------+----------+
          | 1  |  1  | X'00' |  1   | Variable |    2     |
          +----+-----+-------+------+----------+----------+
      
          Where:
      
                o  VER    protocol version: X'05'
                o  CMD
                    o  CONNECT X'01'
                    o  BIND X'02'
                    o  UDP ASSOCIATE X'03'
                o  RSV    RESERVED
                o  ATYP   address type of following address
                    o  IP V4 address: X'01'
                    o  DOMAINNAME: X'03'
                    o  IP V6 address: X'04'
                o  DST.ADDR       desired destination address
                o  DST.PORT desired destination port in network octet
                    order
        */
        if (socket.authed && message[1] == CMD.UDP) {
          let { buffer, address } = await parseAddress(message.slice(3))
          let port = parsePort(buffer)
          socket.bound = true
          return await serveUDP(socket, address, port, redirectApp, sessionId)
        } else

          if (message.length == 4 && message[3] == 0) {
            // ping
            return [0x05, 0x00]
          } else

            if (socket.bound
              && (message[1] == 0x00 || message[1] == CMD.CONNECT)
                && message[3] > 0x00 && message[3] < 0x04) {
              return await sendMessage(socket, message.slice(3))
            }
  console.log(socket.bound, message)
  throw new Error('should forward')
}

// tcp
function createTCP(port) {
  const { createServer } = require('net')
  let tcp = createServer().listen(port)
  tcp.on('connection', createSOCKS)
  return tcp
}


async function sendMessage(socket, messageBuffer) {
  let { buffer, address } = await parseAddress(messageBuffer)
  let port = (buffer[0] << 8) + buffer[1]
  let message = buffer.slice(2)
  // TODO: find the UDP reservation for this socket
  let clientI = await lookupClient(socket)
  //console.log('Sending: ', clientI, message, '->', port, address)
  if(clientI) {
    let udpSocket = UDP_SERVERS[clientI[0]]
    udpSocket.send(message, 0, message.length, port, address)
  } else {
    // TODO: queue?
  }
  return [0x05, 0x00]
}

module.exports = {
  createSOCKS,
  parseOOB,
}

