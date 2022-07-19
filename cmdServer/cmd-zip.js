const fs = require('fs')
const path = require('path')

const { execCmd } = require('../utilities/exec.js')

async function zipCmd(fullPath, update, newZip) {
  let newDir = fullPath.replace(/\.pk3.*/gi, '.pk3dir')
  let pk3InnerPath = fullPath.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')
  let startArgs = ['-v']
  if(update) {
    startArgs.push('-u')
  }
  startArgs.push.apply(startArgs, [
    '../' + path.basename(newZip), path.join('./', pk3InnerPath)
  ])
  let output = await execCmd(
    //process.env.SHELL, ['-c', 'pwd'
    'zip', startArgs, { cwd: newDir, /* shell: true */ })
  return output
}

module.exports = {
  zipCmd
}
