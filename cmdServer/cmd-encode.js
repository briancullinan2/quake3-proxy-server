


const path = require('path')
const { PassThrough } = require('stream')

const { execCmd } = require('../utilities/exec.js')
const { fileKey, streamFile } = require('../utilities/zip.js')

async function encodeCmd(audioPath, unsupportedFormat, quality, newPath) {
  let cmd
  let file
  let passThrough
  let startArgs = []
  if(audioPath.match(/\.pk3$/i)) {
    file = await fileKey(audioPath, unsupportedFormat)
    if(file) {
      passThrough = new PassThrough()
    } else {
      throw new Error('File not found: ' + unsupportedFormat)
    }
  }

  if(path.extname(audioPath).match(/\.mp3/gi)) {
    cmd = 'ffmpeg'
    startArgs = ['-i', file]
    if(passThrough) {
      startArgs.push('-')
    } else {
      startArgs.push(audioPath)
    }
    startArgs.push.apply(startArgs, [
      '-c:a', 'libvorbis', '-q:a', '4', newPath
    ])
  } else {
    cmd = 'oggenc'
    startArgs = [
      '-q', '7', '--downmix', '--resample',
      '11025', '--quiet'
    ]
    if(passThrough) {
      startArgs.push('-')
    } else {
      startArgs.push(audioPath)
    }
    startArgs.push.apply(startArgs, [
      '-o', newPath
    ])
  }

  console.log('Transcoding: ', audioPath, unsupportedFormat)
  let logs
  if(passThrough) {
    logs = (await Promise.all([
      streamFile(file, passThrough),
      execCmd(cmd, startArgs, {pipe: passThrough})
    ]))[1]
  } else {
    logs = await execCmd(cmd, startArgs)
  }
  //console.log(logs)
  return newPath
}

module.exports = {
  encodeCmd,
}
