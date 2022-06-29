
let LIMIT = 0

async function execCmd(cmd, args, options) {
  const {spawn} = require('child_process')
  LIMIT++
  //console.log('Executing:', LIMIT, cmd, args.join(' '))
  return await new Promise(function (resolve, reject) {
    // we expect this to exit unlike the dedicated server
    let ps = spawn(cmd, args, {
      timeout: 3600,
      cwd: (options ? options.cwd : null) || process.cwd(),
      shell: options ? options.shell : false || false,
    })
    stderr = ''
    stdout = ''
    ps.stderr.on('data', (data) => stderr += data.toString('utf-8'));
    ps.stdout.on('data', (data) => stdout += data.toString('utf-8'));
    if(options && options.pipe) {
      options.pipe.pipe(ps.stdin)
    }
    ps.on('close', function (errCode) {
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