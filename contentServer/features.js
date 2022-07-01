
const SUPPORTED_SERVICES = [
  'proxy', 'maps', 'master', 'mirror', 'dedicated',
  'redirect', 'games', 'content', 'repack', 'discord',
  'virtual', 'live', 'mods', 'palette', 'process', 
  'assets', 'metadata',
  'all'
]

const CONTENT_FEATURES = {
  'maps': {
    title: 'Pk3 Server / Map upload',
    link: 'maps',
    levelshot: ``,
  },
  'games': {
    title: 'Game Server / Live spectate',
    link: 'games',
    levelshot: ``,
  },
  'palette': {
    title: 'List Shaders / Palettes',
    link: 'palette',
    levelshots: ``,
  },
  'mods': {
    title: 'Mods List / Supported games',
    link: 'mods',
    levelshot: ``,
  },
  'metadata': {
    title: 'Metadata / List datas',
    link: 'metadata',
    levelshot: ``,
  },
  'process': {
    title: 'Process server / Transcoding',
    link: 'process',
    levelshot: ``,
  },
  'assets': {
    title: 'Asset server / Virtual pk3s',
    link: 'assets',
    levelshot: ``,
  }
}

// TODO: some sort of registration system?

module.exports = {
  SUPPORTED_SERVICES,
  CONTENT_FEATURES,
}
