# Quake 3 Proxy Server

There's a lot of hidden source code around hosting, rankings, and
uploaded content. This is an effort to mainstream some of the
features I've found exploring many idTech3-based game communities.

Personally, I've attempted to rewrite this manifest.json concept inherited 
from QuakeJS 3 times. It never felt quite right. There are too many parts of
the puzzle to keep them all in a single project.

For testing purposes, this server provides a good interface for testing each of
these components individually, or using the master server to mock connections and
launch the newly built client for automated integration testing.

WARNING: This is admittedly, terrible code. I don't really know what I'm doing here
until after it's been done. This being the 3rd time I've written this proxy server,
I still don't know what I'm doing. The file formats and layered directories make 
everything more complicate, I think. At least the existing code demonstrates the
layered file-system and live-reloading game engine.


## Components

- contentServer - serve traditional HTTP content using a layered file-system
similar to Quake 3's virtual file-system.

![content](./screenshot.png?raw=true)

![content](./screenshot2.png?raw=true)

- gameServer - list games like XQF / Gamedig. Simple process launcher for admins 
to host games at specific times.

![content](./screenshot3.png?raw=true)

- mapServer - map and model uploader, drag and drop files or folders. Lists maps
available for the masses to download. CDN-sourcing support?

![content](./screenshot4.png?raw=true)

- proxyServer - WebSocket and SOCKSv5 proxy server and reverse proxy 
for creating game servers within a corporate network.

- [quake3-discord-bot](https://github.com/briancullinan/quake3-proxy-server) - 
For more communication and live chatting with
discord servers, launching and connecting to games from discord.

## Background

When I started on QuakeJS, I was looking for a way to add
native dedicated servers (faster / optimized) to replace
the QuakeJS Emscripten build. I figured the WASM dedicated
server isn't necessary with a WebSocket to UDP proxy server.

But when I search for SOCKS control servers, I found tons of
existing solutions and none of them support WebSockets.
In principal, this is very similar to WebRTC. Despite the 
misconceptions due to how WebRTC is advertised, there is
actually still a control server using standard protocols
built on HTTP. This is not "serverless" like it implies.

Given QuakeJS design requiring a custom master server, I
thought it only makes sense to run them side-by-side as 
services aware of each other. That way, any client that
starts a browser server from "Create server" in game, 
can automatically display their server in the master server's 
list.

This is getting complicated. A proxy service is a short
leap from content delivery pipeline. If I'm running a proxy
server and allowing users to create game servers, how will
each server distribute content, or user created content, or
minimize duplicate content being transfered over my new proxy?

If I'm using a proxy solely for the purpose of accessing servers
listed in master, and subsequently, content from those
game servers, then my proxy server also needs to be aware of
content. Ugh. A wheel that has been reinvented over and over
and very few of those wheels are open-source. The best example
is probably [Q3Panel](https://github.com/JannoEsko/q3panel).
It is a general process runner, with some FTP EXEC complexity.

I'm not going to reinvent the process running wheel. But I 
want this project to be an all-in-one solution for game
content, without being "over-engineered".

## Asynchrounous image loader

It's worth calling out this issue with Emscripten, WebAssembly, but also specifically
in the context of Quake 3. One of the most awkwards APIs is OpenGL, there's something
like `reserveImage(); loadImage(); mipmapImage();` all in sequence. But web-browsers
load images asynchronously, so you have to reserve the spot for the image, and then
load it into GPU memory later. To make WebGL worse, if the image doesn't load, it
repeats a pattern of millions of transparent 1x1 pixels across the entire scene and
this slows down the GPU and the web browser to a crawl. Such an easy mistake can ruin
a gaming experience if it landed in production.

Because of all this, I have only converted the images to use a "manifest" file. In the form of an extra shader program that takes RGBA values from `palette.shader` and
replaces those nasty missing transparent images with solid plain colors to match
the average of the full (missing) image.


## TODO

* (DONE) Fix engine page transitions using History API
* Logs history tracker using [Vis.js](https://visjs.github.io/vis-timeline/docs/timeline/#Example)
* Engine cmd server and discord integration
* Finish links and extra pages
* 100,000+ world / map compatibility
* Game publishing services and engine menu overlay
* Automated match-making and new in-game UX
* Integrated development environment, map editor, code editor, self-hosted


<sup><sub>powered by [q3e](https://github.com/briancullinan/Quake3e)</sub></sup>
