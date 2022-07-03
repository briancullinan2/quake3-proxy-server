
const { DED_NAME, watcherPID } = require('../utilities/env.js')
const { findFile } = require('../assetServer/virtual.js')
const { renderIndex } = require('../utilities/render.js')
const { EXTRACTING_ZIPS } = require('../utilities/zip.js')


const RESOLVE_DEDICATED = []


async function serveDedicated(mapname) {
  let dedicated = findFile(DED_NAME)
  if (!dedicated) {
    throw new Error(DED_NAME + ' not found, build first')
  }
  return await new Promise(function (resolve, reject) {
    let cancelTimer = setTimeout(function () {
      reject(new Error('Start server timed out.'))
    }, 3000)
    try {
      if (RESOLVE_DEDICATED.length == 0) {
        console.log('Starting ', dedicated)
        dedicatedCmd(dedicated, mapname)
      }
      RESOLVE_DEDICATED.push(function () {
        clearTimeout(cancelTimer)
        console.log('Dedicated started.')
        resolve()
      })
    } catch (e) {
      console.log(e)
      clearTimeout(cancelTimer)
      return reject(e)
    }
  })
}


async function serveProcess(request, response, next) {
  // show basic process runner like Github Actions
  let processes = [{
    name: 'Watcher',
    assignments: watcherPID(),
  }, {
    name: 'Application',
    assignments: process.pid,
  }]
  let zips = Object.keys(EXTRACTING_ZIPS).map(zip => {
    return {
      name: zip,
      assignments: process.pid,
    }
  })
  return response.send(renderIndex(
    //renderMenu(PROXY_MENU, 'downloads-menu')
    //+ 
    `<div class="loading-blur"><img src="/baseq3/pak0.pk3dir/levelshots/q3dm0.jpg"></div>
    <div class="info-layout">
    <h2>Task List</h2>
    <ol class="directory-list">${processes.map(renderProcess).join('\n')}
    </ol>
    <h3>Working ZIPs</3>
    <ol class="directory-list">${zips.map(renderProcess).join('\n')}
    </ol>
    
    </div>
    `))
}

function renderProcess(node) {
  let result = '<li>'
  if (node.name.endsWith('/') || typeof node.size == 'undefined') {
    result += `<a href="${node.link}?index">${node.name}</a>`
    result += `<span>&nbsp;</span>`
  } else {
    result += `<a href="${node.link}?alt">${node.name}</a>`
    result += `<span>${formatSize(node.size)}</span>`
  }
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
  RESOLVE_DEDICATED,
  serveDedicated,
  serveProcess,
}
