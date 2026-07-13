'use strict';
/*
 * Scene: roof — "גג המצפה" (The Observatory Roof)
 * Star puzzle: exactly 3 MEDIUM stars appear over time; clicking all 3
 * proves tzeit hakochavim and yields the 'starproof' item.
 * Decoys: 2 big bright stars, the moon, and a giggling firefly.
 * NPC: a pedantic owl with tiny glasses who explains the 3-medium-stars rule.
 */
(function () {
  if (!window.GAME || typeof window.GAME.registerScene !== 'function') {
    if (window.console && console.warn) console.warn('roof.js: GAME engine not available, scene not registered');
    return;
  }

  // ---------------------------------------------------------------------
  // Constants & deterministic pseudo-random helpers
  // ---------------------------------------------------------------------

  var W = 320, H = 180;
  var SKY_TOP = '#0a0a23', SKY_MID = '#141440', SKY_LOW = '#232366';
  var STONE_D = '#4a4a68', STONE_M = '#6b6b8f', STONE_L = '#8f8fb0';
  var WOOD_D = '#5a3a24', WOOD_L = '#7a512f';
  var AMBER = '#ffd166', AMBER2 = '#ffb347';
  var PARCH = '#e8d8a8';

  // Medium-star appearance times (seconds after first roof entry).
  var APPEAR_BASE = [2.5, 9, 16];
  var APPEAR_SKYVIEW = [1, 3.5, 6]; // telescope used -> stars spotted sooner

  // Medium star positions (center points, sky area).
  var MSTARS = [
    { x: 140, y: 38 },
    { x: 208, y: 22 },
    { x: 96, y: 52 }
  ];
  // Big decoy stars.
  var BSTARS = [
    { x: 52, y: 30 },
    { x: 240, y: 56 }
  ];

  function rnd(i) {
    var x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Precomputed background star field (deterministic).
  var BG_STARS = [];
  (function () {
    for (var i = 0; i < 72; i++) {
      var sx = 4 + Math.floor(rnd(i) * 312);
      var sy = 3 + Math.floor(rnd(i + 100) * 96);
      // Keep clear halos around the interactive stars and the moon.
      var blocked = false;
      var pts = MSTARS.concat(BSTARS).concat([{ x: 272, y: 26 }]);
      for (var p = 0; p < pts.length; p++) {
        if (Math.abs(sx - pts[p].x) < 12 && Math.abs(sy - pts[p].y) < 12) { blocked = true; break; }
      }
      if (blocked) continue;
      BG_STARS.push({
        x: sx, y: sy,
        tw: 1 + rnd(i + 200) * 2.5,   // twinkle speed
        ph: rnd(i + 300) * 6.283,     // twinkle phase
        big: rnd(i + 400) > 0.85      // a few 2px stars
      });
    }
  })();

  // ---------------------------------------------------------------------
  // Flag helpers
  // ---------------------------------------------------------------------

  function flags(S) { return (S && S.flags) || {}; }

  function roofElapsed(S) {
    var t0 = flags(S).roofEnteredAt;
    if (!t0) return 0;
    return (Date.now() - t0) / 1000;
  }

  function appearTime(n, S) {
    var arr = flags(S).roofSkyview ? APPEAR_SKYVIEW : APPEAR_BASE;
    return arr[n - 1] != null ? arr[n - 1] : 999;
  }

  function countFound(S) {
    var f = flags(S), c = 0;
    if (f.roofStar1) c++;
    if (f.roofStar2) c++;
    if (f.roofStar3) c++;
    return c;
  }

  function bloomProgress(S) {
    var t0 = flags(S).roofBloomAt;
    if (!t0) return 0;
    var p = (Date.now() - t0) / 4000;
    return p > 1 ? 1 : p;
  }

  // ---------------------------------------------------------------------
  // Drawing helpers (defensive fallbacks if SPRITES helpers are missing)
  // ---------------------------------------------------------------------

  function px(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function dither(ctx, x, y, w, h, c1, c2) {
    if (window.SPRITES && SPRITES.dither) { SPRITES.dither(ctx, x, y, w, h, c1, c2); return; }
    px(ctx, x, y, w, h, c1);
    ctx.fillStyle = c2;
    for (var yy = 0; yy < h; yy++) {
      for (var xx = (yy % 2); xx < w; xx += 2) ctx.fillRect(x + xx, y + yy, 1, 1);
    }
  }

  function glow(ctx, x, y, r, color, alpha) {
    if (window.SPRITES && SPRITES.glow) { SPRITES.glow(ctx, x, y, r, color, alpha); return; }
    ctx.save();
    for (var i = 3; i >= 1; i--) {
      var rr = Math.round(r * i / 3);
      ctx.globalAlpha = alpha * (0.4 - i * 0.1 + 0.15);
      ctx.fillStyle = color;
      ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    ctx.restore();
  }

  function twinkleStar(ctx, x, y, t, size, color) {
    if (window.SPRITES && SPRITES.star) { SPRITES.star(ctx, x, y, t, size, color); return; }
    var a = 0.55 + 0.45 * Math.sin(t * 3 + x * 0.7 + y * 1.3);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = color || '#ffffff';
    ctx.fillRect(x, y - size, 1, size * 2 + 1);
    ctx.fillRect(x - size, y, size * 2 + 1, 1);
    ctx.restore();
  }

  function drawMoon(ctx, t) {
    if (window.SPRITES && SPRITES.moon) { SPRITES.moon(ctx, 272, 26, 0.6); return; }
    // Fallback crescent: bright disc minus offset sky disc.
    var mx = 272, my = 26, r = 11;
    ctx.save();
    ctx.fillStyle = '#e8e8c8';
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = SKY_TOP;
    ctx.beginPath();
    ctx.arc(mx - 5, my - 2, r - 1, 0, 6.283);
    ctx.fill();
    ctx.restore();
    glow(ctx, mx + 3, my, 16, '#e8e8c8', 0.08);
  }

  // ---------------------------------------------------------------------
  // Scene paint pieces
  // ---------------------------------------------------------------------

  function drawSky(ctx, t, S) {
    px(ctx, 0, 0, W, 44, SKY_TOP);
    dither(ctx, 0, 44, W, 4, SKY_TOP, SKY_MID);
    px(ctx, 0, 48, W, 30, SKY_MID);
    dither(ctx, 0, 78, W, 4, SKY_MID, SKY_LOW);
    px(ctx, 0, 82, W, 30, SKY_LOW);

    // Background star field: more stars reveal as the puzzle progresses.
    var found = countFound(S);
    var bloom = bloomProgress(S);
    var visibleCount = 24 + found * 12;
    for (var i = 0; i < BG_STARS.length; i++) {
      var st = BG_STARS[i];
      var a;
      if (i < visibleCount) {
        a = 0.35 + 0.5 * Math.max(0, Math.sin(t * st.tw + st.ph));
      } else if (bloom > 0) {
        a = bloom * (0.4 + 0.5 * Math.max(0, Math.sin(t * st.tw + st.ph)));
      } else {
        continue;
      }
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(st.x, st.y, 1, 1);
      if (st.big) {
        ctx.fillRect(st.x - 1, st.y, 1, 1);
        ctx.fillRect(st.x + 1, st.y, 1, 1);
        ctx.fillRect(st.x, st.y - 1, 1, 1);
        ctx.fillRect(st.x, st.y + 1, 1, 1);
      }
      ctx.restore();
    }

    // After the bloom: a faint milky-way band across the sky.
    if (bloom > 0) {
      ctx.save();
      ctx.globalAlpha = 0.06 * bloom;
      ctx.fillStyle = '#c8c8ff';
      for (var b = 0; b < 5; b++) px(ctx, 0, 18 + b * 9, W, 4, '#c8c8ff');
      ctx.restore();
    }
  }

  function drawBat(ctx, t) {
    // A bat crosses the sky occasionally (every ~18s, for ~3.5s).
    var cycle = t % 18;
    if (cycle > 3.5) return;
    var p = cycle / 3.5;
    var bx = Math.round(-16 + p * (W + 32));
    var by = Math.round(38 + Math.sin(p * 9) * 9);
    var flap = Math.sin(t * 18) > 0;
    ctx.fillStyle = '#05051a';
    px(ctx, bx, by, 3, 2, '#05051a'); // body
    if (flap) { // wings up
      px(ctx, bx - 4, by - 2, 4, 1, '#05051a');
      px(ctx, bx + 3, by - 2, 4, 1, '#05051a');
      px(ctx, bx - 2, by - 1, 2, 1, '#05051a');
      px(ctx, bx + 3, by - 1, 2, 1, '#05051a');
    } else { // wings down
      px(ctx, bx - 4, by + 1, 4, 1, '#05051a');
      px(ctx, bx + 3, by + 1, 4, 1, '#05051a');
    }
  }

  function drawDistantVillage(ctx, t) {
    // Silhouette rooftops peeking above the parapet line.
    ctx.fillStyle = '#12122e';
    px(ctx, 0, 102, 46, 10, '#12122e');
    px(ctx, 8, 96, 14, 8, '#12122e');    // tower
    px(ctx, 46, 105, 40, 7, '#12122e');
    px(ctx, 60, 99, 12, 8, '#12122e');
    px(ctx, 118, 104, 52, 8, '#12122e');
    px(ctx, 132, 98, 10, 8, '#12122e');
    px(ctx, 196, 103, 44, 9, '#12122e');
    px(ctx, 206, 97, 16, 8, '#12122e');  // roof with the cat
    px(ctx, 252, 106, 30, 6, '#12122e');
    // Dome of a far synagogue.
    ctx.beginPath();
    ctx.arc(90, 106, 7, Math.PI, 0);
    ctx.fill();
    // Tiny amber windows, flickering.
    var wins = [[12, 100], [30, 105], [64, 102], [136, 101], [160, 107], [212, 100], [260, 108], [78, 107]];
    for (var i = 0; i < wins.length; i++) {
      var fl = 0.55 + 0.45 * Math.sin(t * 3 + i * 1.9);
      ctx.save();
      ctx.globalAlpha = fl;
      ctx.fillStyle = i % 3 === 0 ? AMBER : AMBER2;
      ctx.fillRect(wins[i][0], wins[i][1], 1, 2);
      ctx.restore();
    }
    // Cat silhouette on a distant roof, tail swishing.
    px(ctx, 210, 93, 5, 3, '#05051a');            // body
    px(ctx, 214, 91, 2, 2, '#05051a');            // head
    px(ctx, 214, 90, 1, 1, '#05051a');            // ear
    var tail = Math.round(Math.sin(t * 1.4) * 2);
    px(ctx, 208, 91 + tail, 2, 1, '#05051a');     // tail tip
    px(ctx, 209, 92, 1, 1, '#05051a');
  }

  function drawParapet(ctx) {
    // Coping stones.
    px(ctx, 0, 110, W, 3, STONE_L);
    px(ctx, 0, 113, W, 1, STONE_D);
    // Wall with brick pattern.
    px(ctx, 0, 114, W, 14, STONE_M);
    ctx.fillStyle = STONE_D;
    for (var row = 0; row < 3; row++) {
      var yy = 114 + row * 5 + 4;
      ctx.fillRect(0, yy, W, 1);
      for (var xx = (row % 2) * 8; xx < W; xx += 16) ctx.fillRect(xx, 114 + row * 5, 1, 4);
    }
    // A few lighter stones for texture.
    px(ctx, 24, 115, 7, 4, '#7d7da0');
    px(ctx, 120, 120, 7, 4, '#7d7da0');
    px(ctx, 232, 115, 7, 4, '#7d7da0');
    // Stair opening in the parapet (left).
    px(ctx, 0, 108, 30, 20, '#1c1c3a');
    px(ctx, 28, 108, 2, 20, STONE_L);
  }

  function drawFloor(ctx) {
    px(ctx, 0, 128, W, H - 128, STONE_D);
    // Tile grid.
    ctx.fillStyle = '#3d3d58';
    for (var yy = 136; yy < H; yy += 10) ctx.fillRect(0, yy, W, 1);
    var r = 0;
    for (var y2 = 128; y2 < H; y2 += 10) {
      for (var x2 = (r % 2) * 12; x2 < W; x2 += 24) ctx.fillRect(x2, y2, 1, 10);
      r++;
    }
    // Some lighter tiles.
    px(ctx, 48, 137, 11, 9, '#565678');
    px(ctx, 156, 147, 11, 9, '#565678');
    px(ctx, 252, 157, 11, 9, '#565678');
    px(ctx, 108, 167, 11, 9, '#565678');
    // Moon-glow patch on the floor.
    glow(ctx, 250, 150, 22, '#8888c0', 0.05);
  }

  function drawStairs(ctx, t) {
    // Steps descending into the dark opening (left).
    px(ctx, 2, 126, 24, 4, STONE_L);
    px(ctx, 4, 130, 22, 4, STONE_M);
    px(ctx, 6, 134, 20, 4, '#5c5c80');
    px(ctx, 8, 138, 18, 4, STONE_D);
    px(ctx, 10, 142, 16, 4, '#3a3a55');
    // Oil lamp on the parapet edge by the stairs, flickering.
    px(ctx, 32, 104, 5, 6, WOOD_L);
    px(ctx, 33, 102, 3, 2, WOOD_D);
    var fl = 0.7 + 0.3 * Math.sin(t * 9 + 1);
    ctx.save();
    ctx.globalAlpha = fl;
    px(ctx, 34, 100, 1, 2, AMBER);
    px(ctx, 34, 99, 1, 1, '#ff8c42');
    ctx.restore();
    glow(ctx, 34, 102, 9, AMBER, 0.12 * fl);
  }

  function drawTelescope(ctx, t) {
    // Tripod legs.
    px(ctx, 70, 146, 2, 14, WOOD_D);
    px(ctx, 80, 146, 2, 14, WOOD_D);
    px(ctx, 75, 148, 2, 12, WOOD_L);
    px(ctx, 72, 144, 8, 4, WOOD_L); // hub
    // Brass tube, stepped diagonal pointing up-right at the sky.
    px(ctx, 68, 138, 10, 7, '#b08d3e');
    px(ctx, 76, 133, 10, 7, '#c9a24d');
    px(ctx, 84, 128, 10, 6, '#c9a24d');
    px(ctx, 92, 123, 9, 6, '#dab55c');
    // Highlights.
    px(ctx, 70, 139, 7, 1, '#e8c76a');
    px(ctx, 86, 129, 6, 1, '#e8c76a');
    // Duct-tape scroll straps (patched repairs).
    px(ctx, 79, 132, 3, 8, '#9a9aa8');
    px(ctx, 90, 125, 3, 7, '#9a9aa8');
    // Eyepiece.
    px(ctx, 66, 140, 3, 3, '#2a2a3a');
    // Lens rim + occasional glint.
    px(ctx, 99, 122, 3, 6, '#2a2a3a');
    if (Math.sin(t * 2.2) > 0.92) px(ctx, 100, 124, 1, 1, '#ffffff');
    // A hanging repair-scroll, swaying.
    var sway = Math.round(Math.sin(t * 1.6) * 1);
    px(ctx, 82 + sway, 140, 4, 6, PARCH);
    px(ctx, 82 + sway, 140, 4, 1, '#c9b48a');
    // Pile of astronomy books next to it.
    px(ctx, 96, 154, 12, 3, '#7a3b46');
    px(ctx, 97, 151, 11, 3, '#2f5d50');
    px(ctx, 98, 148, 9, 3, '#4a4a8a');
    // Star-gazing cushion.
    px(ctx, 120, 158, 14, 5, '#a26bd4');
    px(ctx, 122, 157, 10, 1, '#b98ae0');
  }

  function drawOwl(ctx, t, S) {
    var bob = Math.round(Math.sin(t * 1.7) * 1);
    var y0 = 86 + bob;
    // Wooden post rising from the parapet.
    px(ctx, 286, 104, 4, 26, WOOD_D);
    px(ctx, 287, 104, 1, 26, WOOD_L);
    px(ctx, 282, 102, 12, 3, WOOD_L); // perch crossbar
    // Body.
    px(ctx, 280, y0 + 4, 14, 12, WOOD_L);
    px(ctx, 283, y0 + 8, 8, 7, '#c9b48a'); // belly
    // Belly speckles.
    px(ctx, 284, y0 + 10, 1, 1, WOOD_L);
    px(ctx, 287, y0 + 12, 1, 1, WOOD_L);
    px(ctx, 289, y0 + 9, 1, 1, WOOD_L);
    // Head.
    px(ctx, 281, y0 - 3, 12, 8, WOOD_L);
    // Ear tufts.
    px(ctx, 281, y0 - 5, 2, 2, WOOD_D);
    px(ctx, 291, y0 - 5, 2, 2, WOOD_D);
    // Eyes (blink occasionally).
    var blink = Math.sin(t * 0.9 + 2) > 0.965;
    if (blink) {
      px(ctx, 282, y0 - 1, 4, 1, '#3a2a18');
      px(ctx, 288, y0 - 1, 4, 1, '#3a2a18');
    } else {
      px(ctx, 282, y0 - 2, 4, 4, '#ffffff');
      px(ctx, 288, y0 - 2, 4, 4, '#ffffff');
      // Pupils track slowly (a scholar scanning the sky).
      var look = Math.sin(t * 0.5) > 0 ? 1 : 0;
      px(ctx, 283 + look, y0 - 1, 2, 2, '#1a1208');
      px(ctx, 289 + look, y0 - 1, 2, 2, '#1a1208');
    }
    // Tiny glasses: amber frames + bridge.
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = AMBER;
    ctx.fillRect(281, y0 - 3, 6, 1);
    ctx.fillRect(287, y0 - 3, 6, 1);
    ctx.fillRect(281, y0 + 2, 6, 1);
    ctx.fillRect(287, y0 + 2, 6, 1);
    ctx.fillRect(281, y0 - 3, 1, 6);
    ctx.fillRect(286, y0 - 3, 1, 6);
    ctx.fillRect(287, y0 - 3, 1, 6);
    ctx.fillRect(292, y0 - 3, 1, 6);
    ctx.restore();
    // Beak.
    px(ctx, 286, y0 + 1, 2, 2, '#e8a13e');
    // Wing line.
    px(ctx, 280, y0 + 6, 1, 8, WOOD_D);
    px(ctx, 293, y0 + 6, 1, 8, WOOD_D);
    // Talons on the perch.
    px(ctx, 283, y0 + 16, 2, 1, '#e8a13e');
    px(ctx, 289, y0 + 16, 2, 1, '#e8a13e');
    // If the puzzle is done, the owl gets a proud little sparkle.
    if (flags(S).roofStarsDone && Math.sin(t * 3) > 0.8) px(ctx, 295, y0 - 4, 1, 1, '#ffffff');
  }

  function drawMicroDetails(ctx, t) {
    // Potted plant on the parapet coping.
    px(ctx, 148, 104, 8, 6, '#a15b3a');
    px(ctx, 149, 103, 6, 1, '#7a3f28');
    var leafSway = Math.round(Math.sin(t * 1.2) * 1);
    px(ctx, 149 + leafSway, 98, 2, 5, '#2f6d3f');
    px(ctx, 152, 96, 2, 7, '#3f8b52');
    px(ctx, 154 - leafSway, 99, 2, 4, '#2f6d3f');
    // Sleeping pigeon on the coping, breathing.
    var breathe = Math.sin(t * 2.5) > 0 ? 1 : 0;
    px(ctx, 190, 106 - breathe, 6, 4 + breathe, '#9a9ab8');
    px(ctx, 195, 105, 2, 2, '#8080a0');
    px(ctx, 197, 106, 1, 1, '#e8a13e');
    // Zzz above the pigeon.
    if (Math.sin(t * 1.1) > 0.4) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      px(ctx, 199, 99 - Math.round((t * 3) % 3), 2, 1, '#c8c8ff');
      ctx.restore();
    }
    // Clay water jug by the stairs.
    px(ctx, 36, 140, 7, 8, '#a15b3a');
    px(ctx, 37, 138, 5, 2, '#7a3f28');
    px(ctx, 38, 136, 3, 2, '#a15b3a');
    // Chimney (far right) with drifting smoke.
    px(ctx, 302, 98, 12, 30, STONE_M);
    px(ctx, 300, 96, 16, 3, STONE_L);
    ctx.fillStyle = STONE_D;
    px(ctx, 304, 104, 1, 4, STONE_D);
    px(ctx, 309, 112, 1, 4, STONE_D);
    for (var i = 0; i < 3; i++) {
      var rise = ((t * 7 + i * 13) % 38);
      var sx = 307 + Math.round(Math.sin(t * 1.3 + i * 2.1) * 3);
      ctx.save();
      ctx.globalAlpha = 0.25 * (1 - rise / 38);
      px(ctx, sx, 94 - rise, 3, 2, '#b0b0c8');
      ctx.restore();
    }
    // Laundry line from the owl post to the chimney: a sock and a small scroll.
    ctx.strokeStyle = '#3a3a55';
    ctx.beginPath();
    ctx.moveTo(290, 103);
    ctx.quadraticCurveTo(298, 108, 306, 99);
    ctx.stroke();
    var sway = Math.round(Math.sin(t * 2.3) * 1);
    px(ctx, 294 + sway, 105, 3, 5, '#1f7a8c'); // little sock
    px(ctx, 300 - sway, 104, 4, 5, PARCH);     // drying scroll
    // Weather vane on the chimney: a tiny shofar shape turning.
    var dir = Math.sin(t * 0.6) > 0 ? 1 : -1;
    px(ctx, 307, 90, 1, 6, '#8f8fb0');
    px(ctx, 307 - (dir > 0 ? 0 : 3), 90, 4, 1, '#c9a24d');
  }

  function drawFirefly(ctx, t) {
    var fx = 178 + Math.sin(t * 1.3) * 8;
    var fy = 92 + Math.sin(t * 2.1 + 1) * 5;
    var pulse = 0.35 + 0.55 * Math.abs(Math.sin(t * 5));
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#b6ff6e';
    ctx.fillRect(Math.round(fx), Math.round(fy), 2, 2);
    ctx.globalAlpha = pulse * 0.35;
    ctx.fillRect(Math.round(fx) - 1, Math.round(fy) - 1, 4, 4);
    // Faint trail.
    ctx.globalAlpha = pulse * 0.25;
    ctx.fillRect(Math.round(178 + Math.sin(t * 1.3 - 0.35) * 8), Math.round(92 + Math.sin(t * 2.1 + 0.65) * 5), 1, 1);
    ctx.restore();
  }

  function drawMediumStar(ctx, t, S, n) {
    var f = flags(S);
    var pos = MSTARS[n - 1];
    var found = !!f['roofStar' + n];
    var el = roofElapsed(S);
    var ap = appearTime(n, S);
    var a = found || f.roofStarsDone ? 1 : Math.max(0, Math.min(1, (el - ap) / 2));
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    var color = found ? '#ffe08a' : '#ffffff';
    // Cross rays.
    ctx.fillStyle = color;
    ctx.fillRect(pos.x, pos.y - 2, 1, 5);
    ctx.fillRect(pos.x - 2, pos.y, 5, 1);
    // Pulsing diagonal sparkle.
    if (Math.sin(t * 4 + n * 2) > 0.2) {
      ctx.fillRect(pos.x - 1, pos.y - 1, 1, 1);
      ctx.fillRect(pos.x + 1, pos.y + 1, 1, 1);
      ctx.fillRect(pos.x + 1, pos.y - 1, 1, 1);
      ctx.fillRect(pos.x - 1, pos.y + 1, 1, 1);
    }
    ctx.restore();
    if (found) glow(ctx, pos.x, pos.y, 6, '#ffd166', 0.2 + 0.1 * Math.sin(t * 3 + n));
    else glow(ctx, pos.x, pos.y, 4, '#ffffff', 0.08 * a);
  }

  function drawBigStar(ctx, t, n) {
    var pos = BSTARS[n - 1];
    twinkleStar(ctx, pos.x, pos.y, t, 3, '#fff6c8');
    glow(ctx, pos.x, pos.y, 7, '#fff6c8', 0.12 + 0.05 * Math.sin(t * 2 + n * 3));
  }

  // ---------------------------------------------------------------------
  // Puzzle logic
  // ---------------------------------------------------------------------

  function starVisible(n) {
    return function (S) {
      var f = flags(S);
      if (f['roofStar' + n] || f.roofStarsDone) return true;
      return roofElapsed(S) >= appearTime(n, S);
    };
  }

  async function bloomCutscene(g) {
    await g.cutscene(async function () {
      g.flag('roofStarsDone', true);
      g.flag('roofBloomAt', Date.now());
      g.sfx('magic');
      await g.wait(1800); // the sky blossoms with stars
      await g.say('הוּ-הוּא! שלושה בינוניים בשמים — צאת הכוכבים! מאושר רשמית!', { who: 'owl' });
      await g.playerSay('שלושה כוכבים בינוניים — יצאו הכוכבים!');
      await g.playerSay('זה בדיוק הרגע שהכהנים נכנסים לאכול בתרומתן! «משעה שהכהנים נכנסים לאכול בתרומתן»!');
      g.give('starproof');
      await g.playerSay('רשמתי הכל על קלף. פנחס הכהן חייב לראות את זה — הוא גווע ברעב!');
    });
  }

  function makeStarHandlers(n) {
    return {
      look: async function (g) {
        if (g.flag('roofStarsDone') && !g.flag('roofStar' + n)) {
          // Defensive: should not happen, but never crash.
          g.flag('roofStar' + n, true);
        }
        if (g.flag('roofStar' + n)) {
          if (g.flag('roofStarsDone')) await g.playerSay('השמים כבר מלאים כוכבים — וההוכחה כבר אצלי.');
          else await g.playerSay('את זה כבר ספרתי. כוכב אחד נספר פעם אחת. ככה זה בהלכה וגם בחשבון.');
          return;
        }
        g.flag('roofStar' + n, true);
        g.sfx('star');
        var c = countFound(window.GAME.state);
        if (c >= 3) {
          await bloomCutscene(g);
        } else if (c === 2) {
          await g.playerSay('שניים! נשאר אחד אחרון... איפה אתה מתחבא?');
        } else {
          await g.playerSay('כוכב בינוני ראשון! עוד שניים ויצאו הכוכבים.');
        }
      },
      take: async function (g) {
        await g.playerSay('לקטוף כוכב מהשמים? אני תלמיד ישיבה, לא נביא.');
      },
      use: async function (g) {
        await g.playerSay('הכוכב מתעלם ממני בנימוס. כוכבים סופרים בעיניים, לא בידיים.');
      }
    };
  }

  // ---------------------------------------------------------------------
  // Scene registration
  // ---------------------------------------------------------------------

  var star1 = makeStarHandlers(1);
  var star2 = makeStarHandlers(2);
  var star3 = makeStarHandlers(3);

  window.GAME.registerScene('roof', {
    name: 'גג המצפה',
    floor: { yMin: 130, yMax: 168 },

    paint: function (ctx, t, S) {
      drawSky(ctx, t, S);
      drawMoon(ctx, t);
      drawBat(ctx, t);
      drawDistantVillage(ctx, t);
      drawParapet(ctx);
      drawFloor(ctx);
      drawStairs(ctx, t);
      drawTelescope(ctx, t);
      drawMicroDetails(ctx, t);
    },

    onEnter: async function (g) {
      if (!g.flag('roofEnteredAt')) g.flag('roofEnteredAt', Date.now());
      if (!g.flag('roofIntroDone')) {
        g.flag('roofIntroDone', true);
        await g.cutscene(async function () {
          await g.playerSay('גג המצפה! מכאן רואים את כל שמי כפר ברכות.');
          await g.playerSay('עכשיו רק צריך לתפוס את צאת הכוכבים על חם. כוכבים בינוניים, איפה אתם?');
        });
      }
    },

    hotspots: [
      // --- Interactive medium stars (the puzzle) ---
      {
        id: 'mstar1', name: 'כוכב בינוני', type: 'object',
        x: MSTARS[0].x - 8, y: MSTARS[0].y - 8, w: 16, h: 16,
        visible: starVisible(1),
        draw: function (ctx, t, S) { drawMediumStar(ctx, t, S, 1); },
        look: star1.look, take: star1.take, use: star1.use
      },
      {
        id: 'mstar2', name: 'כוכב בינוני', type: 'object',
        x: MSTARS[1].x - 8, y: MSTARS[1].y - 8, w: 16, h: 16,
        visible: starVisible(2),
        draw: function (ctx, t, S) { drawMediumStar(ctx, t, S, 2); },
        look: star2.look, take: star2.take, use: star2.use
      },
      {
        id: 'mstar3', name: 'כוכב בינוני', type: 'object',
        x: MSTARS[2].x - 8, y: MSTARS[2].y - 8, w: 16, h: 16,
        visible: starVisible(3),
        draw: function (ctx, t, S) { drawMediumStar(ctx, t, S, 3); },
        look: star3.look, take: star3.take, use: star3.use
      },

      // --- Decoys: big stars ---
      {
        id: 'bstar1', name: 'כוכב גדול ובוהק', type: 'object',
        x: BSTARS[0].x - 8, y: BSTARS[0].y - 8, w: 16, h: 16,
        draw: function (ctx, t) { drawBigStar(ctx, t, 1); },
        look: async function (g) {
          g.sfx('fail');
          await g.playerSay('גדול מדי! את זה רואים גם ביום. לא נחשב.');
        },
        take: async function (g) {
          await g.playerSay('אפילו אם הייתי מגיע — הוא גדול מדי בשביל הכיס.');
        }
      },
      {
        id: 'bstar2', name: 'כוכב גדול ובוהק', type: 'object',
        x: BSTARS[1].x - 8, y: BSTARS[1].y - 8, w: 16, h: 16,
        draw: function (ctx, t) { drawBigStar(ctx, t, 2); },
        look: async function (g) {
          g.sfx('fail');
          await g.playerSay('גדול מדי! את זה רואים גם ביום. לא נחשב.');
          await g.playerSay('כוכב שנראה מבעוד יום לא מוכיח שירד לילה. ינשוף לימד אותי.');
        },
        take: async function (g) {
          await g.playerSay('חז"ל לא הכינו אותי לתרחיש הזה.');
        }
      },

      // --- Decoy: the firefly ---
      {
        id: 'firefly', name: 'נצנוץ קטן', type: 'object',
        x: 168, y: 84, w: 24, h: 16,
        draw: function (ctx, t) { drawFirefly(ctx, t); },
        look: async function (g) {
          await g.say('חי-חי-חי! גחלילית, לא כוכב. תתרכז.', { who: 'firefly', color: '#b6ff6e' });
          await g.playerSay('רגע... היא צחקקה עליי עכשיו?!');
        },
        take: async function (g) {
          await g.playerSay('היא מתחמקת ומצחקקת. יש לה יותר זריזות ממני.');
        },
        talk: async function (g) {
          await g.say('חי-חי-חי!', { who: 'firefly', color: '#b6ff6e' });
          await g.playerSay('שיחה מעמיקה. ממש בית מדרש של גחליליות.');
        }
      },

      // --- Decoy: the moon ---
      {
        id: 'moon', name: 'הירח', type: 'object',
        x: 258, y: 12, w: 28, h: 28,
        look: async function (g) {
          await g.playerSay('הירח. גדול, יפה, ובפירוש לא כוכב. אל תנסה לספור אותו.');
        },
        take: async function (g) {
          await g.playerSay('לוקחים ירח רק בקידוש לבנה, וגם אז — בעיניים בלבד.');
        }
      },

      // --- The telescope ---
      {
        id: 'telescope', name: 'הטלסקופ', type: 'object',
        x: 62, y: 116, w: 44, h: 44,
        walkTo: { x: 84, y: 152 },
        look: async function (g) {
          await g.playerSay('טלסקופ נחושת עתיק, מחוזק ברצועות קלף ובהרבה אמונה. האחריות פגה לפני כאלף שנה.');
        },
        take: async function (g) {
          await g.playerSay('הוא מוברג לגג. וגם כבד. וגם ממש לא שלי.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('כתוב בדף: «מאימתי קורין את שמע בערבין? משעה שהכהנים נכנסים לאכול בתרומתן».');
            await g.playerSay('כלומר — צאת הכוכבים! העדשה הזאת תעזור לי למצוא אותם.');
            return;
          }
          if (itemId && itemId !== 'daf') {
            await g.playerSay('להצמיד את זה לעדשה? עוד נס שהטלסקופ שרד עד היום.');
            return;
          }
          var first = !g.flag('roofSkyview');
          g.flag('roofSkyview', true);
          g.sfx('magic');
          if (g.flag('roofStarsDone')) {
            await g.playerSay('וואו... דרך העדשה השמים נראים כמו דף גמרא זרוע נקודות אור.');
            return;
          }
          if (first) {
            await g.playerSay('וואו... דרך העדשה רואים את השמים מתעוררים!');
            await g.playerSay('הגדולים כבר דולקים מבעוד יום. אני מחכה לבינוניים — הם ההוכחה שירד לילה.');
          } else {
            await g.playerSay('העדשה מחדדת הכל. עכשיו רק לסרוק את השמים בסבלנות.');
          }
        }
      },

      // --- The owl ---
      {
        id: 'owl', name: 'ינשוף', type: 'char',
        x: 276, y: 80, w: 22, h: 26,
        walkTo: { x: 272, y: 140 },
        draw: function (ctx, t, S) { drawOwl(ctx, t, S); },
        look: async function (g) {
          await g.playerSay('ינשוף עם משקפיים זעירים. כנראה היחיד על הגג שבאמת סיים את הדף.');
        },
        take: async function (g) {
          await g.playerSay('הוא נועץ בי מבט של תלמיד חכם נעלב. עדיף לוותר.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.say('הוּ! «משעה שהכהנים נכנסים לאכול בתרומתן». דף מצוין. הערות שוליים מצוינות.', { who: 'owl' });
            return;
          }
          await g.say('הוּ?! ינשוף אינו כלי עבודה.', { who: 'owl' });
        },
        talk: async function (g) {
          if (!g.flag('roofOwlMet')) {
            g.flag('roofOwlMet', true);
            await g.say('הוּ? מי מפריע באמצע תצפית?', { who: 'owl' });
            await g.playerSay('אני זרח! אני מחפש את צאת הכוכבים בשביל הכהן פנחס.');
            await g.say('אה, עניין הלכתי. סוף סוף שאלה רצינית על הגג הזה.', { who: 'owl' });
          } else if (g.flag('roofStarsDone')) {
            await g.say('הוּ-הוּא. שלושה בינוניים נספרו כדין. עבודה מצפונית ומצפינית.', { who: 'owl' });
          }
          var talking = true;
          while (talking) {
            var choice = await g.choose([
              { text: 'איך יודעים שיצאו הכוכבים?', value: 'how' },
              { text: 'למה דווקא כוכבים בינוניים?', value: 'why' },
              { text: 'הוּ?', value: 'hoo' },
              { text: 'תמשיך בתצפית, ינשוף', value: 'bye' }
            ]);
            if (choice === 'how') {
              await g.say('הכלל פשוט: שלושה כוכבים בינוניים בשמים — וזהו לילה. לא אחד. לא שניים. שלושה.', { who: 'owl' });
              await g.say('ומשירד לילה — הכהנים שנטהרו נכנסים לאכול בתרומתן. ומשם למדנו זמן קריאת שמע של ערבית.', { who: 'owl' });
              await g.playerSay('אז אני צריך למצוא שלושה בינוניים בשמים. מתחיל לספור!');
            } else if (choice === 'why') {
              await g.say('כוכב גדול נראה עוד מבעוד יום — הוא לא מוכיח כלום. כוכב קטן מדי? עד שתראה אותו כבר עלה השחר.', { who: 'owl' });
              await g.say('רק הבינוניים מעידים שירד לילה באמת. וגחליליות? אל תתחיל איתי על גחליליות.', { who: 'owl' });
            } else if (choice === 'hoo') {
              await g.say('הוּא!', { who: 'owl' });
              await g.playerSay('זה... ארמית?');
              await g.say('ארמית של ינשופים. תרגום חופשי: השואל שאלה טובה — חצי תשובה כבר בכנפו.', { who: 'owl' });
            } else {
              await g.say('הוּ-הוּא. שיהיה לך לילה טוב ומדויק.', { who: 'owl' });
              talking = false;
            }
          }
        }
      },

      // --- Exit: stairs down to the square ---
      {
        id: 'stairs', name: 'מדרגות לכיכר', type: 'exit',
        x: 0, y: 112, w: 30, h: 40,
        walkTo: { x: 20, y: 142 },
        target: 'square',
        spawn: { x: 250, y: 150 },
        look: async function (g) {
          await g.playerSay('מדרגות אבן צרות חזרה לכיכר. לרדת לאט — חשוך, ואין לי ביטוח.');
        }
      }
    ]
  });
})();
