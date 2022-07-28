const { updatePageViewers } = require('../contentServer/session.js')

let LIMIT = 0
let RUNNING = 0

const PROCESS_TIMEOUT = 20000 // 20 seconds?
const PROCESS_INTERVAL = 100
const PROCESS_LIMIT = 5
const CHILD_PROCESS = {}

async function execCmd(cmd, args, options) {
  const { spawn } = require('child_process')

  if (RUNNING >= PROCESS_LIMIT) {
    let waitCounter = 0
    let waitInterval
    try {
      await new Promise(
        function (resolve, reject) {
          waitInterval = setInterval(function () {
            if (options && typeof options.wait == 'number'
              && waitCounter > options.wait / PROCESS_INTERVAL) {
              clearInterval(waitInterval)
              reject(new Error('Too many running processes!'))
            } else
              if ((!options || !options.wait) // don't wait indefinitely
                && waitCounter > PROCESS_TIMEOUT / PROCESS_INTERVAL) {
                  clearInterval(waitInterval)
                  reject(new Error('Too many running processes!'))
              } else
                if (RUNNING < PROCESS_LIMIT) {
                  clearInterval(waitInterval)
                  resolve()
                } else {
                  waitCounter++
                }
          }, PROCESS_INTERVAL)
        })
    } catch (e) {
      console.error('EXEC COMMAND:', e)
      return
    }
  }

  LIMIT++
  console.log('Executing:', LIMIT, RUNNING, cmd, args.join(' '))
  let transform = async function (key, result) {
    return await Promise.resolve(result)
  }
  if (options && options.once) {
    transform = onceOrTimeout
  }

  return await transform(options && options.once
    ? options.once : LIMIT + '', new Promise(
      function (resolve, reject) {
        // we expect this to exit unlike the dedicated server
        if (options && options.later) {
          CHILD_PROCESS[LIMIT + ':' + 0] = [cmd].concat(args).join(' ')
          return resolve('')
        }
        let ps = spawn(cmd, args, {
          timeout: options && (options.detached || options.background || options.wait) ? void 0 : 3600000,
          cwd: (options ? options.cwd : null) || process.cwd(),
          shell: (options ? options.shell : false) || false,
          detached: (options ? options.detached : false) || false,
          stdio: options && options.detached ? 'ignore' : 'pipe',
        })
        if(!options || !options.detached) {
          RUNNING++ // don't coult detached toward total
        }
        let pid = LIMIT + ':' + ps.pid
        CHILD_PROCESS[pid] = [cmd].concat(args).join(' ')
        updatePageViewers('/process')
        let stderr = ''
        let stdout = ''
        if(!options || !options.detached) {
          ps.stderr.on('data', (data) => {
            console.log(data.toString('utf-8'))
            stderr += data.toString('utf-8')
          })
          if (options && typeof options.write == 'object') {
            //options.stdout.cork()
            ps.stdout.pipe(options.write)
          }
          // TODO: somehow output this to console
          if (options && typeof options.error == 'object') {
            ps.stderr.pipe(options.error)
          }
          ps.stdout.on('data', (data) => {
            stdout += data.toString('utf-8')
          })
          if (options && options.pipe) {
            options.pipe.pipe(ps.stdin)
          }
        }
        ps.on('close', function (errCode) {
          if (options && typeof options.write == 'object') {
            //options.stdout.uncork()
          }
          RUNNING--
          delete CHILD_PROCESS[pid]
          updatePageViewers('/process')
          if (!options || (!options.detached && !options.background)) {
            if (errCode > 0) {
              console.log('Error executing:', LIMIT, cmd, args.join(' '), options)
              //console.log(stdout, stderr)
              reject(new Error('Process failed: ' + errCode + ': '
                + stderr + (!options || !options.write ? stdout : '')))
            } else {
              resolve(stdout + stderr)
            }
          }
        })
        if (options && (options.detached || options.background)) {
          // startup succeeded
          resolve(ps)
        }
      }))
}

const EXECUTING_ONCE = {}


// TODO: CODE REVIEW, using the same technique in compress.js (CURRENTLY_UNPACKING)
//   but the last resolve function would be here after the resolve(stderr)
//   instead of after, in the encapsulating function call.

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
      for (let i = 1; i < EXECUTING_ONCE[key].length; ++i) {
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