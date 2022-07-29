// TODO: make HTML copies of every page for deploying to GitHub Pages
const path = require('path')
const fs = require('fs')

const { getGame } = require('../utilities/env.js')
const { START_SERVICES, CONTENT_FEATURES } = require('../contentServer/features.js')
const { createWebServers } = require('../contentServer/express.js')
const { createMasters } = require('../gameServer/serve-master.js')
const { UDP_SOCKETS } = require('../gameServer/master.js')
const { HTTP_LISTENERS, HTTP_PORTS, WEB_SOCKETS } = require('../contentServer/session.js')
const { ASSET_FEATURES } = require('../contentServer/serve-settings.js')
const { STATUS_MENU } = require('../gameServer/processes.js')


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
  let ROUTES = ['/index.css', '/', '/?alt', '/index.html',
    '/quake3e.wasm', '/sys_net.js', '/nipplejs.js', '/sys_emgl.js', 
    '/sys_fs.js', '/sys_idbfs.js', '/sys_in.js', '/sys_std.js', 
    '/sys_web.js', '/sys_snd.js', '/sys_wasm.js',
    '/baseq3/pak0.pk3dir/levelshots/q3dm0.jpg'
  ]
  ROUTES = ROUTES.concat(Object.values(CONTENT_FEATURES).filter(feature => 
      !feature.link.includes('://')).map(feature => '/' + feature.link))
  ROUTES = ROUTES.concat(Object.values(ASSET_FEATURES).filter(feature => 
    !feature.link.includes('://')).map(feature => '/' + feature.link))
  ROUTES = ROUTES.concat(Object.values(STATUS_MENU).filter(feature => 
    !feature.link.includes('://')).map(feature => '/' + feature.link))

  for(let i = 0; i < ROUTES.length; i++) {
    try {
      let response = await fetch('http://localhost:' + HTTP_PORTS[0] + ROUTES[i])
      if(ROUTES[i].match(/\?index/i)) {
        ROUTES[i] = ROUTES[i].replace(/\?index/i, '')
      }
      if(path.basename(ROUTES[i]).length < 1
        || ROUTES[i].endsWith('/')) {
        ROUTES[i] += 'index'
      }
      if(response.headers.get('content-type').match(/\/html/i)
        && !ROUTES[i].match(/\.htm/i)) {
        ROUTES[i] += '.html'
      }
      let html = await response.arrayBuffer()
      fs.mkdirSync(path.join(EXPORT_DIRECTORY, path.dirname(ROUTES[i])), { recursive: true })
      let outFile = path.join(EXPORT_DIRECTORY, ROUTES[i])
      fs.writeFileSync(outFile, Buffer.from(html))
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
    START_SERVICES.push('all')
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


