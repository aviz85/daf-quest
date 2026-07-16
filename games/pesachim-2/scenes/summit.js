'use strict';
/*
 * Scene: summit — Pisgat HaMassuot (The Beacon Summit)
 * DAF QUEST — Pesachim 2a-2b, "The Mystery of the Lost Light".
 * SEAL 3: `melakhah` (the melakhah seal) + the candle-lighting service (ner -> nerlit).
 * Boaz the beacon-watchman guards the village's last ember; the player wins the
 * melakhah quiz (4 rounds, R1-R4 per spec), then a
 * physical 2-click mini-beat: take the ember from the firebox, carry it to the
 * pyre, and light the beacon. Answering fires pop on the far hills, the seal is
 * granted, and Boaz lights the player's candle from the new flame.
 * Split-sky signature: seam narrows as S.seals.length grows.
 * Owns ONLY this file. Registers via GAME.registerScene('summit', {...}).
 * Relies on GAME / SPRITES / AUDIO contracts (all guarded, never crashes).
 */
(function () {
  if (!window.GAME || typeof window.GAME.registerScene !== 'function') {
    if (window.console && console.warn) console.warn('summit.js: GAME.registerScene unavailable, scene not registered');
    return;
  }

  // ---------------------------------------------------------------------
  // Palette — the torn sky at its most dramatic: deep west night vs stuck
  // east dawn, meeting at a shimmering seam that hits the horizon here.
  // ---------------------------------------------------------------------
  var NIGHT_TOP = '#12123a', NIGHT_MID = '#1e1e52', NIGHT_LOW = '#2a2a70';
  var DAY_TOP = '#d97a4a', DAY_MID = '#ffb347', DAY_LOW = '#ffd166';
  var SEAM_C1 = '#aef6ff', SEAM_C2 = '#ffffff';
  var STAR_W = '#fff7d6';
  var HILL_SIL = '#1a1440', HILL_SIL2 = '#241a4a';
  var ROCK_D = '#3f3f5c', ROCK_M = '#4a4a68', ROCK_L = '#6b6b8f';
  var GRASS_N = '#3f7a4a', GRASS_D = '#2e5c38', GRASS_DAY = '#6a8a4a';
  var WOOD_D = '#5a3a24', WOOD_L = '#7a512f';
  var AMBER = '#ffd166', AMBER2 = '#ffb347', AMBER3 = '#ff8c42';
  var PETAL1 = '#ffd7e8', PETAL2 = '#fff0f5';
  var STONE_HUT = '#5a5a7a', STONE_HUT_L = '#7a7a9c';
  var COPPER = '#b0662f';
  var BEARD = '#d8d0c8';

  var SEAM_X = 208; // seam center; night owns the west (left), dawn the east

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
      ctx.globalAlpha = (alpha || 0.15) * 0.35;
      ctx.fillStyle = color;
      ctx.fillRect(x - rr, y - Math.round(rr * 0.8), rr * 2, Math.round(rr * 1.6));
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

  function flame(ctx, x, y, t, size) {
    if (window.SPRITES && typeof SPRITES.flame === 'function') {
      try { SPRITES.flame(ctx, x, y, t, size); return; } catch (e) { /* fall through */ }
    }
    var fl = 0.7 + 0.3 * Math.sin(t * 11 + x);
    var s = size || 1;
    ctx.save();
    ctx.globalAlpha = fl;
    px(ctx, x - s, y - 4 * s, 2 * s, 4 * s, AMBER3);
    px(ctx, x - Math.ceil(s / 2), y - 3 * s, s, 2 * s, AMBER);
    ctx.restore();
  }

  function safeSfx(g, name) {
    try { if (g && typeof g.sfx === 'function') g.sfx(name); } catch (e) { /* silent */ }
  }

  function flags(S) { return (S && S.flags) || {}; }
  function sealCount(S) { return (S && S.seals && S.seals.length) || 0; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function shuffled(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function stFlags() {
    try { return (window.GAME && window.GAME.state && window.GAME.state.flags) || {}; }
    catch (e) { return {}; }
  }
  function beaconIsLit() { return !!stFlags().beaconLit; }
  function quizIsDone() { return !!stFlags().summitQuizDone; }
  function emberHeld() { return !!stFlags().summitEmber; }

  // Speaker helpers — fixed bubble colors per character
  function boazSay(g, text) { return g.say(text, { who: 'boaz', color: '#ffc07a' }); }
  function roosterSay(g, text) { return g.say(text, { who: 'rooster', color: '#ffe08a' }); }
  function catSay(g, text) { return g.say(text, { who: 'summitcat', color: '#d0c8ff' }); }

  // Module-level animation timestamps (event-driven paint effects)
  var lastT = 0;
  var beaconLitAtT = null; // set when the cascade runs; null = unknown (re-entry)
  var quizRunning = false;
  var serviceRunning = false;

  // ---------------------------------------------------------------------
  // SKY — the split-sky signature. Seam narrows with each seal collected.
  // ---------------------------------------------------------------------
  function paintNightSky(ctx, t) {
    // west half: deep night, layered indigo bands with dither seams
    px(ctx, 0, 0, 320, 30, NIGHT_TOP);
    dither(ctx, 0, 30, 320, 4, NIGHT_TOP, NIGHT_MID);
    px(ctx, 0, 34, 320, 30, NIGHT_MID);
    dither(ctx, 0, 64, 320, 4, NIGHT_MID, NIGHT_LOW);
    px(ctx, 0, 68, 320, 34, NIGHT_LOW);
    // stars — only convincing on the true-night side, west of the seam
    var stars = [[12, 8], [34, 22], [58, 6], [80, 30], [104, 14], [128, 40], [150, 10], [178, 26], [66, 48], [24, 52]];
    for (var i = 0; i < stars.length; i++) {
      twinkle(ctx, stars[i][0], stars[i][1], t + i * 1.7, (i % 3 === 0) ? 2 : 1, STAR_W);
    }
    // pale patient moon over the night hill
    if (window.SPRITES && typeof SPRITES.moon === 'function') {
      try { SPRITES.moon(ctx, 42, 20, 0.4, 10); } catch (e) { px(ctx, 38, 16, 8, 8, '#cfc3e0'); }
    } else {
      px(ctx, 38, 16, 8, 8, '#cfc3e0');
    }
  }

  function paintDaySky(ctx, t) {
    // east half: the stuck golden dawn, painted only right of the seam
    var x0 = SEAM_X;
    px(ctx, x0, 0, 320 - x0, 34, DAY_TOP);
    dither(ctx, x0, 34, 320 - x0, 4, DAY_TOP, DAY_MID);
    px(ctx, x0, 38, 320 - x0, 32, DAY_MID);
    dither(ctx, x0, 70, 320 - x0, 4, DAY_MID, DAY_LOW);
    px(ctx, x0, 74, 320 - x0, 28, DAY_LOW);
    // the confused half-risen sun — bobbing, trying to rise, giving up.
    // Anchored at sy~86 so it crests the HILL_SIL2 ridge (top y=84 there):
    // top rows peek above the ridgeline, bottom rows clip behind it, and the
    // +-1.5 bob makes rows appear/disappear behind the ridge.
    var sy = 86 + Math.round(Math.sin(t * 0.7) * 1.5);
    var widths = [16, 14, 12, 9, 5];
    for (var r = 0; r < widths.length; r++) {
      px(ctx, 272 - Math.round(widths[r] / 2), sy - r - 1, widths[r], 1, r < 2 ? '#fff0c0' : DAY_LOW);
    }
    // exhausted sun rays, flickering at half strength
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 2.3);
    px(ctx, 254, sy - 8, 3, 1, '#fff0c0');
    px(ctx, 286, sy - 9, 3, 1, '#fff0c0');
    px(ctx, 271, sy - 13, 1, 3, '#fff0c0');
    ctx.restore();
  }

  function paintSeam(ctx, t, S) {
    // the shimmering vertical seam — the game's visual progress bar:
    // 0 seals = ~14px wide; each seal shaves ~3px off. It hits the horizon here.
    var w = Math.max(4, 14 - sealCount(S) * 3);
    var x0 = SEAM_X - Math.floor(w / 2);
    var pulse = 0.45 + 0.2 * Math.sin(t * 1.7);
    ctx.save();
    ctx.globalAlpha = pulse;
    dither(ctx, x0, 0, w, 102, SEAM_C1, NIGHT_LOW);
    ctx.restore();
    // sparkle pixels crawling the seam, deterministic per row + frame step
    ctx.save();
    var step = Math.floor(t * 6);
    for (var y = 0; y < 102; y += 2) {
      if ((y * 37 + step * 13) % 11 === 0) {
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 5 + y);
        px(ctx, x0 + ((y * 7 + step) % Math.max(1, w)), y, 1, 2, SEAM_C2);
      }
    }
    ctx.restore();
    glow(ctx, SEAM_X, 50, 6 + w, SEAM_C1, 0.05 * pulse);
  }

  // ---------------------------------------------------------------------
  // FAR HILLS — where the answering beacons live (mountains see mountains)
  // ---------------------------------------------------------------------
  var ANSWER_FIRES = [[20, 90], [60, 86], [246, 88], [292, 92], [140, 84]];

  function paintHills(ctx, t, S) {
    // silhouette ridge line across the whole horizon
    px(ctx, 0, 92, 320, 12, HILL_SIL);
    px(ctx, 0, 86, 90, 8, HILL_SIL2);
    px(ctx, 110, 82, 70, 12, HILL_SIL2);
    px(ctx, 226, 84, 60, 10, HILL_SIL2);
    px(ctx, 282, 88, 38, 8, HILL_SIL2);
    // warm accent where the half-risen sun crests the ridge silhouette
    glow(ctx, 272, 82, 8, DAY_LOW, 0.08);
    // answering fires pop one by one after the beacon lights
    if (flags(S).beaconLit) {
      if (beaconLitAtT === null) beaconLitAtT = t - 30; // re-entry: fires already burning
      var dt = t - beaconLitAtT;
      for (var i = 0; i < ANSWER_FIRES.length; i++) {
        if (dt > 1.2 + i * 0.9) {
          var fx = ANSWER_FIRES[i][0], fy = ANSWER_FIRES[i][1];
          flame(ctx, fx, fy, t + i * 2.3, 1);
          glow(ctx, fx, fy - 2, 5, AMBER2, 0.1);
        }
      }
    }
  }

  // ---------------------------------------------------------------------
  // GROUND — windswept rocky peak; night grass west, day-tinted grass east
  // ---------------------------------------------------------------------
  function paintGround(ctx, t, S) {
    // upper slope down from the horizon
    px(ctx, 0, 102, 320, 26, ROCK_M);
    dither(ctx, 0, 102, 320, 3, HILL_SIL, ROCK_M);
    // plateau (walkable band)
    px(ctx, 0, 128, 320, 52, ROCK_D);
    dither(ctx, 0, 126, 320, 3, ROCK_M, ROCK_D);
    // rock texture cracks
    ctx.fillStyle = '#35354e';
    for (var yy = 136; yy < 180; yy += 9) ctx.fillRect(0, yy, 320, 1);
    var r = 0;
    for (var y2 = 128; y2 < 180; y2 += 9) {
      for (var x2 = (r % 2) * 14; x2 < 320; x2 += 28) ctx.fillRect(x2, y2, 1, 9);
      r++;
    }
    // grass fringes: cool green on the night side, sun-bleached on the day side
    px(ctx, 0, 102, 200, 3, GRASS_N);
    px(ctx, 0, 105, 90, 2, GRASS_D);
    px(ctx, 216, 102, 104, 3, GRASS_DAY);
    // scattered boulders
    px(ctx, 86, 148, 12, 8, ROCK_L);
    px(ctx, 88, 146, 8, 2, '#8f8fb0');
    px(ctx, 232, 158, 10, 7, ROCK_L);
    px(ctx, 20, 164, 14, 8, ROCK_M);
    px(ctx, 22, 162, 10, 2, ROCK_L);
    // dirt path east, down toward the inn
    px(ctx, 282, 130, 38, 6, '#5c5044');
    px(ctx, 288, 136, 32, 12, '#6a5c4e');
    px(ctx, 294, 148, 26, 32, '#5c5044');
    // the day half leaks warmth onto its side of the ground
    ctx.save();
    ctx.globalAlpha = 0.07;
    px(ctx, SEAM_X + 8, 100, 320 - SEAM_X - 8, 80, AMBER2);
    ctx.restore();
  }

  // wind-blown grass tufts — the peak never stops whispering
  var TUFTS = [[10, 131], [34, 169], [92, 173], [142, 131], [206, 151], [252, 171], [302, 133], [72, 153], [186, 168]];
  function paintGrassTufts(ctx, t) {
    for (var i = 0; i < TUFTS.length; i++) {
      var gx = TUFTS[i][0], gy = TUFTS[i][1];
      var sway = Math.round(Math.sin(t * 2 + i * 1.3) * 1.5);
      var col = gx > SEAM_X ? GRASS_DAY : GRASS_N;
      px(ctx, gx, gy - 3, 1, 3, col);
      px(ctx, gx + 2 + sway, gy - 4, 1, 4, col);
      px(ctx, gx + 4, gy - 2, 1, 2, GRASS_D);
    }
  }

  // almond petals streaming on the wind — it is Nisan, even up here
  function paintPetals(ctx, t) {
    for (var i = 0; i < 7; i++) {
      var ppx = ((i * 47 + t * 18) % 330) - 5;
      var ppy = 58 + ((i * 23) % 74) + Math.sin(t * 2 + i) * 3;
      ctx.save();
      ctx.globalAlpha = 0.75;
      px(ctx, Math.round(ppx), Math.round(ppy), 1, 1, i % 2 ? PETAL1 : PETAL2);
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------------
  // WATCHMAN'S HUT — round window, burnt-match collection, weathervane duel
  // ---------------------------------------------------------------------
  function paintHut(ctx, t, S) {
    // stone body
    px(ctx, 16, 78, 62, 50, STONE_HUT);
    px(ctx, 16, 78, 62, 2, STONE_HUT_L);
    ctx.fillStyle = '#4a4a66';
    for (var yy = 86; yy < 128; yy += 8) ctx.fillRect(16, yy, 62, 1);
    for (var xx = 24; xx < 78; xx += 12) ctx.fillRect(xx, 78, 1, 50);
    // slanted wooden roof
    px(ctx, 12, 70, 70, 8, WOOD_D);
    px(ctx, 12, 70, 70, 2, WOOD_L);
    px(ctx, 20, 64, 54, 6, WOOD_D);
    px(ctx, 28, 60, 38, 4, WOOD_L);
    // round window: dark inside, sill with the burnt-match collection
    ctx.fillStyle = '#181228';
    px(ctx, 40, 94, 14, 14, '#181228');
    px(ctx, 42, 92, 10, 2, '#181228');
    px(ctx, 42, 108, 10, 2, '#181228');
    px(ctx, 38, 96, 2, 10, '#181228');
    px(ctx, 54, 96, 2, 10, '#181228');
    // faint homey glow inside, breathing
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 1.1);
    px(ctx, 43, 98, 8, 7, '#3a2a20');
    ctx.restore();
    // sill: three burnt matches sorted by size + the bedikah kit sight gag
    px(ctx, 38, 110, 18, 2, STONE_HUT_L);
    px(ctx, 40, 109, 1, 1, '#3a2a20');
    px(ctx, 43, 109, 2, 1, '#3a2a20');
    px(ctx, 47, 109, 3, 1, '#3a2a20');
    // feather + wooden spoon tucked by the door frame (bedikat-chametz kit)
    px(ctx, 70, 118, 1, 8, WOOD_L);          // spoon handle
    px(ctx, 69, 124, 3, 3, WOOD_L);          // spoon bowl
    var fsway = Math.round(Math.sin(t * 3.1) * 1);
    px(ctx, 66 + fsway, 116, 1, 6, '#fff7d6'); // feather, fluttering
    // weathervane: pole on the roof peak
    px(ctx, 25, 44, 2, 18, '#3a3a52');
    paintVane(ctx, t);
    // rooster's cardboard practice sun, on a stick beside the ridge
    paintCardboardSun(ctx, t, S);
  }

  // The weathervane duel — snaps east/west, flings off a hopeful bird
  function paintVane(ctx, t) {
    var east = Math.sin(t * 1.3) > 0;
    var vy = 46;
    if (east) {
      px(ctx, 26, vy, 8, 2, COPPER);
      px(ctx, 34, vy - 1, 2, 4, COPPER); // arrowhead east (day side)
      px(ctx, 22, vy, 4, 2, '#8a5024');
    } else {
      px(ctx, 18, vy, 8, 2, COPPER);
      px(ctx, 16, vy - 1, 2, 4, COPPER); // arrowhead west (night side)
      px(ctx, 26, vy, 4, 2, '#8a5024');
    }
    // the bird: flies in, tries to land, gets flung — every 6 seconds
    var p = t % 6;
    var bx, by;
    if (p < 1.2) {
      bx = -6 + (p / 1.2) * 30; by = 40 - Math.sin((p / 1.2) * Math.PI) * 6;
    } else if (p < 1.9) {
      var q = (p - 1.2) / 0.7;
      bx = 24 + q * 26; by = 42 - Math.sin(q * Math.PI) * 14 + q * q * 10; // flung arc
    } else {
      return;
    }
    px(ctx, Math.round(bx), Math.round(by), 2, 1, '#2a2a3e');
    var wingUp = Math.floor(t * 10) % 2 === 0;
    px(ctx, Math.round(bx) + (wingUp ? 0 : 1), Math.round(by) - 1, 1, 1, '#2a2a3e');
  }

  function paintCardboardSun(ctx, t, S) {
    if (flags(S).beaconLit) {
      // drooped: the real fire out-shone it; the prop has given up
      ctx.save();
      ctx.globalAlpha = 0.8;
      px(ctx, 73, 62, 1, 6, WOOD_L);
      px(ctx, 74, 66, 3, 1, WOOD_L);   // bent stick
      px(ctx, 76, 66, 4, 4, '#d8b055'); // sagging disc
      ctx.restore();
    } else {
      var wob = Math.round(Math.sin(t * 2.7) * 1);
      px(ctx, 73, 58, 1, 10, WOOD_L);
      px(ctx, 71 + wob, 54, 5, 5, AMBER);   // proud cardboard disc
      px(ctx, 70 + wob, 56, 1, 1, AMBER2);  // crayon rays
      px(ctx, 77 + wob, 56, 1, 1, AMBER2);
      px(ctx, 73 + wob, 52, 1, 1, AMBER2);
    }
  }

  // ---------------------------------------------------------------------
  // THE BEACON — log tripod with oil-soaked wrappings; the scene's heart
  // ---------------------------------------------------------------------
  function paintBeacon(ctx, t, S) {
    var lit = flags(S).beaconLit;
    // base log pile
    px(ctx, 150, 120, 44, 4, WOOD_D);
    px(ctx, 154, 116, 36, 4, WOOD_L);
    px(ctx, 158, 124, 30, 4, WOOD_D);
    px(ctx, 150, 121, 44, 1, '#452c1a');
    // tripod legs converging to the apex (172, 84)
    var i, k;
    for (i = 0; i <= 16; i++) {
      var f = i / 16;
      px(ctx, Math.round(152 + f * 18), Math.round(118 - f * 34), 2, 3, WOOD_D);   // left leg
      px(ctx, Math.round(192 - f * 18), Math.round(118 - f * 34), 2, 3, WOOD_D);   // right leg
      px(ctx, 171, Math.round(118 - f * 34), 2, 3, WOOD_L);                        // center post
    }
    // oil-soaked wrappings — pale bands, glistening slightly
    for (k = 0; k < 3; k++) {
      var wy = 96 + k * 9;
      var ww = 10 + k * 6;
      px(ctx, 172 - Math.round(ww / 2), wy, ww, 2, '#c8b890');
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 1.9 + k);
      px(ctx, 172 - Math.round(ww / 2), wy, ww, 1, '#e8dcc0');
      ctx.restore();
    }
    if (lit) {
      if (beaconLitAtT === null) beaconLitAtT = t - 30;
      // the great flame — layered, roaring
      flame(ctx, 172, 88, t, 3);
      flame(ctx, 165, 94, t + 1.1, 2);
      flame(ctx, 179, 94, t + 2.2, 2);
      flame(ctx, 172, 112, t + 0.6, 2);
      glow(ctx, 172, 92, 34 + Math.round(Math.sin(t * 6) * 3), AMBER3, 0.14);
      // sparks rising and dying on the wind
      for (i = 0; i < 6; i++) {
        var sp = (t * 0.7 + i / 6) % 1;
        var sx = 172 + Math.round(Math.sin(i * 2.1 + t) * (6 + sp * 8));
        var sy = 88 - Math.round(sp * 42);
        ctx.save();
        ctx.globalAlpha = 1 - sp;
        px(ctx, sx, sy, 1, 1, i % 2 ? AMBER : AMBER3);
        ctx.restore();
      }
      // smoke wisps drifting east
      for (i = 0; i < 3; i++) {
        var sm = (t * 0.25 + i / 3) % 1;
        ctx.save();
        ctx.globalAlpha = 0.25 * (1 - sm);
        px(ctx, 172 + Math.round(sm * 20 + Math.sin(t + i) * 3), 60 - Math.round(sm * 24), 2, 2, '#9a9ab0');
        ctx.restore();
      }
    } else {
      // cold and waiting — one sad blue shimmer so the eye finds it
      ctx.save();
      ctx.globalAlpha = 0.1 + 0.05 * Math.sin(t * 0.9);
      px(ctx, 168, 84, 8, 4, '#8fb0d8');
      ctx.restore();
    }
  }

  // warm firelight wash over the whole peak once the beacon burns
  function paintFireWash(ctx, t, S) {
    if (!flags(S).beaconLit) return;
    ctx.save();
    ctx.globalAlpha = 0.05 + 0.02 * Math.sin(t * 5);
    px(ctx, 0, 0, 320, 180, AMBER3);
    ctx.restore();
  }

  // ---------------------------------------------------------------------
  // CHARACTERS (drawn via hotspot draw() so they layer above the scene)
  // ---------------------------------------------------------------------

  // Boaz — huge beard, mild pyromania, cradles the firebox like a baby
  function drawBoaz(ctx, t, S) {
    var lit = flags(S).beaconLit;
    var bx = 122, by = 143; // feet anchor
    var bob = Math.sin(t * 1.7) * 0.8;
    var y0 = Math.round(by + bob);
    // shadow
    ctx.save();
    ctx.globalAlpha = 0.25;
    px(ctx, bx - 8, by - 1, 17, 2, '#000000');
    ctx.restore();
    // boots
    px(ctx, bx - 5, y0 - 3, 4, 3, '#3a2a20');
    px(ctx, bx + 1, y0 - 3, 4, 3, '#3a2a20');
    // robe — copper-red, a watchman singed at the edges
    px(ctx, bx - 7, y0 - 22, 14, 19, '#8c4a2f');
    px(ctx, bx - 7, y0 - 22, 14, 2, '#a05836');
    px(ctx, bx - 7, y0 - 10, 14, 2, WOOD_D); // belt
    px(ctx, bx - 1, y0 - 10, 2, 2, AMBER2);  // brass buckle
    // singe marks on the hem (occupational hazard)
    px(ctx, bx - 6, y0 - 4, 2, 1, '#4a2a1a');
    px(ctx, bx + 3, y0 - 5, 2, 1, '#4a2a1a');
    // head + wool cap
    px(ctx, bx - 4, y0 - 30, 8, 8, '#d8a878');
    px(ctx, bx - 5, y0 - 33, 10, 4, '#4a3a5c');
    px(ctx, bx - 5, y0 - 30, 10, 1, '#5c4a70');
    // heavy eyebrows + eyes (blink)
    px(ctx, bx - 3, y0 - 27, 2, 1, '#7a6a5c');
    px(ctx, bx + 1, y0 - 27, 2, 1, '#7a6a5c');
    if ((t % 3.7) > 0.12) {
      px(ctx, bx - 3, y0 - 26, 1, 1, '#241a14');
      px(ctx, bx + 2, y0 - 26, 1, 1, '#241a14');
    }
    // THE BEARD — vast, grey-white, slightly singed at the tips, breathing
    var bsway = Math.round(Math.sin(t * 1.2) * 1);
    px(ctx, bx - 5, y0 - 24, 10, 8, BEARD);
    px(ctx, bx - 4 + bsway, y0 - 16, 8, 5, BEARD);
    px(ctx, bx - 3 + bsway, y0 - 11, 6, 3, '#c8c0b8');
    px(ctx, bx - 3 + bsway, y0 - 8, 4, 1, '#8a7a6a'); // singed tips
    // arms cradling the firebox at chest height
    var rock = Math.sin(t * 0.9) * 1; // gentle lullaby rocking
    px(ctx, bx - 8, y0 - 20, 3, 8, '#8c4a2f');
    px(ctx, bx + 6, y0 - 20, 3, 8, '#8c4a2f');
    // the firebox itself (empty after the lighting, but still cradled)
    var fbx = Math.round(bx - 5 + rock), fby = y0 - 19;
    px(ctx, fbx, fby, 11, 8, WOOD_D);
    px(ctx, fbx, fby, 11, 1, WOOD_L);
    px(ctx, fbx + 2, fby + 2, 1, 5, '#2a1a10');
    px(ctx, fbx + 5, fby + 2, 1, 5, '#2a1a10');
    px(ctx, fbx + 8, fby + 2, 1, 5, '#2a1a10');
    if (!lit && !emberHeld()) {
      // the last ember glows through the slats, pulsing like slow breath
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 1.4);
      px(ctx, fbx + 3, fby + 3, 2, 3, AMBER3);
      px(ctx, fbx + 6, fby + 4, 2, 2, '#d84e20');
      ctx.restore();
      glow(ctx, fbx + 5, fby + 4, 7, AMBER3, 0.1);
    }
    // post-beacon: one arm rises in periodic triumph toward his "daughter"
    if (lit && Math.sin(t * 0.9) > 0.55) {
      px(ctx, bx + 6, y0 - 26, 3, 7, '#8c4a2f');
      px(ctx, bx + 7, y0 - 28, 2, 2, '#d8a878');
    }
  }

  // Sekhvi the rooster — broken halachic instrument, stationed on the hut roof
  function drawRooster(ctx, t, S) {
    var rx = 58, ry = 66; // feet on the roof ridge
    var c = t % 4.6;
    var headUp = c < 0.5;             // crowing at the day half
    var bowing = c >= 0.5 && c < 1.0; // apologizing to the night half
    var bob = Math.round(Math.sin(t * 2.6) * 0.7);
    // legs
    px(ctx, rx + 2, ry - 2, 1, 2, '#c87830');
    px(ctx, rx + 5, ry - 2, 1, 2, '#c87830');
    // body
    px(ctx, rx, ry - 8 + bob, 9, 6, '#f0e8e0');
    px(ctx, rx + 1, ry - 3 + bob, 7, 1, '#d8d0c8');
    // tail feathers — dark green-teal fan, wind-teased
    var tsw = Math.round(Math.sin(t * 2.1) * 1);
    px(ctx, rx - 3 + tsw, ry - 11 + bob, 3, 5, '#2a6a55');
    px(ctx, rx - 2 + tsw, ry - 13 + bob, 2, 4, '#3a7a8c');
    // the STUCK FEATHER (someone's bedikah kit lost a soldier up here)
    px(ctx, rx + 2, ry - 10 + bob + tsw, 1, 3, '#fff7d6');
    // head: up = crowing, down = apologizing
    var hy = headUp ? ry - 14 : (bowing ? ry - 9 : ry - 12);
    px(ctx, rx + 8, hy + bob, 4, 4, '#f0e8e0');
    px(ctx, rx + 9, hy - 2 + bob, 2, 2, '#d84040');       // comb
    px(ctx, rx + 12, hy + 1 + bob, headUp ? 3 : 2, 1, '#ff9a3a'); // beak (open wider mid-crow)
    if (headUp) px(ctx, rx + 12, hy + 2 + bob, 2, 1, '#ff9a3a');
    px(ctx, rx + 10, hy + 1 + bob, 1, 1, '#241a14');      // haunted eye
    // tiny "!?" of a strangled crow, right at the peak of the cycle
    if (c < 0.25) {
      ctx.save();
      ctx.globalAlpha = 0.8 - c * 3;
      px(ctx, rx + 14, hy - 4 + bob, 1, 3, '#fff7d6');
      px(ctx, rx + 14, hy + bob, 1, 1, '#fff7d6');
      ctx.restore();
    }
  }

  // Beitza the cat — professional fire critic, cameo after the lighting
  function drawCat(ctx, t, S) {
    if (!flags(S).beaconLit) return;
    var cx = 204, cy = 144;
    // seated silhouette facing the beacon, warmed by it
    px(ctx, cx, cy - 6, 7, 6, '#241432');
    px(ctx, cx + 1, cy - 9, 4, 4, '#241432');
    px(ctx, cx + 1, cy - 11, 1, 2, '#241432'); // ears
    px(ctx, cx + 3, cy - 11, 1, 2, '#241432');
    // tail sway — slow, content
    var tw = Math.round(Math.sin(t * 1.6) * 2);
    px(ctx, cx + 6, cy - 4 + tw, 3, 1, '#241432');
    px(ctx, cx + 8, cy - 5 + tw, 1, 2, '#241432');
    // firelit rim on the beacon-facing edge
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 5);
    px(ctx, cx, cy - 8, 1, 7, AMBER3);
    ctx.restore();
    // one amber eye glint (the other is judging silently)
    if ((t % 4.1) > 0.2) px(ctx, cx + 2, cy - 8, 1, 1, AMBER);
  }

  // ---------------------------------------------------------------------
  // MELAKHAH QUIZ DATA — 4 rounds (R1-R4 per spec).
  // Wrong answers: specific teaching rejection + a forced restatement beat.
  // ---------------------------------------------------------------------
  var QUIZ = [
    {
      setup: [
        '«אֵין מַשִּׂיאִין מַשּׂוּאוֹת אֶלָּא עַל הַחֹדֶשׁ שֶׁנִּרְאָה בִּזְמַנּוֹ, לְקַדְּשׁוֹ.»'
      ],
      q: 'שאלה ראשונה: ומתי משיאין את המשואות?',
      correct: 'לְאוֹר עִבּוּרוֹ — בלילה',
      praise: [
        '«וְאֵימָתַי מַשִּׂיאִין מַשּׂוּאוֹת — לְאוֹר עִבּוּרוֹ». משואות מדליקים רק בלילה — ואם לזה קוראים אוֹר עיבורו, סימן שאוֹר = לילה!',
        '«אַלְמָא ״אוֹר״ אוּרְתָּא הוּא! שְׁמַע מִינַּהּ.» משואות הן יצורי לילה. כמוני.'
      ],
      wrong: [
        {
          text: 'בצהריים',
          fb: 'בצהריים?! משואה בצהריים זה מדורה עם בעיית ביטחון עצמי. אף אחד לא יראה אותה! משיאין לְאוֹר עִבּוּרוֹ — בלילה.'
        },
        {
          text: 'בשעת הנץ',
          fb: 'בהנץ החמה השמש כבר גונבת לי את ההצגה. «לְאוֹר עִבּוּרוֹ» — והמשואה נראית רק בחושך. נסה שוב, ההרים מחכים.'
        }
      ],
      restate: {
        p: 'רגע, שנייה. לפני שממשיכים — במילים שלך: למה המשואה מוכיחה שאוֹר זה ערב?',
        ok: 'כי משואה רואים רק בלילה — אז "אוֹר עיבורו" חייב להיות ערב',
        bad: 'כי אש זה דבר של צהריים',
        badFb: 'הפוך, גיבור. משואה בצהריים אף אחד לא רואה — היא עובדת רק בחושך. ואם הזמן שלה נקרא "אוֹר עיבורו", סימן שאוֹר הוא ערב. תרים את הראש לחצי החשוך ותנסה שוב.'
      }
    },
    {
      setup: [
        '«מֵאֵימָתַי אַרְבָּעָה עָשָׂר אָסוּר בַּעֲשִׂיַּית מְלָאכָה? רַבִּי אֱלִיעֶזֶר בֶּן יַעֲקֹב אוֹמֵר: מִשְּׁעַת הָאוֹר, רַבִּי יְהוּדָה אוֹמֵר: מִשְּׁעַת הָנֵץ הַחַמָּה.»'
      ],
      q: 'שאלה שנייה: ה"אוֹר" של רבי אליעזר בן יעקב — מה הוא?',
      correct: 'עמוד השחר',
      praise: [
        'בדיוק. הגמרא מעמידה: אצל רבי אליעזר בן יעקב "אור" התפרש כעמוד השחר — ולכן דבריו אינם ראיה במחלוקת נגהי ולילי.',
        'ושלא תתבלבל לי: ה"אוֹר" של המשנה — של הבדיקה — הוא ערב. מילה אחת, שני שימושים. קם מוקדם, האיש.'
      ],
      wrong: [
        {
          text: 'הנץ החמה',
          fb: 'הנץ החמה — זה רבי יהודה! אתה בשאלה של רבי אליעזר בן יעקב. אצלו «מִשְּׁעַת הָאוֹר» — עמוד השחר.'
        },
        {
          text: 'הערב',
          fb: 'מהערב?! זה ה"אוֹר" של הבדיקה, לא שלו! אצל רבי אליעזר בן יעקב הגמרא מעמידה: «מַאי ״אוֹר״ — עַמּוּד הַשַּׁחַר». מילה אחת, שתי משמרות — ואתה רשמת אותו למשמרת הלא נכונה.'
        }
      ],
      restate: {
        p: 'עצור. במילים שלך: למה רבי אליעזר בן יעקב לא עוזר לנו במחלוקת על אוֹר של בדיקה?',
        ok: 'כי ה"אור" שלו הוא עמוד השחר — לא ה"אוֹר" של המשנה, שהוא ערב',
        bad: 'כי הוא קם מאוחר מדי בשביל מחלוקות',
        badFb: 'דווקא מוקדם מדי. ה"אוֹר" שלו הוא עמוד השחר — בכלל לא ה"אוֹר" של המשנה, שהוא ערב. שני "אוֹר", אפס ראיה. עוד ניסיון.'
      }
    },
    {
      setup: [
        'רבי אליעזר בן יעקב הקשה על רבי יהודה: «וְכִי הֵיכָן מָצִינוּ יוֹם שֶׁמִּקְצָתוֹ אָסוּר בַּעֲשִׂיַּית מְלָאכָה וּמִקְצָתוֹ מוּתָּר בַּעֲשִׂיַּית מְלָאכָה?»'
      ],
      q: 'שאלה שלישית: יום שחציו אסור במלאכה וחציו מותר — מה החזיר לו רבי יהודה?',
      correct: 'הוא ענה: ארבעה עשר בעצמו יוכיח — מקצתו מותר באכילת חמץ ומקצתו אסור',
      praise: [
        '«הוּא עַצְמוֹ יוֹכִיחַ, שֶׁמִּקְצָתוֹ מוּתָּר בַּאֲכִילַת חָמֵץ וּמִקְצָתוֹ אָסוּר בַּאֲכִילַת חָמֵץ.» היום עצמו!',
        'ארבעה עשר בבוקר — עוד אוכלים חמץ. ארבעה עשר בצהריים — כבר לא. יום אחד, שני דינים. הנה לך יום חצוי.'
      ],
      wrong: [
        {
          text: 'הוא לא ענה — הודה שרבי אליעזר בן יעקב ניצח בזו',
          fb: 'לוותר?! רבי יהודה?! יש לו תשובה — והיא עומדת על היום הזה בעצמו. תסתכל על ארבעה עשר. תנסה שוב.'
        },
        {
          text: 'הוא ענה: שבת תוכיח — גם בשבת אסור במלאכה',
          fb: 'שבת? שבת כולה אסורה, מההתחלה ועד הסוף — אין בה "מקצת". רבי יהודה מצא יום חצוי באמת. קרוב יותר משנדמה לך.'
        }
      ],
      restate: {
        p: 'רגע. במילים שלך: איזה יום הביא רבי יהודה כהוכחה ליום שחציו כך וחציו כך?',
        ok: 'את ארבעה עשר עצמו — שמקצתו מותר באכילת חמץ ומקצתו אסור',
        bad: 'את יום ההולדת של בית שמאי',
        badFb: 'חגיגי, אבל לא. ארבעה עשר עצמו: בבוקר עוד אוכלים חמץ, מהצהריים כבר אסור — יום אחד, חצי מותר וחצי אסור. עוד ניסיון.'
      }
    },
    {
      setup: [
        'רבי יהודה מחייך. אבל לרבי אליעזר בן יעקב נשאר עוד חץ אחד באשפה — והוא החד מכולם.'
      ],
      q: 'שאלה אחרונה: ומה הפיל רבי אליעזר בן יעקב בחזרה?',
      correct: 'הוא הפיל: אני אמרתי לך מלאכה דרבנן — ואתה עונה לי חמץ דאורייתא?!',
      praise: [
        'בדיוק! «אֲמֵינָא לָךְ אֲנָא מְלָאכָה דְּרַבָּנַן וְאַתְּ אָמְרַתְּ לִי חָמֵץ דְּאוֹרָיְיתָא?!» — אי אפשר להשוות גחלת למדורה.',
        'שעות אכילת החמץ — «הַרְחָקָה הוּא דַּעֲבוּד רַבָּנַן לִדְאוֹרָיְיתָא». גדר של חכמים סביב דין תורה. חד כמו רוח פסגה.'
      ],
      wrong: [
        {
          text: 'הוא נכנע: בוא נאכל קרעפלעך ונשכח מהכול',
          fb: 'מפתה, אבל לא — וקרעפלעך תקבל אצל גד, לשנייה וחצי, עד שייזכר שזה חמץ. התשובה האמיתית חדה: מלאכה דרבנן — וחמץ דאורייתא. לא באותה ליגה בכלל.'
        },
        {
          text: 'הוא הציע פשרה: שנינו צודקים, נחלק את היום חצי-חצי',
          fb: 'פשרה של שוק, לא של בית מדרש. הוא לא חילק את היום — הוא הפריד בין הליגות: דרבנן מול דאורייתא.'
        }
      ],
      restate: {
        p: 'לאט. במילים שלך: מה הבעיה בתשובה של רבי יהודה, לפי רבי אליעזר בן יעקב?',
        ok: 'הוא ענה מחמץ דאורייתא על שאלה במלאכה דרבנן — אין השוואה',
        bad: 'רבי יהודה דיבר בקול נמוך מדי בשביל פסגה',
        badFb: 'הקול היה בסדר. הראיה הייתה מהמגרש הלא נכון. עוד פעם.'
      }
    }
  ];

  var QUIZ_PRAISE_SHORT = [
    'יפה! שמונה. כמעט להבה נקייה.',
    'נכון! תשע. עשן מינימלי.',
    'חד! תשע וחצי. בלי ניצוצות מיותרים.',
    'מדויק. ההרים היו מוחאים כפיים, אם היו להם ידיים.'
  ];

  // ---------------------------------------------------------------------
  // QUIZ RUNNER — retry-until-right, with a forced restatement after a miss
  // ---------------------------------------------------------------------
  async function runMelakhahQuiz(g) {
    if (quizRunning) return;
    quizRunning = true;
    try {
      await g.cutscene(async function () {
        await boazSay(g, 'ארבע שאלות על זמנים ואש. תענה נכון — ואני פותח את התיבה. תטעה — נתקן ביחד. אף אחד לא יורד מההר בור.');
        for (var i = 0; i < QUIZ.length; i++) {
          var round = QUIZ[i];
          safeSfx(g, 'quiz');
          for (var s = 0; s < round.setup.length; s++) await boazSay(g, round.setup[s]);
          var solved = false;
          var firstTry = true;
          while (!solved) {
            await boazSay(g, round.q);
            var opts = [{ text: round.correct, value: 'ok' }];
            for (var w = 0; w < round.wrong.length; w++) {
              opts.push({ text: round.wrong[w].text, value: 'w' + w });
            }
            var ans = await g.choose(shuffled(opts));
            if (ans === 'ok') {
              safeSfx(g, 'star');
              if (firstTry) await boazSay(g, QUIZ_PRAISE_SHORT[i % QUIZ_PRAISE_SHORT.length]);
              for (var p = 0; p < round.praise.length; p++) await boazSay(g, round.praise[p]);
              solved = true;
            } else {
              firstTry = false;
              safeSfx(g, 'fail');
              var wi = parseInt(String(ans).slice(1), 10);
              var wobj = round.wrong[wi] || round.wrong[0];
              await boazSay(g, wobj.fb);
              // forced restatement: the retry must test the rule, not the buttons
              var restated = false;
              while (!restated) {
                await boazSay(g, round.restate.p);
                var r = await g.choose(shuffled([
                  { text: round.restate.ok, value: 'yes' },
                  { text: round.restate.bad, value: 'no' }
                ]));
                if (r === 'yes') {
                  await boazSay(g, 'זהו. עכשיו — עוד פעם, ובקול של מי שמבין.');
                  restated = true;
                } else {
                  await boazSay(g, round.restate.badFb);
                }
              }
            }
          }
        }
        // quiz complete — hand off to the physical ember mini-beat
        g.flag('summitQuizDone', true);
        safeSfx(g, 'magic');
        await boazSay(g, 'עברת. אלפיים שנה של משואות מסתכלות עליך עכשיו בכבוד.');
        await boazSay(g, 'עכשיו החלק הקדוש. פתח את תיבת הגחלים. בעדינות. היא קמה עצבנית.');
        await g.playerSay('אני? לגעת בתינוקת? ...בסדר. ידיים יציבות, זרח.');
      });
    } catch (e) {
      if (window.console && console.warn) console.warn('summit.js: quiz error', e);
    } finally {
      quizRunning = false;
    }
  }

  // ---------------------------------------------------------------------
  // EMBER BEAT (click 1) — take the ember out of the firebox
  // ---------------------------------------------------------------------
  async function takeEmber(g) {
    await g.cutscene(async function () {
      safeSfx(g, 'click');
      await g.playerSay('אתה פותח את התיבה. גחלת אחת, אדומה, מביטה בך כמו סבתא שהעירו מתנומה.');
      await boazSay(g, 'שתי ידיים! נשימה איטית! היא מריחה פחד!');
      g.flag('summitEmber', true);
      safeSfx(g, 'pickup');
      await g.playerSay('יש לי אש בידיים. טכנית — פוטנציאל של אש. הרגע הכי לוהט בקריירה שלי.');
      await boazSay(g, 'עכשיו — אל המשואה. שים, תנשוף, ותתרחק בכבוד.');
    });
  }

  // ---------------------------------------------------------------------
  // LIGHTING CASCADE (click 2) — the beacon catches, the hills answer
  // ---------------------------------------------------------------------
  async function lightBeacon(g) {
    await g.cutscene(async function () {
      try { await g.walkTo(172, 140); } catch (e) { /* keep going */ }
      await g.playerSay('שם את הגחלת בין העצים... ונושף. בעדינות. כמו על מרק חם.');
      safeSfx(g, 'magic');
      await g.wait(700);
      g.flag('beaconLit', true);
      beaconLitAtT = lastT;
      safeSfx(g, 'star');
      g.flag('summitEmber', false);
      await g.wait(600);
      await boazSay(g, 'עשר! להבה נקייה, אפס עשן! ...אני לא אובייקטיבי. זו הבת שלי.');
      await g.wait(900);
      await g.say('בעיניים דומעות אתה רואה: על ההרים הרחוקים נדלקות נקודות אור, אחת אחרי אחת.', { x: 160, y: 60 });
      await boazSay(g, 'הרים רואים הרים! ככה זה עובד כבר אלפיים שנה — ואף אחד לא מרים טלפון!');
      safeSfx(g, 'hic'); // Sekhvi, startled mid-apology
      await roosterSay(g, 'זה... זה לא אני! שאף אחד לא יאכל לפי זה!');
      // the comprehension moment — beacons burn at night, so or = evening
      await boazSay(g, 'ועכשיו תבין מה עשית: משואות נראות רק בלילה. «וְאֵימָתַי מַשִּׂיאִין מַשּׂוּאוֹת — לְאוֹר עִבּוּרוֹ».');
      await boazSay(g, 'אם משיאין בלילה — אוֹר הוא ערב. «אַלְמָא ״אוֹר״ אוּרְתָּא הוּא! שְׁמַע מִינַּהּ.»');
      try { g.addSeal('melakhah', 'חותם המלאכה'); } catch (e) { /* fail silent */ }
      await boazSay(g, 'והנר שלך — תביא אותו אליי. אש מאש. ככה זה נעשה.');
    });
  }

  // ---------------------------------------------------------------------
  // CANDLE SERVICE — ner -> nerlit, the key gate for the cellar seal
  // ---------------------------------------------------------------------
  async function candleService(g) {
    if (serviceRunning) return;
    serviceRunning = true;
    try {
      await g.cutscene(async function () {
        await boazSay(g, 'תקרב את הנר. לאט. אש עוברת מיד ליד — לא נזרקת.');
        safeSfx(g, 'magic');
        await g.wait(600);
        try { g.remove('ner'); } catch (e) { /* silent */ }
        try { g.give('nerlit'); } catch (e) { /* silent */ }
        await boazSay(g, 'אש מאש. תגיד למנורה שבועז עוד יודע להדליק.');
        await g.playerSay('נר דולק ביד. «בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר» — פרידא, אני בא.');
        await boazSay(g, 'שבע וחצי לנר שלך. להבה קטנה אבל כנה. לך, לך לבדוק.');
      });
    } catch (e) {
      if (window.console && console.warn) console.warn('summit.js: candle service error', e);
    } finally {
      serviceRunning = false;
    }
  }

  // self-heal: if the beacon burned but the cascade died before the seal was
  // granted (engine error mid-cutscene), re-grant it on the next opportunity
  function healMelakhahSeal(g) {
    try {
      if (beaconIsLit() && g && typeof g.hasSeal === 'function' &&
          typeof g.addSeal === 'function' && !g.hasSeal('melakhah')) {
        g.addSeal('melakhah', 'חותם המלאכה');
      }
    } catch (e) { /* silent */ }
  }

  // refusal lines when fire is requested too early
  async function refuseFire(g) {
    if (!quizIsDone()) {
      await boazSay(g, 'קודם מוכיחים שיודעים מתי לילה. אחר כך נוגעים באש.');
    } else if (!beaconIsLit()) {
      await boazSay(g, 'נר מגחלת ישנה? חס וחלילה. קודם המשואה — הבכורה — אחר כך כל השאר.');
    }
  }

  // ---------------------------------------------------------------------
  // BOAZ TALK MENU
  // ---------------------------------------------------------------------
  async function talkBoaz(g) {
    if (quizRunning || serviceRunning) return;
    healMelakhahSeal(g);
    var S = window.GAME.state;
    if (!flags(S).summitMet) {
      g.flag('summitMet', true);
      await g.cutscene(async function () {
        await boazSay(g, 'עצור!! ...אה. אתה לא רוח. רוחות לא נועלות סנדלים.');
        await boazSay(g, 'בועז, משיא המשואות. אלפיים שנה המשפחה שלי מדליקה את ההר הזה — והלילה, בפעם הראשונה, אני תקוע.');
        await boazSay(g, 'הלילה אוֹר עיבורו של החודש! חייבים להשיא משואה! אבל "אוֹר" — אף אחד כבר לא יודע מתי זה. אין אוֹר — אין אש.');
        await boazSay(g, 'ליל בדיקה וליל עיבור באותו לילה? כן, גם לוח השנה שלנו התבלבל יחד עם השמיים. אל תנסה להבין — תנסה לעזור.');
        await boazSay(g, 'קר לך? קח קצת אש מהתיב— לא!! היא ישנה!!');
        await g.playerSay('כמעט קיבלתי משהו. מרגיש כמו ארוחת ערב אצל גד.');
      });
    }
    var talking = true;
    while (talking) {
      var lit = beaconIsLit();
      var done = quizIsDone();
      var opts = [];
      if (!done) {
        opts.push({ text: 'מה קרה למשואה?', value: 'why' });
        opts.push({ text: 'אני מוכן. תבחן אותי.', value: 'quiz' });
      }
      if (done && !lit && !emberHeld()) opts.push({ text: 'מה עכשיו?', value: 'now' });
      if (done && !lit && emberHeld()) opts.push({ text: 'הגחלת אצלי. מה הלאה?', value: 'carry' });
      if (lit && g.has('ner') && !g.has('nerlit')) opts.push({ text: 'תדליק לי את הנר?', value: 'light' });
      opts.push({ text: 'ספר לי על הגחלת', value: 'ember' });
      if (lit) opts.push({ text: 'איך האש?', value: 'rate' });
      opts.push({ text: 'רגע — גם אתה מציע ומושך בחזרה? כמו גד?', value: 'family' });
      opts.push({ text: 'להתראות', value: 'bye' });
      var choice = await g.choose(opts);
      if (choice === 'why') {
        await g.cutscene(async function () {
          await boazSay(g, 'החודש נראה בזמנו — צריך לקדש אותו ולהודיע לכל ההרים. «אֵין מַשִּׂיאִין מַשּׂוּאוֹת אֶלָּא עַל הַחֹדֶשׁ שֶׁנִּרְאָה בִּזְמַנּוֹ, לְקַדְּשׁוֹ.»');
          await boazSay(g, 'ומתי משיאין? «לְאוֹר עִבּוּרוֹ». אבל תסתכל על השמיים — חצי לילה, חצי בוקר. איזה "אוֹר" בדיוק?!');
          await boazSay(g, 'אני חולק אש רק עם מי שיודע לסדר את הזמנים של הדף. תוכיח — ותקבל.');
        });
      } else if (choice === 'quiz') {
        talking = false;
        await runMelakhahQuiz(g);
      } else if (choice === 'now') {
        await boazSay(g, 'התיבה. שם. פתח אותה בעדינות וקח את הגחלת. שתי ידיים!');
      } else if (choice === 'carry') {
        await boazSay(g, 'אל המשואה! שים בין העצים, תנשוף, ותתרחק. והיא תעשה את השאר.');
      } else if (choice === 'light') {
        talking = false;
        await candleService(g);
      } else if (choice === 'ember') {
        var sh = (g.flag('summitShush') || 0) + 1;
        g.flag('summitShush', sh);
        if (beaconIsLit()) {
          await boazSay(g, 'הייתה. עכשיו היא שם למעלה, גדולה ויפה. הן גדלות כל כך מהר...');
        } else if (emberHeld()) {
          await boazSay(g, 'היא ערה. היא אצלך. אל תדבר — תלך! למשואה!');
        } else if (sh === 1) {
          await boazSay(g, 'הגחלת האחרונה בכפר. כל שאר האש מתה עם המנורה. ששש — היא ישנה.');
        } else if (sh === 2) {
          await boazSay(g, 'שששש!! היא נרדמה עכשיו! אתה יודע כמה קשה להרדים גחלת בת אלפיים?!');
        } else {
          await boazSay(g, 'עוד שאלה אחת עליה ואני שולח אותך לישון בשוקת. ש-ש-ש.');
        }
      } else if (choice === 'rate') {
        await boazSay(g, pick([
          'עשר ומעלה. אפילו שמש הקרטון של שֶׂכְוִי הרימה ידיים. תסתכל עליה — שמוטה כמו תירוץ דחוק.',
          'אלפיים שנה של משואות, ואף פעם לא איחרתי. הלילה כמעט. אל תספר להרים.',
          'ההרים ענו תוך דקות. מקצוענים. הר טוב לא שואל שאלות.'
        ]));
      } else if (choice === 'family') {
        await boazSay(g, 'מה, גם גד עושה את זה? ...משפחה של נותנים.');
        await g.playerSay('נותנים, לוקחים בחזרה, ומרגישים נדיבים. מסורת יפה.');
      } else {
        await boazSay(g, pick([
          'לך בכי טוב. או בכי לילה. או... לך בזהירות, בסדר?',
          'אם תראה אש בדרך — תדרג אותה בשמי. אני סומך עליך.'
        ]));
        talking = false;
      }
    }
  }

  // ---------------------------------------------------------------------
  // ROOSTER TALK — the apology loop, ever more corporate
  // ---------------------------------------------------------------------
  async function talkRooster(g) {
    var n = g.flag('roosterChat') || 0;
    g.flag('roosterChat', n + 1);
    safeSfx(g, 'hic');
    if (stFlags().won) {
      await roosterSay(g, 'קוקוריקו. אחת. בזמן. הודעה לציבור: המכשיר חזר לכיול מלא — נא לא לצטט את הקריאות הקודמות.');
      return;
    }
    if (n === 0) {
      await g.cutscene(async function () {
        await roosterSay(g, '«רַבִּי שִׁמְעוֹן אוֹמֵר: עַד קְרוֹת הַגֶּבֶר»! אני לא סתם עוף — אני שעון הלכתי!');
        await roosterSay(g, 'ועכשיו אני שעון... מקולקל. אתה יודע כמה אנשים אכלו הלילה לפני תענית לפי הקריאה שלי?! גם אני לא!');
        await roosterSay(g, 'סליחה, לילה. סליחה, יום. סליחה לכל הצדדים.');
        await g.playerSay('תרנגול במשבר אמון. הכפר הזה לא מפסיק לתת.');
      });
    } else if (beaconIsLit()) {
      await roosterSay(g, pick([
        'המשואה הזאת קוראת יותר טוב ממני. אני מעריך מקצוענות, גם כשהיא כואבת.',
        'השמש מקרטון שלי פרשה. לא עמדה בתחרות. גם אני שוקל תחום חדש. אולי בעלי חיים.'
      ]));
    } else if (n === 1) {
      await roosterSay(g, 'הודעה לציבור הלילה: הקריאה האחרונה בוטלה. אנו מתנצלים על אי הנוחות.');
    } else if (n === 2) {
      await roosterSay(g, 'אני שוקל לפרסם מכתב. לשני השמיים. בנוסח אחיד, שלא ייפגעו.');
    } else {
      await roosterSay(g, pick([
        'קוקורי— לא. סליחה. עוד לא. אולי אף פעם.',
        'מי צריך שעון כשיש שני שמיים? כולם. כולם צריכים שעון.'
      ]));
    }
  }

  // ---------------------------------------------------------------------
  // SCENE REGISTRATION
  // ---------------------------------------------------------------------
  GAME.registerScene('summit', {
    name: 'פִּסְגַּת הַמַּשּׂוּאוֹת',
    floor: { yMin: 128, yMax: 170 },

    paint: function (ctx, t, S) {
      try {
        lastT = t;
        paintNightSky(ctx, t);
        paintDaySky(ctx, t);
        paintSeam(ctx, t, S);
        paintHills(ctx, t, S);
        paintGround(ctx, t, S);
        paintHut(ctx, t, S);
        paintBeacon(ctx, t, S);
        paintGrassTufts(ctx, t);
        paintPetals(ctx, t);
        paintFireWash(ctx, t, S);
      } catch (e) {
        px(ctx, 0, 0, 320, 180, NIGHT_MID);
        if (!window.__summitPaintWarned && window.console && console.warn) {
          window.__summitPaintWarned = true;
          console.warn('summit.js: paint error', e);
        }
      }
    },

    onEnter: async function (g) {
      try {
        healMelakhahSeal(g);
        if (!g.flag('summitVisited')) {
          g.flag('summitVisited', true);
          await g.cutscene(async function () {
            await g.say('רוח הפסגה מקבלת אותך בסטירה ידידותית. למעלה, התפר שבשמיים יורד ופוגע באופק.', { x: 160, y: 50 });
            await boazSay(g, 'עצור שם!! עוד צעד רועש ותעיר את הגחלת!!');
            await g.playerSay('הגעתי להר שבו גם להליכה יש הלכות. נעים מאוד.');
          });
        } else if (beaconIsLit() && g.has('ner') && !g.has('nerlit')) {
          await boazSay(g, 'הנר, גיבור! המשואה דולקת — בוא נדליק אותך גם!');
        } else if (quizIsDone() && !beaconIsLit() && emberHeld()) {
          await boazSay(g, 'הגחלת מחכה בידיים שלך. המשואה מחכה מולך. אל תמשוך את הדרמה.');
        }
      } catch (e) {
        if (window.console && console.warn) console.warn('summit.js: onEnter error', e);
      }
    },

    hotspots: [
      // ----- the split-sky seam, where it meets the horizon -----
      {
        id: 'seam', name: 'הַתֶּפֶר בַּשָּׁמַיִם', type: 'object',
        x: 198, y: 24, w: 20, h: 70,
        walkTo: { x: 208, y: 138 },
        look: async function (g) {
          await g.playerSay('התפר פוגע כאן באופק. חצי דשא בטל, חצי דשא נרדם. העשב היחיד בעולם עם ג\'ט לג.');
          if (sealCount(window.GAME.state) >= 2) {
            await g.playerSay('הוא צר יותר משהיה. כל חותם תופר עוד קצת שמיים.');
          }
        },
        take: async function (g) {
          await g.playerSay('לקחת תפר של שמיים? אין לי כיס בגודל הזה.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('«מַאי ״אוֹר״? רַב הוּנָא אָמַר: נַגְהֵי, וְרַב יְהוּדָה אָמַר: לֵילֵי.» — והשמיים לקחו את המחלוקת אישית.');
          } else {
            await g.playerSay('השמיים לא צריכים עזרה ממני. הם צריכים תשובה.');
          }
        }
      },

      // ----- far hills, waiting for the signal -----
      {
        id: 'hills', name: 'הֶהָרִים הָרְחוֹקִים', type: 'object',
        x: 228, y: 80, w: 90, h: 22,
        walkTo: { x: 262, y: 136 },
        look: async function (g) {
          if (beaconIsLit()) {
            await g.playerSay('אש של ראש חודש, וההרים עונים אחד-אחד. "הרים רואים הרים" — בועז חוזר על זה כל שתי דקות, והלילה אי אפשר להתווכח איתו.');
          } else {
            await g.playerSay('הרים בחושך, מחכים לסימן מבועז. מנוי של אלפיים שנה — ואף פעם לא התחילה ההצגה באיחור. עד הלילה.');
          }
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('«אֵין מַשִּׂיאִין מַשּׂוּאוֹת אֶלָּא עַל הַחֹדֶשׁ שֶׁנִּרְאָה בִּזְמַנּוֹ, לְקַדְּשׁוֹ.» — והם שם כדי להעביר את זה הלאה.');
          } else {
            await g.playerSay('רחוק מדי. גם בשביל זריקה טובה.');
          }
        }
      },

      // ----- the weathervane -----
      {
        id: 'vane', name: 'הַשַּׁבְשֶׁבֶת', type: 'object',
        x: 14, y: 38, w: 24, h: 26,
        walkTo: { x: 40, y: 136 },
        look: async function (g) {
          await g.playerSay('מצביעה מזרחה. עכשיו מערבה. עכשיו על עצמה. גם היא כבר לא יודעת אם ללכת לישון.');
        },
        take: async function (g) {
          await g.playerSay('היא מסתובבת מהר מדי. אני מעריך את האצבעות שלי.');
        },
        use: async function (g) {
          await g.playerSay('רוח של יום מפה, רוח של לילה משם. הציפור שניסתה לנחות עליה כבר ויתרה.');
        }
      },

      // ----- the hut window -----
      {
        id: 'window', name: 'חַלּוֹן הַבִּקְתָּה', type: 'object',
        x: 36, y: 90, w: 22, h: 22,
        walkTo: { x: 52, y: 136 },
        look: async function (g) {
          await g.playerSay('חלון עגול. בפנים: מיטה, קומקום, ואוסף קטן של גפרורים שרופים מסודרים לפי גודל. אספנות.');
          await boazSay(g, 'כל גפרור שם הדליק משהו חשוב. אל תשפוט.');
        },
        take: async function (g) {
          await g.playerSay('לגנוב מאוסף הגפרורים? יש גבולות גם לחוקרי חמץ.');
        },
        use: async function (g, itemId) {
          if (itemId === 'pita') {
            await g.playerSay('להכניס חמץ לבקתה של בועז לילה לפני פסח? הוא ישרוף אותי לפני הביעור.');
          } else {
            await g.playerSay('החלון סגור. גם הבקתה שומרת על חום.');
          }
        }
      },

      // ----- Boaz (declared before firebox so the box rect wins the overlap) -----
      {
        id: 'boaz', name: 'בּוֹעַז מַשִּׂיא הַמַּשּׂוּאוֹת', type: 'char',
        x: 108, y: 108, w: 28, h: 36,
        walkTo: { x: 140, y: 148 },
        draw: function (ctx, t, S) { drawBoaz(ctx, t, S); },
        look: async function (g) {
          await g.playerSay('זקן גדול, לב גדול, וריח קל של עשן. פרידא צדקה — איש של אש, קצת שרוף בעצמו.');
        },
        talk: function (g) { return talkBoaz(g); },
        take: async function (g) {
          await g.playerSay('הוא שקוע באדמה כמו ההר. וההר היה פה קודם.');
        },
        use: async function (g, itemId) {
          if (itemId === 'ner') {
            if (beaconIsLit()) { await candleService(g); }
            else { await refuseFire(g); }
          } else if (itemId === 'nerlit') {
            await boazSay(g, 'כבר דולק! שבע וחצי, אמרתי. אל תבקש שיפוט חוזר.');
          } else if (itemId === 'daf') {
            await g.cutscene(async function () {
              await boazSay(g, 'רואה את הכוכבים מעל המצפה? הצופה שם בטוח שהם שלו.');
              await boazSay(g, 'תגיד לו — «הַנּוֹדֵר מִן הָאוֹר — אָסוּר בְּאוֹרָן שֶׁל כּוֹכָבִים». אור הכוכבים — אור לכל הדעות.');
              if (!quizIsDone()) {
                await boazSay(g, 'ולדף שלך: תחפש שם מתי משיאין משואות. זה כל הסוד שלי.');
              }
            });
          } else if (itemId === 'pita') {
            await boazSay(g, 'חמץ? מחר בבוקר זה דלק של מצווה. שמונה. שמור אותה לביעור.');
          } else {
            await g.playerSay('אין לי מה לתת לו. חוץ מתשובות נכונות, מסתבר.');
          }
        }
      },

      // ----- the firebox (the ember mini-beat, click 1) -----
      {
        id: 'firebox', name: 'תֵּבַת הַגֶּחָלִים', type: 'object',
        x: 112, y: 118, w: 16, h: 13,
        walkTo: { x: 132, y: 146 },
        look: async function (g) {
          if (quizIsDone() && !beaconIsLit() && !emberHeld()) { await takeEmber(g); return; }
          if (beaconIsLit()) {
            await boazSay(g, 'ריקה. הגחלת שלי עכשיו משואה שלמה. ...הן גדלות כל כך מהר.');
            return;
          }
          if (emberHeld()) {
            await boazSay(g, 'התיבה ריקה — היא אצלך! למשואה, עכשיו! שתי ידיים!');
            return;
          }
          var sh = (g.flag('summitShush') || 0) + 1;
          g.flag('summitShush', sh);
          if (sh <= 1) {
            await g.playerSay('גחלת אחרונה בכפר. בועז מנדנד את התיבה בעדינות. נדמה לך ששמעת שיר ערש.');
          } else if (sh === 2) {
            await boazSay(g, 'שששש! היא ישנה!');
          } else {
            await boazSay(g, 'היא נרדמה עכשיו!! עוד מבט אחד ואתה שומר עליה עד הבוקר!');
          }
        },
        take: async function (g) {
          if (quizIsDone() && !beaconIsLit() && !emberHeld()) { await takeEmber(g); return; }
          if (beaconIsLit()) { await boazSay(g, 'את התיבה הריקה? היא מזכרת משפחתית. עזוב.'); return; }
          if (emberHeld()) { await boazSay(g, 'התיבה ריקה. הגחלת כבר אצלך — למשואה איתה!'); return; }
          await boazSay(g, 'ידיים מהתיבה! גחלת עוברת רק למי שיודע מתי לילה. גם אני עברתי את המבחן הזה — לפני שישים שנה, אצל אבא שלי.');
        },
        use: async function (g, itemId) {
          if (itemId === 'nerlit') {
            await boazSay(g, 'שששש! אתה מציע אש לגחלת?! היא סבתא של האש שלך! כבד את הוריך.');
            return;
          }
          if (itemId === 'ner') {
            if (beaconIsLit()) { await candleService(g); return; }
            await refuseFire(g);
            return;
          }
          if (itemId === 'pita') {
            await boazSay(g, 'חמץ ליד התיבה?! היא ישנה, ואתה מגיש לה ארוחת בוקר אסורה?! שמור אותה לביעור של מחר.');
            return;
          }
          if (itemId === 'daf') {
            await g.playerSay('להשעין דף גמרא על התיבה? היא בת אלפיים. היא כתבה את התגובות בשוליים.');
            return;
          }
          if (quizIsDone() && !beaconIsLit() && !emberHeld()) { await takeEmber(g); return; }
          if (!quizIsDone()) {
            await boazSay(g, 'קודם מוכיחים שיודעים מתי לילה. אחר כך נוגעים באש.');
          } else {
            await g.playerSay('התיבה כבר עשתה את שלה.');
          }
        }
      },

      // ----- the beacon pyre (the lighting, click 2) -----
      {
        id: 'beacon', name: 'הַמַּשּׂוּאָה', type: 'object',
        x: 144, y: 76, w: 56, h: 52,
        walkTo: { x: 172, y: 142 },
        look: async function (g) {
          if (emberHeld() && !beaconIsLit()) { await lightBeacon(g); return; }
          if (beaconIsLit()) {
            await g.playerSay('אש של ראש חודש, גבוהה וצלולה. עומדת על ההר כמו תשובה סופית.');
          } else {
            await g.playerSay('ערימת עצים ספוגה בשמן. הדבר היחיד בכפר שמוכן להידלק — ואסור לו.');
          }
        },
        take: async function (g) {
          await g.playerSay('לקחת משואה? אני מחפש חמץ, לא פריצת גב.');
        },
        use: async function (g, itemId) {
          if (itemId === 'ner') {
            if (beaconIsLit()) { await candleService(g); }
            else { await refuseFire(g); }
            return;
          }
          if (itemId === 'nerlit') {
            await g.playerSay('להדליק משואה דולקת בנר? זה כמו להשקות את הים.');
            return;
          }
          if (itemId === 'daf') {
            await g.cutscene(async function () {
              await g.playerSay('«וְאֵימָתַי מַשִּׂיאִין מַשּׂוּאוֹת — לְאוֹר עִבּוּרוֹ».');
              await g.playerSay('משואה רואים רק בלילה. אז "אוֹר" של המשנה — ערב. הדף כבר ענה, רק צריך להקשיב.');
            });
            return;
          }
          if (itemId === 'pita') {
            await boazSay(g, 'להשליך חמץ למשואה?! זו משואת קידוש החודש, לא ביעור! מחר. בזמן. בנחת.');
            return;
          }
          if (emberHeld() && !beaconIsLit()) { await lightBeacon(g); return; }
          if (!beaconIsLit()) {
            await g.playerSay('בלי אש ביד אין מה ללחוץ על העצים. הם לא נדלקים מכוח רצון.');
          } else {
            await g.playerSay('היא דולקת מצוין בלעדיי. יש דברים שכדאי לא לשפר.');
          }
        }
      },

      // ----- Sekhvi the rooster -----
      {
        id: 'rooster', name: 'שֶׂכְוִי הַתַּרְנְגוֹל', type: 'char',
        x: 50, y: 48, w: 24, h: 20,
        walkTo: { x: 62, y: 136 },
        draw: function (ctx, t, S) { drawRooster(ctx, t, S); },
        look: async function (g) {
          await g.playerSay('תרנגול על הגג, עיניים של תורן משמרת כפולה. קורא ליום, מתנצל בפני הלילה, וחוזר חלילה.');
        },
        talk: function (g) { return talkRooster(g); },
        take: async function (g) {
          g.flag('egg_rooster', true);
          safeSfx(g, 'hic');
          await roosterSay(g, 'לקחת אותי?! אני מכשיר הלכתי! «עַד קְרוֹת הַגֶּבֶר»! אין קריאה בלי גבר, ואין גבר בלי פסגה!');
          await boazSay(g, 'עזוב אותו. הוא בתקופה רגישה.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await roosterSay(g, 'כתוב עליי! אוכלים לפני תענית «עַד שֶׁיַּעֲלֶה עַמּוּד הַשַּׁחַר» — «רַבִּי שִׁמְעוֹן אוֹמֵר: עַד קְרוֹת הַגֶּבֶר»! אני פסיקה מהלכת!');
          } else if (itemId === 'pita') {
            await roosterSay(g, 'חמץ?! לילה לפני בדיקה?! תרחיק את זה מהגג שלי, אני מוסד ציבורי!');
          } else {
            await g.playerSay('הוא באמצע התנצלות. לא מפריעים לאמן.');
          }
        }
      },

      // ----- Beitza the cat, professional fire critic (after the lighting) -----
      {
        id: 'summitcat', name: 'בֵּיצָה הַחֲתוּלָה', type: 'char',
        x: 200, y: 130, w: 14, h: 14,
        walkTo: { x: 190, y: 150 },
        visible: function (S) { return !!(S && S.flags && S.flags.beaconLit); },
        draw: function (ctx, t, S) { drawCat(ctx, t, S); },
        look: async function (g) {
          await boazSay(g, 'החתולה מהפונדק. מגיעה לכל הדלקה. מבקרת אש מקצועית.');
        },
        talk: async function (g) {
          await catSay(g, 'מִיאוּ. (תרגום חופשי: להבה יציבה, עשן סביר. שמונה וחצי.)');
          await boazSay(g, 'שמונה וחצי?! היא נותנת לי שמונה וחצי?!');
        },
        take: async function (g) {
          await catSay(g, 'מִיאוּ. (אסור לטלטל אותי. תבדוק במסכת שלי.)');
        },
        use: async function (g, itemId) {
          if (itemId === 'pita') {
            await catSay(g, 'מִיאוּ!! (חמץ?! עליי?! גם פה?! אני חתולה שומרת מסורת!)');
          } else {
            await g.playerSay('היא בעבודה. מבקרים לא מפריעים למבקרת.');
          }
        }
      },

      // ----- exit: back down to the inn -----
      {
        id: 'toinn', name: 'אֶל הַפּוּנְדָּק', type: 'exit',
        x: 294, y: 116, w: 26, h: 62,
        walkTo: { x: 302, y: 150 },
        target: 'inn',
        spawn: { x: 48, y: 150 },
        look: async function (g) {
          await g.playerSay('השביל חזרה לפונדק. יוצאים בכי טוב, נכנסים בכי טוב — בכפר הזה פשוט אף אחד לא יודע מתי "טוב".');
        }
      }
    ]
  });
})();
