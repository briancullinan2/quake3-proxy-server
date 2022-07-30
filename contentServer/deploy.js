// TODO: make HTML copies of every page for deploying to GitHub Pages
const path = require('path')
const fs = require('fs')

const { getGame, setGame } = require('../utilities/env.js')
const { START_SERVICES, CONTENT_FEATURES } = require('../contentServer/features.js')
const { createWebServers } = require('../contentServer/express.js')
const { createMasters } = require('../gameServer/serve-master.js')
const { UDP_SOCKETS } = require('../gameServer/master.js')
const { HTTP_LISTENERS, HTTP_PORTS, WEB_SOCKETS } = require('../contentServer/session.js')
const { ASSET_FEATURES } = require('../contentServer/serve-settings.js')
const { STATUS_MENU } = require('../gameServer/processes.js')
const { setOutput, repackBasemap, repackBasepack } = require('../mapServer/repack.js')
const { MAP_DICTIONARY, listMaps } = require('../assetServer/list-maps.js')


const EXPORT_DIRECTORY = path.join(__dirname, '/../docs/')
// TODO: generate a GitHub redirect file from routes

// TODO: including yellow banner warning message like "This is a cached page, reconnecting..."
const DEPLOY_GAMES = [getGame()]

async function exportGame(game) {
  if(!game) {
    game = getGame()
  } else {
    setGame(game)
  }

  fs.mkdirSync(EXPORT_DIRECTORY, { recursive: true })

  await listMaps('baseq3')

  // loop through every detectable route and export it to /docs/
  let ROUTES = ['/index.css', '/', '/?alt', '/index.html',
    '/quake3e.wasm', '/sys_net.js', '/nipplejs.js', '/sys_emgl.js', 
    '/sys_fs.js', '/sys_idbfs.js', '/sys_in.js', '/sys_std.js', 
    '/sys_web.js', '/sys_snd.js', '/sys_wasm.js', '/frontend.js',
    '/unknownmap.jpg', `/${getGame()}/pak0.pk3dir/levelshots/q3dm0.jpg`
  ]
  ROUTES = ROUTES.concat(Object.values(CONTENT_FEATURES).filter(feature => 
    !feature.link.includes('://')).map(feature => '/' + feature.link))
  ROUTES = ROUTES.concat(Object.values(ASSET_FEATURES).filter(feature => 
    !feature.link.includes('://')).map(feature => '/' + feature.link))
  ROUTES = ROUTES.concat(Object.values(STATUS_MENU).filter(feature => 
    !feature.link.includes('://')).map(feature => '/' + feature.link))
  ROUTES = ROUTES.concat(Object.keys(MAP_DICTIONARY).map(map => '/maps/' + map))

  // export HTML content with a cache banner message
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

  // TODO: export all images and maps from TRIAL DEMO ONLY
  const TRIAL_MAPS = ['Q3DM1', 'Q3DM7', 'Q3DM17', 'Q3TOURNEY2']
  setOutput(path.join(EXPORT_DIRECTORY, 'demoq3/pak0.pk3dir'))

  //await repackBasepack('demoq3')
  //fs.renameSync(
  //  path.join(EXPORT_DIRECTORY, 'demoq3/pak0.pk3'), 
  //  path.join(EXPORT_DIRECTORY, 'maps/repacked/pak0.pk3'))

  // TODO: include the other BSPs for background display but no PLAY NOW 
  //   button and no copyrighted content generated images will be okay, 
  for(let i = 0; i < TRIAL_MAPS.length; i++) {
    //await repackBasemap('demoq3', TRIAL_MAPS[i].toLocaleLowerCase())
    //fs.renameSync(
    //  path.join(EXPORT_DIRECTORY, 'demoq3/' + TRIAL_MAPS[i] + '.pk3'), 
    //  path.join(EXPORT_DIRECTORY, 'maps/repacked/' + TRIAL_MAPS[i] + '.pk3'))
  }

  // TODO: replace BSP files with voxel tracemaps, remove lightmaps here

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
    START_SERVICES.push('deploy')
    await createMasters(false)
    await createWebServers(START_SERVICES)

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


