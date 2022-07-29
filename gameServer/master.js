// THIS IS MASTER PROTOCOL STUFF


const { parseOOB } = require('../proxyServer/socks5.js')
const buildChallenge = require('../quake3Utils/generate-challenge.js')
// repack live http://ws.q3df.org/maps/download/%1
const { EXECUTING_MAPS, RESOLVE_DEDICATED, GAME_SERVERS } = require('../gameServer/processes.js')
const { updatePageViewers } = require('../contentServer/session.js')

const UDP_SOCKETS = []
const MASTER_PORTS = [27950]
const INFO_TIMEOUT = 5000
const MASTER_SERVICE = [
  'getserversResponse', 'getservers ', 'heartbeat ', 'infoResponse\n',
  'subscribe', 'statusResponse\n', 'print',
]
const RESOLVE_STATUS = {}
const RESOLVE_LOGS = {}


function sendOOB(socket, message, rinfo) {
  let response = [0xFF, 0xFF, 0xFF, 0xFF].concat(
    message.split('').map(c => c.charCodeAt(0)))
  if (typeof socket._socket == 'object') {
    socket.send(Buffer.from(response), { binary: true })
  } else {
    socket.send(Buffer.from(response), 0, response.length, rinfo.port, rinfo.address)
  }
  rinfo.timeSent = Date.now()
}


async function heartbeat(socket, message, rinfo) {
  let SERVER = GAME_SERVERS[rinfo.address + ':' + rinfo.port]
  // wait for a successful infoResponse before confirming
  if (typeof SERVER == 'undefined') {
    SERVER = GAME_SERVERS[rinfo.address + ':' + rinfo.port] = rinfo
    SERVER.timeAdded = Date.now()
  }
  if (typeof SERVER.challenge == 'undefined') {
    SERVER.challenge = buildChallenge()
  }
  let challenge = SERVER.challenge
  SERVER.timeUpdated = Date.now()

  sendOOB(socket, 'getstatus ' + challenge, rinfo)
  sendOOB(socket, 'getinfo ' + challenge, rinfo)
  if(typeof SERVER.logs == 'undefined') {
    SERVER.logs = ''
  }
  SERVER.logs += 'Heartbeat: ' + rinfo.address + ':' 
    + rinfo.port + ' ' + SERVER.mapname + ' '
    + (typeof SERVER.qps_serverId != 'undefined'
    ? ('Server is ' + EXECUTING_MAPS[SERVER.qps_serverId].working
    ? 'working' : 'available') : '')
    + '\n'
  updatePageViewers('/rcon')

  // resolve awaiting `getServers` command for new local dedicated
  if (typeof SERVER.qps_serverId != 'undefined') {
    if (typeof EXECUTING_MAPS[SERVER.qps_serverId] != 'undefined') {
      EXECUTING_MAPS[SERVER.qps_serverId].timedout = false
    }
    if (typeof RESOLVE_DEDICATED[SERVER.qps_serverId] == 'undefined') {
      RESOLVE_DEDICATED[SERVER.qps_serverId] = []
    }
    let res
    while ((res = RESOLVE_DEDICATED[SERVER.qps_serverId].shift())) {
      res()
    }
  }
}




async function statusResponse(socket, message, rinfo) {
  // TODO: decode status, part info, part player list
  let infos = await infoResponse(socket, message, rinfo)

  let playerStrings = Array.from(message)
    .map(c => String.fromCharCode(c)).join('').split('\n').slice(1)

  for (let i = 0; i < playerStrings.length; i++) {
    // TODO: parsePlayer()
  }

  if (typeof infos.qps_serverId != 'undefined') {
    // create the key just so we know not to create one in the future, we have control already
    if (typeof RESOLVE_DEDICATED[infos.qps_serverId] == 'undefined') {
      RESOLVE_DEDICATED[infos.qps_serverId] = []
    }
    if (typeof EXECUTING_MAPS[infos.qps_serverId] == 'undefined') {
      EXECUTING_MAPS[infos.qps_serverId] = {
        mapname: infos.mapname,
        renderer: !!infos.qps_renderer,
        challenge: infos.qps_serverId,
        pid: infos.qps_pid,
        logs: '',
      }
      console.log('Dedicated ' + (!!infos.qps_renderer ? ' renderer ' : '') 
          + 'already started', EXECUTING_MAPS)
    }
    if (typeof infos.qps_pid == 'undefined'
      && typeof EXECUTING_MAPS[infos.qps_serverId].pid != 'undefined') {
      sendOOB(socket, 'rcon password1 sets qps_pid ' 
          + EXECUTING_MAPS[infos.qps_serverId].pid, infos)
    }
  }

  //console.log(infos, playerStrings)
  if (typeof RESOLVE_STATUS[infos.challenge] != 'undefined') {
    let res
    while ((res = RESOLVE_STATUS[infos.challenge].shift())) {
      res(GAME_SERVERS[rinfo.address + ':' + rinfo.port])
    }
  }

  updatePageViewers('/games')
  updatePageViewers('/rcon')

  return GAME_SERVERS[rinfo.address + ':' + rinfo.port]
}


async function infoResponse(socket, message, rinfo) {
  let messageString = Array.from(message)
    .map(c => String.fromCharCode(c)).join('').split('\n')[0]

  let SERVER = GAME_SERVERS[rinfo.address + ':' + rinfo.port]
  if (typeof SERVER == 'undefined') {
    SERVER = GAME_SERVERS[rinfo.address + ':' + rinfo.port] = rinfo
    SERVER.timeAdded = Date.now()
  }
  SERVER.timeUpdated = Date.now()

  let infos = messageString.split(/\\/gi)
    .reduce(function (obj, item, i, arr) {
      if (i > 0 && i % 2 == 1) {
        obj[item] = (arr[i + 1] + '').trim()
      }
      return obj
    }, {})

  Object.assign(SERVER, infos)

  console.log('Updating server: ', rinfo.address + ':' + rinfo.port, '->', SERVER.mapname)
  if (typeof EXECUTING_MAPS[SERVER.qps_serverId] != 'undefined') {
    EXECUTING_MAPS[SERVER.qps_serverId].mapname = SERVER.mapname
    if (typeof EXECUTING_MAPS[SERVER.qps_serverId].working != 'object') {
      EXECUTING_MAPS[SERVER.qps_serverId].working = false
    }
    //console.log('Server is ', EXECUTING_MAPS[SERVER.qps_serverId].working ? 'working' : 'available')
    EXECUTING_MAPS[SERVER.qps_serverId].timedout = false
  }

  // TODO: store by address and port instead of challenge to prevent duplicates
  SERVER.timeUpdated = Date.now()

  return GAME_SERVERS[rinfo.address + ':' + rinfo.port]
}


// LOL, so funny, "case of the fuck-arounds"
//   instead of returning the original address, 
//   return a useful websocket proxy to the original dedicated
//   and update ws://quakejs.com with our own address
// When the time comes, I'll convert every server name to marquee
//   the name of my proxy server and user login. Useful Ads?
// Ads that sell NFTs? People pay to be advertised to because
//   even knowing about luxury-goods should cost money? 
// Interesting, I see an end to the classic "loss-leaders"
async function getserversResponse(socket, message, rinfo) {
  let buffer = message

  while (buffer[0] == '\\'.charCodeAt(0)
    && !(buffer[1] == 'E'.charCodeAt(0)
      && buffer[2] == 'O'.charCodeAt(0)
      && buffer[3] == 'T'.charCodeAt(0))) {
    // validate server info
    if (typeof GAME_SERVERS[rinfo.address + ':' + rinfo.port] == 'undefined') {
      GAME_SERVERS[rinfo.address + ':' + rinfo.port] = rinfo
    }
    if (typeof GAME_SERVERS[rinfo.address + ':' + rinfo.port].challenge == 'undefined') {
      GAME_SERVERS[rinfo.address + ':' + rinfo.port].challenge = buildChallenge()
    }
    let challenge = GAME_SERVERS[rinfo.address + ':' + rinfo.port].challenge
    let msg = 'getinfo ' + challenge
    let rinfo = {
      address: buffer[1] + '.' + buffer[2] + '.' + buffer[3] + '.' + buffer[4],
      port: (buffer[5] << 8) + buffer[6],
    }
    if (rinfo.port == 0) {
      rinfo.port = 27960
    }
    if (rinfo.address == '0.0.0.0') {
      rinfo.address = '127.0.0.1'
    }

    sendOOB(socket, msg, rinfo)
    buffer = buffer.slice(7)
  }
  return buffer
}


async function getServers(socket, message, rinfo) {
  let msg = 'getserversResponse'
  let keys = Object.keys(GAME_SERVERS)

  // TODO:
  //keys = []

  for (let i = 0; i < keys.length; i++) {
    let octets = GAME_SERVERS[keys[i]].address
      .split('.').map(n => parseInt(n, 10))
    msg += '\\'
    msg += String.fromCharCode(octets[0] & 0xFF)
    msg += String.fromCharCode(octets[1] & 0xFF)
    msg += String.fromCharCode(octets[2] & 0xFF)
    msg += String.fromCharCode(octets[3] & 0xFF)
    msg += String.fromCharCode((GAME_SERVERS[keys[i]].port & 0xFF00) >> 8)
    msg += String.fromCharCode((GAME_SERVERS[keys[i]].port & 0xFF))
  }
  console.log('sending ', keys.length, ' servers')
  msg += '\\EOT'
  sendOOB(socket, msg, rinfo)
}


async function print(socket, message, rinfo) {
  let lines = Array.from(message)
    .map(c => String.fromCharCode(c)).join('')
  const SERVER = GAME_SERVERS[rinfo.address + ':' + rinfo.port]
  if (!SERVER) {
    // ignore?
    return
  }
  SERVER.timeUpdated = Date.now()

  if (typeof SERVER.logs == 'undefined') {
    SERVER.logs = ''
  }
  SERVER.logs += lines + '\n'
  console.log('Message from:', rinfo.address + ':' + rinfo.port, lines)
  if (typeof RESOLVE_LOGS[SERVER.challenge] != 'undefined') {
    let res
    while ((res = RESOLVE_LOGS[SERVER.challenge].shift())) {
      res(SERVER.logs)
    }
  }
  updatePageViewers('/rcon')
}


async function serveMaster(socket, message, rinfo) {
  let buffer
  if (!(buffer = parseOOB(message))) {
    return
  }

  for (let i = 0; i < MASTER_SERVICE.length; i++) {
    if (buffer.length < MASTER_SERVICE[i].length) {
      continue
    }
    let request = Array.from(buffer.slice(0, MASTER_SERVICE[i].length))
      .map(c => String.fromCharCode(c)).join('')
    if (MASTER_SERVICE[i].localeCompare(
      request, 'en', { sensitivity: 'base' }) != 0
    ) {
      continue;
    }

    console.log(request)

    buffer = buffer.slice(MASTER_SERVICE[i].length)
    if (i == 0) {
      await getserversResponse(socket, buffer, rinfo)
    } else
      if (i == 1) {
        await getServers(socket, buffer, rinfo)
      } else
        if (i == 2) {
          await heartbeat(socket, buffer, rinfo)
        } else
          if (i == 3) {
            await infoResponse(socket, buffer, rinfo)
          } else
            if (i == 4) {
              await subscribe(socket, buffer, rinfo)
            } else
              if (i == 5) {
                await statusResponse(socket, buffer, rinfo)
              } else
                if (i == 6) {
                  await print(socket, buffer, rinfo)
                } // else
    return
  }

  console.error(new Error('Unknown response: ' +
    Array.from(message.slice(4)).map(c => String.fromCharCode(c))
      .join('').split(/[^a-z0-9]/i)[0]))
}

module.exports = {
  RESOLVE_LOGS,
  UDP_SOCKETS,
  MASTER_PORTS,
  INFO_TIMEOUT,
  RESOLVE_STATUS,
  serveMaster,
  sendOOB,
}

