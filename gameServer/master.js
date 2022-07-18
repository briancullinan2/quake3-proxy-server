
const { RESOLVE_DEDICATED } = require('../cmdServer/cmd-dedicated.js')
const { serveDedicated } = require('../gameServer/serve-process.js')
const { parseOOB } = require('../proxyServer/socks5.js')
const buildChallenge = require('../quake3Utils/generate-challenge.js')
// repack live http://ws.q3df.org/maps/download/%1
const MASTER_SERVICE = [
  'getserversResponse', 'getservers ', 'heartbeat ', 'infoResponse\n',
  'subscribe'
]
const GAME_SERVERS = {}
const RESOLVE_INFOS = {}

function sendOOB(socket, message, rinfo) {
  let response = [0xFF, 0xFF, 0xFF, 0xFF].concat(
    message.split('').map(c => c.charCodeAt(0)))
  if (typeof socket._socket == 'object') {
    socket.send(Buffer.from(response), { binary: true })
  } else {
    socket.send(Buffer.from(response), 0, response.length, rinfo.port, rinfo.address)
  }
}


async function heartbeat(socket, message, rinfo) {
  console.log('Heartbeat: ', rinfo)
  // wait for a successful infoResponse before confirming
  let info = await new Promise(function (resolve, reject) {
    let cancelTimer = setTimeout(function () {
      reject(new Error('Heartbeat getinfo timed out.'))
    }, 3000)
    let challenge = buildChallenge()
    let msg = 'getinfo ' + challenge
    GAME_SERVERS[challenge] = rinfo
    RESOLVE_INFOS[challenge] = function (info) {
      clearTimeout(cancelTimer)
      resolve(info)
    }
    sendOOB(socket, msg, rinfo)
  })

  // resolve awaiting `getServers` command for new local dedicated
  if (rinfo.address == '127.0.0.1') {
    let res
    while ((res = RESOLVE_DEDICATED.pop())) {
      res()
    }
  }
}

async function infoResponse(socket, message, rinfo) {
  let messageString = Array.from(message)
    .map(c => String.fromCharCode(c)).join('')
  let infos = messageString.split(/\\/gi)
    .reduce(function (obj, item, i, arr) {
      if (i > 0 && i % 2 == 1) {
        obj[item] = arr[i + 1]
      }
      return obj
    }, {})

  if (typeof GAME_SERVERS[infos.challenge] != 'undefined') {
    Object.assign(GAME_SERVERS[infos.challenge], infos)
  }
  if (typeof RESOLVE_INFOS[infos.challenge] != 'undefined') {
    RESOLVE_INFOS[infos.challenge](GAME_SERVERS[infos.challenge])
    delete RESOLVE_INFOS[infos.challenge]
  }
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
    let challenge = buildChallenge()
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
    GAME_SERVERS[challenge] = rinfo

    sendOOB(socket, msg, rinfo)
    buffer = buffer.slice(7)
  }
  return buffer
}


async function getServers(socket, message, rinfo) {
  let msg = 'getserversResponse'
  let keys = Object.keys(GAME_SERVERS)
  // don't hold up own local server on loading itself
  if (keys.length == 0
    && (RESOLVE_DEDICATED.length == 0
      || rinfo.address != '127.0.0.1')) {
    serveDedicated()
    keys = Object.keys(GAME_SERVERS)
  }

  // TODO:
  keys = []

  for (let i = 0; i < keys.length; i++) {
    if (!GAME_SERVERS.hasOwnProperty(keys[i])) {
      continue
    }
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
            } // else
    return
  }

  console.error(new Error('Unknown response: ' +
    Array.from(message.slice(4)).map(c => String.fromCharCode(c))
      .join('').split(/[^a-z0-9]/i)[0]))
}

module.exports = {
  GAME_SERVERS,
  serveMaster,
  sendOOB,
  serveDedicated,
}

