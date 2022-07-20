const path = require('path')

const { watcherPID } = require('../utilities/env.js')
const { renderIndex } = require('../utilities/render.js')
const { EXTRACTING_ZIPS } = require('../utilities/zip.js')
const { CHILD_PROCESS } = require('../utilities/exec.js')
const { EXECUTING_MAPS, RESOLVE_DEDICATED, dedicatedCmd } = require('../cmdServer/cmd-dedicated.js')
const buildChallenge = require('../quake3Utils/generate-challenge.js')
const { GAME_SERVERS, SERVER_LOGS } = require('../gameServer/processes.js')
const { updatePageViewers } = require('../contentServer/session.js')

async function serveDedicated() {
  try {
    if (RESOLVE_DEDICATED.length == 0) {
      let challenge = buildChallenge()
      let ps = await dedicatedCmd([
        '+set', 'dedicated', '2',
        '+set', 'sv_master2', '"207.246.91.235:27950"',
        '+set', 'sv_master3', '"ws://master.quakejs.com:27950"',
        '+sets', 'qps_serverId', challenge,
        '+set', 'rconPassword2', 'password1',
        '+map', 'lsdm3_v1', 
        '+wait', '300', '+heartbeat',
      ], function (lines) {
        SERVER_LOGS[challenge] += lines + '\n'
        updatePageViewers('/rcon')
      })
      ps.on('close', function () {
        delete SERVER_LOGS[challenge]
        delete EXECUTING_MAPS[challenge]
      })
      SERVER_LOGS[challenge] = ''
      EXECUTING_MAPS[challenge] = {
        challenge: challenge,
        pid: ps.pid,
        mapname: 'lsdm3_v1',
      }
    }
  } catch (e) {
    console.error(e)
  }
}

async function serveProcess(request, response, next) {
  // show basic process runner like Github Actions
  let processes = [{
    name: 'Watcher',
    assignments: watcherPID(),
  }, {
    name: 'Application',
    assignments: process.pid,
  }].concat(Object.keys(CHILD_PROCESS).map(cp => {
    return {
      name: CHILD_PROCESS[cp],
      assignments: cp,
    }
  }))
  let zips = Object.keys(EXTRACTING_ZIPS).map(zip => {
    return {
      name: zip,
      assignments: process.pid,
    }
  })
  let engines = Object.keys(EXECUTING_MAPS)
  .map(zip => {
    let challenge = EXECUTING_MAPS[zip].challenge
    let pid = EXECUTING_MAPS[zip].pid
    let serverInfo = Object.values(GAME_SERVERS)
        .filter(server => server.qps_serverId == challenge)[0]
    if(!serverInfo) {
      return
    }
    return {
      name: zip,
      assignments: pid,
      link: path.join('/games/', serverInfo.address + ':' + serverInfo.port)
    }
  })
  .filter(zip => zip)

  return response.send(renderIndex(
    //renderMenu(PROXY_MENU, 'downloads-menu')
    //+ 
    `<div class="loading-blur"><img src="/baseq3/pak0.pk3dir/levelshots/q3dm0.jpg"></div>
    <div class="info-layout">
    <h2>Task List</h2>
    <ol class="directory-list">${processes.map(renderProcess).join('\n')}
    </ol>
    <h3>Running Engines</h3>
    <ol class="directory-list">${engines.map(renderProcess).join('\n')}
    </ol>
    <h3>Working ZIPs</h3>
    <ol class="directory-list">${zips.map(renderProcess).join('\n')}
    </ol>
    <h3>Image Converter</h3>
    <ol class="directory-list">
    </ol>
    </div>
    `))
}

function renderProcess(node) {
  let result = '<li>'
  result += `<a href="${node.link}">${node.name}</a>`
  result += `<span>${typeof node.size == 'undefined' 
    ? '&nbsp;' : formatSize(node.size)}</span>`
if (typeof node.mtime != 'undefined') {
    result += `<span>${node.mtime.getMonth() + 1}/${node.mtime.getDate()} `
    result += `${node.mtime.getHours()}:${node.mtime.getMinutes()}</span>`
  } else {
    result += `<span>&nbsp;</span>`
  }
  result += `<span>${node.assignments}</span>`
  result += '</li>'
  return result
}

module.exports = {
  serveDedicated,
  serveProcess,
}
