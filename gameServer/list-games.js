
const fs = require('fs')
const path = require('path')
const { gameDirectories } = require('../assetServer/virtual.js')
const { calculateSize } = require('../utilities/async-size.js')
const { MODS, MODS_NAMES, getGames } = require('../utilities/env.js')

// TODO: combine with filteredGames from list-filtered

// TODO: replace with filteredGames + formattedGames() 
//   or something to add `size:` and promises
async function listGames(unexisting) {
  let zeroTimer = new Promise(resolve => setTimeout(
    resolve.bind(null, '0B (Calculating)'), 200))
  let promises = []
  let GAME_MODS = getGames()
  for(let j = 0; j < GAME_MODS.length; j++) {
    let GAME_ORDER = gameDirectories(GAME_MODS[j], unexisting)
    //let nonExistingGames = []
    //let includedGames = []
    for(let i = 0; i < GAME_ORDER.length; i++) {
      let exists = fs.existsSync(GAME_ORDER[i])
      // force the directory size calculations to queue in parallel
      //   i.e. only wait for setTimeout(calculating, 100) to run 1
      //   time overall, instead of 100ms every iteration.
      // page will return MUCH faster this way 
      async function returnPromise() {
        return {
          name: (exists === false ? '(unused) ' : '') 
            + path.basename(path.dirname(GAME_ORDER[i])) 
            + '/' + path.basename(GAME_ORDER[i]) + '/',
          mtime: exists ? fs.statSync(GAME_ORDER[i]).mtime : void 0,
          absolute: path.dirname(GAME_ORDER[i]),
          exists: exists,
          size: exists 
            // I had this idea, what if a page could take a specific amount of time,
            //   and the server only tries to get done what it thinks it can in that.
            ? await Promise.any([calculateSize(GAME_ORDER[i]), zeroTimer]) : void 0,
          link: GAME_MODS[j] + '/',
        }
      }
      promises.push(Promise.resolve(returnPromise()))
    }
  }
  return await Promise.all(promises)
}

// just has to load after the rest of the system
//   if it changes then watch.js will restart
let GAMES_NAMES


function listGameNames() {
  if(!GAMES_NAMES) {
    GAMES_NAMES = Object.values(MODS_NAMES).concat(getGames())
      .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
      .filter((mod, i, arr) => arr.indexOf(mod) == i)
      //.map(game => game.toLocaleLowerCase())

  }
  return GAMES_NAMES
}

// TODO: combine with above function for cleanliness

function filteredGames() {
  // TODO: rename this section to listGames()
  let gameNames = listGameNames()
  let games = gameNames
    .reduce((list, game, i) => {
      let devDirectories = gameDirectories(game)
      let first = {
        name: game,
        link: '/' + game + '/',
        isDirectory: true,
        absolute: '/.'
      }
      list.push(first)
      for (let j = 0; j < devDirectories.length; j++) {
        if (j == 0) {
          first.absolute = devDirectories[j]
          continue
        }
        list.push({
          name: path.basename(path.dirname(devDirectories[j])) + '/' + path.basename(devDirectories[j]),
          exists: false,
          link: '/' + game + '/',
          isDirectory: true,
          absolute: path.dirname(devDirectories[j])
        })
      }
      return list
    }, [])
  return games
}


module.exports = {
  listGames,
  filteredGames,
  listGameNames,
}