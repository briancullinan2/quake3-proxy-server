
async function execCmd(cmd, stdInPipe) {
  const {exec} = require('child_process')
  //console.log('Executing:', cmd)
  return await new Promise(function (resolve, reject) {
    let ps = exec(cmd,
    // we expect this to exit unlike the dedicated server
    function(errCode, stdout, stderr) {
      if(errCode > 0) {
        reject(new Error(stderr))
      } else {
        resolve(stdout + stderr)
      }
    })
    ps.stderr.on('data', console.error);
    ps.stdout.on('data', console.log);
    if(stdInPipe) {
      stdInPipe.pipe(ps.stdin)
    }
  })
}

module.exports = {
  execCmd
}