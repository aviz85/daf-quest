'use strict';
/*
 * Scene: inn — the "Pundak Be-Khi Tov" (The "Be-Khi Tov" Inn)
 * DAF QUEST — Pesachim 2a-2b, "The Mystery of the Lost Light".
 * HUB scene: player starts here. No seal is earned here — the inn courtyard
 * routes the player to the cellar (bedikah), observatory (light), summit
 * (melakhah) and press (finale), under the game's signature SPLIT SKY:
 * night on the west half, stuck dawn on the east half, and a shimmering
 * seam between them that NARROWS as seals are collected (S.seals.length).
 * Comedy hub: Gad the fried innkeeper, the twins wedged in the doorway
 * (the "yikanes adam be-khi tov" gag), Beitza the relocating cat, a chametz
 * cart, an Aramaic-gurgling trough, and the inn sign carrying the Mishnah.
 * Owns ONLY this file. Registers via GAME.registerScene('inn', {...}).
 * Relies on GAME / SPRITES / AUDIO contracts (all guarded).
 */
(function () {
  if (!window.GAME || typeof window.GAME.registerScene !== 'function') {
    if (window.console && console.warn) console.warn('inn.js: GAME.registerScene unavailable, scene not registered');
    return;
  }

  // ---------------------------------------------------------------------
  // Palette — the torn sky: indigo night (west) vs stuck amber dawn (east),
  // spring village below (it is Nisan: almond blossoms, young grass).
  // ---------------------------------------------------------------------
  var NIGHT_TOP = '#12123a', NIGHT_MID = '#1e1e52', NIGHT_LOW = '#2a2a70';
  var DAWN_TOP = '#8c4a52', DAWN_MID = '#d97a4a', DAWN_WARM = '#ffb347', DAWN_LOW = '#ffd166';
  var SEAM_A = '#aef6ff', SEAM_B = '#ffffff';
  var STONE_D = '#5a5a7a', STONE_M = '#6b6b8f', STONE_L = '#7a7a9c', STONE_XL = '#8f8fb0';
  var WOOD_D = '#5a3a24', WOOD_L = '#7a512f';
  var COPPER = '#b0662f';
  var AMBER = '#ffd166', AMBER2 = '#ffb347', AMBER3 = '#ff8c42';
  var PARCH = '#e8d8a8';
  var DIRT_D = '#4a3424', DIRT_M = '#5a4030', DIRT_L = '#6b4a38';
  var GRASS = '#3f7a4a', GRASS_D = '#2f5a3a';
  var BLOSSOM = '#ffd7e8', BLOSSOM_L = '#fff0f5';
  var STARWHITE = '#fff7d6';
  var HILL_NIGHT = '#161640', HILL_DAWN = '#7a4632';

  var GAD_COLOR = '#ffcf86';
  var TWIN_OUT_COLOR = '#ffc8a0';
  var TWIN_IN_COLOR = '#a8c8ff';
  var CAT_COLOR = '#e8ffc8';
  var TROUGH_COLOR = '#aef6ff';

  // ---------------------------------------------------------------------
  // Defensive helpers (SPRITES/AUDIO used when present, else fallbacks)
  // ---------------------------------------------------------------------
  function px(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function dither(ctx, x, y, w, h, c1, c2) {
    if (window.SPRITES && typeof SPRITES.dither === 'function') {
      try { SPRITES.dither(ctx, x, y, w, h, c1, c2); return; } catch (e) { /* fall through */ }
    }
    px(ctx, x, y, w, h, c1);
    ctx.fillStyle = c2;
    for (var yy = 0; yy < h; yy++) {
      for (var xx = (yy % 2); xx < w; xx += 2) ctx.fillRect(x + xx, y + yy, 1, 1);
    }
  }

  function glow(ctx, x, y, r, color, alpha) {
    if (window.SPRITES && typeof SPRITES.glow === 'function') {
      try { SPRITES.glow(ctx, x, y, r, color, alpha); return; } catch (e) { /* fall through */ }
    }
    ctx.save();
    for (var i = 3; i >= 1; i--) {
      var rr = Math.round(r * i / 3);
      ctx.globalAlpha = (alpha || 0.15) * 0.3;
      ctx.fillStyle = color;
      ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    ctx.restore();
  }

  function twinkle(ctx, x, y, t, size, color) {
    if (window.SPRITES && typeof SPRITES.star === 'function') {
      try { SPRITES.star(ctx, x, y, t, size, color); return; } catch (e) { /* fall through */ }
    }
    var a = 0.5 + 0.5 * Math.sin(t * 3 + x * 0.6 + y * 1.2);
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.65 * a;
    px(ctx, x, y, 1, 1, color || '#ffffff');
    ctx.restore();
  }

  function safeMusic(mode) {
    try { if (window.AUDIO && typeof AUDIO.music === 'function') AUDIO.music(mode); } catch (e) { /* fail silent */ }
  }

  function safeSfx(g, name) {
    try { if (g && typeof g.sfx === 'function') g.sfx(name); } catch (e) { /* fail silent */ }
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function sealsIn(S) {
    try { return (S && S.seals) || []; } catch (e) { return []; }
  }

  function hasSealIn(S, id) {
    var s = sealsIn(S);
    for (var i = 0; i < s.length; i++) { if (s[i] === id) return true; }
    return false;
  }

  function stateFlags() {
    try { return (window.GAME && window.GAME.state && window.GAME.state.flags) || {}; }
    catch (e) { return {}; }
  }

  function hasSealSafe(g, id) {
    try { return !!(g && typeof g.hasSeal === 'function' && g.hasSeal(id)); }
    catch (e) { return false; }
  }

  function flagNum(g, name) {
    try { var v = g.flag(name); return typeof v === 'number' ? v : 0; }
    catch (e) { return 0; }
  }

  // Seam width: the game's visual progress bar. 0 seals = wide (~14px),
  // each seal shaves it down. Never below 4 (heals fully only in the ending).
  function seamWidth(S) {
    var n = 0;
    try { n = sealsIn(S).length || 0; } catch (e) { n = 0; }
    return Math.max(4, 14 - 3 * n);
  }

  // ---------------------------------------------------------------------
  // Speaker helpers — one fixed color per recurring speaker
  // ---------------------------------------------------------------------
  function gadSay(g, text) { return g.say(text, { who: 'gad', color: GAD_COLOR }); }
  function twinOutSay(g, text) { return g.say(text, { who: 'twins', color: TWIN_OUT_COLOR }); }
  function twinInSay(g, text) { return g.say(text, { who: 'twins', color: TWIN_IN_COLOR }); }
  function catSay(g, text) { return g.say(text, { who: 'cat', color: CAT_COLOR }); }
  function troughSay(g, text) { return g.say(text, { who: 'trough', color: TROUGH_COLOR }); }

  // ---------------------------------------------------------------------
  // SKY — the signature. West half = deep night; east half = stuck dawn;
  // between them the shimmering seam, narrowing per collected seal.
  // ---------------------------------------------------------------------
  var HORIZON = 92;

  var NIGHT_STARS = [
    [12, 8], [34, 26], [58, 5], [76, 40], [96, 14], [118, 30], [140, 9], [70, 62], [24, 50]
  ];

  function paintSky(ctx, t, S) {
    // night half (west / left)
    px(ctx, 0, 0, 160, 32, NIGHT_TOP);
    dither(ctx, 0, 32, 160, 4, NIGHT_TOP, NIGHT_MID);
    px(ctx, 0, 36, 160, 26, NIGHT_MID);
    dither(ctx, 0, 62, 160, 4, NIGHT_MID, NIGHT_LOW);
    px(ctx, 0, 66, 160, HORIZON - 66, NIGHT_LOW);

    // stars — only where the night rules
    for (var i = 0; i < NIGHT_STARS.length; i++) {
      twinkle(ctx, NIGHT_STARS[i][0], NIGHT_STARS[i][1], t + i * 1.7, (i % 3 === 0) ? 2 : 1, STARWHITE);
    }

    // pale moon over the night half
    if (window.SPRITES && typeof SPRITES.moon === 'function') {
      try { SPRITES.moon(ctx, 44, 20, 0.35, 10); } catch (e) { px(ctx, 40, 16, 8, 8, '#cfc3e0'); }
    } else {
      px(ctx, 40, 16, 8, 8, '#cfc3e0');
    }

    // dawn half (east / right) — a morning that refuses to finish rising
    px(ctx, 160, 0, 160, 28, DAWN_TOP);
    dither(ctx, 160, 28, 160, 4, DAWN_TOP, DAWN_MID);
    px(ctx, 160, 32, 160, 26, DAWN_MID);
    dither(ctx, 160, 58, 160, 4, DAWN_MID, DAWN_WARM);
    px(ctx, 160, 62, 160, 16, DAWN_WARM);
    dither(ctx, 160, 78, 160, 4, DAWN_WARM, DAWN_LOW);
    px(ctx, 160, 82, 160, HORIZON - 82, DAWN_LOW);

    // (the stuck half-risen sun is painted in paintHills, AFTER the ridge,
    // so its dome actually peeks over the hills instead of hiding behind them)

    // THE SEAM — animated dithered sparkle column, pulsing, narrowing
    var w = seamWidth(S);
    var x0 = 160 - Math.floor(w / 2);
    ctx.save();
    ctx.globalAlpha = 0.22 + 0.10 * Math.sin(t * 2.1);
    dither(ctx, x0, 0, w, HORIZON, SEAM_A, NIGHT_LOW);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.5;
    px(ctx, 160, 0, 1, HORIZON, SEAM_B);
    ctx.restore();
    // bright motes drifting up the tear
    for (var m = 0; m < 5; m++) {
      var my = HORIZON - ((t * 26 + m * 41) % HORIZON);
      var mx = x0 + ((m * 5 + Math.floor(t * 2)) % Math.max(1, w));
      ctx.save();
      ctx.globalAlpha = 0.45 + 0.4 * Math.sin(t * 5 + m * 2.1);
      px(ctx, mx, my, 1, 1, m % 2 === 0 ? SEAM_A : SEAM_B);
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------------
  // Far hills at the horizon — night hills west, dawn hills east.
  // After the melakhah seal: Boaz's beacon glimmers on the west horizon.
  // ---------------------------------------------------------------------
  function paintHills(ctx, t, S) {
    px(ctx, 0, 82, 70, 10, HILL_NIGHT);
    px(ctx, 20, 76, 52, 16, HILL_NIGHT);
    px(ctx, 60, 84, 60, 8, HILL_NIGHT);
    px(ctx, 200, 84, 60, 8, HILL_DAWN);
    px(ctx, 250, 78, 70, 14, HILL_DAWN);
    px(ctx, 290, 74, 30, 18, HILL_DAWN);

    // the stuck half-risen sun — confused, shivers a pixel now and then.
    // Painted AFTER the dawn hills so the dome peeks over the ridge at y78:
    // literally half-risen, exactly as stuck as the rest of the sky.
    var shiver = ((t % 5) < 0.15) ? 1 : 0;
    ctx.save();
    ctx.globalAlpha = 0.10 + 0.05 * Math.sin(t * 0.8);
    px(ctx, 226, 66, 56, 18, DAWN_LOW);              // morning haze around the dome
    ctx.restore();
    px(ctx, 244, 76 + shiver, 20, 6, DAWN_LOW);
    px(ctx, 246, 74 + shiver, 16, 3, '#fff0c0');
    px(ctx, 250, 72 + shiver, 8, 2, '#fff7d6');
    glow(ctx, 254, 76, 14, DAWN_LOW, 0.10);

    // callback: the summit beacon burning far west once melakhah is sealed
    if (hasSealIn(S, 'melakhah')) {
      var fl = 0.6 + 0.4 * Math.sin(t * 7 + 1);
      ctx.save();
      ctx.globalAlpha = fl;
      px(ctx, 30, 73, 2, 3, AMBER3);
      px(ctx, 30, 72, 2, 1, AMBER);
      ctx.restore();
      glow(ctx, 31, 74, 6, AMBER3, 0.10 * fl);
    }
  }

  // ---------------------------------------------------------------------
  // The stable (west, night side) — dark, sleepy, one dim window
  // ---------------------------------------------------------------------
  function paintStable(ctx, t) {
    px(ctx, 22, 70, 58, 56, '#3f3f5c');
    px(ctx, 22, 70, 58, 2, STONE_D);
    // sloped hay roof
    px(ctx, 18, 62, 66, 10, WOOD_D);
    px(ctx, 18, 62, 66, 2, WOOD_L);
    // stable door, closed for the night
    px(ctx, 56, 96, 18, 30, '#241a10');
    px(ctx, 56, 96, 18, 2, WOOD_L);
    px(ctx, 64, 110, 2, 4, COPPER);
    // one dim sleepy window — a horse who gave up on the sky question
    px(ctx, 30, 84, 10, 10, '#141428');
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 0.9);
    px(ctx, 31, 85, 8, 8, '#3a3a66');
    ctx.restore();
    // hay spill at the base
    px(ctx, 24, 122, 14, 4, '#8c7a3a');
    px(ctx, 28, 120, 8, 2, '#a89048');
  }

  // ---------------------------------------------------------------------
  // Almond tree in bloom (Nisan!) — shedding petals, the only thing in the
  // village that knows exactly what time of year it is.
  // ---------------------------------------------------------------------
  function paintTree(ctx, t) {
    // trunk
    px(ctx, 44, 82, 6, 44, '#3a2418');
    px(ctx, 46, 78, 3, 8, '#3a2418');
    px(ctx, 40, 88, 6, 3, '#3a2418');
    px(ctx, 50, 92, 7, 3, '#3a2418');
    // blossom canopy — pink clusters over dark branches
    px(ctx, 28, 58, 40, 14, BLOSSOM);
    px(ctx, 34, 52, 30, 8, BLOSSOM);
    px(ctx, 24, 66, 20, 10, BLOSSOM);
    px(ctx, 52, 64, 20, 12, BLOSSOM);
    dither(ctx, 28, 58, 40, 8, BLOSSOM, BLOSSOM_L);
    px(ctx, 38, 50, 14, 4, BLOSSOM_L);
    px(ctx, 30, 70, 8, 4, BLOSSOM_L);
    // drifting petals (animated) — one lands on the trough spoon (see trough)
    for (var i = 0; i < 4; i++) {
      var ph = (t * 0.12 + i * 0.26) % 1;
      var fx = 44 + i * 9 + Math.sin(t * 1.3 + i * 2) * 6 + ph * 26;
      var fy = 66 + ph * 66;
      ctx.save();
      ctx.globalAlpha = 0.8 - ph * 0.4;
      px(ctx, Math.round(fx), Math.round(fy), 1, 1, i % 2 === 0 ? BLOSSOM : BLOSSOM_L);
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------------
  // The inn (east, dawn-lit side) — two stories, mixed lit/unlit windows:
  // the building itself can't decide if it's bedtime.
  // ---------------------------------------------------------------------
  var INN_WINDOWS = [
    // [x, y, lit] — lit ones flicker like candles
    [200, 44, true], [222, 44, false], [250, 44, true], [276, 44, false],
    [200, 66, false], [250, 66, true], [276, 66, true]
  ];

  function paintInn(ctx, t) {
    // main body — right edge catches the stuck dawn (lighter)
    px(ctx, 192, 30, 108, 96, STONE_M);
    px(ctx, 262, 30, 38, 96, STONE_L);
    px(ctx, 192, 30, 108, 2, STONE_XL);
    // floor divider beam
    px(ctx, 192, 60, 108, 3, WOOD_D);
    // roof
    px(ctx, 188, 24, 116, 8, WOOD_D);
    px(ctx, 188, 24, 116, 2, WOOD_L);
    // chimney + smoke wisps (supper still cooking; chametz, obviously)
    px(ctx, 284, 12, 8, 14, STONE_D);
    px(ctx, 283, 10, 10, 3, STONE_M);
    for (var s = 0; s < 3; s++) {
      var sp = (t * 0.35 + s * 0.33) % 1;
      ctx.save();
      ctx.globalAlpha = 0.30 * (1 - sp);
      px(ctx, Math.round(287 + Math.sin(t * 1.2 + s * 2.2) * 3 * sp), Math.round(10 - sp * 14), 2, 2, '#9c9cb8');
      ctx.restore();
    }
    // windows — half lit, half dark; one keeps toggling (can't decide)
    for (var i = 0; i < INN_WINDOWS.length; i++) {
      var wn = INN_WINDOWS[i];
      px(ctx, wn[0], wn[1], 9, 11, WOOD_D);
      var lit = wn[2];
      if (i === 3) lit = (Math.floor(t / 4) % 2) === 0; // the undecided window
      if (lit) {
        var fl = 0.7 + 0.3 * Math.sin(t * 5 + i * 1.9);
        ctx.save();
        ctx.globalAlpha = fl;
        px(ctx, wn[0] + 1, wn[1] + 1, 7, 9, AMBER);
        ctx.restore();
        px(ctx, wn[0] + 4, wn[1] + 1, 1, 9, WOOD_D);
      } else {
        px(ctx, wn[0] + 1, wn[1] + 1, 7, 9, '#141428');
        px(ctx, wn[0] + 4, wn[1] + 1, 1, 9, '#22223a');
      }
    }
    // bedikah kit tucked on a windowsill — feather + wooden spoon (sight gag)
    px(ctx, 222, 76, 10, 2, STONE_XL);
    px(ctx, 223, 73, 1, 3, '#f0f0e0');   // feather
    px(ctx, 226, 74, 4, 1, WOOD_L);      // spoon
    px(ctx, 229, 73, 1, 1, WOOD_L);      // spoon bowl
    // doorway — arched dark opening (the twins wedge themselves here)
    px(ctx, 208, 86, 32, 40, '#181022');
    px(ctx, 206, 84, 36, 4, WOOD_D);
    px(ctx, 206, 84, 36, 1, WOOD_L);
    px(ctx, 206, 88, 3, 38, WOOD_D);
    px(ctx, 239, 88, 3, 38, WOOD_D);
    // warm inn light spilling from inside
    ctx.save();
    ctx.globalAlpha = 0.16 + 0.05 * Math.sin(t * 3.1);
    px(ctx, 210, 90, 28, 36, AMBER2);
    ctx.restore();
  }

  // ---------------------------------------------------------------------
  // The crossroads sign post — hangs EXACTLY on the sky seam. Left half
  // painted night-dark with a tiny star, right half dawn-lit; the sign
  // swings, and each swing the lit half flips. The painter gave up mid-job.
  // ---------------------------------------------------------------------
  function paintSignPost(ctx, t) {
    // post + arm
    px(ctx, 158, 56, 3, 70, WOOD_D);
    px(ctx, 158, 56, 3, 2, WOOD_L);
    px(ctx, 148, 54, 24, 3, WOOD_D);
    // chains
    var sw = Math.round(Math.sin(t * 1.6) * 2);
    px(ctx, 150 + sw, 57, 1, 4, '#9c9cb8');
    px(ctx, 168 + sw, 57, 1, 4, '#9c9cb8');
    // the board, split down its own middle like the sky above it
    var bx = 147 + sw;
    var flipLit = (Math.floor((t * 1.6) / Math.PI) % 2) === 0;
    px(ctx, bx, 61, 24, 15, WOOD_D);
    if (flipLit) {
      px(ctx, bx + 1, 62, 11, 13, '#232348');
      px(ctx, bx + 12, 62, 11, 13, PARCH);
      twinkle(ctx, bx + 5, 65, t, 1, STARWHITE);
    } else {
      px(ctx, bx + 1, 62, 11, 13, PARCH);
      px(ctx, bx + 12, 62, 11, 13, '#232348');
      twinkle(ctx, bx + 17, 65, t, 1, STARWHITE);
    }
    // unreadable Hebrew-ish glyph rows ("Pundak Be-Khi Tov", allegedly)
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 5; c++) {
        px(ctx, bx + 3 + c * 4, 64 + r * 4, 2, 1, '#3a2a18');
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------
  // The water trough — gurgles Aramaic. Someone planted a feather-mast and
  // a wooden-spoon oar in it: a bedikat-chametz kit pretending to be a boat.
  // A shed almond petal lands on the spoon every few seconds.
  // ---------------------------------------------------------------------
  function paintTrough(ctx, t) {
    px(ctx, 84, 124, 36, 16, WOOD_D);
    px(ctx, 84, 124, 36, 2, WOOD_L);
    px(ctx, 86, 127, 32, 9, '#2a4a6a');
    // water shimmer ripples
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 2.7);
    px(ctx, 88 + Math.round(Math.sin(t * 1.9) * 2), 129, 8, 1, '#4a7a9c');
    px(ctx, 102 + Math.round(Math.sin(t * 2.3 + 1) * 2), 132, 7, 1, '#4a7a9c');
    ctx.restore();
    // the boat: feather mast + spoon oar
    px(ctx, 98, 119, 1, 8, '#f0f0e0');       // feather quill
    px(ctx, 96, 118, 3, 3, '#ffffff');       // feather fluff
    px(ctx, 104, 129, 8, 1, WOOD_L);         // spoon shaft laid across
    px(ctx, 111, 128, 2, 2, WOOD_L);         // spoon bowl
    // petal drop cycle: falls, then rests on the spoon for a beat
    var p = (t % 6) / 6;
    if (p < 0.6) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      px(ctx, 111, Math.round(96 + (p / 0.6) * 32), 1, 1, BLOSSOM);
      ctx.restore();
    } else {
      px(ctx, 111, 127, 1, 1, BLOSSOM); // landed on the spoon bowl
    }
  }

  // ---------------------------------------------------------------------
  // The chametz cart — the village's last chametz, piled for tomorrow's
  // biur. A crumb trail leads suspiciously toward the cellar doors.
  // ---------------------------------------------------------------------
  function paintCart(ctx, t) {
    // wheel
    px(ctx, 124, 122, 12, 12, WOOD_D);
    px(ctx, 127, 125, 6, 6, '#2a1a0e');
    px(ctx, 129, 122, 2, 12, WOOD_L);
    px(ctx, 124, 127, 12, 2, WOOD_L);
    // bed + handles
    px(ctx, 116, 116, 40, 8, WOOD_L);
    px(ctx, 116, 116, 40, 2, '#8c6038');
    px(ctx, 112, 114, 6, 3, WOOD_D);
    // the chametz mound — bumpy, proud, doomed
    px(ctx, 120, 106, 32, 10, '#c8a05a');
    px(ctx, 124, 102, 22, 6, '#d8b068');
    px(ctx, 130, 99, 10, 4, PARCH);
    // the baby-sized crouton
    px(ctx, 122, 101, 7, 6, '#b08040');
    px(ctx, 123, 102, 5, 1, '#d8b068');
    // a bagel that remembers the Destruction
    px(ctx, 144, 104, 6, 6, '#a87838');
    px(ctx, 146, 106, 2, 2, DIRT_M);
    // parchment tag: "for tomorrow's biur"
    px(ctx, 150, 112, 5, 4, PARCH);
    px(ctx, 151, 113, 3, 1, '#5a4a2a');
    // crumb trail toward the cellar doors (the cat's standing hint)
    var CRUMBS = [[162, 140], [180, 142], [200, 139], [222, 141], [242, 138], [254, 134]];
    for (var i = 0; i < CRUMBS.length; i++) {
      px(ctx, CRUMBS[i][0], CRUMBS[i][1], 1, 1, PARCH);
    }
    // the crumbs nearest the trapdoor faintly twinkle — follow me, hero
    twinkle(ctx, 256, 132, t * 1.3, 1, AMBER);
  }

  // ---------------------------------------------------------------------
  // Cellar trapdoor at the inn's base — angled double doors + steps
  // ---------------------------------------------------------------------
  function paintTrapdoor(ctx, t) {
    px(ctx, 248, 116, 34, 14, WOOD_D);
    px(ctx, 248, 116, 34, 2, WOOD_L);
    px(ctx, 264, 116, 2, 14, WOOD_L);       // the split between the two doors
    px(ctx, 258, 122, 3, 2, COPPER);        // handle
    px(ctx, 269, 122, 3, 2, COPPER);        // handle
    // steps hint below
    px(ctx, 252, 130, 26, 3, STONE_D);
    px(ctx, 256, 133, 18, 3, '#3a3a58');
    // cool cellar breath seeping from the crack
    ctx.save();
    ctx.globalAlpha = 0.10 + 0.06 * Math.sin(t * 1.4);
    px(ctx, 262, 112, 6, 4, '#6a9cb8');
    ctx.restore();
    // a wooden spoon leaning by the doors (the kit is EVERYWHERE)
    px(ctx, 284, 118, 1, 10, WOOD_L);
    px(ctx, 283, 116, 3, 2, WOOD_L);
  }

  // ---------------------------------------------------------------------
  // Exit paths: summit lane (west, dark), press alley (center, deep shadow),
  // observatory trail (east edge, dawn-lit)
  // ---------------------------------------------------------------------
  function paintPaths(ctx, t) {
    // west summit trail — climbing into the night half
    px(ctx, 0, 88, 22, 38, '#2a2a48');
    px(ctx, 2, 92, 16, 3, '#3a3a58');
    px(ctx, 4, 100, 14, 3, '#343450');
    px(ctx, 2, 110, 16, 3, '#30304c');
    px(ctx, 0, 120, 18, 3, '#2c2c48');
    // swaying grass at the trailside
    var g1 = Math.round(Math.sin(t * 1.8) * 1);
    px(ctx, 19 + g1, 116, 1, 4, GRASS);
    px(ctx, 17, 118, 1, 3, GRASS_D);

    // press alley — a dark lane between post and inn, smelling of old oil
    px(ctx, 168, 78, 22, 48, '#141428');
    px(ctx, 168, 78, 2, 48, STONE_D);
    px(ctx, 188, 78, 2, 48, STONE_D);
    // deep inside: a faint copper glint — the old press lamp-hoard
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 1.1);
    px(ctx, 178, 96, 2, 2, COPPER);
    ctx.restore();

    // east observatory trail — dawn-lit steps rising behind the inn
    px(ctx, 300, 84, 20, 42, '#8c6a4a');
    px(ctx, 302, 90, 16, 3, '#a87e56');
    px(ctx, 304, 98, 14, 3, '#9c7450');
    px(ctx, 302, 108, 16, 3, '#8c6a4a');
    px(ctx, 300, 118, 18, 3, '#7e6044');
    var g2 = Math.round(Math.sin(t * 1.5 + 2) * 1);
    px(ctx, 299 + g2, 114, 1, 4, GRASS);
  }

  // ---------------------------------------------------------------------
  // Courtyard floor — packed spring dirt, young grass, stones
  // ---------------------------------------------------------------------
  function paintFloor(ctx, t, S) {
    px(ctx, 0, 126, 320, 54, DIRT_M);
    ctx.fillStyle = DIRT_D;
    for (var yy = 134; yy < 180; yy += 9) ctx.fillRect(0, yy, 320, 1);
    var r = 0;
    for (var y2 = 126; y2 < 180; y2 += 9) {
      for (var x2 = (r % 2) * 14; x2 < 320; x2 += 28) ctx.fillRect(x2, y2, 1, 9);
      r++;
    }
    // lighter walked path crossing the yard
    px(ctx, 0, 146, 320, 8, DIRT_L);
    dither(ctx, 0, 144, 320, 2, DIRT_M, DIRT_L);
    dither(ctx, 0, 154, 320, 2, DIRT_L, DIRT_M);
    // young Nisan grass tufts, swaying
    var TUFTS = [[14, 132], [70, 160], [126, 170], [232, 164], [296, 136], [180, 158]];
    for (var i = 0; i < TUFTS.length; i++) {
      var sway = Math.round(Math.sin(t * 1.7 + i * 1.3) * 1);
      px(ctx, TUFTS[i][0] + sway, TUFTS[i][1] - 3, 1, 3, GRASS);
      px(ctx, TUFTS[i][0] + 2, TUFTS[i][1] - 2, 1, 2, GRASS_D);
    }
    // scattered stones
    px(ctx, 52, 150, 4, 2, STONE_D);
    px(ctx, 210, 168, 5, 2, STONE_D);
    px(ctx, 302, 162, 4, 2, STONE_D);
    // the torn sky touches the earth: cool night cast on the west yard,
    // warm dawn cast on the east, meeting under the seam
    var sw2 = seamWidth(S);
    ctx.save();
    ctx.globalAlpha = 0.10;
    px(ctx, 0, 126, 160 - Math.floor(sw2 / 2), 54, NIGHT_LOW);
    ctx.globalAlpha = 0.06;
    px(ctx, 160 + Math.floor(sw2 / 2), 126, 160, 54, DAWN_LOW);
    // 1px ground shimmer continuing the seam, same pulse as the sky tear
    ctx.globalAlpha = 0.10 + 0.05 * Math.sin(t * 2.1);
    px(ctx, 160, 126, 1, 54, SEAM_B);
    ctx.restore();
  }

  // ---------------------------------------------------------------------
  // CHARACTERS (hotspot draw functions, anchored at feet)
  // ---------------------------------------------------------------------

  // Gad the innkeeper — aggressively hospitable, completely fried.
  // Serve-and-snatch loop: the tray arm extends and yanks back forever.
  function drawGad(ctx, t, S) {
    var fx = 192, fy = 156;
    var bob = Math.round(Math.sin(t * 1.8) * 1);
    var top = fy - 34 + bob;
    // shadow
    ctx.save();
    ctx.globalAlpha = 0.25;
    px(ctx, fx - 8, fy - 1, 18, 2, '#000000');
    ctx.restore();
    // legs + shoes
    px(ctx, fx - 5, fy - 8, 4, 8, '#3a2a20');
    px(ctx, fx + 2, fy - 8, 4, 8, '#3a2a20');
    px(ctx, fx - 6, fy - 2, 5, 2, '#241a10');
    px(ctx, fx + 2, fy - 2, 5, 2, '#241a10');
    // round belly body — copper tunic, parchment apron
    px(ctx, fx - 8, top + 12, 17, 15, COPPER);
    px(ctx, fx - 5, top + 14, 11, 13, PARCH);
    px(ctx, fx - 5, top + 14, 11, 1, '#c8b088');
    // apron stain (today's chametz casualty)
    px(ctx, fx - 2, top + 19, 3, 2, '#b08040');
    // right arm: towel over shoulder
    px(ctx, fx + 7, top + 13, 3, 8, COPPER);
    px(ctx, fx + 8, top + 10, 3, 6, '#d8e0e8');
    // serve-and-snatch tray arm (extends left, toward the courtyard)
    var srv = (Math.sin(t * 2.2) + 1) / 2;
    var ext = Math.round(srv * 6);
    px(ctx, fx - 10 - ext, top + 15, 4 + ext, 3, COPPER);
    px(ctx, fx - 16 - ext, top + 13, 9, 2, WOOD_L);          // tray
    // the dish on the tray: chametz until all 3 seals, then proud matzah
    var allSeals = hasSealIn(S, 'bedikah') && hasSealIn(S, 'light') && hasSealIn(S, 'melakhah');
    if (allSeals) {
      px(ctx, fx - 14 - ext, top + 12, 5, 1, '#f5ecd0');     // flat matzah
    } else {
      px(ctx, fx - 14 - ext, top + 10, 4, 3, '#d8b068');     // steaming kreplach-blob
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 6);
      px(ctx, fx - 13 - ext, top + 8, 1, 2, '#e8e8f0');      // steam
      ctx.restore();
    }
    // head: bald with side tufts, grand mustache
    px(ctx, fx - 5, top, 11, 12, '#e8b088');
    px(ctx, fx - 6, top + 3, 2, 5, '#5a3a24');
    px(ctx, fx + 5, top + 3, 2, 5, '#5a3a24');
    px(ctx, fx - 4, top - 1, 9, 2, '#e8b088');
    // eyes (blink) — wide, of course; he hasn't slept since the sky tore
    var blink = ((t + 1.2) % 3.7) < 0.13;
    if (!blink) {
      px(ctx, fx - 3, top + 4, 2, 2, '#2a1a10');
      px(ctx, fx + 2, top + 4, 2, 2, '#2a1a10');
    } else {
      px(ctx, fx - 3, top + 5, 2, 1, '#8c5a3a');
      px(ctx, fx + 2, top + 5, 2, 1, '#8c5a3a');
    }
    // mustache
    px(ctx, fx - 3, top + 8, 8, 2, '#5a3a24');
    // stress sweat drop, on schedule
    var sw = t % 4;
    if (sw < 0.6) {
      ctx.save();
      ctx.globalAlpha = 0.8;
      px(ctx, fx + 6, Math.round(top + 2 + sw * 6), 1, 2, '#aef6ff');
      ctx.restore();
    }
    // perch #3: the cat sits ON Gad's head, so she must paint AFTER him.
    // The engine depth-sorts hotspot draws by rect bottom (y+h) and Gad's
    // bottom (158) beats the cat's small head-rect; drawing her here makes
    // the paint order explicit without inflating her hit rect over Gad.
    if (catSpotIndex() === 3) drawCat(ctx, t);
  }

  // The twins — wedged in the inn doorway, one halfway out, one halfway in,
  // arguing in stereo. After the `light` seal they have SWAPPED and are
  // wedged the other way. Neither has noticed.
  function drawTwins(ctx, t, S) {
    var swapped = hasSealIn(S, 'light');
    var bobA = Math.round(Math.sin(t * 2.4) * 1);
    var bobB = Math.round(Math.sin(t * 2.4 + Math.PI) * 1);
    // twin at the outer edge of the doorway (pushing out... or in)
    drawTwinFigure(ctx, 213, 126 + 0, t, swapped ? '#3a3a7a' : '#d9975a', true, bobA);
    // twin deeper inside, in the door shadow
    ctx.save();
    ctx.globalAlpha = 0.85;
    drawTwinFigure(ctx, 231, 126 + 0, t, swapped ? '#d9975a' : '#3a3a7a', false, bobB);
    ctx.restore();
  }

  function drawTwinFigure(ctx, fx, fy, t, robe, faceLeft, bob) {
    var top = fy - 20 + bob;
    // legs
    px(ctx, fx - 2, fy - 5, 2, 5, '#241a10');
    px(ctx, fx + 1, fy - 5, 2, 5, '#241a10');
    // robe
    px(ctx, fx - 3, top + 6, 8, 9, robe);
    // bracing arm against the doorframe
    if (faceLeft) px(ctx, fx - 6, top + 7, 3, 2, robe);
    else px(ctx, fx + 5, top + 7, 3, 2, robe);
    // head + cap
    px(ctx, fx - 2, top, 6, 6, '#e8b088');
    px(ctx, fx - 2, top - 1, 6, 2, '#4a3a5a');
    // one indignant eye each, facing their chosen doom
    var blink = ((t + fx) % 4.1) < 0.12;
    if (!blink) px(ctx, faceLeft ? fx - 1 : fx + 2, top + 2, 1, 1, '#2a1a10');
  }

  // Beitza the cat — named for the masechet AND the breakfast. Relocates to
  // a new perch every visit, declares each one muktzeh. Loaf pose, tail
  // swish, ear twitch, blink — masechet-grade stillness.
  var CAT_SPOTS = [
    { ax: 134, ay: 106, rx: 124, ry: 92, rw: 20, rh: 16, wx: 134, wy: 146 },  // on the chametz cart
    { ax: 100, ay: 124, rx: 90, ry: 110, rw: 20, rh: 16, wx: 102, wy: 146 },  // on the trough rim
    { ax: 160, ay: 54, rx: 150, ry: 40, rw: 20, rh: 16, wx: 158, wy: 142 },   // on the sign arm
    { ax: 192, ay: 124, rx: 182, ry: 108, rw: 20, rh: 18, wx: 180, wy: 152 }  // on Gad's head
  ];

  function catSpotIndex() {
    var f = stateFlags();
    var n = typeof f.innCatSpot === 'number' ? f.innCatSpot : 0;
    return ((n % CAT_SPOTS.length) + CAT_SPOTS.length) % CAT_SPOTS.length;
  }

  function drawCat(ctx, t) {
    var sp = CAT_SPOTS[catSpotIndex()];
    var fx = sp.ax, fy = sp.ay;
    // tail swish
    var tw = Math.round(Math.sin(t * 2.1) * 2);
    px(ctx, fx + 4, fy - 3 + tw, 3, 1, '#f0ead6');
    px(ctx, fx + 6, fy - 4 + tw, 1, 2, '#d9a05a');
    // loaf body
    px(ctx, fx - 4, fy - 5, 9, 5, '#f0ead6');
    px(ctx, fx - 1, fy - 5, 3, 2, '#d9a05a'); // amber patch
    // head
    px(ctx, fx - 6, fy - 8, 5, 5, '#f0ead6');
    // ears (twitch)
    var twitch = Math.sin(t * 3.4) > 0.85 ? 1 : 0;
    px(ctx, fx - 6, fy - 9 - twitch, 1, 1, '#f0ead6');
    px(ctx, fx - 3, fy - 9, 1, 1, '#f0ead6');
    // eyes (blink; green — she has read further than everyone)
    var blink = ((t + 2.6) % 3.9) < 0.14;
    if (!blink) {
      px(ctx, fx - 5, fy - 7, 1, 1, '#3f7a4a');
      px(ctx, fx - 3, fy - 7, 1, 1, '#3f7a4a');
    }
    // tiny nose
    px(ctx, fx - 5, fy - 5, 1, 1, '#c86a6a');
  }

  // ---------------------------------------------------------------------
  // GAD dialogue — quest recap hub + serve-and-snatch running gag
  // ---------------------------------------------------------------------
  async function gadDishGag(g) {
    var allSeals = hasSealSafe(g, 'bedikah') && hasSealSafe(g, 'light') && hasSealSafe(g, 'melakhah');
    if (allSeals) {
      if (!g.flag('innGadMatza')) {
        g.flag('innGadMatza', true);
        await gadSay(g, 'רגע! לפני הכל — מצה! שמורה! עגולה! סוף סוף משהו שאני יכול להגיש בלי לחטוף התקף!');
        await gadSay(g, '...אני בוכה. זה מרוב גאווה. אל תסתכל.');
        await g.playerSay('הוא מגיש. הוא לא חוטף בחזרה. היסטוריה.');
      }
      return;
    }
    var idx = flagNum(g, 'innGadDish');
    g.flag('innGadDish', idx + 1);
    var which = idx % 3;
    if (which === 0) {
      await gadSay(g, 'שב! תאכל! קרעפלעך טריים מה... לא!! חמץ!! כלומר — מותר עד מחר בבוקר!! כלומר — תאכל מהר!!!');
      await g.playerSay('המגש הופיע ונעלם לפני שהספקתי להושיט יד. שירות מרשים, מבחינה טכנית.');
    } else if (which === 1) {
      await gadSay(g, 'לחמניות! רכות! חמות! ...רגע. רגע רגע רגע. גם זה חמץ. תשכח שראית. תשכח שהרחת!');
      await g.playerSay('אני עד ראייה בעל כורחי לפשע המאפה השלישי הערב.');
    } else {
      await gadSay(g, 'מים! קח מים! מים זה בטוח! ...רגע. השריתי בהם שיפון. אל תשאל למה. תקופה קשה.');
      await g.playerSay('גם המים בכפר הזה חמץ. אני רושם לפניי לא לנשום עמוק ליד המזווה.');
    }
  }

  async function gadRecap(g) {
    var needBedikah = !hasSealSafe(g, 'bedikah');
    var needLight = !hasSealSafe(g, 'light');
    var needMelakhah = !hasSealSafe(g, 'melakhah');
    if (!needBedikah && !needLight && !needMelakhah) {
      await gadSay(g, 'שלושה חותמות?! ומה אתה עומד פה?! בית הבד! המנורה! רוץ!! הסמטה שם, בין העמוד לפונדק!');
      await g.playerSay('רץ. טכנית — הולך בקצב נמרץ. יש לי נר ביד.');
      return;
    }
    if (needBedikah) {
      if (g.has && g.has('nerlit')) {
        await gadSay(g, 'יש לך אש?! אמיתית?! למרתף! עכשיו! פרידא מחכה שם עם הנוצה כבר שעתיים!');
      } else if (g.has && g.has('ner')) {
        await gadSay(g, 'נר יש לך — אש אין. נר כבוי בודק בערך כמו קרעפלעך. בועז בפסגה, במערב — הוא שומר על הגחלת האחרונה.');
      } else {
        await gadSay(g, 'המרתף שלי מחכה לבדיקה. רד לפרידא — הדלת הכפולה ליד הקיר. היא כבר תסביר לך מה חסר. הכל חסר.');
      }
    }
    if (needLight) {
      await gadSay(g, 'ובמצפה במזרח — נפתלי החליט ש"אוֹר" זה יום. תוריד אותו מהעץ הזה בעדינות. הוא רגיש. והעץ גבוה.');
    }
    if (needMelakhah) {
      await gadSay(g, 'ובפסגה במערב — בועז לא נותן אש בלי שיעור בזמנים. ככה הוא. איש של אש, קצת שרוף בעצמו.');
    }
    await g.playerSay('סיכום ביניים: כפר אחד, שלושה חותמות, ואפס שעות שינה לפונדקאי.');
  }

  async function gadTalk(g) {
    if (!g.flag('innGadMet')) {
      g.flag('innGadMet', true);
      await gadSay(g, 'ברוך הבא! שב! תנוח! אל תיגע בכלום! במיוחד לא בעגלה! ובעצם גם לא בכיסא — ייתכן פירורים!');
      await g.playerSay('פונדקאי שמארח אותך ומתחרט על זה באותו משפט. כישרון.');
    }
    // one-time beacon callback once melakhah is sealed — placed AFTER the
    // first-meeting block so the welcome always precedes the callback
    if (hasSealSafe(g, 'melakhah') && !g.flag('innGadBeaconNoted')) {
      g.flag('innGadBeaconNoted', true);
      await gadSay(g, 'רגע — אתה רואה את הנקודה שם במערב? בועז הדליק? אז יש אש בכפר! ...רגע, למה אני שמח. זה אומר שהמרתף שלי עומד להיבדק.');
    }
    await gadDishGag(g);
    var talking = true;
    while (talking) {
      var choice = await g.choose([
        { text: 'מה נשאר לי לעשות?', value: 'recap' },
        { text: 'ספר לי על הכפר.', value: 'village' },
        { text: 'יש חדר פנוי הלילה?', value: 'room' },
        { text: 'תמשיך להגיש. אני זז.', value: 'bye' }
      ]);
      if (choice === 'recap') {
        await gadRecap(g);
      } else if (choice === 'village') {
        await gadSay(g, 'כפר נהורא. קראו לו על שם האור. עכשיו האור בפגרה, השמיים קרועים, והשם תובע אותנו על הטעיה.');
        await gadSay(g, 'ובלילה הזה — אוֹר לארבעה עשר — כל הכפר אמור לבדוק חמץ. במקום זה כולם עומדים ומתווכחים מה זה "אוֹר".');
      } else if (choice === 'room') {
        await gadSay(g, 'לישון? בטח! חדר מצוין! רק תגיד לי — לישון של לילה או נמנום של יום? כי המחיר שונה!!');
        await g.playerSay('אני אחזור אליך כשהשמיים יחליטו. כלומר — כשאני אחליט בשבילם.');
      } else {
        await gadSay(g, 'לך! תבדוק! תציל! ואם אתה רואה פירור בדרך — אל תספר לי, הלב שלי לא בנוי לזה!');
        talking = false;
      }
    }
  }

  // ---------------------------------------------------------------------
  // TWINS dialogue — the stereo be-khi-tov argument, one word further each
  // visit; post-`light` they've swapped and yell each other's lines.
  // ---------------------------------------------------------------------
  async function twinsTalk(g) {
    // callback egg: after meeting Huna & Yehuda at the press, the twins
    // adopt the machloket itself (defensive multi-name flag read;
    // press.js sets 'pressRabbisMet'). Gated on innTwinsMet so the
    // payoff never fires before the twins' original argument intro.
    var f = stateFlags();
    var metSages = !!(f.pressRabbisMet || f.pressSagesMet || f.metHunaYehuda || f.hunaYehudaMet || f.pressMet);
    if (metSages && g.flag('innTwinsMet') && !g.flag('innTwinsSages')) {
      g.flag('innTwinsSages', true);
      await twinOutSay(g, 'נַגְהֵי!');
      await twinInSay(g, 'לֵילֵי!');
      await catSay(g, 'מִיאוּ. מִיאוּ כִּי מִיאוּ.');
      await g.playerSay('אפילו החתולה כבר מדקלמת משהו בקצב של הדף הבא. היא מקדימה את כולנו.');
      return;
    }
    if (!g.flag('innTwinsMet')) {
      g.flag('innTwinsMet', true);
      await twinOutSay(g, 'אני לא זז! רב אמר! «וְיֵצֵא בְּכִי טוֹב»! תראה שמיים! חצי טוב!');
      await twinInSay(g, 'ואני לא נכנס! «יִכָּנֵס אָדָם בְּכִי טוֹב»! אותם שמיים! אותו חצי!');
      await g.playerSay('תאומים תקועים בדלת אחת. אחד מסרב לצאת, אחד מסרב להיכנס. הדלת מסרבת להגיב.');
      await g.playerSay('העצה של רב הגיונית לגמרי — נכנסים לעיר כשעוד אור, יוצאים כשעוד אור. הבעיה שהאור פה בשביתה איטלקית.');
      return;
    }
    var swapped = hasSealSafe(g, 'light');
    var step = flagNum(g, 'innTwinsStep');
    g.flag('innTwinsStep', step + 1);
    if (swapped && !g.flag('innTwinsSwapNoted')) {
      g.flag('innTwinsSwapNoted', true);
      await twinOutSay(g, 'אני לא נכנס! כלומר — לא יוצא! כלומר... מה הייתי קודם?');
      await twinInSay(g, 'אתה היית אני! כלומר — אני הייתי אתה! העיקר: לא זזים!');
      await g.playerSay('הם התחלפו וכל אחד צועק עכשיו את הטיעון של השני. אף אחד לא שם לב. מרהיב.');
      return;
    }
    if (step % 3 === 0) {
      await twinOutSay(g, '«לְעוֹלָם—»');
      await twinInSay(g, '«לְעוֹלָם—»');
      await twinOutSay(g, 'אתה קודם!');
      await twinInSay(g, 'לא, אתה!');
    } else if (step % 3 === 1) {
      await twinOutSay(g, 'לְעוֹלָם יֵצֵא אָדָם—!');
      await twinInSay(g, '«לְעוֹלָם יִכָּנֵס אָדָם—»');
      await g.playerSay('הם מתקדמים מילה בכל פעם. בקצב הזה הם יסיימו את הציטוט בדיוק בזמן לפסח שני.');
    } else {
      await twinOutSay(g, '«לְעוֹלָם יִכָּנֵס אָדָם בְּכִי טוֹב, וְיֵצֵא בְּכִי טוֹב»!');
      await twinInSay(g, '«לְעוֹלָם יִכָּנֵס אָדָם בְּכִי טוֹב, וְיֵצֵא בְּכִי טוֹב»!');
      await twinOutSay(g, 'אז למה אתה זז?!');
      await twinInSay(g, 'אני?! אתה!');
    }
  }

  // ---------------------------------------------------------------------
  // CAT dialogue — meow gags, the cellar hint, and the hidden master egg
  // for players who investigated EVERYTHING (trough, telescope, rooster).
  // ---------------------------------------------------------------------
  var CAT_PERCH_LINES = [
    'היא יושבת על הר החמץ ומכריזה עליו מוקצה. גם על עצמה. ליתר ביטחון.',
    'עברה לשוקת. הכריזה על המים מוקצה. המים ענו «מַאי?». יש להם שפה משותפת.',
    'טיפסה לזרוע השלט. מוקצה, כמובן. כולל הכוכב המצויר.',
    'יושבת על הראש של גד. הכריזה עליו מוקצה. הוא עוד לא יודע.'
  ];

  async function catMasterEgg(g) {
    await g.cutscene(async function () {
      safeSfx(g, 'magic');
      await catSay(g, 'בדקת את השוקת. את הטלסקופ. את התרנגול. אפילו אותי. אתה מבין שזה בעצם כל הדף? לבדוק בכל מקום שמכניסים בו משהו.');
      await catSay(g, 'פרס למי שבודק הכול. תתקרב... «בֵּיצָה שֶׁנּוֹלְדָה בְּיוֹם טוֹב» — ככה נפתחת המסכת שלי. שתדע לאן ההרפתקה ממשיכה, חוקר.');
      await g.playerSay('קיבלתי ספוילר ממסכת. כלומר — מחתולה.');
      g.flag('egg_masterDone', true);
    });
  }

  async function catTalk(g) {
    // hidden micro-payoff: "a true examiner" — all investigation eggs done
    var f = stateFlags();
    if (f.egg_pitaCat && (flagNum(g, 'egg_troughTalks') >= 3) && f.egg_telescope && f.egg_rooster && !f.egg_masterDone) {
      await catMasterEgg(g);
      return;
    }
    if (!g.flag('innCatMet')) {
      g.flag('innCatMet', true);
      await catSay(g, 'מִיאוּ.');
      await g.playerSay('בכפר הזה קוראים לחתולים על שם מסכתות. לה קוראים בֵּיצָה. גם מסכת, גם ארוחת בוקר. היא בשלום עם זה.');
    }
    var talking = true;
    while (talking) {
      var choice = await g.choose([
        { text: 'מה את שומרת בדיוק?', value: 'guard' },
        { text: 'יש לך רמז בשבילי?', value: 'hint' },
        { text: 'מיאו?', value: 'meow' },
        { text: 'תמשיכי לשמור. שלום.', value: 'bye' }
      ]);
      if (choice === 'guard') {
        await catSay(g, 'מִיאוּ. (מבט ארוך ומשמעותי על ערימת החמץ.)');
        await g.playerSay('היא שומרת על החמץ עד הביעור של מחר. שומרת, לא טועמת. חתולה עם עקרונות.');
      } else if (choice === 'hint') {
        await catSay(g, 'מִיאוּ. (היא מסובבת את האף, לאט ובכוונה, לעבר דלתות המרתף.)');
        await g.playerSay('שובל פירורים מהעגלה עד דלת המרתף. או שביצה מנסה להגיד משהו, או שגד אוכל תוך כדי הליכה. או שניהם.');
      } else if (choice === 'meow') {
        await catSay(g, 'מִיאוּ. (זה "מַאי?" בחתולית. גם היא לומדת את הדף.)');
        await g.playerSay('עניתי "אוֹר". היא לא נראתה משוכנעת. גם רב הונא ורב יהודה לא היו.');
      } else {
        await catSay(g, 'מִיאוּ. (תרגום: השמירה נמשכת. אל תפריע למשמרת.)');
        talking = false;
      }
    }
  }

  // ---------------------------------------------------------------------
  // TROUGH — the Aramaic echo gag, escalating; hides easter egg #2
  // ---------------------------------------------------------------------
  async function troughPoke(g) {
    var cnt = flagNum(g, 'egg_troughTalks');
    if (cnt === 0) {
      g.flag('egg_troughTalks', 1);
      await troughSay(g, '«מַאי?»');
      await g.playerSay('רכנתי לשתות והשוקת גרגרה בחזרה. עניתי "אור". נראה לי שפתחתי סוגיה.');
    } else if (cnt === 1) {
      g.flag('egg_troughTalks', 2);
      await troughSay(g, '«מַאי אוֹר?»');
      await g.playerSay('שאלה מצוינת. רב הונא אומר נַגְהֵי, רב יהודה אומר לֵילֵי — והשוקת מגרגרת. תיכנסי לתור, גברת.');
    } else if (cnt === 2) {
      g.flag('egg_troughTalks', 3);
      await troughSay(g, '...נַגְהֵי? ...לֵילֵי? ...מַאי אֲנָא יָדַע, אֲנָא שׁוֹקֶת.');
      await g.playerSay('גם המים במחלוקת. אני הולך.');
    } else if (hasSealSafe(g, 'light')) {
      await troughSay(g, '«שְׁמַע מִינַּהּ!»');
      await g.playerSay('שְׁמַע מִינַּהּ — "אוֹר" זה ערב! גם השוקת סגרה את הסוגיה לפניי. אני שותה מים של תלמידת חכמים.');
    } else {
      await troughSay(g, '«מַאי מַאי?»');
      await g.playerSay('היא נכנסה ללופ. אני מזדהה.');
    }
  }

  // ---------------------------------------------------------------------
  // Scene definition
  // ---------------------------------------------------------------------
  var catHotspot = {
    id: 'cat',
    name: 'בֵּיצָה הַחֲתוּלָה',
    type: 'char',
    x: CAT_SPOTS[0].rx, y: CAT_SPOTS[0].ry, w: CAT_SPOTS[0].rw, h: CAT_SPOTS[0].rh,
    walkTo: { x: CAT_SPOTS[0].wx, y: CAT_SPOTS[0].wy },
    draw: function (ctx, t) {
      // perch #3 is painted from within drawGad (she sits on his head and
      // must render after him); skip here to avoid a double draw.
      if (catSpotIndex() === 3) return;
      drawCat(ctx, t);
    },
    look: async function (g) {
      var idx = catSpotIndex();
      await g.playerSay('חתולה בפוזה של אבן. אבן זה מוקצה קלאסי — היא לא רק פוסקת, היא מדגימה.');
      await g.playerSay(CAT_PERCH_LINES[idx] || CAT_PERCH_LINES[0]);
    },
    talk: catTalk,
    take: async function (g) {
      await catSay(g, 'מִיאוּ! (תרגום חופשי: אסור לטלטל אותי. אני מוקצה. תבדוק במסכת שלי.)');
      await g.playerSay('זו עמדתה, לא פסק הלכה. אבל עם ציפורניים כאלה — מי מתווכח.');
    },
    use: async function (g, itemId) {
      if (!itemId) { await g.playerSay('להשתמש בחתולה? היא משתמשת בי, אם כבר. ככה זה עובד.'); return; }
      if (itemId === 'pita') {
        // easter egg #1 — halachic horror
        g.flag('egg_pitaCat', true);
        await catSay(g, 'חמץ?! עליי?! אני חתולה שומרת מסורת. תרחיק את זה — ותגיד לפרידא שמצאת. היא תתרגש.');
        await g.playerSay('חתולה עם יראת שמיים. רק בכפר נהורא.');
        return;
      }
      if (itemId === 'nerlit') {
        await g.playerSay('לבדוק את ביצה? כל מקום שאין מכניסין בו חמץ אין צריך בדיקה — והיא בחיים לא הכניסה, רק שמרה.');
        return;
      }
      if (itemId === 'ner') {
        await g.playerSay('נר כבוי מול חתולה. שנינו לא מאירים כרגע, אבל רק אחד מאיתנו רגוע עם זה.');
        return;
      }
      if (itemId === 'daf') {
        await g.playerSay('היא מרחרחת את הדף ומהנהנת לאט. חוות דעת מקצועית התקבלה.');
        return;
      }
      await catSay(g, 'מִיאוּ. (לא. פשוט לא.)');
    }
  };

  window.GAME.registerScene('inn', {
    name: 'פּוּנְדַּק בְּכִי טוֹב',
    floor: { yMin: 126, yMax: 170 },

    paint: function (ctx, t, S) {
      try {
        paintSky(ctx, t, S);
        paintHills(ctx, t, S);
        paintStable(ctx, t);
        paintTree(ctx, t);
        paintInn(ctx, t);
        paintPaths(ctx, t);
        paintFloor(ctx, t, S);
        paintTrapdoor(ctx, t);
        paintTrough(ctx, t);
        paintCart(ctx, t);
        paintSignPost(ctx, t);
      } catch (e) {
        px(ctx, 0, 0, 320, 180, NIGHT_MID);
        if (!window.__innPaintWarned) {
          window.__innPaintWarned = true;
          if (window.console && console.warn) console.warn('inn paint error:', e);
        }
      }
    },

    onEnter: async function (g) {
      try {
        safeMusic('night');
        // rotate the cat's perch on every RE-entry (running gag)
        if (g.flag('innEntered')) {
          g.flag('innCatSpot', (flagNum(g, 'innCatSpot') + 1) % CAT_SPOTS.length);
        } else {
          g.flag('innEntered', true);
          g.flag('innCatSpot', 0);
        }
        var sp = CAT_SPOTS[catSpotIndex()];
        catHotspot.x = sp.rx; catHotspot.y = sp.ry;
        catHotspot.w = sp.rw; catHotspot.h = sp.rh;
        catHotspot.walkTo = { x: sp.wx, y: sp.wy };
        if (!g.flag('innLooked')) {
          g.flag('innLooked', true);
          await g.cutscene(async function () {
            await g.playerSay('פונדק "בכי טוב". שמיים קרועים לשניים, תאומים תקועים בדלת, וחתולה שומרת על הר חמץ. אוֹר לארבעה עשר — עכשיו רק צריך לברר מה זה "אוֹר".');
          });
        }
      } catch (e) { /* never crash on entry */ }
    },

    hotspots: [
      // --- Exits first (declaration order = LOWEST hit priority) ---
      {
        id: 'exit_summit',
        name: 'אֶל הַפִּסְגָּה',
        type: 'exit',
        x: 0, y: 80, w: 24, h: 52,
        walkTo: { x: 16, y: 148 },
        target: 'summit',
        spawn: { x: 292, y: 150 },
        look: async function (g) {
          await g.playerSay('שביל מערבי מטפס אל תוך צד הלילה. שם למעלה בועז שומר על הגחלת האחרונה — היחיד בכפר שבשבילו "חושך בחוץ" זה תיאור משרה.');
        }
      },
      {
        id: 'exit_observatory',
        name: 'אֶל הַמִּצְפֶּה',
        type: 'exit',
        x: 296, y: 80, w: 24, h: 52,
        walkTo: { x: 302, y: 150 },
        target: 'observatory',
        spawn: { x: 28, y: 150 },
        look: async function (g) {
          await g.playerSay('שביל מזרחי אל תוך השחר התקוע. נפתלי הצופה שם למעלה, רב עם השמיים ומפסיד.');
        }
      },
      {
        id: 'exit_press',
        name: 'אֶל בֵּית הַבַּד',
        type: 'exit',
        x: 166, y: 76, w: 24, h: 50,
        walkTo: { x: 178, y: 136 },
        target: 'press',
        spawn: { x: 160, y: 152 },
        look: async function (g) {
          await g.playerSay('מהסמטה עולה ריח של שמן זית עתיק ושל מנורה שנעלבה.');
        }
      },
      {
        id: 'exit_cellar',
        name: 'אֶל הַמַּרְתֵּף',
        type: 'exit',
        x: 246, y: 112, w: 40, h: 26,
        walkTo: { x: 264, y: 142 },
        target: 'cellar',
        spawn: { x: 160, y: 150 },
        look: async function (g) {
          await g.playerSay('דלת מרתף כפולה ליד קיר הפונדק, ושובל פירורים שנכנס פנימה בלי לדפוק. חמץ שהולך לבד למקום שבודקים בו — סוף סוף מישהו פה משתף פעולה.');
        }
      },

      // --- Objects ---
      {
        id: 'sign',
        name: 'שֶׁלֶט הַפּוּנְדָּק',
        type: 'object',
        x: 144, y: 52, w: 32, h: 28,
        walkTo: { x: 158, y: 140 },
        look: async function (g) {
          await g.playerSay('כוכב אחד בביקורות: "שירות מצוין, אבל אף אחד לא מסכים מתי צ\'ק־אאוט."');
          await g.playerSay('תקנון: "אורח שנכנס — שייכנס בכי טוב. אורח שיוצא — שייצא בכי טוב. אורח באמצע — שיחליט כבר."');
          await g.playerSay('ולמטה, חרוט עמוק: «אוֹר לְאַרְבָּעָה עָשָׂר בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר».');
          await g.playerSay('זהו. זו המשימה. הלילה בודקים. עם נר. כל השאר — פרטים טכניים של שמיים קרועים.');
        },
        take: async function (g) {
          await g.playerSay('לקחת את השלט? הוא היחיד בכפר שמצטט את המשנה בלי להתווכח איתה. שיישאר תלוי — שיהיה פה לפחות מבוגר אחראי אחד.');
        },
        use: async function (g, itemId) {
          if (!itemId) { await g.playerSay('השלט מתנדנד: רגע מואר, רגע חשוך. רב הונא, רב יהודה, רב הונא, רב יהודה. מחלוקת עם ציר.'); return; }
          if (itemId === 'ner') {
            await g.playerSay('נר כבוי לא בודק כלום. «בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר» — לְאוֹר. קודם אש, גיבור.');
            return;
          }
          if (itemId === 'nerlit') {
            await g.playerSay('להאיר את השלט? הוא כבר חצי מואר. זו בדיוק הבעיה שלו.');
            return;
          }
          if (itemId === 'daf') {
            await g.playerSay('אותו משפט על השלט ועל הדף. לפחות על דבר אחד בכפר הזה יש הסכמה מלאה.');
            return;
          }
          await g.playerSay('השלט ממשיך להתנדנד. הוא לא לוקח צד. חכם ממני.');
        }
      },
      {
        id: 'trough',
        name: 'הַשּׁוֹקֶת',
        type: 'object',
        x: 84, y: 120, w: 36, h: 22,
        walkTo: { x: 102, y: 148 },
        look: async function (g) {
          await g.playerSay('מישהו נעץ נוצה וכף עץ במים — ערכת בדיקת חמץ שמעמידה פנים שהיא סירה. עלה שקד עוגן על הכף.');
        },
        talk: troughPoke,
        take: async function (g) {
          await g.playerSay('לקחת שוקת שלמה? הסוסים יגישו תלונה. והם מאורגנים יותר ממה שנדמה.');
        },
        use: async function (g, itemId) {
          if (!itemId) { await troughPoke(g); return; }
          if (itemId === 'pita') {
            await g.playerSay('להשרות את הפיתה? היא שרדה אלפיים שנה יבשה. לא אני אשבור לה את הרצף.');
            return;
          }
          if (itemId === 'ner' || itemId === 'nerlit') {
            await g.playerSay('נר ומים זה שילוב עם סוף ידוע מראש. הנר נשאר אצלי.');
            return;
          }
          if (itemId === 'daf') {
            await g.playerSay('לקרב דף גמרא למים? רטיבות זו לא דרך לימוד. השוקת תסתדר עם הגרסה שבעל־פה.');
            return;
          }
          await troughPoke(g);
        }
      },
      {
        id: 'cart',
        name: 'עֲגָלַת הֶחָמֵץ',
        type: 'object',
        x: 112, y: 96, w: 46, h: 42,
        walkTo: { x: 134, y: 146 },
        look: async function (g) {
          await g.playerSay('רשימת מלאי: קרוטון בגודל של תינוק, בייגלה שזוכר את החורבן, ולחמנייה שגד מכחיש שהיא שלו.');
          await g.playerSay('הכל מסודר יפה עם פתק: "לביעור של מחר". החמץ האחרון של כפר נהורא, בדרכו החוצה בכבוד.');
        },
        take: async function (g) {
          await gadSay(g, 'לא לגעת בעגלה!!! זה מסודר לפי גודל פירור!! יש שיטה!!');
          await g.playerSay('יש שיטה. אין שלווה.');
        },
        use: async function (g, itemId) {
          if (!itemId) {
            await gadSay(g, 'מה אתה עושה שם?! עגלה זה לא צעצוע! זה חמץ בהשגחה!');
            return;
          }
          if (itemId === 'pita') {
            await g.playerSay('להוסיף אותה לערימה? הביעור מחר בבוקר, לא הערב. הערב רק בּוֹדְקִין — לאור הנר. וגד מספיק לחוץ.');
            return;
          }
          if (itemId === 'nerlit') {
            await g.playerSay('לקרב אש לערימת חמץ יבש? הביעור מחר, ובשליטה. גד היה מתעלף פעמיים — פעם מהבהלה ופעם מהריח.');
            return;
          }
          if (itemId === 'ner') {
            await g.playerSay('נר כבוי ליד ערימת חמץ. הדבר הכי לא מסוכן שעשיתי היום, וגם הכי חסר טעם.');
            return;
          }
          if (itemId === 'daf') {
            await g.playerSay('העגלה היא ההפך הגמור מ«מָקוֹם שֶׁאֵין מַכְנִיסִין בּוֹ חָמֵץ». לכאן רק מכניסים. בערימות.');
            return;
          }
          await gadSay(g, 'שים את זה בצד!! העגלה בתפוסה מלאה!!');
        }
      },
      {
        id: 'windows',
        name: 'חַלּוֹנוֹת הַפּוּנְדָּק',
        type: 'object',
        x: 194, y: 34, w: 104, h: 48,
        walkTo: { x: 244, y: 152 },
        look: async function (g) {
          await g.playerSay('חצי מהחלונות דולקים וחצי כבויים. הפונדק ישן ומתעורר בו־זמנית. כמו זרח בשיעור מוקדם.');
          await g.playerSay('ועל אדן אחד — נוצה וכף עץ, מוכנות לבדיקה. מישהו פה אופטימי שתהיה אש הלילה. אני מקווה שהוא צודק.');
        },
        take: async function (g) {
          await g.playerSay('החלונות מחוברים לקיר, והקיר מחובר לפונדק, והפונדק מחובר רגשית לגד. עדיף לא.');
        },
        use: async function (g, itemId) {
          if (!itemId) { await g.playerSay('דפקתי קלות על תריס. מבפנים ענתה נחירה. שכנעת אותי, אמשיך הלאה.'); return; }
          if (itemId === 'ner') {
            await g.playerSay('נר כבוי לא בודק כלום. «בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר» — לְאוֹר. קודם אש, גיבור.');
            return;
          }
          if (itemId === 'nerlit') {
            await g.playerSay('הבדיקה של הפונדק היא עסק של גד ופרידא. אני עם הנר שלי — למרתף.');
            return;
          }
          if (itemId === 'daf') {
            await g.playerSay('חלון דולק, חלון כבוי, דף ביד. שלושה מצבי צבירה של "אוֹר".');
            return;
          }
          await g.playerSay('התריס חורק משהו כמו "לא בשעות האלה".');
        }
      },
      {
        id: 'tree',
        name: 'אִילַן הַשָּׁקֵד',
        type: 'object',
        x: 24, y: 48, w: 48, h: 78,
        walkTo: { x: 48, y: 142 },
        look: async function (g) {
          await g.playerSay('שקדייה פורחת בניסן. הדבר היחיד בכפר שיודע בדיוק מה השעה.');
        },
        take: async function (g) {
          await g.playerSay('לקטוף? היא היחידה פה שמתפקדת לפי לוח שנה. שתישאר בדיוק איפה שהיא.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('הנחתי את הדף מתחת לעץ. עלה שקד נחת עליו בדיוק על המילה "אוֹר". גם הטבע מצביע.');
            return;
          }
          await g.playerSay('נענעתי ענף. ירד עליי גשם ורוד. שווה את זה.');
        }
      },
      {
        id: 'stable',
        name: 'הָאֻרְוָה',
        type: 'object',
        x: 22, y: 62, w: 58, h: 64,
        walkTo: { x: 64, y: 140 },
        look: async function (g) {
          await g.playerSay('אורווה חשוכה. הסוסים החליטו שזה לילה, סגרו עיניים, וסיימו את הוויכוח. הכי חכמים בכפר.');
        },
        take: async function (g) {
          await g.playerSay('לצאת לדרך עכשיו? «וְיֵצֵא בְּכִי טוֹב» — יוצאים רק כשיש אור בשמיים. הסוס למד את הדף לפניי, ולכן הוא ישן.');
        },
        use: async function (g, itemId) {
          if (itemId === 'ner' || itemId === 'nerlit') {
            await g.playerSay('קש יבש ואש זה שידוך שאף שדכן לא היה מציע. ממשיך הלאה.');
            return;
          }
          await g.playerSay('מבפנים נשמעה נחירה עמוקה של מישהו שהשלים עם המציאות.');
        }
      },

      // --- Characters (declared late = win overlapping hit-tests) ---
      {
        id: 'gad',
        name: 'גָּד הַפּוּנְדְּקַאי',
        type: 'char',
        x: 178, y: 120, w: 28, h: 38,
        walkTo: { x: 174, y: 156 },
        draw: function (ctx, t, S) { drawGad(ctx, t, S); },
        look: async function (g) {
          await g.playerSay('פונדקאי שמחזיק מגש ביד אחת ומושך אותו חזרה ביד השנייה. שיווי משקל של ערב ארבעה עשר.');
        },
        talk: gadTalk,
        take: async function (g) {
          await g.playerSay('לקחת את גד? הוא מגיע עם פונדק שלם, שני תאומים תקועים וחוב רגשי לעגלת חמץ. אין לי מקום בתיק.');
        },
        use: async function (g, itemId) {
          if (!itemId) { await gadSay(g, 'כן! מה! מה צריך! שב! אל תשב! הרגע ניקיתי!'); return; }
          if (itemId === 'pita') {
            await gadSay(g, 'פיתה?! עתיקה?! תרחיק! אני שומר על ניקיון מאז צהריים! זה הישג שלא הולך להתבזבז על ארכיאולוגיה!');
            return;
          }
          if (itemId === 'ner') {
            await gadSay(g, 'נר יפה. כבוי. כמו כל הכפר. אתה מבין את גודל הבעיה? לך לבועז!');
            return;
          }
          if (itemId === 'nerlit') {
            await gadSay(g, 'אש!! יש לך אש!! למרתף! לפרידא! למה אתה עוד מדבר איתי?!');
            return;
          }
          if (itemId === 'daf') {
            await gadSay(g, '«אוֹר לְאַרְבָּעָה עָשָׂר בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר». כתוב! פשוט! אז למה כל הכפר בפילוסופיה?!');
            return;
          }
          await gadSay(g, 'זה לא מהתפריט. וגם מה שמהתפריט — אסור. תקופה מורכבת.');
        }
      },
      {
        id: 'twins',
        name: 'שַׁחַר וְלֵיל הַתְּאוֹמִים',
        type: 'char',
        x: 206, y: 86, w: 36, h: 42,
        walkTo: { x: 222, y: 138 },
        draw: function (ctx, t, S) { drawTwins(ctx, t, S); },
        look: async function (g) {
          if (hasSealSafe(g, 'light')) {
            await g.playerSay('הם התחלפו. עכשיו זה שיוצא נכנס וזה שנכנס יוצא. התקדמות? תלוי את מי שואלים.');
            return;
          }
          await g.playerSay('שחר תקוע בחוץ, ליל תקוע בפנים. או הפוך. גם הם כבר לא בטוחים.');
        },
        talk: twinsTalk,
        take: async function (g) {
          await g.playerSay('להזיז אותם? הם מחוברים לדלת בכוח האידיאולוגיה. זה חזק ממסמרים.');
        },
        use: async function (g, itemId) {
          if (!itemId) { await g.playerSay('ניסיתי לדחוף. שניהם דחפו בחזרה, כל אחד לכיוון אחר. הדלת ניצחה.'); return; }
          if (itemId === 'daf') {
            await g.playerSay('הראיתי להם את המקור: «לְעוֹלָם יִכָּנֵס אָדָם בְּכִי טוֹב, וְיֵצֵא בְּכִי טוֹב».');
            await twinOutSay(g, 'רואה?! יִכָּנֵס!');
            await twinInSay(g, 'רואה?! יֵצֵא!');
            await g.playerSay('שניהם שמעו את אותה מימרא של רב — והבינו הפוך. חינוך זה דבר מופלא.');
            return;
          }
          if (itemId === 'nerlit') {
            await g.playerSay('הארתי עליהם. עכשיו שניהם טוענים שזה "כי טוב" ומסרבים לזוז מסיבות חדשות לגמרי.');
            return;
          }
          await g.playerSay('הם עסוקים מדי בלא־לזוז. אין פתח, תרתי משמע.');
        }
      },

      // --- The cat LAST: her hit rect must win wherever she perches ---
      catHotspot
    ]
  });

})();
