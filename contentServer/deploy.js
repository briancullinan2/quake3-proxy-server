// TODO: make HTML copies of every page for deploying to GitHub Pages
const path = require('path')
const fs = require('fs')
const { PassThrough } = require('stream')

const { SUPPORTED_FORMATS, AUDIO_FORMATS, IMAGE_FORMATS,
  getGame, setGame, addGame } = require('../utilities/env.js')
const { START_SERVICES, CONTENT_FEATURES } = require('../contentServer/features.js')
const { createWebServers } = require('../contentServer/express.js')
const { createMasters } = require('../gameServer/serve-master.js')
const { UDP_SOCKETS } = require('../gameServer/master.js')
const { HTTP_LISTENERS, HTTP_PORTS, WEB_SOCKETS } = require('../contentServer/session.js')
const { ASSET_FEATURES } = require('../contentServer/serve-settings.js')
const { STATUS_MENU } = require('../gameServer/processes.js')
const { setOutput, repackBasemap, repackBasepack } = require('../mapServer/repack.js')
const { listMaps } = require('../assetServer/list-maps.js')
const { layeredDir } = require('../assetServer/layered.js')
const { MAP_DICTIONARY } = require('../mapServer/download.js')
const { streamAndCache, CONVERTED_FILES, streamFile, findAlt } = require('../assetServer/stream-file.js')
const { unsupportedImage, unsupportedAudio } = require('../contentServer/unsupported.js')
const { CONVERTED_IMAGES, convertCmd } = require('../cmdServer/cmd-convert.js')
const { opaqueCmd } = require('../cmdServer/cmd-identify.js')
const { CONVERTED_SOUNDS, encodeCmd } = require('../cmdServer/cmd-encode.js')
const { streamKey } = require('../utilities/zip.js')


const EXPORT_DIRECTORY = path.join(__dirname, '/../docs/')
// TODO: generate a GitHub redirect file from routes

// TODO: including yellow banner warning message like "This is a cached page, reconnecting..."
const DEPLOY_GAMES = [getGame()]

async function exportGame(game) {
  if (!game) {
    game = getGame()
  } else {
    setGame(game)
  }

  // TODO: addGame
  addGame('multigame')

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
  //ROUTES = ROUTES.concat(Object.keys(MAP_DICTIONARY).map(map => '/baseq3/screenshots/' + map + '_screenshot0001.jpg?alt'))
  //ROUTES = ROUTES.concat(Object.keys(MAP_DICTIONARY).map(map => '/baseq3/' + MAP_DICTIONARY[map] + 'dir/levelshots/' + map + '.jpg?alt'))

  // export HTML content with a cache banner message
  for (let i = 0; i < ROUTES.length; i++) {
    try {
      let response = await fetch('http://localhost:' + HTTP_PORTS[0] + ROUTES[i])
      ROUTES[i] = ROUTES[i].replace(/\?index/i, '').replace(/\?alt/i, '')
      if (path.basename(ROUTES[i]).length < 1
        || ROUTES[i].endsWith('/')) {
        ROUTES[i] += 'index'
      }
      if (response.headers.get('content-type').match(/\/html/i)
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

  // TODO: put the vm in the right place in the output path so the new VM is picked up
  //   and packaged into the pk3
  let outputDir = path.join(EXPORT_DIRECTORY, 'baseq3/pak0.pk3dir')
  let files = layeredDir('multigame/xxx-multigame.pk3dir', true).map(file => path.basename(file))
  //let files2 = layeredDir('multigame/vm', true).map(file => path.basename(file))
  //console.log(files)
  //await exportFiles(files, outputDir)
  //await exportFiles(files2, outputDir)

  return
  // TODO: export all images and maps from TRIAL DEMO ONLY
  const TRIAL_MAPS = ['Q3DM1', 'Q3DM7', 'Q3DM17', 'Q3TOURNEY2']
  setOutput(path.join(EXPORT_DIRECTORY, 'baseq3/pak0.pk3dir'))

  await repackBasepack('demoq3')
  fs.renameSync(
    path.join(EXPORT_DIRECTORY, 'baseq3/pak0.pk3'),
    path.join(EXPORT_DIRECTORY, 'maps/repacked/pak0.pk3'))

  // TODO: include the other BSPs for background display but no PLAY NOW 
  //   button and no copyrighted content generated images will be okay, 
  for (let i = 0; i < TRIAL_MAPS.length; i++) {
    await repackBasemap('demoq3', TRIAL_MAPS[i].toLocaleLowerCase())
    fs.renameSync(
      path.join(EXPORT_DIRECTORY, 'baseq3/' + TRIAL_MAPS[i] + '.pk3'),
      path.join(EXPORT_DIRECTORY, 'maps/repacked/' + TRIAL_MAPS[i] + '.pk3'))
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

if (runDeploy) {

  Promise.resolve()
    .then(async () => {
      START_SERVICES.push('all')
      START_SERVICES.push('deploy')
      await createMasters(false)
      await createWebServers(START_SERVICES)

      for (let i = 0; i < DEPLOY_GAMES.length; i++) {
        await exportGame(DEPLOY_GAMES[i])
      }

      let sockets = Object.values(UDP_SOCKETS)
      for (let i = 0; i < sockets.length; i++) {
        sockets[i].close()
      }

      let websockets = Object.values(WEB_SOCKETS)
      for (let i = 0; i < websockets.length; i++) {
        websockets[i].close()
      }

      let servers = Object.values(HTTP_LISTENERS)
      for (let i = 0; i < servers.length; i++) {
        servers[i].close(function () {
          console.log('Shutting down HTTP server.')
        })
      }
    })
}


module.exports = {
  exportGame
}


