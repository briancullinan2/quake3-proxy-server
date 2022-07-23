


const path = require('path')
const { PassThrough } = require('stream')

const { execCmd } = require('../utilities/exec.js')
const { fileKey, streamFile } = require('../utilities/zip.js')

const CONVERTED_SOUNDS = {}

async function encodeCmd(audioPath, unsupportedFormat, quality, newPath, wait) {
  let cmd
  let file
  let passThrough
  let startArgs = []
  if(typeof audioPath == 'object' || audioPath.match(/\.pk3$/i)) {
    if(typeof audioPath == 'object') {
      file = audioPath
    } else {
      file = await fileKey(audioPath, unsupportedFormat)
    }
    if(file) {
      passThrough = new PassThrough()
    } else {
      throw new Error('File not found: ' + unsupportedFormat)
    }
  }

  if(path.extname(typeof audioPath == 'object' ? audioPath.name : audioPath).match(/\.mp3/gi)) {
    cmd = 'ffmpeg'
    startArgs = ['-i', file]
    if(passThrough) {
      startArgs.push('-')
    } else {
      startArgs.push(audioPath)
    }
    startArgs.push.apply(startArgs, [
      '-c:a', 'libvorbis', '-q:a', '4', typeof outFile == 'string' ? newPath : '-'
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
      '-o', typeof outFile == 'string' ? newPath : '-'
    ])
  }

  console.log('Transcoding: ', typeof audioPath == 'object' ? audioPath.name : audioPath, unsupportedFormat)
  let logs
  if(passThrough) {
    logs = (await Promise.all([
      streamFile(file, passThrough),
      execCmd(cmd, startArgs, {
        once: path.join(file.file, unsupportedFormat),
        write: typeof newPath == 'string' ? void 0 : newPath,
        pipe: passThrough,
        wait: wait,
      })
    ]))[1]
  } else {
    logs = await execCmd(cmd, startArgs)
  }
  return newPath
}

module.exports = {
  CONVERTED_SOUNDS,
  encodeCmd,
}
