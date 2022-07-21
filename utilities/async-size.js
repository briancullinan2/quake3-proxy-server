
const fs = require('fs')
const path = require('path')

const { updatePageViewers } = require('../contentServer/session.js')


const DIRECTORY_TIMES = {}
const DIRECTORY_SIZES = {}
const DIRECTORY_DIRS = {}
const DIRECTORY_QUEUE = []
const DIRECTORY_WAITS = {}
let directoryTimer

async function calculateSize(directory, callback) {
  if (!directoryTimer) {
    directoryTimer = setInterval(function () {
      let funcs = DIRECTORY_QUEUE.splice(0, 5)
      funcs.forEach(func => func())
    }, 1000 / 60)
  }

  let key = directory.toLocaleLowerCase()
  let stat = fs.statSync(directory)
  let compareTime = stat.mtime.getTime()
  if (!stat.isDirectory()) {
    return stat.size
  }
  if (typeof DIRECTORY_TIMES[key] != 'undefined'
    // just set this somewhere else
    && DIRECTORY_TIMES[key] == compareTime
    // this means another process in the middle of reading
    && typeof DIRECTORY_DIRS[key] == 'undefined') {
    // if this is the second time queueing, and there is
    //   no result, wait a full second before queing more
    if (typeof DIRECTORY_WAITS[key] == 'undefined') {
      DIRECTORY_WAITS[key] = []
    }
    await new Promise(resolve => DIRECTORY_WAITS[key].push(resolve))
  }

  if (typeof DIRECTORY_DIRS[key] != 'undefined'
    // if the directory hasn't changed, use the size
    //   and list of directories from memory, instead
    //   of reading from disk again
    && DIRECTORY_TIMES[key] >= compareTime) {
    // recheck subdirectories for changes because child 
    //   changes to not propogate to parent directories
    return Promise.all(DIRECTORY_DIRS[key].map(dir => {
      return calculateSize(dir, callback)
    })).then(subsizes => subsizes.reduce((s, i) => (s + i), 0) + DIRECTORY_SIZES[key])
  }

  // finally WE NEED UPDATE HERE! before anything asynchronous
  DIRECTORY_TIMES[key] = compareTime

  // TODO: rate limit to not pound hard drive while playing / developing
  let dirs = await new Promise(resolve => {
    //console.log('Queuing: ', directory)
    DIRECTORY_QUEUE.push(function () {
      // check again if cache was updated with list
      if (typeof DIRECTORY_DIRS[key] != 'undefined'
        && DIRECTORY_TIMES[key] >= compareTime) {
        resolve(DIRECTORY_DIRS[key])
      } else {
        //console.log('Scanning: ', directory)
        resolve(fs.readdirSync(directory))
      }
    })
  })

  if (typeof DIRECTORY_DIRS[key] != 'undefined'
    && DIRECTORY_TIMES[key] >= compareTime) {
    // save a little more time not doing stat-sync and updating clients
    //   if some other process already requested the size for this dir
    //   but we we're already queued for later
    return Promise.all(DIRECTORY_DIRS[key].map(dir => {
      return calculateSize(dir, callback)
    })).then(subsizes => subsizes.reduce((s, i) => (s + i), 0) + DIRECTORY_SIZES[key])
  }

  let subdirs = []
  let totalSize = 0
  // queue up the folder inside this folder before resolving
  for (let i = 0; i < dirs.length; i++) {
    if (!fs.existsSync(path.join(directory, dirs[i]))) {
      continue
    }
    let stat = fs.statSync(path.join(directory, dirs[i]))
    if (stat.isDirectory()) {
      subdirs.push(path.join(directory, dirs[i]))
    } else {
      totalSize += stat.size
    }
  }

  DIRECTORY_SIZES[key] = totalSize
  DIRECTORY_DIRS[key] = subdirs
  // TODO: update based on parent directories?

  let size = await Promise.all(subdirs.map(dir => calculateSize(dir, callback)))
    .then(subsizes => subsizes.reduce((s, i) => (s + i), 0) + totalSize)

  if (typeof DIRECTORY_WAITS[key] != 'undefined') {
    for (let i = 0; i < DIRECTORY_WAITS[key].length; i++) {
      DIRECTORY_WAITS[key]()
    }
    DIRECTORY_WAITS[key].splice(0)
  }
  updatePageViewers('/settings')
  updatePageViewers('\/?index')
  return size
}


module.exports = {
  calculateSize
}


