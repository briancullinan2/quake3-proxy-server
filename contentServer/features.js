
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
  'palette': {
    title: 'Shaders',
    subtitle: 'List Shaders / Palettes',
    link: 'palette',
    levelshot: `/build/shaders.svg`,
  },
  'mods': {
    title: 'Mods',
    subtitle: 'Mods List / Supported games',
    link: 'mods',
    levelshot: `/build/mods.svg`,
  },
  'metadata': {
    title: 'Metadata',
    subtitle: 'Metadata / List datas',
    link: 'metadata',
    levelshot: `/build/metadata.svg`,
  },
  'process': {
    title: 'Tasks',
    subtitle: 'Process Server / Transcoding',
    link: 'process',
    levelshot: `/build/tasks.svg`,
  },
  'assets': {
    title: 'Assets',
    subtitle: 'Asset Server / Virtual pk3s',
    link: 'assets',
    levelshot: `/build/bundle.svg`,
  },
  'logs': {
    title: 'Logs',
    subtitle: 'Error Logs / Notifications',
    link: 'logs',
    levelshot: `/build/logs.svg`,
  },
  'users': {
    title: 'Users',
    subtitle: 'Users / Groups / Access',
    link: 'users',
    levelshot: `/build/users.svg`,
  },
  'downloads': {
    title: 'Downloads',
    subtitle: 'Download Remote content',
    link: 'downloads',
    levelshot: `/build/downloads.svg`,
  },
  'proxy': {
    title: 'Proxy',
    subtitle: 'Proxy Server',
    link: 'proxy',
    levelshot: `/build/proxy.svg`,
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
