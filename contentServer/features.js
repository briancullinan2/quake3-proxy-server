
const START_SERVICES = []

const SUPPORTED_SERVICES = [
  'downloads', 'holdup',
  'proxy', 'maps', 'master', 'mirror', 'dedicated',
  'redirect', 'games', 'content', 'repack', 'discord',
  'virtual', 'live', 'mods', 'palette', 'process', 
  'assets', 'metadata', 'logs', 'users', 'sitemap',
  'all'
]

const CONTENT_FEATURES = {
  'sitemap': {
    title: 'Site Map',
    subtitle: 'Feature List / Site map',
    link: 'sitemap',
    levelshot: ``,
  },
  'maps': {
    title: 'Pk3s',
    subtitle: 'Pk3 Server / Map upload',
    link: 'maps',
    levelshot: ``,
  },
  'games': {
    title: 'Games',
    subtitle: 'Game Server / Live spectate',
    link: 'games',
    levelshot: ``,
  },
  'palette': {
    title: 'Shaders',
    subtitle: 'List Shaders / Palettes',
    link: 'palette',
    levelshots: ``,
  },
  'mods': {
    title: 'Mods',
    subtitle: 'Mods List / Supported games',
    link: 'mods',
    levelshot: ``,
  },
  'metadata': {
    title: 'Metadata',
    subtitle: 'Metadata / List datas',
    link: 'metadata',
    levelshot: ``,
  },
  'process': {
    title: 'Tasks',
    subtitle: 'Process Server / Transcoding',
    link: 'process',
    levelshot: ``,
  },
  'assets': {
    title: 'Assets',
    subtitle: 'Asset Server / Virtual pk3s',
    link: 'assets',
    levelshot: ``,
  },
  'logs': {
    title: 'Logs',
    subtitle: 'Error Logs / Notifications',
    link: 'logs',
    levelshot: ``,
  },
  'users': {
    title: 'Users',
    subtitle: 'Users / Groups / Access',
    link: 'users',
    levelshot: ``,
  },
  'downloads': {
    title: 'Downloads',
    subtitle: 'Download Remote content',
    link: 'downloads',
    levelshot: ``,
  },
  'proxy': {
    title: 'Proxy',
    subtitle: 'Proxy Server',
    link: 'proxy',
    levelshot: ``,
  }
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
