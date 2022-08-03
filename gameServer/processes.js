const GAME_SERVERS = {}

const STATUS_MENU = [{
  title: 'Engines',
  subtitle: 'Download and build games engines',
  link: 'engines',
  levelshot: `/build/engine.svg`,
}, {
  title: 'Downloads',
  subtitle: 'Download Remote content',
  link: 'downloads',
  levelshot: `/build/downloads.svg`,
}, {
  title: 'Tasks',
  subtitle: 'Process Server / Transcoding',
  link: 'process',
  levelshot: `/build/tasks.svg`,
}, {
  title: 'Proxy',
  subtitle: 'Proxy Server',
  link: 'proxy',
  levelshot: `/build/proxy.svg`,
}, {
  title: 'Logs',
  subtitle: 'Error Logs / Notifications',
  link: 'logs',
  levelshot: `/build/logs.svg`,
}, {
  title: 'Users',
  subtitle: 'Users / Groups / Access',
  link: 'users',
  levelshot: `/build/users.svg`,
},]

const FILESYSTEM_WATCHERS = [{
  name: '(implied) Proxy Code Watcher',
  absolute: 'reload/proxy/.',
}, {
  name: '(implied) Game Code Watcher',
  absolute: 'reload/qvms/.',
}, {
  name: '(implied) Engine Code Watcher',
  absolute: 'reload/engine/.',
}, {
  name: '(implied) Content Watcher',
  absolute: 'reload/mounts/.',
}]

const EXECUTING_MAPS = {}
const RESOLVE_DEDICATED = {}

module.exports = {
  EXECUTING_MAPS,
  RESOLVE_DEDICATED,
  FILESYSTEM_WATCHERS,
  STATUS_MENU,
  GAME_SERVERS,
}