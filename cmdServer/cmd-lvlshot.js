

// TODO: combine this master server serveDed()
async function lvlshotCmd(mapname, extraCommands) {
  if (typeof EXECUTING[mapname] == 'undefined') {
    EXECUTING[mapname] = []
  }

  // prevent clients from making multiple requests on 
  //   the same map. just wait a few seconds
  if (EXECUTING[mapname].length != 0) {
    return await new Promise(function (resolve, reject) {
      let rejectTimer = setTimeout(function () {
        reject(new Error('Levelshot Service timed out.'))
      }, 10000)
      EXECUTING[mapname].push(function (/* logs */) {
        clearTimeout(rejectTimer)
        resolve()
      })
    })
  }

  // TODO: this is pretty lame, tried to make a screenshot, and a
  //   bunch of stuff failed, now I have some arbitrary wait time
  //   and it works okay, but a real solution would be "REAL-TIME"!
  // TODO: open a control port and create a new master server. One
  //   separate master control for every single map, split up and only
  //   do 10 maps at a time, because of this.
  let startArgs = [
    '+set', 'fs_basepath', FS_BASEPATH,
    '+set', 'fs_homepath', FS_GAMEHOME,
    '+set', 'bot_enable', '0',
    '+set', 'developer', '0',
    // Ironically, the thing I learned working for the radio station about
    //   M$ Windows not being able to run without a video card for remote
    //   desktop, but Xvfb working fine with remote desktop, has suddenly
    //   become relevant, and now I understand why.
    // https://stackoverflow.com/questions/12482166/creating-opengl-context-without-window
    '+set', 'r_headless', '1',
    // TODO: run a few frames to load images before
    //   taking a screen shot and exporting canvas
    //   might also be necessary for aligning animations.
  ]
    .concat(extraCommands)
  //console.log(startArgs)
  // TODO: wait for the new dedicated process to connect to our specialized
  //   control port. Now we have a Quake 3 server command pipe. Send OOB
  //   RCON messages to control our own process remotely / asynchronously.
  // TODO: take the screenshots, run client commands using local dedicate 
  //   connected commands (side-effect, easily switch out client to a real
  //   server using the reconnect command).
  let client = findFile(EXE_NAME)
  const { execFile } = require('child_process')
  //console.log(startArgs)
  // TODO: CODE REVIEW, using the same technique in compress.js (CURRENTLY_UNPACKING)
  //   but the last resolve function would be here after the resolve(stderr)
  //   instead of after, in the encapsulating function call.
  return await new Promise(function (resolve, reject) {
    EXECUTING[mapname].push('placeholder')
    let ps = execFile(client, startArgs,
      function (errCode, stdout, stderr) {
        if (errCode > 0) {
          reject(new Error(stderr))
        } else {
          resolve(stderr + stdout)
        }
      })
    //ps.stderr.on('data', console.error);
    //ps.stdout.on('data', console.log);
  })

}


module.exports = {
  lvlshotCmd
}
