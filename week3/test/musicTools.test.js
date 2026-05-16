import test from "node:test";
import assert from "node:assert/strict";

import { callTool } from "../server/tools/musicTools.js";

function fakeClient(responses) {
  const calls = [];
  return {
    calls,
    async postWeapi(path, data) {
      calls.push({ method: "postWeapi", path, data });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return response ?? {};
    },
    async getJson(path, params) {
      calls.push({ method: "getJson", path, params });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return response ?? {};
    },
  };
}

test("search_songs calls NetEase search type 1 and normalizes results", async () => {
  const client = fakeClient([
    {
      result: {
        songCount: 1,
        songs: [
          {
            id: 5257138,
            name: "遇见",
            artists: [{ name: "孙燕姿" }],
            album: { name: "The Moment" },
            duration: 319039,
            fee: 8,
          },
        ],
      },
    },
  ]);

  const result = await callTool(client, "search_songs", { keyword: "遇见", limit: 1 });

  assert.equal(client.calls[0].path, "/weapi/search/get?csrf_token=");
  assert.equal(client.calls[0].data.type, 1);
  assert.equal(result.total, 1);
  assert.equal(result.songs[0].id, 5257138);
});

test("search_playlists calls search type 1000", async () => {
  const client = fakeClient([
    {
      result: {
        playlistCount: 1,
        playlists: [{ id: 123, name: "Stefanie mix", creator: { nickname: "listener" }, trackCount: 10 }],
      },
    },
  ]);

  const result = await callTool(client, "search_playlists", { keyword: "Stefanie", limit: 1 });

  assert.equal(client.calls[0].data.type, 1000);
  assert.equal(result.playlists[0].creator, "listener");
});

test("get_playlist_songs pages through trackIds and fetches song details", async () => {
  const client = fakeClient([
    {
      playlist: {
        id: 10,
        name: "mix",
        trackIds: [{ id: 1 }, { id: 2 }, { id: 3 }],
      },
    },
    {
      songs: [
        { id: 2, name: "B", ar: [{ name: "Artist" }], al: { name: "Album" }, dt: 200 },
        { id: 3, name: "C", ar: [{ name: "Artist" }], al: { name: "Album" }, dt: 300 },
      ],
    },
  ]);

  const result = await callTool(client, "get_playlist_songs", { playlist_id: 10, offset: 1, limit: 2 });

  assert.equal(client.calls[1].path, "/weapi/v3/song/detail?csrf_token=");
  assert.deepEqual(JSON.parse(client.calls[1].data.ids), [2, 3]);
  assert.equal(result.total, 3);
  assert.deepEqual(result.songs.map((song) => song.id), [2, 3]);
});

test("find_song_by_lyric_phrase composes search and lyrics calls", async () => {
  const client = fakeClient([
    {
      result: {
        songs: [
          { id: 1, name: "Song A", artists: [{ name: "A" }], album: { name: "Album" } },
          { id: 2, name: "Song B", artists: [{ name: "B" }], album: { name: "Album" } },
        ],
      },
    },
    { lrc: { lyric: "[00:01.00]hello roof\n[00:02.00]bye" } },
    { lrc: { lyric: "[00:01.00]nothing here" } },
  ]);

  const result = await callTool(client, "find_song_by_lyric_phrase", {
    keyword: "roof",
    phrase: "roof",
    limit: 2,
  });

  assert.equal(result.searched, 2);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].song.id, 1);
  assert.equal(result.matches[0].lyric_matches[0].text, "hello roof");
});

test("resolve_netease_url parses hash URLs and suggests follow-up tools", async () => {
  const result = await callTool(fakeClient([]), "resolve_netease_url", {
    url: "https://music.163.com/#/playlist?id=6792103822",
  });

  assert.deepEqual(result, {
    type: "playlist",
    id: 6792103822,
    url: "https://music.163.com/#/playlist?id=6792103822",
    suggested_tool: "get_playlist_songs",
  });
});
