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

  return await new Promise(function (resolve, reject) {
    // we expect this to exit unlike the dedicated server
    if(options && options.later) {
      CHILD_PROCESS[LIMIT + ':' + 0] = [cmd].concat(args).join(' ')
      return resolve('')
    }
    let ps = spawn(cmd, args, {
      timeout: 3600,
      cwd: (options ? options.cwd : null) || process.cwd(),
      shell: options ? options.shell : false || false,
    })
    RUNNING++
    let pid = LIMIT + ':' + ps.pid
    CHILD_PROCESS[pid] = [cmd].concat(args).join(' ')
    updatePageViewers('/process')
    let stderr = ''
    let stdout = ''
    ps.stderr.on('data', (data) => stderr += data.toString('utf-8'))
    ps.stdout.on('data', (data) => stdout += data.toString('utf-8'))
    if(options && options.pipe) {
      options.pipe.pipe(ps.stdin)
    }
    ps.on('close', function (errCode) {
      RUNNING--
      delete CHILD_PROCESS[pid]
      updatePageViewers('/process')
      if(errCode > 0) {
        console.log('Error executing:', LIMIT, cmd, args.join(' '), options)
        console.log(stdout + stderr)
        reject(new Error('Process failed: ' + errCode))
      } else {
        resolve(stdout + stderr)
      }
    })
  })
}



module.exports = {
  CHILD_PROCESS,
  execCmd
}