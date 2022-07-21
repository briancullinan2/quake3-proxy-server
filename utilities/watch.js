const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { START_SERVICES } = require('../contentServer/features.js')
const { gameDirectories, buildDirectories } = require('../assetServer/virtual.js')
const { getGames, downloadCache, repackedCache } = require('../utilities/env.js')
const { updatePageViewers } = require('../contentServer/session.js')
const { FILESYSTEM_WATCHERS } = require('../gameServer/processes.js')


let childProcess
let debounceTimer
let PROJECT_WATCHER


function restartProcess(startArgs, type, file) {
  if (debounceTimer) {
    return
  }
  debounceTimer = setTimeout(function () {
    debounceTimer = null
    if (!file || file.match(/\.js/i)) {
      if (childProcess) {
        childProcess.kill()
      }
      childProcess = spawn('node', startArgs, { stdio: 'inherit' })
      childProcess.unref()
      childProcess.on('close', restartProcess.bind(null, startArgs))
      childProcess.on('error', restartProcess.bind(null, startArgs))
    }
  }, 1000)
}


function projectWatcher() {
  let startArgs = [process.argv[1]]
    .concat(process.argv.slice(2))
    .concat(START_SERVICES)
    .concat(['holdup', '--watcher-pid', process.pid])
  PROJECT_WATCHER = fs.watch(path.resolve(__dirname + '/../'),
    { recursive: true }, restartProcess.bind(null, startArgs))
  childProcess = spawn('node', startArgs, { stdio: 'inherit' })
  childProcess.unref()
  childProcess.on('close', restartProcess.bind(null, startArgs))
  childProcess.on('error', restartProcess.bind(null, startArgs))
}


const CONTENT_WATCHES = {}
let lastRun = 0

function contentWatcher() {
  updatePageViewers('\/?index')
  updatePageViewers('/settings')
  // debounce, in case multiple files change
  if (Date.now() - lastRun < 1000) {
    return
  }
  lastRun = Date.now()

  let BUILD_ORDER = buildDirectories()
  let GAME_MODS = getGames()
  let GAME_ORDER = []
  for (let i = 0; i < GAME_MODS.length; i++) {
    GAME_ORDER.push.apply(GAME_ORDER, gameDirectories(GAME_MODS[i], true))
  }
  let CONTENT_ORDER = repackedCache().concat(downloadCache())
  let MONITOR_CHANGES = BUILD_ORDER.concat(GAME_ORDER).concat(CONTENT_ORDER)
  let localeList = []
  for (let i = 0; i < MONITOR_CHANGES.length; i++) {
    if (fs.existsSync(MONITOR_CHANGES[i])) {
      let localeName = MONITOR_CHANGES[i].toLocaleLowerCase()
      if (typeof CONTENT_WATCHES[localeName] == 'undefined') {
        console.log('Watching 1: ', MONITOR_CHANGES[i])
        CONTENT_WATCHES[localeName] = fs.watch(MONITOR_CHANGES[i], { recursive: false }, function (type, file) {
          setTimeout(contentWatcher, 1000)
        })
      }
      localeList.push(localeName)

      // TODO: test on Windows, should be one directory down from drive, e.g. C:/dir
      let rootDirectory = MONITOR_CHANGES[i].split('/').slice(0, 2).join('/')
      let rootName = rootDirectory.toLocaleLowerCase()
      if (typeof CONTENT_WATCHES[rootName] == 'undefined') {
        console.log('Watching 2: ', rootDirectory)
        CONTENT_WATCHES[rootName] = fs.watch(rootDirectory, { recursive: false }, function (type, file) {
          setTimeout(contentWatcher, 1000)
        })
      }
      localeList.push(rootName)

    } else {
      // find the top-most existing path, refresh the page when someone
      //   plugs in a /Volumes/
      let currentPath = path.dirname(MONITOR_CHANGES[i])
      while (!fs.existsSync(currentPath)) {
        currentPath = path.dirname(currentPath)
      }

      if (fs.existsSync(currentPath)) {

        let localeName = currentPath.toLocaleLowerCase()
        if (typeof CONTENT_WATCHES[localeName] == 'undefined') {
          console.log('Watching 3: ', currentPath)
          CONTENT_WATCHES[localeName] = fs.watch(currentPath, { recursive: false }, function (type, file) {
            setTimeout(contentWatcher, 1000)
          })
        }
        localeList.push(localeName)

        let rootDirectory = currentPath.split('/').slice(0, 2).join('/')
        let rootName = rootDirectory.toLocaleLowerCase()
        if (typeof CONTENT_WATCHES[rootName] == 'undefined') {
          console.log('Watching 4: ', rootDirectory)
          CONTENT_WATCHES[rootName] = fs.watch(rootDirectory, { recursive: false }, function (type, file) {
            setTimeout(contentWatcher, 1000)
          })
        }
        localeList.push(rootName)

      }
    }
  }

  // close and delete old watches
  let oldWatches = Object.keys(CONTENT_WATCHES)
  for (let i = 0; i < oldWatches.length; i++) {
    if (!localeList.includes(oldWatches[i])) {
      CONTENT_WATCHES[oldWatches[i]].close()
      delete CONTENT_WATCHES[oldWatches[i]]
    }
  }
}

module.exports = {
  FILESYSTEM_WATCHERS,
  projectWatcher,
  contentWatcher,
}

