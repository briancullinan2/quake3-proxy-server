const { renderIndex, renderFeature, renderMenu } = require('../utilities/render.js')

// TODO: provide editor / viewer for selected file type

async function serveMetadata(request, response, next) {
  let filename = request.originalUrl.replace(/\?.*$/, '')
  let METADATA_FEATURES = [
    {
      title: 'Skins',
      link: 'metadata/#skins',
      subtitle: 'Asset streaming / Indexing'
    }, {
      title: 'Arenas',
      link: 'metadata/#arenas',
      subtitle: 'Map Validation / Parsing'
    }, {
      title: 'Matches',
      link: 'metadata/#matches',
      subtitle: 'Server Mocking / Recording'
    }, {
      title: 'Games',
      link: 'metadata/#games',
      subtitle: 'Master Servers / Mods'
    }
  ]
  return response.send(renderIndex(
  renderMenu(METADATA_FEATURES, 'metadata-menu')
  + `<div class="loading-blur"><img src="/baseq3/pak0.pk3dir/levelshots/q3dm0.jpg"></div>
  <div class="info-layout">
  <h2>Metadata</h2>
  <p>Each of the following pages demonstrates pulling data from multiple sources
  to make a coherant display. Otherwise, it would be simpler just to go out and
  find the information somewhere else. By combining the information here, this 
  makes the tool more useful, as well as demonstrates each piece of the game's 
  architecture.</p>

  <ol id="metadatas-list" class="stream-list">${METADATA_FEATURES
    .map(f => renderFeature(f)).join('')}</ol>

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
  serveMetadata,
}