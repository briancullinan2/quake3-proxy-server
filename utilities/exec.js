const { updatePageViewers } = require('../contentServer/session.js')

let LIMIT = 0
let RUNNING = 0

const PROCESS_TIMEOUT = 20000 // 20 seconds?
const PROCESS_INTERVAL = 100
const PROCESS_LIMIT = 5
const CHILD_PROCESS = {}

async function execCmd(cmd, args, options) {
  const {spawn} = require('child_process')
  LIMIT++
  if(RUNNING >= PROCESS_LIMIT) {
    let waitCounter = 0
    let waitInterval
    try {
      waitInterval = await new Promise(
      function (resolve, reject) {
        setInterval(function () {
          if(waitCounter > PROCESS_TIMEOUT / PROCESS_INTERVAL) {
            reject(new Error('Too many running processes!'))
          } else
          if(RUNNING < PROCESS_LIMIT) {
            clearInterval(waitInterval)
            resolve()
          } else {
            waitCounter++
          }
        }, PROCESS_INTERVAL)
      })
    } catch (e) {
      console.error(e)
      return
    }
  }

  //console.log('Executing:', LIMIT, RUNNING, cmd, args.join(' '))
  let transform = async function (key, result) {
    return await Promise.resolve(result)
  }
  if(options && options.once) {
    transform = onceOrTimeout
  }

  return await transform(options && options.once 
    ? options.once : LIMIT + '', new Promise(
    function (resolve, reject) {
    // we expect this to exit unlike the dedicated server
    if(options && options.later) {
      CHILD_PROCESS[LIMIT + ':' + 0] = [cmd].concat(args).join(' ')
      return resolve('')
    }
    let ps = spawn(cmd, args, {
      timeout: options && options.detached ? void 0 : 3600,
      cwd: (options ? options.cwd : null) || process.cwd(),
      shell: options ? options.shell : false || false,
      detached: options ? options.detached : false || false,
    })
    RUNNING++
    let pid = LIMIT + ':' + ps.pid
    CHILD_PROCESS[pid] = [cmd].concat(args).join(' ')
    updatePageViewers('/process')
    let stderr = ''
    let stdout = ''
    ps.stderr.on('data', (data) => {
      stderr += data.toString('utf-8')
    })
    if(options && typeof options.write == 'object') {
      //options.stdout.cork()
      ps.stderr.pipe(options.write)
      ps.stdout.pipe(options.write)
    }
    ps.stdout.on('data', (data) => {
      stdout += data.toString('utf-8')
    })
    if(options && options.pipe) {
      options.pipe.pipe(ps.stdin)
    }
    ps.on('close', function (errCode) {
      if(options && typeof options.write == 'object') {
        //options.stdout.uncork()
      }
      RUNNING--
      delete CHILD_PROCESS[pid]
      updatePageViewers('/process')
      if(!options || !options.detached) {
        if(errCode > 0) {
          console.log('Error executing:', LIMIT, cmd, args.join(' '), options)
          reject(new Error('Process failed: ' + errCode))
        } else {
          resolve(stdout + stderr)
        }
      }
    })
    if(options && options.detached) {
      // startup succeeded
      resolve(ps)
    }
  }))
}

const EXECUTING_ONCE = {}


async function onceOrTimeout(key, promise) {

  // prevent clients from making multiple requests on 
  //   the same map. just wait a few seconds
  if (typeof EXECUTING_ONCE[key] == 'undefined') {
    EXECUTING_ONCE[key] = []
  }
  if (EXECUTING_ONCE[key].length != 0) {
    return await new Promise(function (resolve, reject) {
      let rejectTimer = setTimeout(function () {
        reject(new Error('Service timed out.'))
      }, 10000)
      EXECUTING_ONCE[key].push(function (result) {
        clearTimeout(rejectTimer)
        resolve(result)
      })
    })
  }
  updatePageViewers('/process')

  return await Promise.resolve(promise)
  .then(result => new Promise(resolve => {
    resolve(result)
    for(let i = 1; i < EXECUTING_ONCE[key].length; ++i) {
      EXECUTING_ONCE[key][i](result)
    }
    EXECUTING_ONCE[key].splice(0)
    updatePageViewers('/process')
  }))

}


module.exports = {
  CHILD_PROCESS,
  execCmd,
  onceOrTimeout,
}