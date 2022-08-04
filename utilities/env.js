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

const TEMP_DIR = os.tmpdir()
const WEB_DIRECTORY = path.resolve(__dirname)
const ASSETS_DIRECTORY = path.resolve(__dirname + '/../../Quake3e/docs/')
const BUILD_DIRECTORY = path.resolve(__dirname + '/../../Quake3e/build/')
const FS_HOMEPATH = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
const FS_GAMEHOME = path.join(FS_HOMEPATH, '.q3a')
const LVLWORLD_DB = process.env.LVLWORLD || path.join(FS_HOMEPATH, '/quake3-discord-bot/lvlworldDB')
const PROGRAMPATH = process.env['PROGRAMFILES(X86)'] || process.env['PROGRAMFILES']
const STYLES = path.resolve(__dirname + '/../utilities/index.css')
const SCRIPTS = path.resolve(__dirname + '/../utilities/frontend.js')
const UNKNOWN = path.resolve(__dirname + '/../utilities/unknownmap.jpg')
const INDEX = fs.readFileSync(path.resolve(__dirname + '/../utilities/index.html')).toString('utf-8')
const REPACK_CACHE = [path.join(BUILD_DIRECTORY, FS_BASEGAME + '-converted')]
const DOWNLOAD_CACHE = [path.join(BUILD_DIRECTORY)]
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

const APPLICATIONS = []


function addCommon(application) {
  if (os.platform == 'win32') {
    APPLICATIONS.push.apply(APPLICATIONS, [{
      basepath: path.join('C:/Program\ Files', application),
    }, {
      basepath: path.join(PROGRAMPATH, '\/Steam\/steamapps\/common', application),
      steam: true,
    }])
  } else
    if (os.platform == 'darwin') {
      APPLICATIONS.push.apply(APPLICATIONS, [{
        basepath: path.join('/Applications', application)
      }, {
        basepath: path.join(FS_HOMEPATH, '/Library/Application\ Support/Steam/steamapps/common', application),
        steam: true,
      }])
    } else
      APPLICATIONS.push.apply(APPLICATIONS, [{
        basepath: path.join('/usr/local/games', application)
      }, {
        basepath: path.join(FS_HOMEPATH, '/.steam/steam/SteamApps/common', application),
        steam: true,
      }])
}

addCommon('Quake\ III\ Arena')
addCommon('quake3')
addCommon('ioquake3')
addCommon('UrbanTerror')
addCommon('Urban\ Terror')

const MODS = []
const MODS_NAMES = []
const MODS_DESCRIPTIONS = {}


/*


baseq3
Quake III Arena
(players|player)\/(sarge|major)
missionpack
0 Choice: Team Arena
(players|player)\/(sarge|james)
defrag
1 Choice: Defrag
baseq3r
2 Choice: Q3Rally
(players|player)\/(sidepipe)
basemod
3 Choice: Monkeys of Doom
generations
4 Choice: Generations Arena
q3f2
5 Choice: Q3 Fortress 2
cpma
6 Choice: Challenge ProMode
(players|player)\/(sarge|mynx)
q3ut4
7 Choice: Urban Terror 4
(players|player)\/(athena|orion)
freezetag
8 Choice: Freeze Tag
corkscrew
9 Choice: Corkscrew
freon
Excessive Plus: Freon
baseoa
Open Arena
(players|player)\/(sarge|gi)
bfpq3
Bid For Power
excessive
Excessive+
q3ut3
Urban Terror 3
edawn
eDawn
geoball
Geoball
neverball
Neverball
omissionpack
OpenArena Mission Pack
platformer
Platformer
legoc
Lego Carnage
osp
Orange Smoothie Productions
quake2arena
Quake 2 Arena
smokin
Smokin\' Guns
wfa
Weapons Factory Arena
uberarena
Uber Arena
demoq3
Quake III Demo
mfdata
Military Forces
conjunction
Dark Conjunction
chili
Chili Quake XXL
hqq
High Quality Quake
entityplus
Engine Of Creation: Entity Plus
wop
World of Padman
truecombat
True Combat 1.3
(tc_players|player)\/(sarge|alpha)
rocketarena
Coming Soon: Rocket Arena
gpp
Coming Soon: Tremulous
gppl
Coming Soon: Unvanquished
iortcw
Coming Soon: Return to Castle Wolfenstien
baset
Coming Soom: Wolfenstien: Enemy Territory
openjk
Coming Soon: Jedi Knights: Jedi Academy
baseef
Coming Soon: Star Trek: Elite Force
*/

const GAME_FORMATS = [
  '.pk3' // TODO: dlls and isos and roms
]

function refreshMods() {
  MODS.splice(0)
  MODS_NAMES.splice(0)
  Object.keys(MODS_DESCRIPTIONS).forEach(key => {
    delete MODS_DESCRIPTIONS[key]
  })
  for (let j = 0; j < APPLICATIONS.length; j++) {
    APPLICATIONS[j].mods = []
    if (!fs.existsSync(APPLICATIONS[j].basepath)
        || !fs.statSync(APPLICATIONS[j].basepath).isDirectory()) {
      continue
    }
    let appDirectory = fs.readdirSync(APPLICATIONS[j].basepath)
    for (let i = 0; i < appDirectory.length; i++) {
      let modDir = path.join(APPLICATIONS[j].basepath, appDirectory[i])
      let description = appDirectory[i]
      if (!fs.existsSync(modDir) || !fs.statSync(modDir).isDirectory()) {
        continue
      }
      let hasDescription = false
      if (fs.existsSync(path.join(modDir, 'description.txt'))) {
        hasDescription = true
        description = fs.readFileSync(path.join(modDir, 'description.txt'))
          .toString('utf-8').trim()
      }
      if (description
        || fs.readdirSync(modDir).filter(file => GAME_FORMATS.includes(
          path.extname(file.toLocaleLowerCase()))).length > 0) {
        MODS.push(appDirectory[i])
        APPLICATIONS[j].mods.push(appDirectory[i].toLocaleLowerCase())
        MODS_NAMES.push(appDirectory[i].toLocaleLowerCase())
        MODS_DESCRIPTIONS[appDirectory[i].toLocaleLowerCase()] = description
      }
    }
  }
}

refreshMods()

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
  DOMAIN,
  APPLICATIONS,
  EXPORT_DIRECTORY,
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
  FS_HOMEPATH,
  FS_GAMEHOME,
  STYLES,
  SCRIPTS,
  UNKNOWN,
  INDEX,
  MODS,
  MODS_NAMES,
  MODS_DESCRIPTIONS,
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
