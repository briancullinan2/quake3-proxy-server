// TODO: some basic capability checking and
//   default config and file paths.
const fs = require('fs')
const path = require('path')
const os = require('os')
const process = require('process')

const { START_SERVICES } = require('../contentServer/features.js')

const EXE_NAME = 'quake3e' + (os.platform() == 'win32' ? '.exe' : '')
const DED_NAME = 'quake3e.ded' + (os.platform() == 'win32' ? '.exe' : '')

//let FS_BASEGAME = 'demoq3'
let FS_BASEGAME = 'baseq3'

const TEMP_DIR = os.tmpdir()
const FS_HOMEPATH = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
const PROJECTS = [
  path.join(FS_HOMEPATH, 'Quake3e'), 
  path.resolve(__dirname) // /utilities/ not /root/ of project
] 
const FS_GAMEHOME = path.join(FS_HOMEPATH, '.q3a')
const LVLWORLD_DB = process.env.LVLWORLD || path.join(FS_HOMEPATH, '/quake3-discord-bot/lvlworldDB')
const PROGRAMPATH = process.env['PROGRAMFILES(X86)'] || process.env['PROGRAMFILES']
const STYLES = path.resolve(__dirname + '/../utilities/index.css')
const SCRIPTS = path.resolve(__dirname + '/../utilities/frontend.js')
const UNKNOWN = path.resolve(__dirname + '/../utilities/unknownmap.jpg')
const INDEX = fs.readFileSync(path.resolve(__dirname + '/../utilities/index.html')).toString('utf-8')
const REPACK_CACHE = []
const DOWNLOAD_CACHE = []
const EXPORT_DIRECTORY = path.join(__dirname, '/../docs/')

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
  if (!game) {
    throw new Error('No game set!')
  }
  FS_BASEGAME = game
}

function getGame() {
  return FS_BASEGAME
}

const GAME_FORMATS = [
  '.pk3', '.z64', '.he0', '.he1', '.he2', '.dmu', '.gba', // TODO: dlls and isos and roms
]

function filterGame(modDir) {
  if (!fs.existsSync(modDir)) {
    return
  }
  if(!fs.statSync(modDir).isDirectory()) {
    if(GAME_FORMATS.includes(path.extname(modDir.toLocaleLowerCase()))) {
      return path.basename(modDir).replace(path.extname(modDir), '')
    }
    return
  }
  if (fs.existsSync(path.join(modDir, 'description.txt'))) {
    return fs.readFileSync(path.join(modDir, 'description.txt'))
      .toString('utf-8').trim()
  }
  if (fs.readdirSync(modDir).filter(file => GAME_FORMATS.includes(
      path.extname(file.toLocaleLowerCase()))).length > 0) {
    return path.basename(modDir)
  }
}

function getBasepath(gamename) {
  for (let j = 0; j < PROJECTS.length; j++) {
    if (!fs.existsSync(PROJECTS[j]) 
        || !fs.statSync(PROJECTS[j]).isDirectory()) {
      continue
    }
    let appDirectory = fs.readdirSync(PROJECTS[j])
    for (let i = 0; i < appDirectory.length; i++) {
      if(gamename.localeCompare(appDirectory[i], 'en', {sensitivity: 'base'})) {
        continue
      }
      let modName = filterGame(path.join(PROJECTS[j], appDirectory[i]))
      if(modName) {
        return PROJECTS[j]
      }
    }
  }
}


const GAME_NAMES = {}

function addGame(game) {
  // just has to load after the rest of the system
  //   if it changes then watch.js will restart
  GAME_NAMES[game.toLocaleLowerCase()] = game
}


// TODO: CODE REVIEW: every time the program forks, it reloads this list at least once
//   from current data. Because of live-reloading, I can make better decisions in my 
//   design. For example, the other way to prevent this function from being called
//   hundreds of times is with parameter passing, and adding a bunch of references
//   to data inside every "class". This is lame because who cares where the memory 
//   reference comes from? Not me the programmer. Why should I add an extra parameter
//   to pass around a bunch of references to "static" data. What makes it static?
// Live reloading means every time the data is refreshed the entire program state
//   is also refreshed. Then, I am forced to cache what is frequently used in memory
//   and cache what is infrequently "refreshed" or reloaded on disk for loading at 
//   program start.
// I've philosophically drawn the line between what parts of my program are speedy and
//   indexed and which parts are redundant. Now discovering this redundancy with the 
//   performance recording tool makes reducing the number of calls to this procedure 
//   a piece of cake. I've verified through programming the API that this is redundant.

function getGames() {
  if(START_SERVICES.includes('deploy')) {
    let gameNames = [].concat(Object.keys(GAME_NAMES))
    gameNames.sort()
    return gameNames
  }

  // DUCK OUT EARLY WITH CACHE
  let gameNames = Object.keys(GAME_NAMES)
  if(gameNames.length > 0) {
    return gameNames
  }

  // recompute list from disk
  for (let j = 0; j < PROJECTS.length; j++) {
    if (!fs.existsSync(PROJECTS[j]) 
        || !fs.statSync(PROJECTS[j]).isDirectory()) {
      continue
    }
    let appDirectory = fs.readdirSync(PROJECTS[j])
    for (let i = 0; i < appDirectory.length; i++) {
      let basename = appDirectory[i].toLocaleLowerCase()
      let modName = filterGame(path.join(PROJECTS[j], appDirectory[i]))
      if(!modName) {
        continue
      }
      GAME_NAMES[basename] = modName.replace(/\s*\[\!\]\s*/gi, '').replace(/\s*\(U\)\s*/gi, '')
        // TODO: make API?
          .replace(/\s*\(3DO\)\s*/gi, '').replace(/\s*\(cd dos\)\s*/gi, '')
          .replace(/\s*\(cd windows\)\s*/gi, '')
      if(!gameNames.includes(basename)) {
        gameNames.push(basename)
      }
    }
  }
  gameNames.sort()
  return gameNames
}

function addProject(project) {
  let addProjects = []

  addProjects.push(path.resolve(project))
  addProjects.push(path.join(FS_HOMEPATH, project))
  addProjects.push(path.resolve(path.join(__dirname, '/../../', project)))
  if (os.platform == 'win32') {
    addProjects.push(path.join('C:/Program\ Files', project))
    addProjects.push(path.join(PROGRAMPATH, '\/Steam\/steamapps\/common', project))
  } else
    if (os.platform == 'darwin') {
      addProjects.push(path.join('/Applications', project))
      addProjects.push(path.join(FS_HOMEPATH, '/Library/Application\ Support/Steam/steamapps/common', project))
    } else {
      addProjects.push(path.join('/usr/local/games', project))
      addProjects.push(path.join(FS_HOMEPATH, '/.steam/steam/SteamApps/common', project))
    }

  let newProjects = addProjects.filter(fs.existsSync)
  if(!newProjects.length) {
    console.log('WARNING: directory does not exist, unexpected behavior: ' + project)
  }
  PROJECTS.push.apply(PROJECTS, newProjects)
}


//addProject('Quake\ III\ Arena')
//addProject('quake3')
//addProject('ioquake3')
//addProject('UrbanTerror')
//addProject('Urban\ Terror')
//addProject(path.join(FS_HOMEPATH, '/Documents/Roms/N64 Roms'))
//addProject(path.join(FS_HOMEPATH, '/Downloads/Putt-Putt for ScummVM'))
//addProject(path.join(FS_HOMEPATH, '/Downloads/Coin Ops Gameboy Advance/GBA Roms'))

const ROUTES = []
function addRoute(plugin) {
  ROUTES.push(plugin)
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



const SUPPORTED_FORMATS = [
  '.cfg', '.qvm', '.jts', '.bot',
  '.txt', '.hit',
  '.shader', '.shaderx',
  '.crosshair', '.skin', '.font',
  '.config', '.menu',
  '.defi', // CPMA game mode definition
  '.arena', // map based game mode definition
  // these can be compiled in game to run bot AI
  '.c', '.h', '.scc',
  // camera files
  '.cam',
  // can load async, but new repacking system includes small ones
  '.map', '.aas', '.md5',
  '.bsp', '.md3', '.iqm', '.mdr',
]
const WEB_FORMATS = ['.js', '.wasm', '.css', '.html', '.jpg', '.png', '.jpeg', '.gif', '.svg']
const IMAGE_FORMATS = ['.jpeg', '.jpg', '.png', '.tga', '.dds', '.bmp']
const AUDIO_FORMATS = ['.wav', '.mp3', '.ogg', '.opus', '.flac']

let DOMAIN = 'http://127.0.0.1:8080'


module.exports = {
  GAME_NAMES,
  ROUTES,
  DOMAIN,
  EXPORT_DIRECTORY,
  TEMP_DIR,
  WEB_FORMATS,
  SUPPORTED_FORMATS,
  IMAGE_FORMATS,
  AUDIO_FORMATS,
  EXE_NAME,
  DED_NAME,
  PROJECTS,
  LVLWORLD_DB,
  FS_HOMEPATH,
  FS_GAMEHOME,
  STYLES,
  SCRIPTS,
  UNKNOWN,
  INDEX,
  addRoute,
  addProject,
  setGame,
  addGame,
  getGame,
  getGames,
  repackedCache,
  downloadCache,
  getBasepath,
  setRepack,
  setDownload,
  redirectAddress,
  setRedirect,
  addDownload,
  addRepacked,
  setWatcherPID,
  watcherPID,
}
