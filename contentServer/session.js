
const buildChallenge = require('../quake3Utils/generate-challenge.js')
const { UDP_CLIENTS, SESSION_IDS, SESSION_URLS } = require('../proxyServer/serve-udp.js')



const HTTP_PORTS = [8080]
const HTTP_LISTENERS = []
const WEB_SOCKETS = {}


// make sure this run async because we don't want to block 
//   something else from queing this cycle
async function updatePageViewers(route) {
  let promises = []
  await new Promise(resolve => setTimeout(resolve, 100))
  let html
  if(route.match(/proxy/i)) {
    html = 'UPDATE: ' + route
  } else {
    let response = await fetch('http://localhost:' + HTTP_PORTS[0] + route)
    html = await response.text()
  }
  let ports = Object.keys(UDP_CLIENTS)
  //let sessions = Object.keys(SESSION_URLS)
  let count = 0
  for(let i = 0; i < ports.length; i++) {
    for(let j = 0; j < UDP_CLIENTS[ports[i]].length; ++j) {
      let msg
      if(ports[i] == 0) {
        msg = 'UPDATE: ' + route
      } else {
        let sess = Object.keys(SESSION_IDS).filter(k => SESSION_IDS[k] == ports[i])
        if(sess[0] 
          && SESSION_URLS[sess[0]]
          && SESSION_URLS[sess[0]].match(route)) {
          msg = html
        } else {
          msg = 'UPDATE: ' + route
        }
      }

      promises.push(new Promise(resolve => setTimeout(resolve, 10 * count))
      .then(() => {
        UDP_CLIENTS[ports[i]][j].send(msg, {binary: false})
      }))
      count++
    }
  }

  Promise.resolve(Promise.all(promises))
}

function parseCookies(cookie) {
  return (cookie || '').split(';').reduce((obj, kv) => {
    let key = kv.split('=')[0].trim()
    let val = kv.split('=').slice(1).join('=') // base64?
    obj[key] = val
    return obj
  }, {})
}


function restoreSession(req, res) {
  let cookies = parseCookies(req.headers['cookie'])

  if (typeof cookies['__planet_quake_sess'] == 'undefined') {
    let newId = buildChallenge()
    res.cookie('__planet_quake_sess', newId, { maxAge: 900000, httpOnly: true })
  } else
    if (typeof SESSION_IDS[cookies['__planet_quake_sess']] != 'undefined'
      && (typeof cookies['__planet_quake_port'] == 'undefined'
        || cookies['__planet_quake_port'] != SESSION_IDS[cookies['__planet_quake_sess']])) {
      res.cookie('__planet_quake_port', SESSION_IDS[cookies['__planet_quake_sess']], { maxAge: 900000, httpOnly: true })
    }

}


module.exports = {
  HTTP_PORTS,
  HTTP_LISTENERS,
  WEB_SOCKETS,
  updatePageViewers,
  restoreSession,
  parseCookies,
}

