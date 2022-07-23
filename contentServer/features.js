
const START_SERVICES = []

const SUPPORTED_SERVICES = [
  'downloads', 'holdup',
  'proxy', 'maps', 'master', 'mirror', 'dedicated',
  'redirect', 'games', 'content', 'repack', 'discord',
  'virtual', 'live', 'mods', 'palette', 'process', 
  'assets', 'metadata', 'logs', 'users', 'sitemap',
  'all', 'lvlshot',
]

const CONTENT_FEATURES = {
  'sitemap': {
    title: 'Site Map',
    subtitle: 'Feature List / Site map',
    link: 'sitemap',
    levelshot: `/build/sitemap.svg`,
  },
  'maps': {
    title: 'Maps',
    subtitle: 'Pk3 Server / Map upload',
    link: 'maps',
    levelshot: `/build/maps.svg`,
  },
  'games': {
    title: 'Games',
    subtitle: 'Game Server / Live spectate',
    link: 'games',
    levelshot: `/build/games.svg`,
  },
  'mods': {
    title: 'Mods',
    subtitle: 'Mods List / Supported games',
    link: 'mods',
    levelshot: `/build/mods.svg`,
  },
  'assets': {
    title: 'Assets',
    subtitle: 'Asset Server / Virtual pk3s',
    link: 'assets',
    levelshot: `/build/bundle.svg`,
  },
  'process': {
    title: 'Status',
    subtitle: 'Server Status / Current tasks',
    link: 'process',
    levelshot: `/build/tasks.svg`,
  },

}

// TODO: some sort of registration system?

function getFeatureFilter(features) {
  let featuresFiltered = (features || [])
  .concat(!features ? START_SERVICES : [])
  .concat((features || START_SERVICES).includes('all') ? SUPPORTED_SERVICES : [])
  .filter((s, i, arr) => arr.indexOf(s) == i)
  // do this to maintain the correct order
  let featureList = SUPPORTED_SERVICES
  .filter(f => featuresFiltered.includes(f))
  .map(f => CONTENT_FEATURES[f])
  .filter(f => f)
  return featureList
}


module.exports = {
  START_SERVICES,
  SUPPORTED_SERVICES,
  CONTENT_FEATURES,
  getFeatureFilter,
}
