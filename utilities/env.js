// TODO: some basic capability checking and
//   default config and file paths.
const path = require('path')
const os = require('os')

const EXE_NAME = 'quake3e.ded' 
    + (os.platform() == 'win32' ? '.exe' : '')

let masters = ['ws://master.quakejs.com:27950', '207.246.91.235:27950', 'master.quake3arena.com']
let forward = 'http://local.games:8080'
let basegame = 'baseq3a'
let basepath = ''
let steampath = ''
let repackedCache = path.join(BUILD_DIRECTORY, basegame + '-converted')
let downloadCache = path.join(BUILD_DIRECTORY)

const WEB_DIRECTORY = path.resolve(__dirname)
const ASSETS_DIRECTORY = path.resolve(__dirname + '/../../docs/')
const BUILD_DIRECTORY = path.resolve(__dirname + '/../../build/')

const HOMEPATH = process.env.HOME || process.env.HOMEPATH 
  || process.env.USERPROFILE
const PROGRAMPATH = process.env['PROGRAMFILES(X86)'] || process.env['PROGRAMFILES']
const os = require('os')
if(os.platform == 'win32') {
  basepath = 'C:/Program\ Files/Quake\ III\ Arena'
  steampath = path.join(PROGRAMPATH, '\/Steam\/steamapps\/common')
} else
if(os.platform == 'darwin') {
  basepath = '/Applications/ioquake3'
  steampath = path.join(HOMEPATH, '/Library/Application\ Support/Steam/steamapps/common/Quake\ III\ Arena')
} else
if(os.platform == 'linux') {
  basepath = '/usr/local/games/quake3'
  steampath = path.join(HOMEPATH, '/.steam/steam/SteamApps/common/quake3')
}

module.exports = {
  EXE_NAME,

}
