'use strict';
/*
 * Scene: observatory — Naftali's Star Observatory ("Mitzpe HaKochavim")
 * DAF QUEST — Pesachim 2a-2b. SEAL 2: 'light' (chotam ha-or).
 * The absurd twist: the observatory sits on the DAY half of the torn sky, so the
 * astronomer's stars are washed out by a stuck dawn. Naftali has decided that
 * "or" = day (his stars be damned — he hasn't thought it through). The player
 * defeats him in the VERSE-DUEL: 4 graded rounds (verses 1-4 + the Gemara's
 * deflections), a free mid-duel twist (stars-of-light realization), Naftali
 * self-deflecting verses 5-6 in a despair monologue, then the CLINCHER —
 * Rabbi Yehuda's baraita — earns g.addSeal('light', ...) (the light seal).
 * Owns ONLY this file. Registers via GAME.registerScene('observatory', {...}).
 * Relies on GAME / SPRITES / AUDIO contracts (all guarded).
 */
(function () {
  if (!window.GAME || typeof window.GAME.registerScene !== 'function') {
    if (window.console && console.warn) console.warn('observatory.js: GAME.registerScene unavailable, scene not registered');
    return;
  }

  // ---------------------------------------------------------------------
  // Palette — split sky: night indigo (west/left) vs stuck golden dawn (east/right)
  // ---------------------------------------------------------------------
  var NIGHT_TOP = '#12123a', NIGHT_MID = '#1e1e52', NIGHT_LOW = '#2a2a70';
  var DAY_TOP = '#d97a4a', DAY_MID = '#ffb347', DAY_LOW = '#ffd166';
  var SEAM_A = '#aef6ff', SEAM_B = '#ffffff';
  var STAR_WHITE = '#fff7d6';
  var GRASS_D = '#2e5a38', GRASS_M = '#3f7a4a', GRASS_L = '#5a9a5f';
  var WOOD_D = '#5a3a24', WOOD_L = '#7a512f';
  var STONE_M = '#6b6b8f';
  var BRASS = '#b0662f', BRASS_L = '#d98c3f', BRASS_HL = '#f0b060';
  var PARCH = '#e8d8a8', PARCH_D = '#c9b684';
  var PETAL_A = '#ffd7e8', PETAL_B = '#fff0f5';
  var SCARF = '#c0455a', SCARF_L = '#e06a7e';
  var ROBE = '#2e2e5e', ROBE_L = '#3d3d7a';
  var SKIN = '#e8b88a';
  var PATH = '#b0906a';

  var SEAM_X = 88; // seam center: the tear crosses the west edge of the east hill

  // ---------------------------------------------------------------------
  // Defensive drawing helpers
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

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function shuffled(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function sealCount(S) {
    try { return (S && S.seals && S.seals.length) || 0; } catch (e) { return 0; }
  }

  function hasLightSeal(S) {
    try { return !!(S && S.seals && S.seals.indexOf('light') >= 0); } catch (e) { return false; }
  }

  function safeSfx(g, name) {
    try { if (g && typeof g.sfx === 'function') g.sfx(name); } catch (e) { /* silent */ }
  }

  function flagSafe(g, name, val) {
    try {
      if (arguments.length >= 3) return g.flag(name, val);
      return g.flag(name);
    } catch (e) { return undefined; }
  }

  // ---------------------------------------------------------------------
  // Module animation state (timestamps set from dialogue, read by draw)
  // ---------------------------------------------------------------------
  var lastT = 0;           // updated every paint frame
  var scarfFlipAt = -99;   // one-shot scarf flip (set at each duel round)
  var scarfPower = 1;      // flip strength, fades as the duel drags on
  var scarfDroop = false;  // R5-R6 despair: the scarf gives up
  var capOn = false;       // lens-cap sight gag (painted stars inside)
  var starsFlareAt = -99;  // stubborn stars flare when the seal is earned
  var jarGlimmerAt = -99;  // star jar glimmers at the mid-duel twist
  var duelRunning = false; // double-launch guard

  // Speaker helper — Naftali always speaks in scarf-pink
  function nSay(g, text) { return g.say(text, { who: 'naftali', color: '#ff9ab0' }); }

  // =======================================================================
  // PAINT — layered background
  // =======================================================================

  // ---- Split sky: night bands left of the seam, stuck dawn right of it ----
  function paintSky(ctx, t, S) {
    var n = sealCount(S);
    var seamW = Math.max(2, 14 - 4 * n); // the game's visual progress bar
    var seamL = SEAM_X - Math.floor(seamW / 2);

    // night side (west)
    px(ctx, 0, 0, seamL, 42, NIGHT_TOP);
    dither(ctx, 0, 42, seamL, 4, NIGHT_TOP, NIGHT_MID);
    px(ctx, 0, 46, seamL, 34, NIGHT_MID);
    dither(ctx, 0, 80, seamL, 4, NIGHT_MID, NIGHT_LOW);
    px(ctx, 0, 84, seamL, 28, NIGHT_LOW);

    // day side (east) — stuck golden dawn
    var dayX = seamL + seamW;
    px(ctx, dayX, 0, 320 - dayX, 42, DAY_TOP);
    dither(ctx, dayX, 42, 320 - dayX, 4, DAY_TOP, DAY_MID);
    px(ctx, dayX, 46, 320 - dayX, 34, DAY_MID);
    dither(ctx, dayX, 80, 320 - dayX, 4, DAY_MID, DAY_LOW);
    px(ctx, dayX, 84, 320 - dayX, 28, DAY_LOW);

    // micro-detail 1: the SEAM — shimmering dithered sparkle column, slowly pulsing
    dither(ctx, seamL, 0, seamW, 112, NIGHT_LOW, DAY_MID);
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.12 * Math.sin(t * 1.5);
    px(ctx, seamL, 0, seamW, 112, SEAM_A);
    ctx.restore();
    var sy;
    for (sy = 8; sy < 110; sy += 17) {
      twinkle(ctx, SEAM_X + ((sy % 3) - 1), sy, t * 1.6, 1, (sy % 2) ? SEAM_A : SEAM_B);
    }

    // micro-detail 2: night-side stars twinkling out of sync
    twinkle(ctx, 12, 14, t, 2, STAR_WHITE);
    twinkle(ctx, 34, 30, t, 1, STAR_WHITE);
    twinkle(ctx, 55, 10, t, 2, STAR_WHITE);
    twinkle(ctx, 22, 52, t, 1, '#cfe0ff');
    twinkle(ctx, 66, 40, t, 1, STAR_WHITE);
    twinkle(ctx, 44, 70, t, 1, '#cfe0ff');
    twinkle(ctx, 8, 84, t, 1, STAR_WHITE);

    // pale moon on the night side
    if (window.SPRITES && typeof SPRITES.moon === 'function') {
      try { SPRITES.moon(ctx, 32, 24, 0.4, 9); } catch (e) { px(ctx, 28, 20, 8, 8, '#cfc3e0'); }
    } else {
      px(ctx, 28, 20, 8, 8, '#cfc3e0');
    }

    // micro-detail 3: the confused half-risen sun, rays wobbling irregularly
    var sunX = 300, sunY = 112;
    ctx.save();
    ctx.fillStyle = DAY_LOW;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 13, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#fff2b0';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 8, Math.PI, 0);
    ctx.fill();
    ctx.restore();
    var i, ra, rl;
    for (i = 0; i < 5; i++) {
      ra = Math.PI + (i + 0.5) * (Math.PI / 5);
      rl = 4 + Math.sin(t * 2.6 + i * 1.7) * 2.2; // each ray unsure of itself
      px(ctx, Math.round(sunX + Math.cos(ra) * (15 + rl)) , Math.round(sunY + Math.sin(ra) * (15 + rl)), 2, 2, DAY_MID);
    }

    // micro-detail 4: 2-3 STUBBORN STARS piercing the daylight (they refuse to go home)
    var flare = (lastT - starsFlareAt) >= 0 && (lastT - starsFlareAt) < 3;
    var won = hasLightSeal(S);
    var sz = (won || flare) ? 3 : 2;
    twinkle(ctx, 216, 16, t * (flare ? 3 : 1), sz, STAR_WHITE);
    twinkle(ctx, 242, 26, t * (flare ? 3 : 1) + 2, sz, STAR_WHITE);
    twinkle(ctx, 228, 38, t * (flare ? 3 : 1) + 4, won ? 3 : 1, STAR_WHITE);
    if (flare) {
      glow(ctx, 230, 26, 16, SEAM_A, 0.3 + 0.2 * Math.sin(t * 6));
    } else if (won) {
      glow(ctx, 230, 26, 10, STAR_WHITE, 0.12);
    }
  }

  // ---- Ground: the east hill, tinted by both halves of the sky ----
  function paintGround(ctx, t, S) {
    px(ctx, 0, 112, 320, 10, GRASS_D);
    dither(ctx, 0, 122, 320, 4, GRASS_D, GRASS_M);
    px(ctx, 0, 126, 320, 30, GRASS_M);
    dither(ctx, 0, 156, 320, 4, GRASS_M, GRASS_D);
    px(ctx, 0, 160, 320, 20, GRASS_D);

    // each sky half stains its own side of the hill
    ctx.save();
    ctx.globalAlpha = 0.12;
    px(ctx, 0, 112, SEAM_X, 68, NIGHT_MID);
    px(ctx, SEAM_X, 112, 320 - SEAM_X, 68, DAY_MID);
    ctx.restore();

    // dirt path west, downhill to the inn
    px(ctx, 0, 146, 30, 8, PATH);
    px(ctx, 0, 154, 40, 12, PATH);
    px(ctx, 0, 166, 52, 14, PATH);
    dither(ctx, 26, 148, 8, 20, PATH, GRASS_M);

    // micro-detail 5: grass blades swaying (day-side breeze)
    var tufts = [58, 96, 130, 168, 200, 262, 296];
    var i, gx, sway;
    for (i = 0; i < tufts.length; i++) {
      gx = tufts[i];
      sway = Math.round(Math.sin(t * 1.4 + gx) * 1.2);
      px(ctx, gx + sway, 150 + (i % 3) * 8, 1, 3, GRASS_L);
      px(ctx, gx + 2, 151 + (i % 3) * 8, 1, 2, GRASS_L);
    }

    // scattered lens-glass shards catching light (an astronomer lives here)
    twinkle(ctx, 120, 158, t + 1, 1, SEAM_A);
    twinkle(ctx, 180, 165, t + 3, 1, SEAM_A);
  }

  // ---- The crooked wooden stargazing tower (east side) ----
  function paintTower(ctx, t, S) {
    // legs — deliberately crooked (built at night, obviously)
    px(ctx, 262, 96, 5, 54, WOOD_D);
    px(ctx, 304, 94, 5, 56, WOOD_D);
    px(ctx, 268, 118, 36, 3, WOOD_L);  // cross-brace
    px(ctx, 266, 136, 40, 3, WOOD_L);  // lower brace
    // ladder
    px(ctx, 284, 100, 2, 50, WOOD_L);
    px(ctx, 290, 100, 2, 50, WOOD_L);
    var i;
    for (i = 0; i < 6; i++) px(ctx, 284, 104 + i * 8, 8, 1, WOOD_D);

    // cabin, slightly tilted
    px(ctx, 256, 56, 56, 42, WOOD_L);
    px(ctx, 256, 56, 56, 3, WOOD_D);
    px(ctx, 256, 70, 56, 2, WOOD_D);
    px(ctx, 256, 84, 56, 2, WOOD_D);
    // roof — a lopsided dome (aspirational)
    px(ctx, 252, 50, 64, 6, WOOD_D);
    px(ctx, 260, 44, 48, 6, STONE_M);
    px(ctx, 270, 40, 28, 4, STONE_M);
    px(ctx, 278, 36, 12, 4, '#7a7a9c');
    // roof hatch left open for stargazing
    px(ctx, 292, 38, 8, 6, NIGHT_MID);

    // micro-detail 6: round window with Naftali's oil lamp flickering inside
    px(ctx, 262, 60, 10, 10, '#3a2a1a');
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
    px(ctx, 264, 62, 6, 6, DAY_LOW);
    ctx.restore();

    // star chart board pinned to the cabin face (hotspot 'charts')
    paintChartBoard(ctx, t, S, 272, 62);

    // micro-detail 7: wind chimes of lens glass, swaying under the eave
    var cx = 256, cy = 54;
    var lens = [8, 12, 10];
    for (i = 0; i < 3; i++) {
      var swx = Math.round(Math.sin(t * 1.3 + i * 1.4) * 2);
      px(ctx, cx - 2 + i * 4, cy, 1, lens[i], '#9a8f70');
      px(ctx, cx - 3 + i * 4 + swx, cy + lens[i], 3, 3, SEAM_A);
      if (Math.sin(t * 1.3 + i * 1.4) > 0.9) px(ctx, cx - 2 + i * 4 + swx, cy + lens[i] + 1, 1, 1, '#ffffff'); // glint
    }

    // micro-detail 8: a loose parchment sheet on a tower leg, fluttering corner
    px(ctx, 305, 108, 8, 10, PARCH);
    var lift = Math.max(0, Math.sin(t * 2.7)) * 2;
    px(ctx, 311, 108 - Math.round(lift), 2, 2 + Math.round(lift), PARCH_D);
    px(ctx, 306, 110, 5, 1, '#8a7a56');
    px(ctx, 306, 113, 6, 1, '#8a7a56');
  }

  // ---- Star chart board + the "Beitza" cat constellation (sight gag C2) ----
  function paintChartBoard(ctx, t, S, bx, by) {
    px(ctx, bx - 1, by - 1, 32, 32, WOOD_D);
    px(ctx, bx, by, 30, 30, PARCH);
    // micro-detail 9: chart corner flap (the pins are losing the argument with the wind)
    var lift = Math.max(0, Math.sin(t * 2.3)) * 2;
    px(ctx, bx + 24, by - Math.round(lift), 6, 2 + Math.round(lift), PARCH_D);
    // pins
    px(ctx, bx + 1, by + 1, 1, 1, SCARF);
    px(ctx, bx + 28, by + 28, 1, 1, SCARF);
    // constellation lines (faded ink)
    px(ctx, bx + 4, by + 20, 10, 1, PARCH_D);
    px(ctx, bx + 16, by + 14, 8, 1, PARCH_D);
    // the cat-loaf constellation "Beitza": ears, back arc, tail — readable at 8px
    var dots = [[8, 5], [12, 5], [6, 8], [9, 9], [13, 9], [16, 8], [19, 10], [22, 12], [24, 9]];
    var i;
    for (i = 0; i < dots.length; i++) px(ctx, bx + dots[i][0], by + dots[i][1], 1, 1, '#4a4a68');
    // post-seal: two extra pixels — the cat blinked into the chart (they blink!)
    if (hasLightSeal(S) && ((t % 4.2) > 0.3)) {
      px(ctx, bx + 9, by + 7, 1, 1, '#2a6a3a');
      px(ctx, bx + 11, by + 7, 1, 1, '#2a6a3a');
    }
  }

  // ---- Astrolabe on a post (west-mid, poetically on the night side) ----
  function paintAstrolabe(ctx, t) {
    px(ctx, 101, 106, 3, 28, WOOD_D);
    px(ctx, 98, 132, 9, 3, WOOD_L);
    ctx.save();
    ctx.strokeStyle = BRASS;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(102.5, 99, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = BRASS_L;
    ctx.beginPath(); ctx.arc(102.5, 99, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    // micro-detail 10: the sun-wheel and moon-wheel ticks are JAMMED in the same
    // slot, shoving each other — the only instrument honestly reporting the crisis
    var a1 = 1.15 + Math.sin(t * 2.1) * 0.09;
    var a2 = 1.48 - Math.sin(t * 2.1) * 0.09;
    px(ctx, Math.round(102.5 + Math.cos(a1) * 6) - 1, Math.round(99 + Math.sin(a1) * 6) - 1, 2, 2, DAY_LOW);
    px(ctx, Math.round(102.5 + Math.cos(a2) * 6) - 1, Math.round(99 + Math.sin(a2) * 6) - 1, 2, 2, '#cfc3e0');
    // lazy outer wheel still doing its rounds
    var a3 = t * 0.35;
    px(ctx, Math.round(102.5 + Math.cos(a3) * 8), Math.round(99 + Math.sin(a3) * 8), 1, 1, BRASS_HL);
  }

  // ---- Ambient drifting bits ----
  function paintAmbient(ctx, t, S) {
    // micro-detail 11: almond petals drifting across (it is Nisan!)
    var i, pxx, pyy;
    for (i = 0; i < 6; i++) {
      pxx = ((t * 9 + i * 61) % 360) - 20;
      pyy = 26 + i * 21 + Math.sin(t * 0.8 + i * 1.9) * 7;
      if (pyy < 172) px(ctx, Math.round(pxx), Math.round(pyy), 2, 1, (i % 2) ? PETAL_A : PETAL_B);
    }
    // micro-detail 12: one loyal firefly patrolling the night side
    var fx = 42 + Math.sin(t * 0.5) * 24;
    var fy = 92 + Math.sin(t * 0.9 + 1.3) * 10;
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4.2);
    px(ctx, Math.round(fx), Math.round(fy), 1, 1, DAY_LOW);
    ctx.restore();
    // micro-detail 13: the star jar's stray sparkle right after the twist beat
    if ((lastT - jarGlimmerAt) >= 0 && (lastT - jarGlimmerAt) < 2.5) {
      twinkle(ctx, 256 + Math.round(Math.sin(t * 5) * 3), 108, t * 4, 2, SEAM_A);
    }
  }

  function paint(ctx, t, S) {
    try {
      lastT = t;
      paintSky(ctx, t, S);
      paintGround(ctx, t, S);
      paintTower(ctx, t, S);
      paintAstrolabe(ctx, t);
      paintAmbient(ctx, t, S);
    } catch (e) {
      // never crash a frame
      px(ctx, 0, 0, 320, 180, NIGHT_MID);
      if (!window.__obsPaintWarned && window.console && console.warn) {
        window.__obsPaintWarned = true;
        console.warn('observatory.js paint error:', e);
      }
    }
  }

  // =======================================================================
  // CHARACTER & PROP DRAW (hotspot draw() — depth-sorted with the player)
  // =======================================================================

  // ---- Naftali: dramatic astronomer, self-waved scarf, pointed star hat ----
  function drawNaftali(ctx, t, S) {
    try {
      var fx = 153, fy = 144; // feet anchor
      var bob = Math.sin(t * 1.8) * 0.8;
      var y = fy + Math.round(bob);

      // ground shadow
      ctx.save();
      ctx.globalAlpha = 0.25;
      px(ctx, fx - 7, fy - 1, 14, 2, '#000000');
      ctx.restore();

      // robe — deep indigo with tiny embroidered stars
      px(ctx, fx - 6, y - 16, 12, 16, ROBE);
      px(ctx, fx - 6, y - 16, 3, 16, ROBE_L);
      px(ctx, fx - 2, y - 12, 1, 1, DAY_LOW);
      px(ctx, fx + 2, y - 8, 1, 1, DAY_LOW);
      px(ctx, fx - 4, y - 5, 1, 1, DAY_LOW);
      // belt
      px(ctx, fx - 6, y - 9, 12, 1, WOOD_D);

      // arms: right arm gestures at the sky in a loop (he argues with it daily)
      var ges = (Math.sin(t * 2.2) + 1) / 2;
      px(ctx, fx + 5, y - 15 - Math.round(ges * 4), 3, 6, ROBE_L);          // raised arm
      px(ctx, fx + 6, y - 17 - Math.round(ges * 4), 2, 2, SKIN);            // hand
      px(ctx, fx - 8, y - 14, 3, 7, ROBE);                                  // idle arm

      // head
      px(ctx, fx - 4, y - 23, 8, 7, SKIN);
      // eyes (blink with his own phase)
      if ((t % 3.7) > 0.14) {
        px(ctx, fx - 2, y - 21, 1, 1, '#22223a');
        px(ctx, fx + 1, y - 21, 1, 1, '#22223a');
      }
      // dramatic tiny beard point
      px(ctx, fx - 1, y - 16, 2, 1, '#4a3a5a');

      // pointed hat with a star
      px(ctx, fx - 5, y - 25, 10, 2, NIGHT_MID);
      px(ctx, fx - 3, y - 28, 6, 3, NIGHT_MID);
      px(ctx, fx - 1, y - 31, 2, 3, NIGHT_MID);
      px(ctx, fx, y - 30, 1, 1, DAY_LOW);

      // THE SCARF — waved by himself (there is no wind; he supplies it)
      var seg, sx0 = fx + 3, sy0 = y - 18;
      var flip = (lastT - scarfFlipAt) >= 0 && (lastT - scarfFlipAt) < 1.1;
      var fl = flip ? (1 - (lastT - scarfFlipAt) / 1.1) : 0;
      for (seg = 0; seg < 5; seg++) {
        var sgx, sgy;
        if (scarfDroop && !flip) {
          // despair: the scarf hangs straight down, defeated
          sgx = sx0 + 1;
          sgy = sy0 + 2 + seg * 3;
        } else {
          var wave = Math.sin(t * 3 + seg * 0.9) * (1.5 * scarfPower + 0.4);
          sgx = sx0 + 3 + seg * 3;
          sgy = sy0 + Math.round(wave) - Math.round(fl * (6 + seg * 2)); // flip arcs it skyward
        }
        px(ctx, sgx, sgy, 3, 2, (seg % 2) ? SCARF : SCARF_L);
      }
      // neck wrap
      px(ctx, fx - 5, y - 17, 10, 2, SCARF);
    } catch (e) { /* never crash a draw */ }
  }

  // ---- The big brass telescope on its tripod (slow scanning swivel) ----
  function drawTelescope(ctx, t, S) {
    try {
      var pxv = 214, pyv = 108; // pivot (tripod head)

      // tripod legs
      px(ctx, 199, 146, 3, 2, WOOD_D);
      px(ctx, 229, 144, 3, 2, WOOD_D);
      ctx.save();
      ctx.strokeStyle = WOOD_D;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pxv, pyv); ctx.lineTo(200, 147); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pxv, pyv); ctx.lineTo(218, 145); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pxv, pyv); ctx.lineTo(230, 146); ctx.stroke();
      ctx.restore();

      // micro-detail 14: the bedikat-chametz wooden spoon shimming the short leg
      px(ctx, 226, 143, 8, 2, WOOD_L);
      px(ctx, 232, 142, 3, 3, PARCH_D); // spoon bowl

      // micro-detail 15: the tube slowly scans the seam (angle oscillates)
      var ang = -2.55 + Math.sin(t * 0.25) * 0.08;
      ctx.save();
      ctx.translate(pxv, pyv);
      ctx.rotate(ang);
      px(ctx, 0, -3, 40, 7, BRASS);
      px(ctx, 0, -3, 40, 2, BRASS_L);
      px(ctx, 10, -3, 2, 7, BRASS_HL);   // band
      px(ctx, 26, -3, 2, 7, BRASS_HL);   // band
      px(ctx, -5, -2, 5, 5, BRASS_L);    // eyepiece
      px(ctx, 40, -4, 2, 9, BRASS_HL);   // front rim
      // micro-detail 15b: the front lens catches the dawn once per scan peak
      if (!capOn && Math.sin(t * 0.25) > 0.92) px(ctx, 41, -1, 1, 2, '#ffffff');
      if (capOn) {
        // sight gag C1: the lens cap with painted stars, snapped ON
        px(ctx, 42, -5, 3, 11, '#33334f');
        px(ctx, 43, -3, 1, 1, DAY_LOW);
        px(ctx, 43, 0, 1, 1, DAY_LOW);
        px(ctx, 43, 3, 1, 1, DAY_LOW);
      }
      ctx.restore();

      // pivot bolt
      px(ctx, pxv - 2, pyv - 2, 4, 4, BRASS_L);
    } catch (e) { /* never crash a draw */ }
  }

  // ---- The star jar on its crate (glows; brighter after the seal) ----
  function drawStarJar(ctx, t, S) {
    try {
      // crate
      px(ctx, 244, 134, 22, 16, WOOD_L);
      px(ctx, 244, 134, 22, 2, WOOD_D);
      px(ctx, 244, 141, 22, 1, WOOD_D);
      px(ctx, 254, 134, 1, 16, WOOD_D);
      // jar
      px(ctx, 249, 118, 12, 16, '#cfe9f2');
      px(ctx, 250, 119, 10, 14, '#1a2a4a');
      px(ctx, 251, 116, 8, 2, '#9ab8c2'); // lid
      // micro-detail 16: captured starlight pulsing inside (doubled post-seal)
      var won = hasLightSeal(S);
      var a = (0.25 + 0.12 * Math.sin(t * 2.5)) * (won ? 2 : 1);
      ctx.save();
      ctx.globalAlpha = Math.min(0.85, a);
      px(ctx, 251, 121, 8, 10, SEAM_A);
      ctx.restore();
      twinkle(ctx, 254, 124, t, 1, '#ffffff');
      twinkle(ctx, 257, 128, t + 2, 1, '#ffffff');
      if (won) twinkle(ctx, 252, 127, t + 4, 2, '#ffffff');
      glow(ctx, 255, 126, won ? 8 : 5, SEAM_A, won ? 0.22 : 0.1);
      // micro-detail 17: bedikat-chametz feather resting on the crate edge
      // (vane tip lifts in the breeze, same idiom as the parchment flap)
      var fLift = Math.round(Math.max(0, Math.sin(t * 2.1)) * 1);
      px(ctx, 244, 132, 2, 1, '#9a8f70');            // quill
      px(ctx, 246, 131 - fLift, 3, 2, '#fff0f5');    // vane
      px(ctx, 247, 132 - fLift, 1, 1, PARCH_D);      // barb shadow
    } catch (e) { /* never crash a draw */ }
  }

  // =======================================================================
  // THE VERSE-DUEL — data
  // =======================================================================
  // Round shape: fire (Naftali attacks), claim micro-check (what does he CLAIM
  // the verse proves?), deflection choose (3), teaching rejection + forced
  // restatement on a wrong pick, concession line on the round win.
  var DUEL = [
    { // R1 — Genesis 44:3
      fire: '(מניף את הצעיף בתנופה אדירה) פסוק ראשון! «הַבֹּקֶר אוֹר וְהָאֲנָשִׁים שֻׁלְּחוּ»! הבוקר נקרא אוֹר — אוֹר הוא יוֹם!',
      claimQ: 'רגע, לפני שעונים. מה בדיוק נפתלי טוען שהפסוק מוכיח?',
      claimOk: 'שהפסוק קורא לבוקר "אוֹר" — ולכן אוֹר פירושו יום.',
      claimNo: 'שאחֵי יוסף התקשו לקום בבוקר.',
      claimFix: 'לא. הטענה שלו: הבוקר נקרא כאן "אוֹר". עכשיו נבדוק אם המילה בכלל שם עצם.',
      deflectOk: 'לא כתוב "הָאוֹר בֹּקֶר" — «״הַבֹּקֶר אוֹר״ כְּתִיב»: "אוֹר" כאן פועל, הבוקר הֵאִיר. «צַפְרָא נְהַר».',
      deflectW1: 'האנשים שולחו מוקדם כי הגמלים היו עמוסים — הפסוק עוסק בלוגיסטיקה, לא באוֹר.',
      deflectW2: 'הפסוק מדבר על מצרים, ופסוקים ממצרים לא נחשבים.',
      reject: 'הא! נפלת! ...רגע, למה נפלת, זה דווקא קל: אוֹר כאן זה פועל — הבוקר הֵאִיר. אם זה היה שם עצם, היה כתוב "הָאוֹר בֹּקֶר". נסה שוב, אני אעמיד פנים שלא ראיתי.',
      restQ: 'אז תגיד לי במילים שלך: מה עושה המילה "אוֹר" בפסוק הזה?',
      restOk: 'היא פועל — הבוקר הֵאִיר.',
      restNo: 'היא שם עצם — האור של הבוקר.',
      restFix: 'לא-לא. פועל. הבוקר הֵאִיר, כמו «צַפְרָא נְהַר». עכשיו שוב.',
      concede: 'נו, טוב. פועל. ובדרך הרווחנו עצה: «לְעוֹלָם יִכָּנֵס אָדָם בְּכִי טוֹב, וְיֵצֵא בְּכִי טוֹב».',
      zTag: 'תגיד את זה לתאומים בפונדק. הם תקועים באמצע ה"טוב".'
    },
    { // R2 — II Samuel 23:4
      fire: '(הנפת צעיף — מעט פחות תנופה) פסוק שני! «וּכְאוֹר בֹּקֶר יִזְרַח שָׁמֶשׁ»! אוֹר מושווה לבוקר!',
      claimQ: 'ומה הוא טוען שהפסוק הזה מוכיח?',
      claimOk: 'שאם "אוֹר" מושווה לבוקר — סימן שאוֹר הוא בוקר.',
      claimNo: 'שהשמש חייבת אישור לזרוח.',
      claimFix: 'לא. הטענה שלו: ההשוואה לבוקר מגלה ש"אוֹר" הוא בוקר. עכשיו נבדוק אם הפסוק הזה שעון — או הבטחה.',
      deflectOk: 'זו הבטחה, לא שעון: «וּכְאוֹר בֹּקֶר בָּעוֹלָם הַזֶּה, כְּעֵין זְרִיחַת שֶׁמֶשׁ לַצַּדִּיקִים לָעוֹלָם הַבָּא».',
      deflectW1: 'שמש ממילא זורחת רק ביום — הפסוק רק בא להזכיר לה את המשמרת.',
      deflectW2: 'דוד אמר את זה, ודוד היה ער בלילות — אז הפסוק בכלל על נדודי שינה.',
      reject: 'טעות! זו הבטחה לצדיקים לעולם הבא, לא לוח זמנים. אתה מנסה לקרוא שעה מתוך שירה — גם אני ניסיתי פעם לנווט לפי משל. הגעתי לבאר שבע.',
      restQ: 'במילים שלך: מה הפסוק הזה עושה?',
      restOk: 'מבטיח עתיד לצדיקים — לא מגדיר שעה.',
      restNo: 'קובע להלכה את שעת הזריחה.',
      restFix: 'לא. הבטחה. שירה. עתיד. שום מחוג. שוב.',
      concede: 'שירה, לא שעון. רשמתי לפניי. (הוא לא רושם)',
      zTag: null
    },
    { // R3 — Genesis 1:5
      fire: '(מסדר את הצעיף ביסודיות) פסוק שלישי! «וַיִּקְרָא אֱלֹהִים לָאוֹר יוֹם»! התורה בעצמה! חתום וסגור!',
      claimQ: 'מה נפתלי טוען שהפסוק מוכיח?',
      claimOk: 'שהתורה עצמה הגדירה: אוֹר שווה יום.',
      claimNo: 'שהאוֹר פשוט עמד ראשון בתור לחלוקת השמות.',
      claimFix: 'לא. הטענה: זו הגדרה מילונית מן התורה. עכשיו נבדוק אם זו הגדרה — או מינוי.',
      deflectOk: '«לַמֵּאִיר וּבָא קְרָאוֹ יוֹם» — וזה מינוי, לא מילון: «קַרְיֵיהּ רַחֲמָנָא לִנְהוֹרָא וּפַקְּדֵיהּ אַמִּצְוְתָא דִימָמָא, וְקַרְיֵיהּ רַחֲמָנָא לַחֲשׁוֹכָא וּפַקְּדֵיהּ אַמִּצְוְתָא דְלֵילָה».',
      deflectW1: 'בהמשך הפסוק כתוב לילה, והלילה תמיד גובר.',
      deflectW2: 'זה נאמר לפני מתן תורה, ולכן אינו מחייב.',
      reject: 'לא ולא! הגמרא ביארה: האור קיבל מינוי על מצוות היום, והחושך על מצוות הלילה. לכל אחד משמרת משלו. חוץ ממני — אני בשתיהן.',
      restQ: 'אז במילים שלך: מה בעצם קיבל האור בפסוק הזה?',
      restOk: 'מינוי — הופקד על מצוות היום. לא הגדרת מילון.',
      restNo: 'הגדרה — מעכשיו "אוֹר" פירושו יום בכל מקום.',
      restFix: 'מינוי, חביבי. תפקיד. משמרת. לא ערך במילון. עוד ניסיון.',
      concede: 'משמרות. כמו אצלי במצפה, רק בלי לישון ביניהן. ממשיכים!',
      zTag: null
    },
    { // R4 — Job 24:14
      fire: '(הצעיף מתנופף בעייפות ניכרת) פסוק רביעי! «לָאוֹר יָקוּם רוֹצֵחַ יִקְטׇל עָנִי וְאֶבְיוֹן וּבַלַּיְלָה יְהִי כַגַּנָּב»! הרוצח קם לָאוֹר — ביום!',
      claimQ: 'ומה הטענה כאן?',
      claimOk: 'שהרוצח קם "לָאוֹר" — כלומר אוֹר הוא שעה ביום.',
      claimNo: 'שכדאי לנעול את הדלת פעמיים.',
      claimFix: 'לא. הטענה: "לָאוֹר" מציין שעת יום. עכשיו נבדוק אם זו שעה — או רמת ודאות.',
      deflectOk: 'זו רמת ודאות, לא שעה: ברור לך כאור שבא להרוג — רוצח, וניתן להצילו בנפשו; ספק לך כלילה — דינו כגנב.',
      deflectW1: 'רוצחים פועלים רק בבוקר. עובדה ידועה.',
      deflectW2: 'איוב גר בארץ עוּץ, ופסוקים מחוּץ לארץ — כבר סיכמנו שלא נחשבים.',
      reject: 'פספסת את כל הפואנטה! זה לא שעון — זו רמת ודאות: ברור לך כאור? רוצח. מסופק כלילה? גנב. איוב מדבר על ספקות, ואתה כרגע הדגמת אחד.',
      restQ: 'במילים שלך: מה מודד הפסוק?',
      restOk: 'ודאות — ברור כאור, מסופק כלילה.',
      restNo: 'שעות — את זמני הפעילות של הרוצח.',
      restFix: 'ודאות. לא לוח משמרות של פושעים. נסה שוב.',
      concede: 'ודאות, לא שעות. הצעיף שלי הרים ידיים לפניי.',
      zTag: null
    }
  ];

  // Clincher decoys — recycled day-verses the duel already killed
  var CLINCHER_OK = 'המשנה של רבי יהודה: «בּוֹדְקִין אוֹר אַרְבָּעָה עָשָׂר, וּבְאַרְבָּעָה עָשָׂר שַׁחֲרִית, וּבִשְׁעַת הַבִּיעוּר»';
  var CLINCHER_W1 = '«הַבֹּקֶר אוֹר וְהָאֲנָשִׁים שֻׁלְּחוּ»';
  var CLINCHER_W2 = '«וּכְאוֹר בֹּקֶר יִזְרַח שָׁמֶשׁ»';
  var CLINCHER_REJECT = 'את זה כבר הפלנו מזמן! אתה מביא לי ראיה שהרגנו יחד?! תחפש משהו עם «שְׁמַע מִינַּהּ» בסוף — כשהגמרא חותמת ככה, זה פסק דין.';

  // daf hints per duel stage (flag 'obsRound': 0-3 rounds, 4 = clincher)
  var DAF_HINTS = [
    'הדף לוחש: «״הַבֹּקֶר אוֹר״ כְּתִיב» — חפש את הפועל, לא את שם העצם.',
    'הדף לוחש: הבטחה לצדיקים היא לא שעון. «...לַצַּדִּיקִים לָעוֹלָם הַבָּא».',
    'הדף לוחש: «קַרְיֵיהּ רַחֲמָנָא... וּפַקְּדֵיהּ» — מינוי על מצוות, לא הגדרת מילון.',
    'הדף לוחש: ודאי לך כאור — רוצח; ספק לך כלילה — גנב. ודאות, לא שעות.',
    'הדף לוחש: חפש רשימה שמונה "אוֹר" בנפרד מ"שחרית" — ו«שְׁמַע מִינַּהּ» חתום בסופה.'
  ];

  function buildChoices(okText, wrongs) {
    var opts = [{ text: okText, value: 'ok' }];
    var i;
    for (i = 0; i < wrongs.length; i++) opts.push({ text: wrongs[i], value: 'no' });
    return shuffled(opts);
  }

  // One graded duel round: claim micro-check, then deflection with teaching
  // rejection + forced restatement on wrong picks (retry same round).
  async function runDuelRound(g, idx) {
    var r = DUEL[idx];
    flagSafe(g, 'obsRound', idx);
    scarfFlipAt = lastT;
    scarfPower = Math.max(0.25, 1 - idx * 0.22); // the flip gets tired
    safeSfx(g, 'quiz');
    await nSay(g, r.fire);

    // pedagogy micro-check: name the claim before killing it
    var claim = await g.choose(shuffled([
      { text: r.claimOk, value: 'ok' },
      { text: r.claimNo, value: 'no' }
    ]));
    if (claim === 'ok') {
      await g.playerSay('בדיוק. תחזיק חזק בצעיף — הטענה הזאת תכף נופלת.');
    } else {
      await g.playerSay(r.claimFix);
    }

    // deflection loop — retry same round until right
    while (true) {
      await g.playerSay('התשובה של הגמרא:');
      var ans = await g.choose(buildChoices(r.deflectOk, [r.deflectW1, r.deflectW2]));
      if (ans === 'ok') break;
      safeSfx(g, 'fail');
      await nSay(g, r.reject);
      // if the player carries the daf, it whispers the round's hint before the retry
      try {
        if (typeof g.has === 'function' && g.has('daf') && DAF_HINTS[idx]) {
          await g.playerSay(DAF_HINTS[idx]);
        }
      } catch (e) { /* silent */ }
      // forced restatement before retry — loop until the rule is actually restated
      var rest = 'no';
      while (rest !== 'ok') {
        rest = await g.choose(shuffled([
          { text: r.restOk, value: 'ok' },
          { text: r.restNo, value: 'no' }
        ]));
        if (rest === 'ok') await nSay(g, 'בדיוק. ' + r.restOk + ' עכשיו תפיל אותי כמו שצריך.');
        else await nSay(g, r.restFix);
      }
    }
    safeSfx(g, 'star');
    await nSay(g, r.concede);
    if (r.zTag) await g.playerSay(r.zTag);
  }

  // Mid-duel twist (between R3 and R4): the stars-of-light verse backfires
  async function runTwist(g) {
    safeSfx(g, 'quiz');
    await nSay(g, '(שולף בניצחון) ועכשיו — מכת המחץ! «הַלְלוּהוּ כׇּל כּוֹכְבֵי אוֹר»! הַלְלוּהוּ... כל... כוכבי...');
    await nSay(g, '...אוֹר. כוכבי אוֹר. הפסוק שלי קורא לכוכבים — אוֹר.');
    var re = await g.choose([
      { text: 'תנשום, נפתלי. זה קורה גם לטובים ביותר.', value: 'a' },
      { text: 'הכוכבים שלך הרגע העידו נגדך.', value: 'b' },
      { text: 'שקט... אל תבהיל את הפסוק.', value: 'c' }
    ]);
    if (re === 'a') await nSay(g, 'אני נושם! אני פשוט נושם דרמטית! זה חלק מהתפקיד!');
    else if (re === 'b') await nSay(g, 'עדים משלי! בוגדים זוהרים שכמותכם!');
    else await nSay(g, 'צודק. פסוקים רגישים. (לוחש) הוא קרא לכוכבים אוֹר. שמעת? אוֹר.');
    safeSfx(g, 'magic');
    jarGlimmerAt = lastT;
    await g.playerSay('והגמרא חותכת: «דְּאוֹר דְּכוֹכָבִים נָמֵי אוֹר הוּא».');
    await g.playerSay('עד כדי כך: «הַנּוֹדֵר מִן הָאוֹר — אָסוּר בְּאוֹרָן שֶׁל כּוֹכָבִים». אור הכוכבים — אור גמור.');
    await nSay(g, 'אז הכוכבים שלי... הם אוֹר אמיתי? עם תעודה מהגמרא?');
    capOn = true; // sight gag: the painted-stars lens cap goes ON
    await nSay(g, '(סוגר את מכסה העדשה ומביט בו) ציירתי בפנים כוכבים. ככה לפחות יש כוכבים. שקט, זה עובד.');
    await g.playerSay('נפתלי. יש לך כוכבים אמיתיים. בוא נגמור את הדו-קרב ונחזיר לך אותם.');
  }

  // R5 + R6: Naftali fires them in despair and deflects them HIMSELF
  async function runDespair(g) {
    scarfDroop = true;
    await nSay(g, '(מרים את הצעיף... הצעיף לא מתרומם) רגע. תן לי... הצעיף כבד היום.');
    safeSfx(g, 'quiz');
    await nSay(g, 'פסוק חמישי! «יֶחְשְׁכוּ כּוֹכְבֵי נִשְׁפּוֹ יְקַו לְאוֹר וָאַיִן»! זה... זה איוב מקלל את מזלו — שיצפה האיש ההוא לאור ולא ימצא. שירה של צער, לא תצפית. הפלתי את זה בעצמי.');
    safeSfx(g, 'quiz');
    await nSay(g, 'פסוק שישי!! «וָאוֹמַר אַךְ חֹשֶׁךְ יְשׁוּפֵנִי וְלַיְלָה אוֹר בַּעֲדֵנִי»! ...וזה דוד על העולם הבא שדומה ליום, לעומת העולם הזה שדומה ללילה. תקווה, לא שעון. גם את זה הפלתי בעצמי. למה אני ככה.');
    await nSay(g, 'נגמרו לי הפסוקים. ונגמר לי הצעיף.');
    await g.playerSay('אז נשאר רק לסגור. לא בפסוק שלך — בפסק של הדף עצמו.');
  }

  // The clincher: pick proof A (Rabbi Yehuda's baraita) from the wreckage
  async function runClincher(g) {
    flagSafe(g, 'obsRound', 4);
    await nSay(g, 'תן את מכת החסד. איזו ראיה מכריעה ש"אוֹר" של המשנה הוא הערב?');
    while (true) {
      var ans = await g.choose(buildChoices(CLINCHER_OK, [CLINCHER_W1, CLINCHER_W2]));
      if (ans === 'ok') break;
      safeSfx(g, 'fail');
      await nSay(g, CLINCHER_REJECT);
      // daf hint for the clincher stage, same assist as the graded rounds
      try {
        if (typeof g.has === 'function' && g.has('daf') && DAF_HINTS[4]) {
          await g.playerSay(DAF_HINTS[4]);
        }
      } catch (e) { /* silent */ }
    }
    safeSfx(g, 'star');
    await g.playerSay('אם התנא מנה "אוֹר ארבעה עשר" בנפרד מ"ארבעה עשר שחרית" — אוֹר אינו בוקר. אוֹר הוא הערב.');
    await g.playerSay('«אַלְמָא ״אוֹר״ אוּרְתָּא הוּא. שְׁמַע מִינַּהּ.»');
    await nSay(g, 'שְׁמַע מִינַּהּ... כשהגמרא חותמת ככה — זה פסק דין. אני מודה.');
    await nSay(g, 'ואם "אוֹר" של המשנה הוא ערב — חצי הלילה של השמיים צודק. והכוכבים שלי... בטוחים.');
    capOn = false;
    scarfDroop = false;
    scarfPower = 1;
    scarfFlipAt = lastT;
    await nSay(g, '(מסיר את מכסה העדשה) לא צריך אותך יותר, שמיים מצוירים. יש לי אמיתיים.');
    starsFlareAt = lastT;
    try { g.addSeal('light', 'חותם האוֹר'); } catch (e) { /* fail silent */ }
    // mark the duel done only if the seal actually landed — otherwise the talk
    // gate keeps routing to the duel so the win requirement stays obtainable
    if (hasLightSeal(window.GAME.state)) flagSafe(g, 'obsDuelDone', true);
    await nSay(g, 'בדיקת חמץ בלילה, לאור הנר. והכוכבים — הם יבואו לצפות בך עובד.');
    await g.playerSay('כרטיסים ביציע, בבקשה. הבדיקה הזאת תהיה מלאה.');
  }

  async function runDuel(g) {
    if (duelRunning) return;
    duelRunning = true;
    try {
      await g.cutscene(async function () {
        var i;
        for (i = 0; i < DUEL.length; i++) {
          await runDuelRound(g, i);
          if (i === 2) await runTwist(g); // between R3 and R4
        }
        await runDespair(g);
        await runClincher(g);
      });
    } catch (e) {
      if (window.console && console.warn) console.warn('observatory.js duel error:', e);
    } finally {
      duelRunning = false;
    }
  }

  // =======================================================================
  // POST-SEAL TALK MENU (star census, callbacks)
  // =======================================================================
  var CENSUS = [
    'שלושה כוכבים. ספרתי. אתמול היו שניים וחצי. אנחנו מנצחים.',
    'ארבעה! לא, זה זבוב על העדשה. שלושה.',
    'שלושה, אבל אחד קורץ לי. אני סופר אותו כשלושה וחצי.',
    'שלושה. יציבים. נאמנים. לא כמו הצעיף.'
  ];

  async function postSealTalk(g) {
    var first = !flagSafe(g, 'obsPostMet');
    if (first) {
      flagSafe(g, 'obsPostMet', true);
      await nSay(g, 'חבר הכוכבים! בוא, שב. כלומר — עמוד. אין כיסאות. מכרתי אותם בשביל עדשה.');
    }
    var talking = true;
    while (talking) {
      var c = await g.choose([
        { text: 'כמה כוכבים הערב?', value: 'census' },
        { text: 'ראית משהו מעניין בטלסקופ?', value: 'twins' },
        { text: 'אולי נדליק את המנורה מצנצנת הכוכבים?', value: 'jar' },
        { text: 'להתראות, נפתלי.', value: 'bye' }
      ]);
      if (c === 'census') {
        var n = flagSafe(g, 'obsCensus') || 0;
        flagSafe(g, 'obsCensus', n + 1);
        await nSay(g, CENSUS[n % CENSUS.length]);
      } else if (c === 'twins') {
        await nSay(g, 'דרך הטלסקופ ראיתי את התאומים בפונדק מחליפים צדדים בדלת. שעה וחצי. היה מרתק יותר מליקוי חמה.');
        await g.playerSay('מדע התצפית בשיא כוחו.');
      } else if (c === 'jar') {
        await nSay(g, 'להדליק ממנה את המנורה בבית הבד? ניסיתי. היא אמרה שאור כוכבים הוא אוֹר גמור — «הַנּוֹדֵר מִן הָאוֹר — אָסוּר בְּאוֹרָן שֶׁל כּוֹכָבִים» — אבל היא נדלקת רק מתשובות. מנורה עקרונית.');
        await g.playerSay('מנורה עם תנאי קבלה. מתאים לכפר הזה.');
      } else {
        await nSay(g, 'לך לאור! כלומר — לערב! כלומר — אתה מבין אותי.');
        talking = false;
      }
    }
  }

  // Pre-duel talk: short intro, then offer the duel
  async function preDuelTalk(g) {
    var met = flagSafe(g, 'obsMet');
    if (!met) {
      flagSafe(g, 'obsMet', true);
      await nSay(g, 'עוד צופה? לא. אתה מחזיק נר. אתה מהמפלגה של הלילה.');
      await g.playerSay('אני מהמפלגה של הבדיקה. באתי בגלל השמיים.');
      await nSay(g, 'השמיים בסדר גמור! חצי מהם. החצי הנכון. אוֹר = יוֹם, כתוב בפסוקים, ולכן היום ינצח!');
      await g.playerSay('ואם היום ינצח... מתי בדיוק תראה כוכבים?');
      await nSay(g, '...לא חשבתי על זה עד הסוף. אבל יש לי פסוקים! דו-קרב פסוקים! תפיל את כולם — ואודה.');
    }
    var c = await g.choose([
      { text: 'דו-קרב פסוקים. קדימה.', value: 'duel' },
      { text: 'מי אתה בכלל?', value: 'who' },
      { text: 'עוד רגע. אני מתחמם.', value: 'later' }
    ]);
    if (c === 'who') {
      await nSay(g, 'נפתלי הצופה! שלושה דורות של אסטרונומים! סבי גילה כוכב. אבי איבד אותו. אני מחפש.');
      await g.playerSay('רגע, איך אבא שלך איבד כוכ— עזוב. בוא נדבר על הפסוקים שלך.');
      c = await g.choose([
        { text: 'דו-קרב פסוקים. עכשיו.', value: 'duel' },
        { text: 'בעצם — עוד רגע.', value: 'later' }
      ]);
    }
    if (c === 'duel') {
      await runDuel(g);
    } else {
      await nSay(g, 'תתחמם, תתחמם. הפסוקים שלי לא מתקררים אף פעם.');
    }
  }

  // =======================================================================
  // SCENE REGISTRATION
  // =======================================================================
  GAME.registerScene('observatory', {
    name: 'מִצְפֵּה הַכּוֹכָבִים שֶׁל נַפְתָּלִי',
    floor: { yMin: 128, yMax: 170 },
    paint: paint,

    onEnter: async function (g) {
      try {
        if (!flagSafe(g, 'obsVisited')) {
          flagSafe(g, 'obsVisited', true);
          await g.cutscene(async function () {
            await g.playerSay('מצפה כוכבים בצד של היום. זה או אירוניה, או תכנון עירוני גרוע במיוחד.');
            await nSay(g, 'שמעתי את זה! התכנון היה מצוין! השמיים זזו!');
          });
        }
      } catch (e) {
        if (window.console && console.warn) console.warn('observatory.js onEnter error:', e);
      }
    },

    hotspots: [
      // ------------------------------------------------ sky hotspots (background)
      {
        id: 'seamSky', name: 'הַתֶּפֶר בַּשָּׁמַיִם', type: 'object',
        x: 78, y: 0, w: 20, h: 80,
        look: function (g) {
          var n = 0;
          try { n = sealCount(window.GAME.state); } catch (e) { n = 0; }
          if (n >= 3) return g.playerSay('התפר כמעט נעלם. עוד דחיפה אחת — והשמיים יחזרו להיות שמיכה אחת.');
          if (n > 0) return g.playerSay('התפר בשמיים. מקרוב הוא דק יותר משהיה. כל חותם תופר עוד קצת.');
          return g.playerSay('קרע זוהר לכל גובה השמיים. חצי לילה, חצי בוקר, ובאמצע — פסים מנצנצים של "לא סגור על עצמי".');
        },
        take: function (g) { return g.playerSay('לתפוס את התפר? אני לומד גמרא, לא תופר שמיים. עדיין.'); },
        use: function (g, item) {
          if (item === 'daf') return g.playerSay('הדף אומר: התפר ייסגר כשנדע מה זה אוֹר. הדף די בטוח בעצמו.');
          return g.playerSay('אין לי סולם כזה גבוה. גם לנפתלי אין, ותאמין לי שהוא בדק.');
        }
      },
      {
        id: 'stubbornstars', name: 'כּוֹכָבִים עַקְשָׁנִים', type: 'object',
        x: 196, y: 6, w: 70, h: 36,
        look: function (g) {
          if (hasLightSeal(window.GAME.state)) return g.playerSay('הם זוהרים כאילו ניצחו. כי ניצחו.');
          return g.playerSay('שלושה כוכבים עקשנים בצד של היום. לא הולכים הביתה. הם כמו נפתלי, רק בלי צעיף.');
        },
        take: function (g) { return g.playerSay('לקטוף כוכבים? יש כבר צנצנת. ואני לא שואל איך.'); },
        use: function (g, item) {
          if (item === 'daf') return g.playerSay('«הַלְלוּהוּ כׇּל כּוֹכְבֵי אוֹר» — הדף קורא להם אוֹר. הם מהנהנים.');
          return g.playerSay('הם רחוקים מדי. גם בשביל כוונות טובות.');
        }
      },

      // ------------------------------------------------ mid props
      {
        id: 'astrolabe', name: 'הָאִצְטְרוֹלָב', type: 'object',
        x: 92, y: 90, w: 22, h: 44, walkTo: { x: 106, y: 148 },
        look: function (g) {
          return g.playerSay('האצטרולב מסתובב לאט. גלגל השמש וגלגל הירח נתקעו באותו חריץ ודוחפים זה את זה. היחיד בכפר שמייצג את המצב בדיוק.');
        },
        take: function (g) { return g.playerSay('הוא מסתובב. אני מסתובב. אין במערכת הזאת מקום לשנינו בכיס אחד.'); },
        use: function (g, item) {
          if (item === 'daf') return g.playerSay('הדף והאצטרולב מסכימים: השאלה היא לא איפה השמש. השאלה מה זה אוֹר.');
          return g.playerSay('אם אזיז גלגל אחד, נפתלי ירגיש את זה מהעצמות. עדיף לא.');
        }
      },
      {
        id: 'windchimes', name: 'פַּעֲמוֹנֵי הָרוּחַ', type: 'object',
        x: 250, y: 38, w: 20, h: 30, walkTo: { x: 252, y: 152 },
        look: function (g) {
          return g.playerSay('פעמוני רוח מזכוכית עדשות. כשהרוח נושבת הם מצלצלים משהו שנשמע חשוד כמו «מַאי?»');
        },
        talk: async function (g) {
          safeSfx(g, 'click');
          await g.say('«מַאי?»', { x: 260, y: 48, color: '#aef6ff' });
          await g.playerSay('גם הפעמונים בסוגיה. כולם בסוגיה.');
        },
        take: function (g) { return g.playerSay('הם מכוילים לרוח של נפתלי. אצלי הם רק ישאלו שאלות.'); },
        use: function (g) { return g.playerSay('לצלצל בעצמי? זה כמו לענות לעצמך "מַאי". חסר טעם ומהדהד.'); }
      },
      {
        id: 'charts', name: 'מַפַּת כּוֹכָבִים', type: 'object',
        x: 270, y: 60, w: 32, h: 32, walkTo: { x: 282, y: 152 },
        look: async function (g) {
          await g.playerSay('מפות שמיים. ליד קבוצת "עירובין" מישהו כתב בעיפרון: "לא הבנתי. יפה, אבל לא הבנתי."');
          if (hasLightSeal(window.GAME.state)) {
            await g.playerSay('רגע — לקבוצת "ביצה" נוספו שני כוכבים. והם... מצמצו עכשיו?');
          } else {
            await g.playerSay('ויש שם קבוצה בצורת חתולה בתנוחת כיכר. "ביצה", כתוב. כמובן.');
          }
        },
        take: function (g) { return g.playerSay('לגלגל את כל שמי הלילה לתיק? אין לי ביטוח לדבר כזה.'); },
        use: async function (g, item) {
          if (item === 'daf') return g.playerSay('דף על מפה. מפה על דף. נפתלי היה מתרגש עד דמעות.');
          await nSay(g, 'אל תיגע! זה מסודר לפי סדר מסכתות. כלומר, היה מסודר. פעם.');
        }
      },
      {
        id: 'spoonshim', name: 'כַּף הָעֵץ', type: 'object',
        x: 224, y: 139, w: 12, h: 9, walkTo: { x: 222, y: 154 },
        look: function (g) {
          return g.playerSay('כף עץ של בדיקת חמץ מחזיקה את רגל החצובה. כף עץ אחת מחזיקה את המדע כולו. אל תזיז.');
        },
        take: async function (g) {
          await nSay(g, 'אל!!! הכף הזאת מכוילת! זזה שערה — והירח קופץ לי שתי מעלות!');
          await g.playerSay('כף מכוילת. שמעתי הכול בחיים. עכשיו באמת הכול.');
        },
        use: function (g, item) {
          if (item === 'daf') return g.playerSay('כף של בדיקה מתחת לטלסקופ של אוֹר. הדף היה קורא לזה סימבוליזם.');
          return g.playerSay('היא בתפקיד. לא מפריעים לכף בתפקיד.');
        }
      },

      // ------------------------------------------------ star jar (draws crate+jar)
      {
        id: 'starjar', name: 'צִנְצֶנֶת הַכּוֹכָבִים', type: 'object',
        x: 244, y: 112, w: 24, h: 38, walkTo: { x: 240, y: 154 },
        draw: function (ctx, t, S) { drawStarJar(ctx, t, S); },
        look: async function (g) {
          if (hasLightSeal(window.GAME.state)) {
            await g.playerSay('הצנצנת זוהרת פי שניים. «דְּאוֹר דְּכוֹכָבִים נָמֵי אוֹר הוּא» — אור אמיתי, עם תעודה מהגמרא.');
            return;
          }
          await g.playerSay('צנצנת של אור כוכבים. זוהרת בעדינות על הארגז.');
          await nSay(g, '(לוחש) זה לא גניבה. הם הסכימו. שאלתי.');
        },
        take: async function (g) {
          await nSay(g, 'הם הסכימו להישאר אצלי. אצלך הם לא הסכימו. זה חוזה אישי.');
          await g.playerSay('כוכבים עם עורך דין. בסדר גמור.');
        },
        use: function (g, item) {
          if (item === 'daf') return g.playerSay('«הַנּוֹדֵר מִן הָאוֹר — אָסוּר בְּאוֹרָן שֶׁל כּוֹכָבִים». הצנצנת הזאת היא אוֹר לכל דבר.');
          if (item === 'nerlit') return g.playerSay('להדליק כוכבים מנר? הם הגיעו מהכיוון ההפוך. יש להם גאווה.');
          return g.playerSay('היא סגורה. וכנראה גם ממודרת ביטחונית.');
        }
      },

      // ------------------------------------------------ the telescope (draws itself)
      {
        id: 'telescope', name: 'הַטֵּלֶסְקוֹפ', type: 'object',
        x: 186, y: 84, w: 54, h: 64, walkTo: { x: 176, y: 152 },
        draw: function (ctx, t, S) { drawTelescope(ctx, t, S); },
        look: async function (g) {
          var n = flagSafe(g, 'obsScopeLook') || 0;
          flagSafe(g, 'obsScopeLook', n + 1);
          if (n === 0) {
            await g.playerSay('מציץ בעדשה... התפר מקרוב נראה כמו... פיקסלים? לא. לא יכול להיות. אני במשחק?!');
            await nSay(g, 'רד מזה. עכשיו. יש דברים שצופה לא צופה בהם.');
          } else {
            await nSay(g, 'מספיק! אמרנו שלא מדברים על הפיקסלים. תסתכל על השמיים כמו בן אדם נורמלי.');
          }
        },
        talk: async function (g) {
          // the village echo gag, new vessel: speak into the wrong end
          await g.playerSay('(מדבר אל הקצה הלא נכון) ...שלום?');
          safeSfx(g, 'click');
          await g.say('«מַאי?»', { x: 214, y: 92, color: '#aef6ff' });
          await g.playerSay('הקול שלי חזר אליי בארמית. כל דבר בכפר הזה לומד גמרא.');
        },
        take: async function (g) {
          // easter egg 6: Naftali flings his scarf
          scarfFlipAt = lastT;
          safeSfx(g, 'fail');
          await nSay(g, 'לגעת?! זה מכשיר מדעי!! שלושה דורות של צופים בכו לתוכו!');
          await g.playerSay('בסדר, בסדר. רק רציתי לראות אם הפיקסלים אמיתיים.');
          flagSafe(g, 'egg_telescope', true);
          await g.playerSay('חוץ מזה — לגנוב טלסקופ באור יום? כלומר... בחצי אור יום? עזוב, הנקודה ברורה.');
        },
        use: async function (g, item) {
          if (item === 'pita') {
            // easter egg 7: astronomical examination of the pita
            safeSfx(g, 'magic');
            await nSay(g, '(בוחן בעדשה) מרתק... מכתשים, קרום עתיק, אין סימני חיים. הפיתה הזאת קדומה מכמה כוכבים שאני מכיר.');
            await g.playerSay('והיא עוד תבער מחר. שיא כוכבי.');
            flagSafe(g, 'egg_pitaScope', true);
            return;
          }
          if (item === 'daf') {
            var r = flagSafe(g, 'obsRound');
            if (flagSafe(g, 'obsDuelDone')) return g.playerSay('הדף שקט. הדו-קרב הוכרע, הטלסקופ חופשי לצפות בכוכבים.');
            if (typeof r === 'number' && DAF_HINTS[r]) return g.playerSay(DAF_HINTS[r]);
            return g.playerSay('הדף מציע: קודם תתחיל את הדו-קרב עם נפתלי. אחר כך נכוון.');
          }
          if (item === 'nerlit') return g.playerSay('אש ליד עדשה? נפתלי כבר איבד ככה גבה. לא חוזרים על ניסויים מוצלחים.');
          return g.playerSay('הוא מכוון בדיוק אל התפר. נפתלי כיוון שלושה ימים. לא נוגעים.');
        }
      },

      // ------------------------------------------------ Naftali (the duel)
      {
        id: 'naftali', name: 'נַפְתָּלִי הַצּוֹפֶה', type: 'char',
        x: 142, y: 104, w: 24, h: 40, walkTo: { x: 128, y: 148 },
        draw: function (ctx, t, S) { drawNaftali(ctx, t, S); },
        look: function (g) {
          if (flagSafe(g, 'obsDuelDone')) return g.playerSay('הצעיף נח. הכוכבים בטוחים. נפתלי מרוצה — עד הערעור הבא.');
          return g.playerSay('דמות עם צעיף שמתנופף. אין רוח. הוא מנופף אותו בעצמו.');
        },
        talk: async function (g) {
          try {
            if (flagSafe(g, 'obsDuelDone') || hasLightSeal(window.GAME.state)) {
              await postSealTalk(g);
            } else {
              await preDuelTalk(g);
            }
          } catch (e) {
            if (window.console && console.warn) console.warn('observatory.js talk error:', e);
          }
        },
        take: async function (g) {
          await nSay(g, 'לקחת אותי?! אני לא נייד! אני מוסד!');
          await g.playerSay('מוסד עם צעיף. סליחה ששאלתי.');
        },
        use: async function (g, item) {
          if (item === 'daf') {
            var r = flagSafe(g, 'obsRound');
            if (flagSafe(g, 'obsDuelDone')) return g.playerSay('הדף מרוצה. «שְׁמַע מִינַּהּ» — ונפתלי שמע.');
            if (typeof r === 'number' && DAF_HINTS[r]) return g.playerSay(DAF_HINTS[r]);
            return g.playerSay('הדף אומר: תן לו לירות את הפסוק הראשון. אחר כך נדבר.');
          }
          if (item === 'pita') {
            await nSay(g, 'חמץ במצפה?! יש לי כללים. שום דבר לא נכנס לעדשה חוץ מאוֹר.');
            return;
          }
          if (item === 'ner' || item === 'nerlit') {
            await nSay(g, 'נר? חמוד — לחמץ. «לְאוֹר הַנֵּר» זה למרתף. אני עובד בקנה מידה קוסמי, תודה.');
            return;
          }
          return g.playerSay('להשתמש בנפתלי? הוא לא מכשיר. למרות שהוא בהחלט מכויל רגשית.');
        }
      },

      // ------------------------------------------------ exit
      {
        id: 'exitInn', name: 'אֶל הַפּוּנְדָּק', type: 'exit',
        x: 0, y: 118, w: 26, h: 56,
        target: 'inn', spawn: { x: 280, y: 150 }, walkTo: { x: 14, y: 152 },
        look: function (g) {
          return g.playerSay('השביל חזרה אל הפונדק. בירידה הכול נשמע רעיון טוב יותר.');
        }
      }
    ]
  });
})();
