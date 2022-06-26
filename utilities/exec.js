
async function execCmd(cmd, args, stdInPipe) {
  const {spawn} = require('child_process')
  //console.log('Executing:', cmd)
  return await new Promise(function (resolve, reject) {
    // we expect this to exit unlike the dedicated server
    let ps = spawn(cmd, args)
    stderr = ''
    stdout = ''
    ps.stderr.on('data', (data) => stderr += data.toString('utf-8'));
    ps.stdout.on('data', (data) => stdout += data.toString('utf-8'));
    if(stdInPipe) {
      stdInPipe.pipe(ps.stdin)
    }
    ps.on('close', (errCode) => {
      if(errCode > 0) {
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