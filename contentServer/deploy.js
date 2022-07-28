// TODO: make HTML copies of every page for deploying to GitHub Pages
const path = require('path')
const fs = require('fs')

const { getGame } = require('../utilities/env.js')
const { CONTENT_FEATURES } = require('../contentServer/features.js')
const { createWebServers } = require('../contentServer/express.js')
const { createMasters } = require('../gameServer/serve-master.js')
const { UDP_SOCKETS } = require('../gameServer/master.js')
const { HTTP_LISTENERS, HTTP_PORTS, WEB_SOCKETS } = require('../contentServer/session.js')


const EXPORT_DIRECTORY = path.join(__dirname, '/../docs/')
// TODO: generate a GitHub redirect file from routes

// TODO: including yellow banner warning message like "This is a cached page, reconnecting..."
const DEPLOY_GAMES = [getGame()]

async function exportGame(game) {
  if(!game) {
    game = getGame()
  }

  fs.mkdirSync(EXPORT_DIRECTORY, { recursive: true })

  // loop through every detectable route and export it to /docs/
  let ROUTES = ['/index.css', '/', '/?alt', '/index.html']
  let features = Object.values(CONTENT_FEATURES)
  ROUTES = ROUTES.concat(features.filter(feature => 
      !feature.link.includes('://')).map(feature => '/' + feature.link))
  for(let i = 0; i < ROUTES.length; i++) {
    try {
      let response = await fetch('http://localhost:' + HTTP_PORTS[0] + ROUTES[i])
      if(response.headers.get('content-type').match(/\/html/i)) {
        ROUTES[i] += '.html'
      }
      let html = await response.text()
      fs.mkdirSync(path.join(EXPORT_DIRECTORY, path.dirname(ROUTES[i])), { recursive: true })
      let outFile = path.join(EXPORT_DIRECTORY, ROUTES[i])
      fs.writeFileSync(outFile, html)
    } catch (e) {
      console.error(e)
    }
  }
}


let isCLI = false
let runDeploy = false
for (let i = 0; i < process.argv.length; i++) {
  let a = process.argv[i]
  if (a.includes('node')) {
    isCLI = true
  } else
    if (a.match(__filename)) {
      runDeploy = true
    }
}

if(runDeploy) {

  Promise.resolve()
  .then(async () => {
    //await createMasters(false)
    await createWebServers(['all'])

    for(let i = 0; i < DEPLOY_GAMES.length; i++) {
      await exportGame(DEPLOY_GAMES[i])
    }

    let sockets = Object.values(UDP_SOCKETS)
    for(let i = 0; i < sockets.length; i++) {
      sockets[i].close()
    }

    let websockets = Object.values(WEB_SOCKETS)
    for(let i = 0; i < websockets.length; i++) {
      websockets[i].close()
    }

    let servers = Object.values(HTTP_LISTENERS)
    for(let i = 0; i < servers.length; i++) {
      servers[i].close(function () {
        console.log('Shutting down HTTP server.')
      })
    }
  })
}


module.exports = {
  exportGame
}


