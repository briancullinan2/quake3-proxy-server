
const buildChallenge = require('../quake3Utils/generate-challenge.js')
const { UDP_CLIENTS, SESSION_IDS, SESSION_URLS } = require('../proxyServer/serve-udp.js')

// only update clients with page refresh events at a specific rate not to
//   overload ourselves with new page requests, TODO: this should be a balance.
let clientUpdater

const HTTP_PORTS = [8080]
const HTTP_LISTENERS = []
const WEB_SOCKETS = {}
const CLIENT_QUEUE = []


// make sure this run async because we don't want to block 
//   something else from queing this cycle
async function updatePageViewers(route) {
  if(!clientUpdater) {
    clientUpdater = setInterval(function () {
      let func = CLIENT_QUEUE.shift()
      if(func) {
        Promise.resolve(func())
      }
    }, 1000/60)
  }

  let promises = []
  let ports = Object.keys(UDP_CLIENTS)
  let count = 0

  function updateClient(client, promise) {
    if(typeof client.pageUpdate == 'undefined') {
      client.pageUpdate = {}
    }
    promises.push(new Promise(resolve => {
      CLIENT_QUEUE.push(function () {
        if(client.pageUpdate[route]) {
          //clearTimeout(client.pageUpdate)
          return resolve()
        }
        client.pageUpdate[route] = setTimeout(function () {
          client.pageUpdate[route] = null
          // AHHHHH, if I do this beforehand the fetch() will fire too soon and not wait
          Promise.resolve(promise)
          .then(html2 => {
            client.send(html2, {binary: false})
          })
        }, 100)
        resolve()
      })
    }))
  }

  for(let i = 0; i < ports.length; i++) {
    for(let j = 0; j < UDP_CLIENTS[ports[i]].length; ++j) {
      if(ports[i] == 0) {
        updateClient(UDP_CLIENTS[ports[i]][j], 'UPDATE: ' + route)
      } else {
        let sess = Object.keys(SESSION_IDS).filter(k => SESSION_IDS[k] == ports[i])
        if(sess[0] 
          && SESSION_URLS[sess[0]]
          && SESSION_URLS[sess[0]].match(route)) {

          if(route.match(/proxy/i)) {
            updateClient(UDP_CLIENTS[ports[i]][j], 'UPDATE: ' + route)
          } else {
            updateClient(UDP_CLIENTS[ports[i]][j], fetch(SESSION_URLS[sess[0]])
              .then(response => {
                console.log('Sending: ' + route)
                return response.text()
              }))
          }

        } else {
          updateClient(UDP_CLIENTS[ports[i]][j], 'UPDATE: ' + route)
        }
      }

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

