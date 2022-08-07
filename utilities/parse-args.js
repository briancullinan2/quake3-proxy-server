const fs = require('fs')
const path = require('path')

const { HTTP_PORTS } = require('../contentServer/express.js')
const { MASTER_PORTS } = require('../gameServer/master.js')
const {
  setDownload, setRepack, downloadCache, repackedCache, setGame,
  addDownload, setWatcherPID, addRepacked, addGame, addProject,
  addRoute,
} = require('../utilities/env.js')

let forwardIP = ''
let noFS = false

function parseAguments(startArgs) {
  let relative = path.resolve(__dirname)
  if(typeof startArgs == 'string'
    && fs.existsSync(startArgs)) {
    relative = path.resolve(path.dirname(startArgs))
    startArgs = require(startArgs)
  }
  for (let i = 0; i < startArgs.length; i++) {
    let a = startArgs[i]
    switch (a) {
      case '--proxy-ip':
        console.log('Forwarding ip address: ', startArgs[i + 1])
        forwardIP = startArgs[i + 1]
        i++
        break
      case '--http-port':
        console.log('HTTP ports: ', startArgs[i + 1])
        HTTP_PORTS.splice(0)
        for (let i = 0; i < newPorts.length; i++) {
          HTTP_PORTS.push(parseInt(newPorts[i]))
        }
        i++
        break
      case '--master-port':
        console.log('Master port: ', startArgs[i + 1])
        MASTER_PORTS.splice(0)
        let newPorts = startArgs[i + 1].split(',')
        for (let i = 0; i < newPorts.length; i++) {
          MASTER_PORTS.push(parseInt(newPorts[i]))
        }
        i++
        break
      case '--masters':
        console.log('Master servers: ', startArgs[i + 1])
        masters = startArgs[i + 1].split(',')
        i++
        break
      case '--no-fs':
        console.log('Turning off file-system access.')
        noFS = true
        break
      case '--game':
        console.log('Basegame: ', startArgs[i + 1])
        setGame(startArgs[i + 1])
        i++
        break
      case '--add-project':
        console.log('Project / Engine: ', startArgs[i + 1])
        addProject(startArgs[i + 1])
        i++
        break
      case '--add-mod':
      case '--add-game':
        //console.log('Game mod: ', startArgs[i + 1])
        addGame(startArgs[i + 1])
        i++
        break
      case '--add-route':
        //console.log('Game mod: ', startArgs[i + 1])
        addRoute(startArgs[i + 1].concat([relative]))
        i++
        break
      case '--repack-cache':
        console.log('Repack cache: ', startArgs[i + 1])
        setRepack(startArgs[i + 1])
        if (!fs.existsSync(repackedCache()[0])) {
          console.log('WARNING: directory does not exist, unexpected behavior.')
        }
        i++
        break
      case '--download-cache':
        console.log('Download cache: ', startArgs[i + 1])
        setDownload(startArgs[i + 1])
        if (!fs.existsSync(downloadCache()[0])) {
          console.log('WARNING: directory does not exist, unexpect behavior.')
        }
        i++
        break
      case '--watcher-pid':
        console.log('Watcher PID: ', startArgs[i + 1])
        setWatcherPID(startArgs[i + 1])
        i++
        break
      case '--add-downloads':
        console.log('Download cache: ', startArgs[i + 1])
        addDownload(startArgs[i + 1])
        if (!fs.existsSync(startArgs[i + 1])) {
          console.log('WARNING: directory does not exist, unexpect behavior.')
        }
        i++
        break
      case '--add-repacked':
        console.log('Repacked cache: ', startArgs[i + 1])
        addRepacked(startArgs[i + 1])
        if (!fs.existsSync(startArgs[i + 1])) {
          console.log('WARNING: directory does not exist, unexpect behavior.')
        }
        i++
        break
    }
  }
}

module.exports = {
  parseAguments
}

