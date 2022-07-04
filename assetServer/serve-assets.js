const { renderIndex, renderFeature, renderMenu } = require('../utilities/render.js')
const { ASSET_MENU } = require('../contentServer/serve-settings.js')


// TODO: provide editor / viewer for selected file type

async function serveAssets(request, response, next) {
  let filename = request.originalUrl.replace(/\?.*$/, '')
  let ASSET_FEATURES = [{
    title: 'Virtual FS',
    subtitle: 'Combined baseq3/pak0.pk3dir',
    link: 'baseq3/pak0.pk3dir?index',
  }, {
    title: 'Repacked Cache',
    subtitle: 'On Demand Transcoding',
    link: 'repacked/baseq3/pak0.pk3dir?index',
  }, {
    title: 'Live Dev',
    subtitle: 'FS Watcher / Hot-reloading',
    link: 'build?index',
  }, {
    title: 'Directories',
    subtitle: 'Settings / Auto-detect',
    link: 'settings',
  }, {
    title: 'Downloads',
    subtitle: 'Find Remote content',
    link: 'downloads',
  }]

  return response.send(renderIndex(
    renderMenu(ASSET_MENU, 'asset-menu')
  + `<div class="loading-blur"><img src="/baseq3/pak0.pk3dir/levelshots/q3dm0.jpg"></div>
  <div class="info-layout">
  <h2>Asset server</h2>
  <p>By default, the server responds with a plain HTML page with links for the
  directory listing. For your convenience, and for the sake of navigation,
  entering the directory listing through this interface will continue to
  show the menu. At any time, the \`X\` button can be pressed to get a plain
  HTML directory list.</p>

  <ol id="assets-list" class="stream-list">${ASSET_FEATURES
    .map(renderFeature).join('')}</ol>

  <p>Each of these datas are associated with a number of source or endpoints
  those raw sources are made available at each endpoint by adding \`?json\`
  to the end of the URL, as the first part of the query-string. Links to 
  all the end-points and sample-data are provided in the sections below.
  For more detailed data, and data-manipulation tools, visit the metadata
  section.</p>
  <h2><a name="skins">Skins</a></h2>
  <p>Most popular player skins and character classes.</p>
  <h2><a name="arenas">Arenas</a></h2>
  <p>Maps with matching game-types and bots configured. TODO: all of them.</p>
  <h2><a name="matches">Matches</a></h2>
  <p>Recent games played with player rankings.</p>
  <h2><a name="games">Games</a></h2>
  <p>Playable games (Mods!) hosted on running servers.</p>

  <h3>Sample data</h3>
<pre>
/games/?json
[{
  bsp: "q3ctf2"
  have: false
  levelshot: "/unknownmap.jpg"
  link: "games/198.46.223.132:28408"
  mapname: "q3ctf2"
  title: "Lightning CTF"
}]
</pre>
  <p>This data is a small view of the data collected from querying servers for 
  detailed information. This view is built based on this full server data:
  </p>
<pre>
/servers/?json
[{
  address: "185.239.238.118"
  challenge: "!&814c)sQ"
  clients: "5"
  g_humanplayers: "0"
  g_needpass: "0"
  game: "TIGER-X"
  gamename: "Quake3Arena"
  gametype: "0"
  hostname: "ThunderCats-Fury"
  mapname: "q3dm5"
  port: 27888
  protocol: "68"
  pure: "0"
  sv_maxclients: "15"
  voip: "opus"
}]
</pre>
  </div>
  `))
}

module.exports = {
  serveAssets,
}