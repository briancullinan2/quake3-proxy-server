// TODO: some basic capability checking and
//   default config and file paths.
const path = require('path')
const os = require('os')

const EXE_NAME = 'quake3e.ded' + (os.platform() == 'win32' ? '.exe' : '')

let forward = 'http://local.games:8080'
let FS_BASEGAME = 'baseq3a'
let FS_BASEPATH = ''
let STEAMPATH = ''

const WEB_DIRECTORY = path.resolve(__dirname)
const ASSETS_DIRECTORY = path.resolve(__dirname + '/../../Quake3e/docs/')
const BUILD_DIRECTORY = path.resolve(__dirname + '/../../Quake3e/build/')
const FS_HOMEPATH = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
const PROGRAMPATH = process.env['PROGRAMFILES(X86)'] || process.env['PROGRAMFILES']

let REPACK_CACHE = path.join(BUILD_DIRECTORY, FS_BASEGAME + '-converted')
let DOWNLOAD_CACHE = path.join(BUILD_DIRECTORY)

function setRepack(directory) {
  REPACK_CACHE = directory
}
function setDownload(directory) {
  DOWNLOAD_CACHE = directory
}

function setGame(game) {
  FS_BASEGAME = game
}

function getGame() {
  return FS_BASEGAME
}

function repackedCache() {
  return REPACK_CACHE
}

function downloadCache() {
  return DOWNLOAD_CACHE
}


if(os.platform == 'win32') {
  FS_BASEPATH = 'C:/Program\ Files/Quake\ III\ Arena'
  STEAMPATH = path.join(PROGRAMPATH, '\/Steam\/steamapps\/common')
} else
if(os.platform == 'darwin') {
  FS_BASEPATH = '/Applications/ioquake3'
  STEAMPATH = path.join(FS_HOMEPATH, '/Library/Application\ Support/Steam/steamapps/common/Quake\ III\ Arena')
} else
if(os.platform == 'linux') {
  FS_BASEPATH = '/usr/local/games/quake3'
  STEAMPATH = path.join(FS_HOMEPATH, '/.steam/steam/SteamApps/common/quake3')
}

module.exports = {
  EXE_NAME,
  WEB_DIRECTORY,
  ASSETS_DIRECTORY,
  BUILD_DIRECTORY,
  FS_BASEPATH,
  STEAMPATH,
  setGame,
  getGame,
  repackedCache,
  downloadCache,
  setRepack,
  setDownload,

}
