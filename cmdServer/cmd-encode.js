


const path = require('path')
const { PassThrough } = require('stream')

const { START_SERVICES } = require('../contentServer/features.js')
const { execCmd } = require('../utilities/exec.js')
const { fileKey, streamKey } = require('../utilities/zip.js')

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

  if(path.extname(typeof audioPath == 'object' ? audioPath.name : audioPath).match(/\.mp3|\.ogg/gi)) {
    cmd = 'ffmpeg'
    startArgs = ['-i']
    if(passThrough) {
      startArgs.push('-')
    } else {
      startArgs.push(audioPath)
    }
    startArgs.push.apply(startArgs, [
      '-c:a', 'libvorbis', '-q:a', '4',
    ])
    if(typeof newPath == 'string') {
      startArgs.push(newPath)
    } else {
      startArgs.push.apply(startArgs, [
        '-f', 'ogg', '-'
      ])
    }
  } else {
    cmd = 'oggenc'
    startArgs = [
      '-q', '7', /* '--downmix', */ '--resample',
      '11025', '--quiet'
    ]
    if(passThrough) {
      startArgs.push('-')
    } else {
      startArgs.push(audioPath)
    }
    startArgs.push.apply(startArgs, [
      '-o', typeof newPath == 'string' ? '"' + newPath + '"' : '-'
    ])
  }

  if(START_SERVICES.includes('debug')) {
    console.log('Transcoding: ', typeof audioPath == 'object' 
        ? audioPath.name : audioPath, unsupportedFormat)
  }
  let logs
  if(passThrough) {
    logs = (await Promise.all([
      streamKey(file, passThrough),
      execCmd(cmd, startArgs, {
        once: path.join(file.file, unsupportedFormat),
        write: typeof newPath == 'string' ? void 0 : newPath,
        pipe: passThrough,
        wait: wait,
        shell: true,
      })
    ]))[1]
  } else {
    logs = await execCmd(cmd, startArgs, {
      once: path.join(audioPath, unsupportedFormat),
      write: typeof newPath == 'string' ? void 0 : newPath,
      wait: wait,
      shell: true,
    })
  }
  return newPath
}

module.exports = {
  CONVERTED_SOUNDS,
  encodeCmd,
}
