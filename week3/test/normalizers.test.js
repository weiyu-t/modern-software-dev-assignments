import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeAlbum,
  normalizeArtist,
  normalizePlaylist,
  normalizeSong,
  normalizeSongDetail,
} from "../server/lib/normalizers.js";

test("normalizes songs from legacy search response shape", () => {
  const result = normalizeSong({
    id: 5257138,
    name: "遇见",
    duration: 319039,
    fee: 8,
    artists: [{ name: "孙燕姿" }],
    album: { name: "男女情歌对唱冠军全记录" },
  });

  assert.deepEqual(result, {
    id: 5257138,
    name: "遇见",
    artists: ["孙燕姿"],
    album: "男女情歌对唱冠军全记录",
    duration_ms: 319039,
    fee: 8,
    url: "https://music.163.com/#/song?id=5257138",
  });
});

test("normalizes songs from modern detail response shape", () => {
  const result = normalizeSongDetail({
    id: 186114,
    name: "遇见",
    dt: 234253,
    fee: 0,
    ar: [{ name: "孙燕姿" }],
    al: { id: 18915, name: "Stefanie" },
    alia: ["Stefanie track"],
    mv: 143047,
    pop: 100,
  });

  assert.equal(result.album_id, 18915);
  assert.equal(result.mv_id, 143047);
  assert.deepEqual(result.aliases, ["Stefanie track"]);
  assert.equal(result.album, "Stefanie");
});

test("normalizes albums, artists, and playlists", () => {
  assert.deepEqual(normalizeAlbum({
    id: 18915,
    name: "Stefanie",
    publishTime: 1000396800000,
    size: 10,
    paid: false,
    artists: [{ name: "孙燕姿" }],
  }), {
    id: 18915,
    name: "Stefanie",
    artists: ["孙燕姿"],
    publish_time: "2001-09-13",
    song_count: 10,
    paid: false,
    url: "https://music.163.com/#/album?id=18915",
  });

  assert.equal(normalizeArtist({ id: 9272, name: "孙燕姿", alias: ["Stefanie Sun"] }).url, "https://music.163.com/#/artist?id=9272");
  assert.equal(normalizePlaylist({ id: 1, name: "mix", creator: { nickname: "me" }, trackCount: 2 }).creator, "me");
});
