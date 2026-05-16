import {
  fallbackAlbum,
  fallbackArtist,
  normalizeAlbum,
  normalizeArtist,
  normalizeComment,
  normalizePlaylist,
  normalizeSong,
  normalizeSongDetail,
} from "../lib/normalizers.js";
import { InputError } from "../lib/errors.js";
import { booleanArg, integerArg, stringArg } from "../lib/validation.js";

// This module is the tool layer: schemas shown to MCP clients plus handlers
// that validate args, call NeteaseClient, and normalize responses.
function paginateItems(items, offset, limit) {
  return items.slice(offset, offset + limit);
}

function stripLrcTimestamp(line) {
  return line.replace(/^\[[0-9:.]+\]\s*/, "");
}

function lyricLinesContaining(lyric, phrase) {
  const normalizedPhrase = phrase.toLowerCase();
  return lyric
    .split(/\r?\n/)
    .map((line) => ({ raw: line, text: stripLrcTimestamp(line).trim() }))
    .filter((line) => line.text.toLowerCase().includes(normalizedPhrase));
}

function parseNeteaseUrl(input) {
  const raw = String(input ?? "").trim();
  if (!raw) throw new InputError("url is required");

  const fallbackMatch = raw.match(/(?:song|album|artist|playlist)\?id=(\d+)/);
  const parsed = new URL(raw);
  const id = parsed.searchParams.get("id") ?? fallbackMatch?.[1];

  if (!id) throw new InputError("Could not find a NetEase id in the URL");

  const pathAndHash = `${parsed.pathname}${parsed.hash}`;
  const candidates = [
    ["song", /\/song|#\/song/],
    ["album", /\/album|#\/album/],
    ["artist", /\/artist|#\/artist/],
    ["playlist", /\/playlist|#\/playlist/],
  ];
  const match = candidates.find(([, pattern]) => pattern.test(pathAndHash));
  if (!match) throw new InputError("Supported URL types are song, album, artist, and playlist");

  return { type: match[0], id: Number(id), url: raw };
}

async function searchSongs(client, args) {
  const keyword = stringArg(args, "keyword");
  const limit = integerArg(args, "limit", 5, { min: 1, max: 20 });
  const offset = integerArg(args, "offset", 0);

  // NetEase search type 1 means songs.
  const data = await client.postWeapi("/weapi/search/get?csrf_token=", {
    s: keyword,
    type: 1,
    limit,
    offset,
    total: true,
  });

  const songs = data.result?.songs ?? [];
  return {
    keyword,
    total: data.result?.songCount ?? songs.length,
    songs: songs.map(normalizeSong),
    warning: songs.length === 0 ? "No songs were returned. Try a simpler keyword or include the artist name." : undefined,
  };
}

async function searchPlaylists(client, args) {
  const keyword = stringArg(args, "keyword");
  const limit = integerArg(args, "limit", 5, { min: 1, max: 20 });
  const offset = integerArg(args, "offset", 0);

  // NetEase search type 1000 means playlists.
  const data = await client.postWeapi("/weapi/search/get?csrf_token=", {
    s: keyword,
    type: 1000,
    limit,
    offset,
    total: true,
  });

  const playlists = data.result?.playlists ?? [];
  return {
    keyword,
    total: data.result?.playlistCount ?? playlists.length,
    playlists: playlists.map(normalizePlaylist),
    warning: playlists.length === 0 ? "No playlists were returned. Try a broader keyword." : undefined,
  };
}

async function searchArtists(client, args) {
  const keyword = stringArg(args, "keyword");
  const limit = integerArg(args, "limit", 5, { min: 1, max: 20 });
  const offset = integerArg(args, "offset", 0);

  // NetEase search type 100 means artists.
  const data = await client.postWeapi("/weapi/search/get?csrf_token=", {
    s: keyword,
    type: 100,
    limit,
    offset,
    total: true,
  });

  const artists = data.result?.artists ?? [];
  return {
    keyword,
    total: data.result?.artistCount ?? artists.length,
    artists: artists.map(normalizeArtist),
    warning: artists.length === 0 ? "No artists were returned. Try a simpler keyword or a localized artist name." : undefined,
  };
}

async function searchAlbums(client, args) {
  const keyword = stringArg(args, "keyword");
  const limit = integerArg(args, "limit", 5, { min: 1, max: 20 });
  const offset = integerArg(args, "offset", 0);

  // NetEase search type 10 means albums.
  const data = await client.postWeapi("/weapi/search/get?csrf_token=", {
    s: keyword,
    type: 10,
    limit,
    offset,
    total: true,
  });

  const albums = data.result?.albums ?? [];
  return {
    keyword,
    total: data.result?.albumCount ?? albums.length,
    albums: albums.map(normalizeAlbum),
    warning: albums.length === 0 ? "No albums were returned. Try a simpler keyword or include the artist name." : undefined,
  };
}

async function getSongDetail(client, args) {
  const rawSongIds = args.song_ids ?? args.songIds;
  const songIds = rawSongIds
    ? (Array.isArray(rawSongIds) ? rawSongIds : String(rawSongIds).split(","))
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    : [integerArg(args, ["song_id", "songId"], undefined, { min: 1 })].filter(Boolean);

  if (songIds.length === 0) throw new InputError("song_id or song_ids is required");
  if (songIds.length > 50) throw new InputError("song_ids can include at most 50 IDs");

  const data = await client.postWeapi("/weapi/v3/song/detail?csrf_token=", {
    c: JSON.stringify(songIds.map((id) => ({ id }))),
    ids: JSON.stringify(songIds),
  });

  const songs = data.songs ?? [];
  return {
    requested_ids: songIds,
    songs: songs.map(normalizeSongDetail),
    privileges: data.privileges ?? [],
    warning: songs.length === 0 ? "No song details were returned." : undefined,
  };
}

async function getAlbumSongs(client, args) {
  const albumId = integerArg(args, ["album_id", "albumId"], undefined, { min: 1 });
  if (!albumId) throw new InputError("album_id is required");

  const limit = integerArg(args, "limit", 50, { min: 1, max: 100 });
  const offset = integerArg(args, "offset", 0);

  const data = await client.postWeapi(`/weapi/v1/album/${albumId}?csrf_token=`, {});
  const album = data.album;
  // The encrypted album endpoint may put songs either under album.songs or
  // top-level songs depending on response shape.
  const songs = album?.songs?.length ? album.songs : (data.songs ?? []);

  return {
    album: album ? normalizeAlbum(album) : fallbackAlbum(albumId),
    total: songs.length,
    offset,
    limit,
    songs: paginateItems(songs, offset, limit).map(normalizeSong),
    warning: songs.length === 0 ? "No songs were returned for this album." : undefined,
  };
}

async function getPlaylistSongs(client, args) {
  const playlistId = integerArg(args, ["playlist_id", "playlistId"], undefined, { min: 1 });
  if (!playlistId) throw new InputError("playlist_id is required");

  const limit = integerArg(args, "limit", 50, { min: 1, max: 100 });
  const offset = integerArg(args, "offset", 0);

  const data = await client.postWeapi("/weapi/v6/playlist/detail?csrf_token=", {
    id: playlistId,
    n: 100000,
    s: 0,
  });

  const playlist = data.playlist;
  const trackIds = playlist?.trackIds?.map((track) => track.id).filter(Boolean) ?? [];
  const pageIds = paginateItems(trackIds, offset, limit);
  const detailData = pageIds.length
    ? await client.postWeapi("/weapi/v3/song/detail?csrf_token=", {
        c: JSON.stringify(pageIds.map((id) => ({ id }))),
        ids: JSON.stringify(pageIds),
      })
    : null;
  const tracks = detailData?.songs ?? paginateItems(playlist?.tracks ?? [], offset, limit);
  return {
    playlist: playlist ? normalizePlaylist(playlist) : { id: playlistId },
    total: trackIds.length || playlist?.tracks?.length || 0,
    offset,
    limit,
    songs: tracks.map(normalizeSong),
    warning: tracks.length === 0 ? "No playlist tracks were returned. Large playlists may require official APIs for full paging." : undefined,
  };
}

async function getArtistAlbums(client, args) {
  const artistId = integerArg(args, ["artist_id", "artistId"], undefined, { min: 1 });
  if (!artistId) throw new InputError("artist_id is required");

  const limit = integerArg(args, "limit", 20, { min: 1, max: 50 });
  const offset = integerArg(args, "offset", 0);

  const data = await client.getJson(`/api/artist/albums/${artistId}`, {
    id: artistId,
    limit,
    offset,
  });
  const albums = data.hotAlbums ?? [];

  return {
    artist: data.artist ? normalizeArtist(data.artist) : fallbackArtist(artistId),
    total_returned: albums.length,
    offset,
    limit,
    more: Boolean(data.more),
    albums: albums.map(normalizeAlbum),
    warning: albums.length === 0 ? "No albums were returned for this artist." : undefined,
  };
}

async function getArtistTopSongs(client, args) {
  const artistId = integerArg(args, ["artist_id", "artistId"], undefined, { min: 1 });
  if (!artistId) throw new InputError("artist_id is required");

  const limit = integerArg(args, "limit", 20, { min: 1, max: 100 });
  const offset = integerArg(args, "offset", 0);

  const data = await client.postWeapi(`/weapi/v1/artist/${artistId}?csrf_token=`, {});
  const songs = data.hotSongs ?? [];
  return {
    artist: data.artist ? normalizeArtist(data.artist) : fallbackArtist(artistId),
    total: songs.length,
    offset,
    limit,
    songs: paginateItems(songs, offset, limit).map(normalizeSong),
    warning: songs.length === 0 ? "No top songs were returned for this artist." : undefined,
  };
}

async function getLyrics(client, args) {
  const songId = integerArg(args, ["song_id", "songId"], undefined, { min: 1 });
  if (!songId) throw new InputError("song_id is required");

  const includeTranslation = booleanArg(args, ["include_translation", "includeTranslation"]);
  const data = await client.postWeapi("/weapi/song/lyric?csrf_token=", {
    id: songId,
    lv: -1,
    tv: includeTranslation ? -1 : 0,
  });

  const lyric = data.lrc?.lyric ?? "";
  const translated = includeTranslation ? (data.tlyric?.lyric ?? "") : "";

  return {
    song_id: songId,
    lyric,
    translated_lyric: translated || undefined,
    lyric_version: data.lrc?.version,
    translated_version: includeTranslation ? data.tlyric?.version : undefined,
    warning: lyric ? undefined : "No lyric text was returned for this song.",
  };
}

async function getSongCommentsSummary(client, args) {
  const songId = integerArg(args, ["song_id", "songId"], undefined, { min: 1 });
  if (!songId) throw new InputError("song_id is required");

  const limit = integerArg(args, "limit", 10, { min: 1, max: 30 });
  const offset = integerArg(args, "offset", 0);
  const includeHot = booleanArg(args, ["include_hot_comments", "includeHotComments"], true);
  const resourceId = `R_SO_4_${songId}`;

  const data = await client.postWeapi(`/weapi/v1/resource/comments/${resourceId}?csrf_token=`, {
    rid: resourceId,
    offset,
    limit,
    total: offset === 0,
  });

  const comments = data.comments ?? [];
  const hotComments = includeHot ? (data.hotComments ?? []) : [];
  return {
    song_id: songId,
    total: data.total ?? null,
    offset,
    limit,
    hot_comments: paginateItems(hotComments, 0, limit).map(normalizeComment),
    recent_comments: comments.map(normalizeComment),
    warning:
      comments.length === 0 && hotComments.length === 0
        ? "No comments were returned, or comments are restricted for this song."
        : undefined,
  };
}

async function getSimilarSongs(client, args) {
  const songId = integerArg(args, ["song_id", "songId"], undefined, { min: 1 });
  if (!songId) throw new InputError("song_id is required");

  const limit = integerArg(args, "limit", 20, { min: 1, max: 50 });

  const data = await client.postWeapi("/weapi/discovery/simiSong?csrf_token=", {
    songid: songId,
    limit,
  });

  const songs = data.songs ?? [];
  return {
    song_id: songId,
    total_returned: songs.length,
    songs: paginateItems(songs, 0, limit).map(normalizeSong),
    warning: songs.length === 0 ? "No similar songs were returned for this song." : undefined,
  };
}

async function searchAndGetLyrics(client, args) {
  const results = await searchSongs(client, args);
  const pick = integerArg(args, "pick", 0, { min: 0, max: Math.max(results.songs.length - 1, 0) });
  const selected = results.songs[pick];
  if (!selected) {
    return {
      ...results,
      warning: results.warning ?? "No song matched the keyword, so lyrics could not be fetched.",
    };
  }

  const lyrics = await getLyrics(client, {
    song_id: selected.id,
    include_translation: args.include_translation,
  });

  return {
    keyword: results.keyword,
    selected,
    alternatives: results.songs.filter((_, index) => index !== pick),
    ...lyrics,
  };
}

async function findSongByLyricPhrase(client, args) {
  const keyword = stringArg(args, "keyword");
  const phrase = stringArg(args, "phrase");
  const limit = integerArg(args, "limit", 5, { min: 1, max: 10 });
  const includeTranslation = booleanArg(args, ["include_translation", "includeTranslation"]);

  const results = await searchSongs(client, { keyword, limit });
  const matches = [];

  for (const song of results.songs) {
    try {
      const lyrics = await getLyrics(client, {
        song_id: song.id,
        include_translation: includeTranslation,
      });
      const lyricMatches = lyricLinesContaining(lyrics.lyric ?? "", phrase);
      const translatedMatches = includeTranslation ? lyricLinesContaining(lyrics.translated_lyric ?? "", phrase) : [];
      if (lyricMatches.length || translatedMatches.length) {
        matches.push({
          song,
          lyric_matches: lyricMatches,
          translated_matches: translatedMatches,
        });
      }
    } catch (error) {
      matches.push({
        song,
        error: error.message,
      });
    }
  }

  return {
    keyword,
    phrase,
    searched: results.songs.length,
    matches,
    warning: matches.length === 0 ? "No searched songs had lyrics containing that phrase." : undefined,
  };
}

async function resolveNeteaseUrl(_client, args) {
  const parsed = parseNeteaseUrl(args.url);
  return {
    ...parsed,
    suggested_tool:
      {
        song: "get_song_detail or get_lyrics",
        album: "get_album_songs",
        artist: "get_artist_albums or get_artist_top_songs",
        playlist: "get_playlist_songs",
      }[parsed.type] ?? undefined,
  };
}

export const tools = [
  // Each schema is what the MCP client uses to decide how to call the tool.
  {
    name: "search_songs",
    description: "Search NetEase Cloud Music by keyword and return song IDs, artists, albums, and links.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Song, artist, or lyric-adjacent keyword." },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
        offset: { type: "integer", minimum: 0, default: 0 },
      },
      required: ["keyword"],
    },
  },
  {
    name: "get_lyrics",
    description: "Fetch timestamped lyrics for a NetEase Cloud Music song ID.",
    inputSchema: {
      type: "object",
      properties: {
        song_id: { type: "integer", minimum: 1, description: "NetEase song ID." },
        include_translation: {
          type: "boolean",
          default: false,
          description: "Also request translated lyrics when available.",
        },
      },
      required: ["song_id"],
    },
  },
  {
    name: "get_song_detail",
    description: "Fetch richer metadata for one or more NetEase song IDs.",
    inputSchema: {
      type: "object",
      properties: {
        song_id: { type: "integer", minimum: 1, description: "Single NetEase song ID." },
        song_ids: {
          type: "array",
          items: { type: "integer", minimum: 1 },
          maxItems: 50,
          description: "Optional list of NetEase song IDs.",
        },
      },
    },
  },
  {
    name: "search_albums",
    description: "Search NetEase Cloud Music albums by keyword and return album IDs, artists, publish dates, and links.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Album, artist, or mixed keyword." },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
        offset: { type: "integer", minimum: 0, default: 0 },
      },
      required: ["keyword"],
    },
  },
  {
    name: "search_playlists",
    description: "Search NetEase Cloud Music playlists by keyword.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Playlist keyword." },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
        offset: { type: "integer", minimum: 0, default: 0 },
      },
      required: ["keyword"],
    },
  },
  {
    name: "search_artists",
    description: "Search NetEase Cloud Music artists by keyword and return artist IDs, aliases, counts, and links.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Artist name or alias keyword." },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
        offset: { type: "integer", minimum: 0, default: 0 },
      },
      required: ["keyword"],
    },
  },
  {
    name: "get_album_songs",
    description: "Get the song list for a NetEase Cloud Music album ID.",
    inputSchema: {
      type: "object",
      properties: {
        album_id: { type: "integer", minimum: 1, description: "NetEase album ID." },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
        offset: { type: "integer", minimum: 0, default: 0 },
      },
      required: ["album_id"],
    },
  },
  {
    name: "get_artist_albums",
    description: "Get albums for a NetEase Cloud Music artist ID.",
    inputSchema: {
      type: "object",
      properties: {
        artist_id: { type: "integer", minimum: 1, description: "NetEase artist ID." },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
        offset: { type: "integer", minimum: 0, default: 0 },
      },
      required: ["artist_id"],
    },
  },
  {
    name: "get_artist_top_songs",
    description: "Get popular songs for a NetEase artist ID.",
    inputSchema: {
      type: "object",
      properties: {
        artist_id: { type: "integer", minimum: 1, description: "NetEase artist ID." },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        offset: { type: "integer", minimum: 0, default: 0 },
      },
      required: ["artist_id"],
    },
  },
  {
    name: "get_playlist_songs",
    description: "Get tracks from a NetEase playlist ID.",
    inputSchema: {
      type: "object",
      properties: {
        playlist_id: { type: "integer", minimum: 1, description: "NetEase playlist ID." },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
        offset: { type: "integer", minimum: 0, default: 0 },
      },
      required: ["playlist_id"],
    },
  },
  {
    name: "get_song_comments_summary",
    description: "Fetch hot and recent comments for a NetEase song ID.",
    inputSchema: {
      type: "object",
      properties: {
        song_id: { type: "integer", minimum: 1, description: "NetEase song ID." },
        limit: { type: "integer", minimum: 1, maximum: 30, default: 10 },
        offset: { type: "integer", minimum: 0, default: 0 },
        include_hot_comments: { type: "boolean", default: true },
      },
      required: ["song_id"],
    },
  },
  {
    name: "get_similar_songs",
    description: "Fetch NetEase's similar-song recommendations for a song ID.",
    inputSchema: {
      type: "object",
      properties: {
        song_id: { type: "integer", minimum: 1, description: "NetEase song ID." },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
      },
      required: ["song_id"],
    },
  },
  {
    name: "search_and_get_lyrics",
    description: "Search songs, choose one result, and fetch its lyrics in one call.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Song and/or artist keyword." },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
        offset: { type: "integer", minimum: 0, default: 0 },
        pick: {
          type: "integer",
          minimum: 0,
          default: 0,
          description: "Zero-based result index to fetch lyrics for.",
        },
        include_translation: { type: "boolean", default: false },
      },
      required: ["keyword"],
    },
  },
  {
    name: "find_song_by_lyric_phrase",
    description: "Search songs, fetch lyrics for top results, and return songs whose lyrics contain a phrase.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Search query used to find candidate songs." },
        phrase: { type: "string", description: "Lyric phrase to match." },
        limit: { type: "integer", minimum: 1, maximum: 10, default: 5 },
        include_translation: { type: "boolean", default: false },
      },
      required: ["keyword", "phrase"],
    },
  },
  {
    name: "resolve_netease_url",
    description: "Parse a NetEase song, album, artist, or playlist URL and suggest the next MCP tool to call.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "NetEase Cloud Music URL." },
      },
      required: ["url"],
    },
  },
];

export async function callTool(client, name, args = {}) {
  // Keep dispatch explicit so adding/removing tools is easy to audit.
  const handlers = {
    search_songs: searchSongs,
    search_albums: searchAlbums,
    search_playlists: searchPlaylists,
    search_artists: searchArtists,
    get_song_detail: getSongDetail,
    get_album_songs: getAlbumSongs,
    get_artist_albums: getArtistAlbums,
    get_artist_top_songs: getArtistTopSongs,
    get_playlist_songs: getPlaylistSongs,
    get_lyrics: getLyrics,
    get_song_comments_summary: getSongCommentsSummary,
    get_similar_songs: getSimilarSongs,
    search_and_get_lyrics: searchAndGetLyrics,
    find_song_by_lyric_phrase: findSongByLyricPhrase,
    resolve_netease_url: resolveNeteaseUrl,
  };

  const handler = handlers[name];
  if (!handler) throw new InputError(`Unknown tool: ${name}`);
  return handler(client, args);
}
