
const buildChallenge = require('../quake3Utils/generate-challenge.js')

const UDP_CLIENTS = {0: []}
const SESSION_IDS = {}
const SESSION_URLS = {}
const SESSION_GAMES = {}

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
  if (!clientUpdater) {
    clientUpdater = setInterval(function () {
      let func = CLIENT_QUEUE.shift()
      if (func) {
        Promise.resolve(func())
      }
    }, 1000 / 60)
  }

  let ports = Object.keys(UDP_CLIENTS)
  let count = 0

  function updateClient(client, promise) {
    if (typeof client.pageTime == 'undefined') {
      client.pageTime = {}
    }
    if (typeof client.pageTime[route] != 'undefined'
      && Date.now() - client.pageTime[route] < 800) {
      return
    }

    // TODO: send refresh signal over websocket/proxy
    //   in a POSIX similar way? This would be cool
    //   because then all remote clients will refresh
    //   and reconnect to existing game

    client.pageTime[route] = Date.now()
    CLIENT_QUEUE.push(function () {
      // AHHHHH, if I do this beforehand the fetch() will fire too soon and not wait
      Promise.resolve(new Promise(resolve => setTimeout(resolve, 1000))
        .then(() => Promise.resolve(promise))
        .then(html2 => {
          client.send(html2, { binary: false })
          delete client.pageTime[route]
        }))
    })
  }

  for (let i = 0; i < ports.length; i++) {
    for (let j = 0; j < UDP_CLIENTS[ports[i]].length; ++j) {
      if (ports[i] == 0) {
        updateClient(UDP_CLIENTS[ports[i]][j], 'UPDATE: ' + route)
      } else {
        let sess = Object.keys(SESSION_IDS).filter(k => SESSION_IDS[k] == ports[i])
        /*if(sess[0] 
          && SESSION_URLS[sess[0]]
          && SESSION_URLS[sess[0]].match(route)) {

          if(route.match(/proxy/i)) {
            updateClient(UDP_CLIENTS[ports[i]][j], 'UPDATE: ' + route)
          } else {
            updateClient(UDP_CLIENTS[ports[i]][j], fetch(SESSION_URLS[sess[0]])
              .then(response => {
                //CODE REVIEW: this makes it synchronous because it waits for stdio?
                console.log('Sending: ', route, SESSION_URLS[sess[0]])
                return await response.text()
              }))
          }

        } else {
          */
        updateClient(UDP_CLIENTS[ports[i]][j], 'UPDATE: ' + route)
        //}
      }

      count++
    }
  }

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
  req.cookies = cookies

  if (typeof cookies['__planet_quake_sess'] == 'undefined') {
    cookies['__planet_quake_sess'] = buildChallenge()
    res.cookie('__planet_quake_sess', cookies['__planet_quake_sess'], { maxAge: 900000, httpOnly: true })
  } else
    if (typeof SESSION_IDS[cookies['__planet_quake_sess']] != 'undefined'
      && (typeof cookies['__planet_quake_port'] == 'undefined'
        || cookies['__planet_quake_port'] != SESSION_IDS[cookies['__planet_quake_sess']])) {
      res.cookie('__planet_quake_port', SESSION_IDS[cookies['__planet_quake_sess']], {
        maxAge: 900000, httpOnly: true
      })
    }

  if (req.query && typeof req.query.game != 'undefined') {
    SESSION_GAMES[cookies['__planet_quake_sess']] = req.query.game
    res.cookie('__planet_quake_game', req.query.game, { maxAge: 900000, httpOnly: true })
  }

  if(typeof cookies['__planet_quake_game'] == 'undefined') {
    SESSION_GAMES[cookies['__planet_quake_sess']] = cookies['__planet_quake_game']
  }
}


module.exports = {
  UDP_CLIENTS,
  SESSION_GAMES,
  SESSION_URLS,
  SESSION_IDS,
  HTTP_PORTS,
  HTTP_LISTENERS,
  WEB_SOCKETS,
  updatePageViewers,
  restoreSession,
  parseCookies,
}

