
const path = require('path')
const {DED_NAME, FS_BASEPATH, FS_GAMEHOME} = require('../utilities/env.js')
const {findFile} = require('../assetServer/virtual.js')
const RESOLVE_DEDICATED = []

async function serveDedicated(mapname) {
  let dedicated = findFile(DED_NAME)
  if(!dedicated) {
    throw new Error(DED_NAME + ' not found, build first')
  }
  return await new Promise(function (resolve, reject) {
    let cancelTimer = setTimeout(function () {
      reject(new Error('Start server timed out.'))
    }, 3000)
    try {
      if(RESOLVE_DEDICATED.length == 0) {
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


async function serveProcess() {
  // show basic process runner like Github Actions
  
}


module.exports = {
  RESOLVE_DEDICATED,
  serveDedicated,
}
