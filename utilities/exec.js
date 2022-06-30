
let LIMIT = 0
let RUNNING = 0
const PROCESS_TIMEOUT = 10000
const PROCESS_INTERVAL = 100

async function execCmd(cmd, args, options) {
  const {spawn} = require('child_process')
  LIMIT++
  if(RUNNING >= 10) {
    let waitCounter = 0
    let waitInterval
    waitInterval = await new Promise(function (resolve, reject) {
      setInterval(function () {
        if(waitCounter > PROCESS_TIMEOUT / PROCESS_INTERVAL) {
          reject(new Error('Too many running processes!'))
        } else
        if(RUNNING < 10) {
          clearInterval(waitInterval)
          resolve()
        } else {
          waitCounter++
        }
      }, PROCESS_INTERVAL)
    })
  }
  console.log('Executing:', LIMIT, RUNNING, cmd, args.join(' '))
  return await new Promise(function (resolve, reject) {
    // we expect this to exit unlike the dedicated server
    RUNNING++
    let ps = spawn(cmd, args, {
      timeout: 3600,
      cwd: (options ? options.cwd : null) || process.cwd(),
      shell: options ? options.shell : false || false,
    })
    let stderr = ''
    let stdout = ''
    ps.stderr.on('data', (data) => stderr += data.toString('utf-8'));
    ps.stdout.on('data', (data) => stdout += data.toString('utf-8'));
    if(options && options.pipe) {
      options.pipe.pipe(ps.stdin)
    }
    ps.on('close', function (errCode) {
      RUNNING--
      if(errCode > 0) {
        console.log('Executing:', LIMIT, cmd, args.join(' '), options)
        console.log(stdout + stderr)
        reject(new Error('Process failed: ' + errCode))
      } else {
        resolve(stdout + stderr)
      }
    })
  })
}

module.exports = {
  execCmd
}