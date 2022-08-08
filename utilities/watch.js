const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { START_SERVICES } = require('../contentServer/features.js')
const { gameDirectories, buildDirectories } = require('../assetServer/virtual.js')
const { getGames, downloadCache, repackedCache } = require('../utilities/env.js')
const { FILESYSTEM_WATCHERS } = require('../gameServer/processes.js')


let childProcess
let debounceProject

function projectWatcher(type, file) {
  if (file && !file.match(/\.js/i)) {
    return
  }
  if(debounceProject) {
    return
  }
  console.log('File changed:', file)
  let startArgs = [process.argv[1]]
  .concat(process.argv.slice(2))
  .concat(START_SERVICES)
  .concat(['holdup', '--watcher-pid', process.pid])
  if (childProcess) {
    childProcess.kill()
  }
  debounceProject = setTimeout(function () {
    debounceProject = null
    childProcess = spawn('node', startArgs, { stdio: 'inherit' })
    //childProcess.unref()
    // TODO: add debounce because it restarts annoyingly quick here
    childProcess.on('close', projectWatcher)
    childProcess.on('error', projectWatcher)
  }, 2000)
}



const DEBOUNCE = {}
const CALLBACKS = []
function debounceKey(key, callback, type, file) {
  if(CALLBACKS.indexOf(callback) == -1) {
    CALLBACKS.push(callback)
  }
  let callbackI = CALLBACKS.indexOf(callback)
  if(typeof DEBOUNCE[key + '_' + callbackI] != 'undefined') {
    return
  }
  DEBOUNCE[key] = setTimeout(function () {
    delete DEBOUNCE[key + '_' + callbackI]
    callback(type, file)
  }, 2000)

}



const CONTENT_WATCHES = {}
let lastRun = 0


function watchDirectory(directory, callback, recursive) {
  let localeList = []
  let debouncer = debounceKey.bind(null, directory, callback)
  if (fs.existsSync(directory)) {
    let localeName = directory.toLocaleLowerCase()
    if (typeof CONTENT_WATCHES[localeName] == 'undefined') {
      CONTENT_WATCHES[localeName] = fs.watch(directory, { recursive: recursive }, debouncer)
    }
    localeList.push(localeName)

    // TODO: test on Windows, should be one directory down from drive, e.g. C:/dir
    let rootDirectory = directory.split('/').slice(0, 2).join('/')
    let rootName = rootDirectory.toLocaleLowerCase()
    if (typeof CONTENT_WATCHES[rootName] == 'undefined') {
      CONTENT_WATCHES[rootName] = fs.watch(rootDirectory, { recursive: recursive }, debouncer)
    }
    localeList.push(rootName)

  } else if (!recursive) {
    // find the top-most existing path, refresh the page when someone
    //   plugs in a /Volumes/
    let currentPath = path.dirname(directory)
    while (!fs.existsSync(currentPath)) {
      currentPath = path.dirname(currentPath)
    }

    if (fs.existsSync(currentPath)) {

      let localeName = currentPath.toLocaleLowerCase()
      if (typeof CONTENT_WATCHES[localeName] == 'undefined') {
        CONTENT_WATCHES[localeName] = fs.watch(currentPath, { recursive: recursive }, debouncer)
      }
      localeList.push(localeName)

      let rootDirectory = currentPath.split('/').slice(0, 2).join('/')
      let rootName = rootDirectory.toLocaleLowerCase()
      if (typeof CONTENT_WATCHES[rootName] == 'undefined') {
        CONTENT_WATCHES[rootName] = fs.watch(rootDirectory, { recursive: recursive }, debouncer)
      }
      localeList.push(rootName)

    }
  }
  return localeList
}


function contentWatcher() {

  // debounce, in case multiple files change
  if (Date.now() - lastRun < 1000) {
    return
  }
  lastRun = Date.now()

  let BUILD_ORDER = buildDirectories()
  //if(!START_SERVICES.includes('debug')) {
  //  for (let i = 0; i < BUILD_ORDER.length; i++) {
  //    watchDirectory(BUILD_ORDER[i], projectWatcher, true)
  //  }
  //}

  let gameNames = getGames()
  let GAME_ORDER = []
  for (let i = 0; i < gameNames.length; i++) {
    GAME_ORDER.push.apply(GAME_ORDER, gameDirectories(gameNames[i], true))
  }
  let CONTENT_ORDER = repackedCache().concat(downloadCache())
  let MONITOR_CHANGES = BUILD_ORDER.concat(GAME_ORDER).concat(CONTENT_ORDER)
  let localeList = []

  for (let i = 0; i < MONITOR_CHANGES.length; i++) {
    let matched = watchDirectory(MONITOR_CHANGES[i], contentWatcher, false)
    localeList.push.apply(localeList, matched)
  }

  // close and delete old watches
  let oldWatches = Object.keys(CONTENT_WATCHES)
  for (let i = 0; i < oldWatches.length; i++) {
    if (!localeList.includes(oldWatches[i])) {
      CONTENT_WATCHES[oldWatches[i]].close()
      delete CONTENT_WATCHES[oldWatches[i]]
    }
  }
  console.log('Watching', BUILD_ORDER.length, 
    'build directories', MONITOR_CHANGES.length, 'content directories')
}

module.exports = {
  FILESYSTEM_WATCHERS,
  contentWatcher,
  projectWatcher,
  watchDirectory,
}

