
// repack live http://ws.q3df.org/maps/download/%1 
const MASTER_SERVICE = [
  'getservers ', 'heartbeat ', 'infoResponse\n', 
  'subscribe'
]
const GAME_SERVERS = {}
const RESOLVE_INFOS = {}

async function heartbeat(socket, message, rinfo) {
  //console.log(message, rinfo)
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
    let response = [0xFF, 0xFF, 0xFF, 0xFF].concat(msg.split('').map(c => c.charCodeAt(0)))
    if(typeof socket._socket == 'object') {
      socket.send(Buffer.from(response), { binary: true })
    } else {
      socket.send(Buffer.from(response), 0, response.length, rinfo.port, rinfo.address)
    }
  })
  //console.log(info)

  // resolve awaiting `getServers` command for new local dedicated
  if(rinfo.address == '127.0.0.1') {
    let res
    while((res = RESOLVE_DEDICATED.pop())) {
      res()
    }
  }
}

async function infoResponse(socket, message, rinfo) {
  let messageString = Array.from(message)
    .map(c => String.fromCharCode(c)).join('')
  let infos = messageString.split(/\\/gi)
    .reduce(function (obj, item, i, arr) {
      if(i > 0 && i % 2 == 1) {
        obj[item] = arr[i+1]
      }
      return obj
    }, {})
  if(typeof GAME_SERVERS[infos.challenge] != 'undefined') {
    Object.assign(GAME_SERVERS[infos.challenge], infos)
  }
  if(typeof RESOLVE_INFOS[infos.challenge] != 'undefined') {
    RESOLVE_INFOS[infos.challenge](GAME_SERVERS[infos.challenge])
    delete RESOLVE_INFOS[infos.challenge]
  }
}

async function getServers(socket, message, rinfo) {
  let msg = 'getserversResponse'
  let keys = Object.keys(GAME_SERVERS)
  // don't hold up own local server on loading itself
  if(keys.length == 0 
    && (RESOLVE_DEDICATED.length == 0 
      || rinfo.address != '127.0.0.1')) {
    await serveDedicated()
    keys = Object.keys(GAME_SERVERS)
  }
  for(let i = 0; i < keys.length; i++) {
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
  let response = [0xFF, 0xFF, 0xFF, 0xFF].concat(msg.split('').map(c => c.charCodeAt(0)))
  if(typeof socket._socket == 'object') {
    socket.send(Buffer.from(response), { binary: true })
  } else {
    socket.send(Buffer.from(response), 0, response.length, rinfo.port, rinfo.address)
  }

}

async function serveMaster(socket, message, rinfo) {
  let buffer
  if(!(buffer = parseOOB(message))) {
    return
  }
  //console.log(buffer)

  for(let i = 0; i < MASTER_SERVICE.length; i++) {
    if(buffer.length < MASTER_SERVICE[i].length) {
      continue
    }
    let request = Array.from(buffer.slice(0, MASTER_SERVICE[i].length))
        .map(c => String.fromCharCode(c)).join('')
    if(MASTER_SERVICE[i].localeCompare(
        request, 'en', { sensitivity: 'base' }) == 0
    ) {
      buffer = message.slice(MASTER_SERVICE[i].length)
      if(i == 0) {
        await getServers(socket, buffer, rinfo) 
      } else
      if(i == 1) {
        await heartbeat(socket, buffer, rinfo)
      } else
      if(i == 2) {
        await infoResponse(socket, buffer, rinfo) 
      } else
      if(i == 3) {
        await subscribe(socket, buffer, rinfo) 
      }
      break
    }
  }
}
