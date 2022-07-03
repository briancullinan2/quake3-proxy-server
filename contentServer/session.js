
const buildChallenge = require('../quake3Utils/generate-challenge.js')
const { UDP_CLIENTS, SESSION_IDS, SESSION_URLS } = require('../proxyServer/serve-udp.js')



const HTTP_PORTS = [8080]
const HTTP_LISTENERS = []
const WEB_SOCKETS = []


async function updatePageViewers(route) {
  let response = await fetch('http://localhost:' + HTTP_PORTS[0] + route)
  let html = await response.text()
  Promise.resolve(Promise.all(Object.keys(SESSION_URLS).map(sess => {
    if(SESSION_URLS[sess].match(route)) {
      if(UDP_CLIENTS[SESSION_IDS[sess]]) {
        UDP_CLIENTS[SESSION_IDS[sess]].send(html, {binary: false})
      }
    }
  })))
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
    //SESSION_URLS[newId] = 'http://local' + req.originalUrl
  } else
    if (typeof SESSION_IDS[cookies['__planet_quake_sess']] != 'undefined'
      && (typeof cookies['__planet_quake_port'] == 'undefined'
        || cookies['__planet_quake_port'] != SESSION_IDS[cookies['__planet_quake_sess']])) {
      res.cookie('__planet_quake_port', SESSION_IDS[cookies['__planet_quake_sess']], { maxAge: 900000, httpOnly: true })
    } else

      if (typeof cookies['__planet_quake_port'] != 'undefined') {
        // TODO: pre-associate from previously selected address
        //SESSION_IDS[cookies['__planet_quake_sess']] =  cookies['__planet_quake_port']

      }


  if (cookies['__planet_quake_sess']
    && req.headers['accept'].includes('text/html')) {
    SESSION_URLS[cookies['__planet_quake_sess']] = 'http://local' + req.originalUrl
    updatePageViewers('/proxy')
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

