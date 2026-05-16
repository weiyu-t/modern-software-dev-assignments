# NetEase Music MCP

Local stdio or remote HTTP MCP server for quickly searching NetEase Cloud Music and fetching timestamped lyrics.

## What It Wraps

The implementation is based on the NetEase Music developer docs you linked, especially the pages for keyword search and lyric retrieval:

- `803202bd65bc469587d05b507dcd31e7`: lyric retrieval
- `ffd83c003331452d9d0bdb45e8ab1261`: comprehensive keyword search
- `b175e0d52550427cbb7cd4735a9de765`: keyword song search
- `ca7eda92ab634c0fbc1436c99fdaad5d`: keyword album search
- `a1c2bcb0e9b44c09a45b614c3d4f1784`: keyword artist search
- `a6d0565f06c54439b7c75c145b216995`: album song list
- `ba84444321a94ffea19f592e2f92b70a`: artist album list

For this assignment, the MCP focuses on the operations you said you wanted to make fast: searching songs, searching albums, searching artists, listing album songs, listing artist albums, and fetching lyrics. The NetEase web API adapter is isolated in `server/lib/neteaseClient.js` and `server/lib/neteaseCrypto.js`, so you can later replace it with official app-key signing if your developer account requires it.

## Prerequisites

- Node.js 20 or newer
- Network access to `https://music.163.com`

No npm install is required for the server itself. It uses only Node built-ins.

## Project Structure

```text
server/index.js              # stdio entrypoint
server/http.js               # HTTP entrypoint for remote deployment
server/mcpServer.js          # MCP JSON-RPC routing
server/tools/musicTools.js   # tool schemas and handlers
server/lib/neteaseClient.js  # NetEase HTTP client, timeouts, throttling
server/lib/neteaseCrypto.js  # NetEase weapi payload encryption
server/lib/normalizers.js    # response shaping
server/lib/validation.js     # tool input validation
server/lib/errors.js         # typed tool/upstream errors
server/lib/config.js         # server constants and env-backed settings
server/lib/logger.js         # stderr logging
```

## Run Locally With Stdio

```bash
npm start
```

That starts a stdio MCP server. It is meant to be launched by an MCP client, so it will wait for JSON-RPC messages on stdin.

To inspect it interactively:

```bash
npm run inspect
```

The inspector command uses `npx`, so it may download `@modelcontextprotocol/inspector` the first time.

## Run Tests

```bash
npm test
```

The test suite uses Node's built-in `node:test` runner and mocked NetEase clients, so it does not need network access.

## Environment Variables

| Name | Default | Purpose |
| --- | --- | --- |
| `NETEASE_TIMEOUT_MS` | `10000` | Maximum time to wait for a NetEase request. |
| `NETEASE_MIN_INTERVAL_MS` | `350` | Minimum delay between NetEase requests. |
| `USER_AGENT` | Browser-like default | User agent sent to NetEase. |
| `HOST` | `127.0.0.1` | HTTP host for `npm run start:http`. |
| `PORT` | `8787` | HTTP port for `npm run start:http`. |
| `MCP_AUTH_TOKEN` | unset | Optional bearer token for remote HTTP mode. |

## Run Remotely With HTTP

Start an HTTP MCP endpoint:

```bash
MCP_AUTH_TOKEN="change-me-to-a-long-random-secret" npm run start:http
```

By default it listens at:

```text
http://127.0.0.1:8787/mcp
```

Remote deployment hosts usually set `PORT` for you. You can also set:

```bash
HOST=0.0.0.0
PORT=8787
MCP_AUTH_TOKEN="change-me"
NETEASE_TIMEOUT_MS=10000
NETEASE_MIN_INTERVAL_MS=350
```

Health check:

```bash
curl http://127.0.0.1:8787/health
```

Example HTTP MCP request:

```bash
curl -X POST http://127.0.0.1:8787/mcp \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer change-me-to-a-long-random-secret' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

For a public deployment, always set `MCP_AUTH_TOKEN`. Without it, anyone who can reach the URL can call your MCP tools.

## Claude Desktop Config

Add this to your Claude Desktop MCP config:

```json
{
  "mcpServers": {
    "netease-music": {
      "command": "node",
      "args": [
        "/absolute/path/to/week3/server/index.js"
      ],
      "env": {
        "NETEASE_TIMEOUT_MS": "10000",
        "NETEASE_MIN_INTERVAL_MS": "350"
      }
    }
  }
}
```

Restart Claude Desktop after saving the config.

## Remote Client Config

For a remote MCP-aware client, configure:

```text
URL: https://your-domain.example/mcp
Authorization: Bearer your-long-random-secret
```

Exact config syntax depends on the client, but the HTTP server expects a JSON-RPC body at `POST /mcp`.

This HTTP entrypoint is designed for long-running Node hosts such as a VPS, Railway, Render, or Fly.io. Serverless platforms such as Vercel usually need a route-handler adapter instead of a process that calls `http.listen`.

## Tools

### `search_songs`

Search by song, artist, or mixed keyword.

Example input:

```json
{
  "keyword": "Stefanie Sun 遇见",
  "limit": 5
}
```

Returns song IDs, song names, artists, album names, duration, and NetEase song links.

### `search_albums`

Search by album, artist, or mixed keyword.

Example input:

```json
{
  "keyword": "Stefanie Sun Stefanie",
  "limit": 5
}
```

Returns album IDs, album names, artists, publish dates, song counts, and NetEase album links.

### `search_playlists`

Search playlists by keyword.

Example input:

```json
{
  "keyword": "Stefanie Sun covers",
  "limit": 5
}
```

Returns playlist IDs, names, creators, track counts, play counts, descriptions, cover images, and playlist links.

### `search_artists`

Search by artist name or alias.

Example input:

```json
{
  "keyword": "Stefanie Sun",
  "limit": 5
}
```

Returns artist IDs, names, aliases, music counts, album counts, images, and NetEase artist links.

### `get_song_detail`

Fetch richer metadata for one or more song IDs.

Example input:

```json
{
  "song_ids": [287035]
}
```

Returns normalized song metadata, aliases, album IDs, MV IDs, popularity, and privilege data.

### `get_album_songs`

Get songs from a known album ID.

Example input:

```json
{
  "album_id": 32772,
  "limit": 20
}
```

Returns album metadata plus song IDs, titles, artists, duration, fee status, and song links.

### `get_artist_albums`

Get albums from a known artist ID.

Example input:

```json
{
  "artist_id": 9272,
  "limit": 10
}
```

Returns artist metadata plus album IDs, names, artists, publish dates, song counts, and album links.

### `get_artist_top_songs`

Get popular songs from a known artist ID.

Example input:

```json
{
  "artist_id": 9272,
  "limit": 20
}
```

Returns artist metadata plus popular songs.

### `get_playlist_songs`

Get tracks from a known playlist ID.

Example input:

```json
{
  "playlist_id": 6792103822,
  "limit": 20,
  "offset": 0
}
```

Returns playlist metadata plus paged song details.

### `get_lyrics`

Fetch lyrics for a known song ID.

Example input:

```json
{
  "song_id": 287035,
  "include_translation": true
}
```

Returns timestamped lyric text and translated lyrics when available.

### `search_and_get_lyrics`

Search and fetch lyrics in one step.

Example input:

```json
{
  "keyword": "Stefanie Sun 遇见",
  "limit": 5,
  "pick": 0,
  "include_translation": false
}
```

Returns the selected song, alternative matches, and lyrics.

### `find_song_by_lyric_phrase`

Search candidate songs, fetch lyrics, and return matches containing a phrase.

Example input:

```json
{
  "keyword": "Stefanie Sun 遇见",
  "phrase": "我遇见谁",
  "limit": 5
}
```

Returns matching songs and the lyric lines where the phrase appears.

### `get_song_comments_summary`

Fetch hot and recent comments for a song.

Example input:

```json
{
  "song_id": 287035,
  "limit": 10
}
```

Returns total comment count, hot comments, and recent comments.

### `get_similar_songs`

Fetch NetEase similar-song recommendations for a song.

Example input:

```json
{
  "song_id": 287035,
  "limit": 10
}
```

Returns similar songs when NetEase has recommendations.

### `resolve_netease_url`

Parse a NetEase URL into a resource type and ID.

Example input:

```json
{
  "url": "https://music.163.com/#/artist?id=9272"
}
```

Returns the resource type, ID, original URL, and a suggested follow-up tool.

## Example Invocation Flow

In an MCP-aware client, ask:

```text
Use the NetEase Music MCP to search for "Stefanie Sun 遇见" and fetch the lyrics for the best match.
```

The client should call `search_and_get_lyrics`. If the first result is not the song you wanted, call it again with `pick: 1`, `pick: 2`, and so on.

## Reliability Notes

- The server validates required inputs and numeric bounds.
- Requests time out using `NETEASE_TIMEOUT_MS`.
- Calls are throttled with `NETEASE_MIN_INTERVAL_MS` to reduce rate-limit risk.
- Upstream HTTP failures, empty results, and NetEase error codes are returned as graceful tool errors.
- Logs go to stderr only, which keeps stdio MCP traffic clean.
- Remote HTTP mode supports bearer-token auth with `MCP_AUTH_TOKEN`.

## Limitations

- Some NetEase content can be region restricted, unavailable, or missing lyrics.
- This uses NetEase's web API behavior for a local personal tool. If your developer account provides official credentials or a different signing scheme, replace `postWeapi` in `server/lib/neteaseClient.js`.
