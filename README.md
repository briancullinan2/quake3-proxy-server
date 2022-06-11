# Quake 3 Proxy Server

There's a lot of hidden source code around hosting, rankings, and
uploaded content. This is an effort to mainstream some of the
features I've found exploring many idTech3-based game communities.

## Components

- contentServer - serve traditional HTTP content using a layered file-system
similar to Quake 3's virtual file-system.

- gameServer - list games like XQF / Gamedig. Simple process launcher for admins 
to host games at specific times.

- mapServer - map and model uploader, drag and drop files or folders. Lists maps
available for the masses to download. CDN-sourcing support?

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


