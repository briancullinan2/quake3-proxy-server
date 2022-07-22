// TODO: some basic capability checking and
//   default config and file paths.
const fs = require('fs')
const path = require('path')
const os = require('os')
const process = require('process')

const EXE_NAME = 'quake3e' + (os.platform() == 'win32' ? '.exe' : '')
const DED_NAME = 'quake3e.ded' + (os.platform() == 'win32' ? '.exe' : '')

//let FS_BASEGAME = 'demoq3'
let FS_BASEGAME = 'baseq3'
let FS_BASEPATH = ''
let STEAMPATH = ''

const TEMP_DIR = os.tmpdir()
const WEB_DIRECTORY = path.resolve(__dirname)
const ASSETS_DIRECTORY = path.resolve(__dirname + '/../../Quake3e/docs/')
const BUILD_DIRECTORY = path.resolve(__dirname + '/../../Quake3e/build/')
const FS_HOMEPATH = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
const FS_GAMEHOME = path.join(FS_HOMEPATH, '.q3a')
const LVLWORLD_DB = process.env.LVLWORLD || path.join(FS_HOMEPATH, '/quake3-discord-bot/lvlworldDB')
const PROGRAMPATH = process.env['PROGRAMFILES(X86)'] || process.env['PROGRAMFILES']
const STYLES  = path.resolve(__dirname + '/../utilities/index.css')
const SCRIPTS = path.resolve(__dirname + '/../utilities/frontend.js')
const UNKNOWN = path.resolve(__dirname + '/../utilities/unknownmap.jpg')
const INDEX = fs.readFileSync(path.resolve(__dirname + '/../utilities/index.html')).toString('utf-8')
const REPACK_CACHE = [path.join(BUILD_DIRECTORY, FS_BASEGAME + '-converted')]
const DOWNLOAD_CACHE = [path.join(BUILD_DIRECTORY)]

function setRepack(directory) {
  REPACK_CACHE.splice(0)
  REPACK_CACHE.push(directory)
}
function setDownload(directory) {
  DOWNLOAD_CACHE.splice(0)
  DOWNLOAD_CACHE.push(directory)
}

function addDownload(directory) {
  DOWNLOAD_CACHE.push(directory)
}

function addRepacked(directory) {
  REPACK_CACHE.push(directory)
}

function setGame(game) {
  FS_BASEGAME = game
}

function getGame() {
  return FS_BASEGAME
}

const GAME_MODS = []

function getGames() {
  return [FS_BASEGAME].concat(GAME_MODS)
}

function addGame(game) {
  GAME_MODS.push(game)
}

function repackedCache() {
  return REPACK_CACHE
}

function downloadCache() {
  return DOWNLOAD_CACHE
}

let WATCHER_PID = process.pid
function setWatcherPID(pid) {
  WATCHER_PID = pid
}

function watcherPID() {
  return WATCHER_PID
}


let PUBLIC_REDIRECT = 'http://locahost:8080'

function setRedirect(redirect) {
  PUBLIC_REDIRECT = redirect
}

function redirectAddress() {
  return PUBLIC_REDIRECT
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


const MODS = []
const MODS_NAMES = []

if(fs.existsSync(FS_BASEPATH)
//    || fs.existsSync(STEAMPATH)
) {
  let appDirectory = fs.readdirSync(FS_BASEPATH)
  for(let i = 0; i < appDirectory.length; i++) {
    let modDir = path.join(FS_BASEPATH, appDirectory[i])
    if(fs.existsSync(modDir) 
        && fs.statSync(modDir).isDirectory()) {
      if(fs.existsSync(path.join(modDir, 'description.txt'))
        || fs.readdirSync(modDir)
          .filter(filename => filename.match(/\.pk3/i)).length > 0) {
        MODS.push(appDirectory[i])
        MODS_NAMES.push(appDirectory[i].toLocaleLowerCase())
      }
    }
  }
}


const SUPPORTED_FORMATS = [
  '.cfg', '.qvm', '.bot',
  '.txt', 
  '.shader', '.shaderx',
  '.crosshair', '.skin', '.font',
  '.config', '.menu',
  '.defi', // CPMA game mode definition
  '.arena', // map based game mode definition
  // these can be compiled in game to run bot AI
  '.c', '.h', '.scc', 
  // can load async
  // '.map', '.aas', '.md5', 
  // '.bsp', '.md3',  '.iqm', '.mdr',
]
const WEB_FORMATS = ['.js', '.wasm', '.css', '.html', '.jpg', '.png', '.jpeg', '.gif', '.svg']
const IMAGE_FORMATS = ['.jpeg', '.jpg', '.png', '.tga', '.dds', '.bmp']
const AUDIO_FORMATS = ['.wav', '.mp3', '.ogg', '.opus', '.flac']


module.exports = {
  TEMP_DIR,
  WEB_FORMATS,
  SUPPORTED_FORMATS,
  IMAGE_FORMATS,
  AUDIO_FORMATS,
  EXE_NAME,
  DED_NAME,
  GAME_MODS,
  WEB_DIRECTORY,
  ASSETS_DIRECTORY,
  BUILD_DIRECTORY,
  LVLWORLD_DB,
  FS_BASEPATH,
  FS_HOMEPATH,
  FS_GAMEHOME,
  STEAMPATH,
  STYLES,
  SCRIPTS,
  UNKNOWN,
  INDEX,
  MODS,
  MODS_NAMES,
  setGame,
  addGame,
  getGame,
  getGames,
  repackedCache,
  downloadCache,
  setRepack,
  setDownload,
  redirectAddress,
  setRedirect,
  addDownload,
  addRepacked,
  setWatcherPID,
  watcherPID,
}
