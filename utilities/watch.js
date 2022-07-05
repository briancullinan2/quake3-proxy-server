const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { START_SERVICES } = require('../contentServer/features.js')
const { gameDirectories, buildDirectories } = require('../assetServer/virtual.js')
const { getGames, downloadCache, repackedCache } = require('../utilities/env.js')
const { updatePageViewers } = require('../contentServer/session.js')

const FILESYSTEM_WATCHERS = [{
  name: '(implied) Proxy Code Watcher',
  absolute: 'reload/proxy/.',
}, {
  name: '(implied) Game Code Watcher',
  absolute: 'reload/qvms/.',
}, {
  name: '(implied) Engine Code Watcher',
  absolute: 'reload/engine/.',
}, {
  name: '(implied) Content Watcher',
  absolute: 'reload/mounts/.',
}]

const DIRECTORY_TIMES = {}
const DIRECTORY_SIZES = {}
const DIRECTORY_DIRS = {}
const DIRECTORY_QUEUE = []
let directoryTimer

async function calculateSize(directory, callback) {
  if(!directoryTimer) {
    directoryTimer = setInterval(function () {
      Promise.resolve(DIRECTORY_QUEUE.pop())
    }, 100)
  }

  let key = directory.toLocaleLowerCase()
  let stat = fs.statSync(directory)
  if(!stat.isDirectory()) {
    return stat.size
  }

  if(typeof DIRECTORY_TIMES[key] != 'undefined'
    // if the directory hasn't changed, use the size
    //   and list of directories from memory, instead
    //   of reading from disk again
    && DIRECTORY_TIMES[key] >= stat.mtime) {
    // recheck subdirectories for changes because child 
    //   changes to not propogate to parent directories
    return Promise.all(DIRECTORY_DIRS[key].map(dir => {
      return calculateSize(dir, callback)
    })).then(subsize => subsize + DIRECTORY_SIZES[key])
  }
  DIRECTORY_TIMES[key] = stat.mtime
  // TODO: rate limit to not pound hard drive while playing
  let dirs = fs.readdirSync(directory)
  let subdirs = []
  let totalSize = 0
  // queue up the folder inside this folder before resolving
  for(let i = 0; i < dirs.length; i++) {
    let stat = fs.statSync(path.join(directory, dirs[i]))
    if(stat.isDirectory()) {
      subdirs.push(path.join(directory, dirs[i]))
    } else {
      totalSize += stat.size
    }
  }
  DIRECTORY_SIZES[key] = totalSize
  DIRECTORY_DIRS[key] = subdirs
  return Promise.all(subdirs.map(dir => {
    return calculateSize(dir, callback)
  })).then(subsize => subsize + totalSize)

}


let childProcess
let debounceTimer
let PROJECT_WATCHER

function projectWatcher() {
  let startArgs = [process.argv[1]]
    .concat(process.argv.slice(2))
    .concat(START_SERVICES)
    .concat(['holdup', '--watcher-pid', process.pid])
  PROJECT_WATCHER = fs.watch(path.resolve(__dirname + '/../'), { recursive: true },
    function (type, file) {
      if (debounceTimer) {
        return
      }
      debounceTimer = setTimeout(function () {
        debounceTimer = null
        if (file.match(/\.js/i)) {
          if (childProcess) {
            childProcess.kill()
          }
          childProcess = spawn('node', startArgs, { stdio: 'inherit' })
          childProcess.unref()
        }
      }, 300)
    })
  childProcess = spawn('node', startArgs, { stdio: 'inherit' })
  childProcess.unref()
}


const CONTENT_WATCHES = {}


function contentWatcher() {
  let BUILD_ORDER = buildDirectories()
  let GAME_MODS = getGames()
  let GAME_ORDER = []
  for(let i = 0; i < GAME_MODS.length; i++) {
    GAME_ORDER.push.apply(GAME_ORDER, gameDirectories(GAME_MODS[i], true))
  }
  let CONTENT_ORDER = repackedCache().concat(downloadCache())
  let MONITOR_CHANGES = BUILD_ORDER.concat(GAME_ORDER).concat(CONTENT_ORDER)
  let localeList = []
  for(let i = 0; i < MONITOR_CHANGES.length; i++) {
    if(fs.existsSync(MONITOR_CHANGES[i])) {
      let localeName = MONITOR_CHANGES[i].toLocaleLowerCase()
      if(typeof CONTENT_WATCHES[localeName] == 'undefined') {
        console.log('Watching 1: ', MONITOR_CHANGES[i])
        CONTENT_WATCHES[localeName] = fs.watch(MONITOR_CHANGES[i], { recursive: false }, function (type, file) {
          updatePageViewers('\\?index')
          updatePageViewers('/settings')
          setTimeout(contentWatcher, 1000)
        })
      }
      localeList.push(localeName)

      // TODO: test on Windows, should be one directory down from drive, e.g. C:/dir
      let rootDirectory = MONITOR_CHANGES[i].split('/').slice(0, 2).join('/')
      let rootName = rootDirectory.toLocaleLowerCase()
      if(typeof CONTENT_WATCHES[rootName] == 'undefined') {
        console.log('Watching 2: ', rootDirectory)
        CONTENT_WATCHES[rootName] = fs.watch(rootDirectory, { recursive: false }, function (type, file) {
          updatePageViewers('\\?index')
          updatePageViewers('/settings')
          setTimeout(contentWatcher, 1000)
        })
      }
      localeList.push(rootName)

    } else {
      // find the top-most existing path, refresh the page when someone
      //   plugs in a /Volumes/
      let currentPath = path.dirname(MONITOR_CHANGES[i])
      while(!fs.existsSync(currentPath)) {
        currentPath = path.dirname(currentPath)
      }

      if(fs.existsSync(currentPath)) {
        
        let localeName = currentPath.toLocaleLowerCase()
        if(typeof CONTENT_WATCHES[localeName] == 'undefined') {
          console.log('Watching 3: ', currentPath)
          CONTENT_WATCHES[localeName] = fs.watch(currentPath, { recursive: false }, function (type, file) {
            updatePageViewers('\\?index')
            updatePageViewers('/settings')
            setTimeout(contentWatcher, 1000)
          })
        }
        localeList.push(localeName)

        let rootDirectory = currentPath.split('/').slice(0, 2).join('/')
        let rootName = rootDirectory.toLocaleLowerCase()
        if(typeof CONTENT_WATCHES[rootName] == 'undefined') {
          console.log('Watching 4: ', rootDirectory)
          CONTENT_WATCHES[rootName] = fs.watch(rootDirectory, { recursive: false }, function (type, file) {
            updatePageViewers('\\?index')
            updatePageViewers('/settings')
            setTimeout(contentWatcher, 1000)
          })
        }
        localeList.push(rootName)
  
      }
    }
  }

  // close and delete old watches
  let oldWatches = Object.keys(CONTENT_WATCHES)
  for(let i = 0; i < oldWatches.length; i++) {
    if(!localeList.includes(oldWatches[i])) {
      CONTENT_WATCHES[oldWatches[i]].close()
      delete CONTENT_WATCHES[oldWatches[i]]
    }
  }
}

module.exports = {
  FILESYSTEM_WATCHERS,
  projectWatcher,
  contentWatcher,
  calculateSize,
}

