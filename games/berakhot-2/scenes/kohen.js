'use strict';
/*
 * Scene: kohen — "בית הכהן פנחס" (House of Pinchas the Kohen)
 * DAF QUEST — Berakhot 2a. Teaches: kohanim eat terumah at tzeit hakochavim;
 * tevila + he'erev shemesh ("ביאת שמשו מעכבתו ואין כפרתו מעכבתו").
 * Cozy stone interior: steaming mikveh corner, glowing covered terumah,
 * broken grandfather clock, fireplace. Owns ONLY this file.
 */
(function () {

  if (!window.GAME || typeof window.GAME.registerScene !== 'function') {
    if (window.console && console.warn) console.warn('kohen.js: GAME.registerScene missing, scene not registered');
    return;
  }

  /* ------------------------------------------------------------------ */
  /* Small safe drawing helpers (fallbacks if SPRITES helpers missing)  */
  /* ------------------------------------------------------------------ */

  function px(ctx, x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  }

  function dither(ctx, x, y, w, h, c1, c2) {
    var SP = window.SPRITES;
    if (SP && typeof SP.dither === 'function') { SP.dither(ctx, x, y, w, h, c1, c2); return; }
    px(ctx, x, y, w, h, c1);
    ctx.fillStyle = c2;
    for (var yy = 0; yy < h; yy++) {
      for (var xx = (yy % 2); xx < w; xx += 2) ctx.fillRect(x + xx, y + yy, 1, 1);
    }
  }

  function glow(ctx, x, y, r, color, alpha) {
    var SP = window.SPRITES;
    if (SP && typeof SP.glow === 'function') { SP.glow(ctx, x, y, r, color, alpha); return; }
    var steps = 4;
    for (var i = steps; i > 0; i--) {
      var rr = r * i / steps;
      ctx.globalAlpha = alpha * (1 - i / (steps + 1));
      px(ctx, x - rr, y - rr / 2, rr * 2, rr, color);
    }
    ctx.globalAlpha = 1;
  }

  function twinkle(ctx, x, y, t, size, color) {
    var SP = window.SPRITES;
    if (SP && typeof SP.star === 'function') { SP.star(ctx, x, y, t, size, color); return; }
    var a = 0.5 + 0.5 * Math.sin(t * 3 + x * 7 + y * 3);
    ctx.globalAlpha = 0.4 + 0.6 * a;
    px(ctx, x, y, 1, 1, color || '#ffffff');
    if (a > 0.7 && size > 1) {
      px(ctx, x - 1, y, 1, 1, color || '#ffffff');
      px(ctx, x + 1, y, 1, 1, color || '#ffffff');
    }
    ctx.globalAlpha = 1;
  }

  // Normalizes map rows to equal width so a typo can never crash a frame.
  function drawMap(ctx, map, pal, x, y, scale, flip) {
    var SP = window.SPRITES;
    if (SP && typeof SP.draw === 'function') { SP.draw(ctx, map, pal, x, y, scale, flip); return; }
    var w = 0, i;
    for (i = 0; i < map.length; i++) if (map[i].length > w) w = map[i].length;
    for (var ry = 0; ry < map.length; ry++) {
      var row = map[ry];
      for (var rx = 0; rx < row.length; rx++) {
        var ch = row.charAt(rx);
        if (ch === '.' || ch === ' ') continue;
        var c = pal[ch];
        if (!c) continue;
        var dx = flip ? (w - 1 - rx) : rx;
        ctx.fillStyle = c;
        ctx.fillRect(x + dx * scale, y + ry * scale, scale + 0.35, scale + 0.35);
      }
    }
  }

  function flagOf(S, name) {
    return (S && S.flags) ? S.flags[name] : undefined;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /* ------------------------------------------------------------------ */
  /* Kohen Pinchas sprite (15x23 map, feet-anchored when drawn)         */
  /* ------------------------------------------------------------------ */

  var KOHEN_MAP = [
    '....WWWWWWW....',
    '...WWWWWWWWW...',
    '...WwwwwwwwW...',
    '....FFFFFFF....',
    '....FeFFFeF....',
    '....FFFnFFF....',
    '...FBBBBBBBF...',
    '....BBBBBBB....',
    '.....BBBBB.....',
    '....RRRRRRR....',
    '...RRRRRRRRR...',
    '..RRRRRRRRRRR..',
    '..RRGGGGGGGRR..',
    '.HRrRRRRRRRrRH.',
    '..RrRRRRRRRrR..',
    '..RRRRRRRRRRR..',
    '..RRRRRRRRRRR..',
    '..RrRRRRRRRRr..',
    '..RRRRRRRRRRR..',
    '...RRRRRRRRR...',
    '...GGGGGGGGG...',
    '...SS.....SS...',
    '...SS.....SS...'
  ];

  // Blink variant: pupils replaced by a closed-lid color key.
  var KOHEN_MAP_BLINK = (function () {
    var out = [];
    for (var i = 0; i < KOHEN_MAP.length; i++) out.push(KOHEN_MAP[i].replace(/e/g, 'z'));
    return out;
  })();

  var KOHEN_PAL = {
    W: '#f2f2f8', // mitznefet (turban) light
    w: '#c9c9dc', // turban shade
    F: '#e8b88a', // skin
    e: '#2a1a0a', // pupil
    z: '#b5895f', // closed eyelid
    n: '#cf9a68', // nose
    B: '#8a6a4a', // beard
    R: '#efe7d0', // priestly robe cream
    r: '#d4c9a8', // robe shade fold
    G: '#d4a017', // gold sash / hem
    H: '#e8b88a', // hands
    S: '#5a3a24'  // shoes
  };

  var KOHEN_W = 15, KOHEN_H = 23;

  // Returns current kohen anchor {x, y(feet), flip} — pacing when hungry.
  function kohenPos(t, S) {
    if (flagOf(S, 'kohen_fed')) {
      return { x: 193, y: 140, flip: true }; // stands happily by the table
    }
    var ph = Math.sin(t * 0.55);
    return {
      x: 150 + ph * 26,
      y: 142,
      flip: Math.cos(t * 0.55) < 0
    };
  }

  function drawKohen(ctx, t, S) {
    var p = kohenPos(t, S);
    var fed = !!flagOf(S, 'kohen_fed');
    // Match engine's player scale curve (floor 122..170), adult a bit taller.
    var pScale = 0.6 + 0.4 * (p.y - 122) / 48;
    var scale = pScale * 1.35;
    var bob = fed ? Math.sin(t * 2) * 0.8 : Math.abs(Math.sin(t * 4.2)) * 1.6;
    var blink = (t % 3.7) < 0.13;
    var map = blink ? KOHEN_MAP_BLINK : KOHEN_MAP;

    // Soft shadow under feet
    ctx.globalAlpha = 0.22;
    px(ctx, p.x - 8 * scale, p.y - 1, 16 * scale, 3, '#141428');
    ctx.globalAlpha = 1;

    var topX = p.x - (KOHEN_W * scale) / 2;
    var topY = p.y - KOHEN_H * scale - bob;
    drawMap(ctx, map, KOHEN_PAL, topX, topY, scale, p.flip);

    if (fed) {
      // A blissful half-eaten challah in his hand + tiny falling crumb.
      var hx = p.x + (p.flip ? -9 : 7) * scale;
      var hy = topY + 13 * scale;
      px(ctx, hx, hy, 4, 3, '#ffb347');
      px(ctx, hx + 1, hy - 1, 2, 1, '#ffd166');
      var crumbPh = (t * 1.4) % 1;
      ctx.globalAlpha = 1 - crumbPh;
      px(ctx, hx + 1, hy + 3 + crumbPh * 6, 1, 1, '#ffd166');
      ctx.globalAlpha = 1;
    } else {
      // Hungry wobble: wringing hands hint — tiny motion lines near belly.
      if (Math.sin(t * 4.2) > 0.6) {
        ctx.globalAlpha = 0.5;
        px(ctx, p.x - 2, topY + 15 * scale, 1, 1, '#ffffff');
        px(ctx, p.x + 2, topY + 16 * scale, 1, 1, '#ffffff');
        ctx.globalAlpha = 1;
      }
    }

    // Confetti burst during the eating cutscene (drawn above the kohen).
    var until = flagOf(S, 'kohen_confetti_until');
    if (until && Date.now() < until) drawConfetti(ctx, t, until);
  }

  /* ------------------------------------------------------------------ */
  /* Confetti (deterministic pseudo-random pixel rain)                  */
  /* ------------------------------------------------------------------ */

  var CONFETTI_COLORS = ['#e63946', '#ffd166', '#a26bd4', '#1f7a8c', '#ffffff'];

  function drawConfetti(ctx, t, until) {
    var remain = (until - Date.now()) / 1000;
    var elapsed = Math.max(0, 4.5 - remain);
    var fade = Math.max(0, Math.min(1, remain / 1.2));
    for (var i = 0; i < 52; i++) {
      var sx = 30 + ((i * 53) % 260);
      var speed = 26 + (i % 5) * 9;
      var y = 34 + ((elapsed * speed + i * 17) % 116);
      var x = sx + Math.sin(t * 3 + i * 1.3) * 4;
      ctx.globalAlpha = fade * (0.65 + 0.35 * Math.sin(t * 8 + i));
      px(ctx, x, y, 2, 2, CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
    }
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------ */
  /* Background painters                                                */
  /* ------------------------------------------------------------------ */

  function paintWalls(ctx, t) {
    // Plaster wall
    px(ctx, 0, 0, 320, 110, '#5c5c7a');
    // Stone block joints
    ctx.fillStyle = '#4a4a68';
    for (var row = 0; row < 6; row++) {
      var y = 16 + row * 16;
      ctx.fillRect(0, y, 320, 1);
      for (var bx = (row % 2) * 16; bx < 320; bx += 32) ctx.fillRect(bx, y - 16, 1, 16);
    }
    // Subtle top highlight band
    dither(ctx, 0, 12, 320, 4, '#5c5c7a', '#6b6b8f');
    // Ceiling wood beams
    px(ctx, 0, 0, 320, 12, '#4a2f1c');
    px(ctx, 0, 10, 320, 2, '#3a2414');
    ctx.fillStyle = '#5a3a24';
    for (var b = 8; b < 320; b += 44) ctx.fillRect(b, 0, 10, 12);
    // Warm ambient washes near the fire and table candle
    ctx.globalAlpha = 0.08 + 0.02 * Math.sin(t * 6);
    px(ctx, 186, 40, 84, 70, '#ffb347');
    ctx.globalAlpha = 0.06;
    px(ctx, 126, 60, 60, 50, '#ffd166');
    ctx.globalAlpha = 1;
  }

  function paintFloor(ctx, t, S) {
    // Wooden plank floor with slight perspective rows
    px(ctx, 0, 110, 320, 70, '#5a3a24');
    ctx.fillStyle = '#4a2f1c';
    var y = 110, h = 5;
    while (y < 180) {
      ctx.fillRect(0, y, 320, 1);
      y += h;
      h += 1;
    }
    ctx.fillStyle = '#7a512f';
    ctx.fillRect(0, 111, 320, 1);
    // Plank seams
    ctx.fillStyle = '#4a2f1c';
    for (var i = 0; i < 8; i++) ctx.fillRect(18 + i * 40, 116, 1, 60);
    // Baseboard
    px(ctx, 0, 108, 320, 3, '#3a2414');

    // Rug (red with gold border + diamond pattern)
    px(ctx, 122, 132, 88, 34, '#a22832');
    px(ctx, 124, 134, 84, 30, '#e63946');
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(126, 136, 80, 1);
    ctx.fillRect(126, 161, 80, 1);
    for (var d = 0; d < 4; d++) {
      var dx = 138 + d * 20;
      ctx.fillRect(dx, 147, 2, 2);
      ctx.fillRect(dx - 3, 148, 1, 1);
      ctx.fillRect(dx + 4, 148, 1, 1);
    }

    // Firelight pool on the floor in front of the hearth
    ctx.globalAlpha = 0.10 + 0.04 * Math.sin(t * 7.3);
    px(ctx, 196, 112, 56, 26, '#ff8c42');
    ctx.globalAlpha = 1;

    // Cold moonlight spilling in from the doorway
    ctx.globalAlpha = 0.12;
    px(ctx, 286, 112, 34, 22, '#232366');
    ctx.globalAlpha = 1;

    // Happy crumbs after the feast
    if (flagOf(S, 'kohen_fed')) {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(184, 136, 1, 1);
      ctx.fillRect(190, 140, 1, 1);
      ctx.fillRect(179, 142, 1, 1);
      ctx.fillRect(196, 134, 1, 1);
    }
  }

  function paintWindow(ctx, t) {
    // Arched window: cold night vs warm room — the signature contrast
    px(ctx, 78, 30, 32, 36, '#3a2414');           // frame
    px(ctx, 80, 32, 28, 32, '#0a0a23');           // night
    dither(ctx, 80, 32, 28, 10, '#0a0a23', '#141440');
    dither(ctx, 80, 52, 28, 12, '#0a0a23', '#141440');
    // arch top hint
    px(ctx, 80, 32, 4, 2, '#3a2414');
    px(ctx, 104, 32, 4, 2, '#3a2414');
    twinkle(ctx, 86, 38, t, 1, '#ffffff');
    twinkle(ctx, 98, 44, t + 1.7, 2, '#ffffff');
    twinkle(ctx, 92, 56, t + 0.6, 1, '#e8d8a8');
    // Sliver of crescent moon at the window edge
    px(ctx, 103, 36, 3, 6, '#e8d8a8');
    px(ctx, 102, 37, 1, 4, '#e8d8a8');
    // Cross bar
    px(ctx, 93, 32, 2, 32, '#3a2414');
    px(ctx, 80, 46, 28, 2, '#3a2414');
    // Warm little curtains
    px(ctx, 78, 30, 4, 26, '#a22832');
    px(ctx, 106, 30, 4, 26, '#a22832');
  }

  function paintMikveh(ctx, t, S) {
    // Raised stone mikveh in the back-left corner
    px(ctx, 6, 78, 62, 36, '#4a4a68');            // outer stone
    px(ctx, 8, 80, 58, 32, '#6b6b8f');
    px(ctx, 8, 80, 58, 3, '#8f8fb0');             // rim highlight
    // Water
    px(ctx, 12, 86, 50, 24, '#155e70');
    px(ctx, 12, 86, 50, 4, '#1f7a8c');
    // Animated ripple lines
    ctx.fillStyle = '#7fd0e0';
    for (var i = 0; i < 3; i++) {
      var wy = 92 + i * 6;
      var off = Math.sin(t * 1.6 + i * 2.1) * 4;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(18 + off + i * 6, wy, 12, 1);
      ctx.globalAlpha = 1;
    }
    // Toe-dip splash rings
    var splashUntil = flagOf(S, 'mikveh_splash_until');
    if (splashUntil && Date.now() < splashUntil) {
      var ph = 1 - (splashUntil - Date.now()) / 1600;
      var r = 2 + ph * 8;
      ctx.globalAlpha = 1 - ph;
      ctx.fillStyle = '#e8f0f8';
      ctx.fillRect(56 - r, 102, r * 2, 1);
      ctx.fillRect(56 - r / 2, 100, r, 1);
      ctx.globalAlpha = 1;
    }
    // Steps down into it
    px(ctx, 58, 108, 10, 4, '#8f8fb0');
    px(ctx, 60, 112, 8, 3, '#6b6b8f');
    // STEAM — it is heated (badly, per the jokes) so it steams into cold air
    for (var s = 0; s < 3; s++) {
      var sph = (t * 0.35 + s * 0.33) % 1;
      var sy = 82 - sph * 26;
      var sx = 18 + s * 15 + Math.sin(t * 1.5 + s * 2 + sph * 4) * 3;
      ctx.globalAlpha = 0.32 * (1 - sph);
      px(ctx, sx, sy, 3, 2, '#cfd8e8');
      px(ctx, sx + 1, sy - 3, 2, 2, '#e8f0f8');
      ctx.globalAlpha = 1;
    }
    // Towel on a wall hook + water jug (micro-details)
    px(ctx, 70, 66, 2, 2, '#3a2414');
    px(ctx, 68, 68, 6, 12, '#e8d8a8');
    px(ctx, 68, 72, 6, 1, '#c9b98a');
    px(ctx, 70, 112, 7, 9, '#7a512f');
    px(ctx, 71, 110, 5, 3, '#5a3a24');
    px(ctx, 76, 114, 2, 4, '#5a3a24');
  }

  function paintTableAndTerumah(ctx, t, S) {
    var fed = !!flagOf(S, 'kohen_fed');
    // Table
    px(ctx, 124, 100, 68, 7, '#7a512f');
    px(ctx, 124, 100, 68, 2, '#8a6238');
    px(ctx, 128, 107, 5, 20, '#5a3a24');
    px(ctx, 183, 107, 5, 20, '#5a3a24');
    // Embroidered runner
    px(ctx, 138, 99, 40, 3, '#e8d8a8');
    ctx.fillStyle = '#a26bd4';
    ctx.fillRect(140, 100, 2, 1);
    ctx.fillRect(172, 100, 2, 1);

    // Candle on the table (right side)
    var SP = window.SPRITES;
    if (SP && typeof SP.candle === 'function') {
      SP.candle(ctx, 182, 100, t, 1);
    } else {
      px(ctx, 181, 92, 3, 8, '#e8d8a8');
      var fl = Math.sin(t * 9) * 1.2;
      px(ctx, 181.5 + fl * 0.4, 88, 2, 4, '#ffb347');
      px(ctx, 182 + fl * 0.4, 89, 1, 2, '#ffd166');
      glow(ctx, 182, 90, 7, '#ffd166', 0.12 + 0.04 * Math.sin(t * 9));
    }

    if (!fed) {
      // THE TERUMAH: glowing braided challah under a glass dome
      var pulse = 0.16 + 0.07 * Math.sin(t * 2.1);
      glow(ctx, 156, 92, 20, '#ffd166', pulse);
      // Challah (braided)
      px(ctx, 146, 91, 22, 8, '#ffb347');
      px(ctx, 148, 89, 18, 3, '#ffd166');
      ctx.fillStyle = '#ff8c42';
      for (var i = 0; i < 5; i++) ctx.fillRect(149 + i * 4, 92, 1, 5);
      // Sparkle motes rising off it
      for (var m = 0; m < 3; m++) {
        var mph = (t * 0.5 + m * 0.37) % 1;
        ctx.globalAlpha = (1 - mph) * 0.8;
        px(ctx, 150 + m * 6 + Math.sin(t * 2 + m) * 2, 88 - mph * 10, 1, 1, '#ffd166');
        ctx.globalAlpha = 1;
      }
      // Glass dome (translucent)
      ctx.globalAlpha = 0.22;
      px(ctx, 142, 82, 30, 18, '#cfe8ff');
      px(ctx, 144, 79, 26, 3, '#cfe8ff');
      px(ctx, 148, 77, 18, 2, '#cfe8ff');
      ctx.globalAlpha = 0.55;
      px(ctx, 145, 81, 2, 6, '#ffffff'); // shine
      ctx.globalAlpha = 1;
      px(ctx, 155, 75, 4, 2, '#8f8fb0'); // knob
    } else {
      // Dome set aside, blissful crumbs remain
      ctx.globalAlpha = 0.2;
      px(ctx, 126, 88, 12, 12, '#cfe8ff');
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(150, 97, 4, 2);
      ctx.fillRect(158, 98, 3, 1);
      ctx.fillRect(166, 96, 2, 2);
    }
  }

  function paintFireplace(ctx, t) {
    // Chimney breast
    px(ctx, 198, 12, 52, 98, '#4a4a68');
    px(ctx, 200, 14, 48, 96, '#565672');
    // Mantel
    px(ctx, 196, 68, 56, 4, '#5a3a24');
    px(ctx, 196, 68, 56, 1, '#7a512f');
    // Hearth opening (arched)
    px(ctx, 206, 74, 36, 36, '#141428');
    px(ctx, 208, 72, 32, 4, '#141428');
    // Stone trim
    px(ctx, 204, 74, 2, 36, '#8f8fb0');
    px(ctx, 242, 74, 2, 36, '#8f8fb0');
    // Logs
    px(ctx, 212, 102, 24, 3, '#5a3a24');
    px(ctx, 216, 99, 16, 3, '#4a2f1c');
    // FIRE — layered flickering tongues
    for (var i = 0; i < 5; i++) {
      var fx = 213 + i * 5;
      var fh = 9 + Math.sin(t * 7 + i * 1.7) * 3 + (i % 2) * 2;
      px(ctx, fx, 101 - fh, 4, fh, '#ff8c42');
      px(ctx, fx + 1, 101 - fh * 0.65, 2, fh * 0.65, '#ffb347');
      if ((i % 2) === 0) px(ctx, fx + 1, 101 - fh * 0.35, 1, fh * 0.35, '#ffd166');
    }
    glow(ctx, 224, 92, 16, '#ff8c42', 0.14 + 0.05 * Math.sin(t * 7.3));
    // Rising embers
    for (var e = 0; e < 3; e++) {
      var eph = (t * 0.8 + e * 0.33) % 1;
      ctx.globalAlpha = 1 - eph;
      px(ctx, 218 + e * 6 + Math.sin(t * 3 + e * 2) * 2, 96 - eph * 18, 1, 1, '#ffd166');
      ctx.globalAlpha = 1;
    }
    // Smoke wisp drifting along the ceiling
    for (var s = 0; s < 3; s++) {
      var sph = (t * 0.22 + s * 0.31) % 1;
      ctx.globalAlpha = 0.22 * (1 - sph);
      px(ctx, 220 + Math.sin(t + s * 2) * 3 + sph * 10, 20 - sph * 8 + s * 3, 4, 2, '#8f8fb0');
      ctx.globalAlpha = 1;
    }
    // Kettle hanging over the fire (he tried to warm the mikveh with it)
    px(ctx, 222, 74, 1, 8, '#232336');
    px(ctx, 218, 82, 9, 6, '#3a3a52');
    px(ctx, 226, 83, 3, 2, '#3a3a52');
  }

  function paintClock(ctx, t) {
    // Grandfather clock, dignified and completely broken
    px(ctx, 252, 30, 30, 82, '#4a2f1c');
    px(ctx, 254, 32, 26, 78, '#5a3a24');
    px(ctx, 254, 32, 26, 2, '#7a512f');
    px(ctx, 250, 28, 34, 4, '#7a512f'); // crown
    // Face (parchment)
    px(ctx, 257, 36, 20, 20, '#e8d8a8');
    px(ctx, 258, 37, 18, 18, '#f0e4bc');
    // Hebrew letter marks at the quadrants (pixel glyphs)
    ctx.fillStyle = '#3a2414';
    // top (alef-ish)
    ctx.fillRect(265, 38, 1, 3); ctx.fillRect(267, 38, 1, 3); ctx.fillRect(266, 39, 1, 1);
    // right (bet-ish)
    ctx.fillRect(272, 44, 2, 1); ctx.fillRect(273, 45, 1, 2); ctx.fillRect(272, 47, 2, 1);
    // bottom: a tiny FISH instead of a letter (one hand points at it)
    ctx.fillRect(264, 51, 3, 2); ctx.fillRect(263, 52, 1, 1); ctx.fillRect(267, 51, 1, 1); ctx.fillRect(267, 53, 1, 1);
    // left (vav-ish)
    ctx.fillRect(260, 44, 1, 4); ctx.fillRect(260, 43, 2, 1);
    // One working-ish hand pointing at the fish, quivering with effort
    var q = Math.sin(t * 13) * 0.6;
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(266, 46, 1, 1);
    ctx.fillRect(265 + q, 48, 1, 2);
    ctx.fillRect(265 + q, 50, 1, 1);
    // The other hand fell off — lies at the bottom of the case
    ctx.fillRect(262, 104, 6, 1);
    // Crack across the glass
    ctx.fillStyle = '#8f8fb0';
    ctx.fillRect(270, 38, 1, 1); ctx.fillRect(271, 39, 1, 1); ctx.fillRect(270, 40, 1, 1); ctx.fillRect(271, 41, 1, 1);
    // Pendulum window
    px(ctx, 259, 60, 16, 46, '#232336');
    px(ctx, 260, 61, 14, 44, '#141428');
    // Pendulum: STUCK at an angle, just jitters pathetically
    var ang = 0.55 + Math.sin(t * 11) * 0.03;
    var pxv = 266, pyv = 62;
    ctx.fillStyle = '#d4a017';
    for (var seg = 0; seg < 8; seg++) {
      ctx.fillRect(pxv + Math.sin(ang) * seg * 1.6, pyv + Math.cos(ang) * seg * 4.6, 1, 4);
    }
    px(ctx, pxv + Math.sin(ang) * 12 - 2, pyv + Math.cos(ang) * 37, 5, 5, '#d4a017');
    px(ctx, pxv + Math.sin(ang) * 12 - 1, pyv + Math.cos(ang) * 37 + 1, 3, 3, '#ffd166');
    // Sleeping bird on the crown (the cuckoo gave up), breathing
    var br = Math.sin(t * 2) * 0.6;
    px(ctx, 262, 25 - br, 6, 3 + br, '#a26bd4');
    px(ctx, 267, 24 - br, 3, 3, '#a26bd4');
    px(ctx, 270, 25, 2, 1, '#ffd166'); // beak
    ctx.fillStyle = '#141428';
    ctx.fillRect(268, 25, 1, 1); // closed eye (a line would be nicer; a pixel will do)
  }

  function paintDoor(ctx, t) {
    // Arched doorway to the square — cold night outside
    px(ctx, 286, 54, 34, 56, '#3a2414');
    px(ctx, 289, 58, 29, 52, '#0a0a23');
    px(ctx, 289, 58, 29, 8, '#141440');
    dither(ctx, 289, 66, 29, 8, '#141440', '#0a0a23');
    // arch
    px(ctx, 289, 58, 4, 3, '#3a2414');
    px(ctx, 314, 58, 4, 3, '#3a2414');
    twinkle(ctx, 296, 63, t + 0.9, 1, '#ffffff');
    twinkle(ctx, 308, 68, t + 2.2, 1, '#ffffff');
    // Distant village silhouette
    px(ctx, 289, 96, 29, 14, '#141440');
    px(ctx, 294, 90, 8, 6, '#141440');
    px(ctx, 306, 92, 7, 4, '#141440');
    // One warm far window
    var wf = 0.7 + 0.3 * Math.sin(t * 2.7);
    ctx.globalAlpha = wf;
    px(ctx, 297, 93, 2, 2, '#ffd166');
    ctx.globalAlpha = 1;
    // Mezuzah on the right doorpost (gold, slightly slanted look)
    px(ctx, 317, 70, 2, 6, '#d4a017');
    px(ctx, 318, 69, 1, 1, '#ffd166');
  }

  function paintDecor(ctx, t) {
    // Shelf with jars between window and table
    px(ctx, 116, 46, 36, 3, '#5a3a24');
    px(ctx, 120, 38, 6, 8, '#1f7a8c');
    px(ctx, 129, 36, 7, 10, '#e8d8a8');
    px(ctx, 139, 39, 6, 7, '#a26bd4');
    px(ctx, 121, 37, 4, 1, '#8f8fb0');
    // Hanging herb bundles from the beam, swaying gently
    for (var i = 0; i < 2; i++) {
      var hx = 160 + i * 14;
      var sway = Math.sin(t * 1.2 + i * 2) * 1.5;
      px(ctx, hx, 12, 1, 8, '#8a6a4a');
      px(ctx, hx - 2 + sway, 20, 5, 7, '#3f7a3f');
      px(ctx, hx - 1 + sway, 26, 3, 3, '#2f5a2f');
    }
    // Framed embroidery on the wall (pattern only, no text)
    px(ctx, 24, 34, 26, 20, '#3a2414');
    px(ctx, 26, 36, 22, 16, '#e8d8a8');
    ctx.fillStyle = '#e63946';
    ctx.fillRect(30, 40, 2, 2); ctx.fillRect(36, 42, 2, 2); ctx.fillRect(42, 40, 2, 2);
    ctx.fillStyle = '#1f7a8c';
    ctx.fillRect(33, 45, 2, 2); ctx.fillRect(39, 45, 2, 2);
    // Small potted plant right of the door-side wall
    px(ctx, 246, 118, 8, 6, '#a22832');
    px(ctx, 247, 112, 2, 6, '#3f7a3f');
    px(ctx, 250, 110, 2, 8, '#3f7a3f');
    px(ctx, 252, 114, 2, 4, '#2f5a2f');
  }

  /* ------------------------------------------------------------------ */
  /* Dialogue helpers                                                   */
  /* ------------------------------------------------------------------ */

  var KOHEN_COLOR = '#ffd166';
  var BOOM_COLOR = '#e63946';

  function kSay(g, text) {
    return g.say(text, { who: 'pinchas', color: KOHEN_COLOR });
  }

  async function stomachGrowl(g) {
    try { g.sfx('roar'); } catch (err) { /* fail silent */ }
    await g.say('(קְרְרְרְר־ר־ר־ר...)', { who: 'pinchas', color: '#8f8fb0' });
  }

  async function reenactSheretz(g) {
    await kSay(g, 'הבוקר, בשוק. הושטתי יד לתאנה הכי יפה בסלסלה...');
    await kSay(g, 'ואז הרגשתי משהו... זז.');
    await kSay(g, '(פנחס קופא. עיניו נפערות. הוא חי את זה מחדש.)');
    try { g.sfx('roar'); } catch (err) { /* fail silent */ }
    await kSay(g, 'שֶׁרֶץ!!! נגעתי בשֶׁרֶץ!!!');
    await kSay(g, 'ככה הוא זחל עליי: שְׁרַץ... שְׁרַץ... שְׁרַץ... (הוא מדגים בכל הגוף. זה מטריד.)');
    await g.playerSay('אתה משחזר את זה ממש טוב. מפחיד כמה טוב.');
    await kSay(g, 'שנים של ניסיון. כלומר, יום אחד. אבל יום אינטנסיבי.');
    await kSay(g, 'ומי שנוגע בשרץ — נטמא. וכהן טמא לא נוגע בתרומה!');
  }

  async function explainTevila(g) {
    await kSay(g, 'רצתי הביתה וטבלתי במקווה. קפוא, דרך אגב. שאלה מצוינת, אל תשאל.');
    await kSay(g, 'אבל טבילה זה רק חצי מהדרך! עכשיו אני צריך הֶעֱרֵב שֶׁמֶשׁ.');
    await g.playerSay('הערב... שמש?');
    await kSay(g, 'שהשמש תשקע לגמרי ויֵצאו הכוכבים. רק אז הטבילה גומרת את העבודה ואני טהור לאכול.');
    await kSay(g, 'כמו שאומרים: «בִּיאַת שִׁמְשׁוֹ מְעַכַּבְתּוֹ, וְאֵין כַּפָּרָתוֹ מְעַכַּבְתּוֹ» — השקיעה מעכבת אותי, לא הקרבן!');
    await kSay(g, 'וזה בדיוק הסימן של המשנה: «מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן»!');
    await kSay(g, 'כשאני מתיישב לאכול — כל הכפר יודע: יצאו הכוכבים, זמן קריאת שמע של ערבית!');
    await g.playerSay('רגע... אתה בעצם שעון הלכתי מהלך.');
    await kSay(g, 'שעון רעב מאוד, כן.');
  }

  async function explainQuest(g) {
    await kSay(g, 'מכאן אי אפשר לראות כוכבים — החלון שלי פונה בדיוק לארובה של השכנה.');
    await kSay(g, 'ואני חלש מדי מרעב לטפס לגג המצפה. ניסיתי. הגעתי עד המדרגה השנייה.');
    await kSay(g, 'עלה אתה לגג! מצא שלושה כוכבים בינוניים — לא גדולים, בינוניים! — ותביא לי הוכחה.');
    await kSay(g, 'ברגע שיש הוכחה שיצאו הכוכבים — אני אוכל, ואתה מקבל את מה שאתה מחפש.');
    await g.playerSay('שלושה כוכבים בינוניים. סומן. אל תאכל את השולחן בינתיים.');
    await kSay(g, 'אני לא מבטיח כלום.');
    // Activate the roof star puzzle (alias flags for cross-scene safety).
    g.flag('kohen_quest', true);
    g.flag('star_quest', true);
  }

  /* ------------------------------------------------------------------ */
  /* The eating cutscene                                                */
  /* ------------------------------------------------------------------ */

  async function feedingCutscene(g) {
    await g.cutscene(async function (gg) {
      await kSay(gg, 'מה זה?! קלף?! עם... עם שלושה כוכבים בינוניים מצוירים?!');
      await kSay(gg, 'יָצְאוּ הַכּוֹכָבִים!!! הֶעֱרֵב שֶׁמֶשׁ!!! אֲנִי טָהוֹר!!!');
      try { gg.sfx('magic'); } catch (err) { /* fail silent */ }
      await gg.wait(300);
      // He crosses the room at a speed never before recorded.
      gg.flag('kohen_fed', true);
      await kSay(gg, '(פנחס חוצה את החדר במהירות שטרם נצפתה אצל כהן רעב.)');
      await kSay(gg, '(הוא מסיר את פעמון הזכוכית בטקסיות של כהן גדול ביום כיפור.)');
      try { gg.sfx('pickup'); } catch (err) { /* fail silent */ }
      await gg.wait(250);
      await kSay(gg, 'אַמְמְמְם!!! טעם של... טָהֳרָה!!!');
      // PIXEL CONFETTI + fanfare
      gg.flag('kohen_confetti_until', Date.now() + 4500);
      try { gg.sfx('win'); } catch (err) { /* fail silent */ }
      await gg.wait(600);
      await kSay(gg, 'וְזֹאת הַהֲלָכָה, שיֵדעו כל בית ישראל:');
      await kSay(gg, '«מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִית? מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן»!');
      await kSay(gg, 'הכהנים נכנסים לאכול — זה אני! עכשיו! זה הסימן שיצאו הכוכבים!');
      await gg.playerSay('אז כל מי שרואה אותך אוכל יודע שהגיע זמן קריאת שמע. גאוני.');
      await kSay(gg, 'קח, זרח. הרווחת את זה ביושר.');
      try {
        if (typeof gg.remove === 'function') gg.remove('starproof');
      } catch (err) { /* fail silent */ }
      try { gg.addSeal('stars', 'חותם הכוכבים'); } catch (err) { /* fail silent */ }
      await kSay(gg, 'חוֹתַם הַכּוֹכָבִים! קח אותו לארון הזמנים בבית המדרש.');
      await kSay(gg, 'ועכשיו תסלח לי — יש לי דייט עם חלה.');
    });
  }

  /* ------------------------------------------------------------------ */
  /* Scene definition                                                   */
  /* ------------------------------------------------------------------ */

  window.GAME.registerScene('kohen', {

    name: 'בית הכהן פנחס',

    floor: { yMin: 122, yMax: 170 },

    paint: function (ctx, t, S) {
      try {
        paintWalls(ctx, t);
        paintWindow(ctx, t);
        paintDecor(ctx, t);
        paintMikveh(ctx, t, S);
        paintFireplace(ctx, t);
        paintClock(ctx, t);
        paintDoor(ctx, t);
        paintFloor(ctx, t, S);
        paintTableAndTerumah(ctx, t, S);
      } catch (err) {
        // Never let a paint bug kill the frame loop.
        px(ctx, 0, 0, 320, 180, '#141428');
        if (!window.__kohenPaintWarned) {
          window.__kohenPaintWarned = true;
          if (window.console && console.warn) console.warn('kohen paint error:', err);
        }
      }
    },

    onEnter: async function (g) {
      try {
        if (!g.flag('kohen_entered')) {
          g.flag('kohen_entered', true);
          await g.playerSay('מממ... ריח של חלה טרייה. וזוהרת. חלות אמורות לזהור?');
        }
      } catch (err) { /* fail silent */ }
    },

    hotspots: [

      /* ---------------- Pinchas the Kohen ---------------- */
      {
        id: 'pinchas',
        name: 'הכהן פנחס',
        type: 'char',
        x: 112, y: 112, w: 84, h: 38,
        walkTo: { x: 148, y: 150 },

        draw: function (ctx, t, S) {
          try { drawKohen(ctx, t, S); } catch (err) { /* fail silent */ }
        },

        look: async function (g) {
          if (g.hasSeal && g.hasSeal('stars')) {
            await g.playerSay('כהן שבע. נדיר לראות חיוך כזה מחוץ לחתונות.');
          } else {
            await g.playerSay('כהן רעב שמסתובב בחדר כמו אריה בכלוב. אריה עם מצנפת.');
          }
        },

        talk: async function (g) {
          // Already got the seal — happy epilogue lines
          if (g.hasSeal && g.hasSeal('stars')) {
            await kSay(g, pick([
              'שָׂבֵעַ. שָׂמֵחַ. טָהוֹר. שלושת המצבים האהובים עליי.',
              'קח את חותם הכוכבים לארון הזמנים! ותגיד לו שפנחס אכל!',
              'עוד ביס אחד ואני מתחיל לשיר. אתה לא רוצה שאני אשיר.'
            ]));
            return;
          }

          // First meeting — dramatic starving monologue
          if (!g.flag('kohen_met')) {
            g.flag('kohen_met', true);
            await stomachGrowl(g);
            await kSay(g, 'שמעת את זה? זו הבטן שלי. היא מדברת היום יותר ממני.');
            await kSay(g, 'אני פנחס הכהן. ואני רעב. רעב הִיסטורי. רעב תַּלְמוּדִי!');
            await g.playerSay('יש לך חלה זוהרת על השולחן. למה אתה פשוט לא... אוכל?');
            await kSay(g, 'כי אני טמא!! כלומר, הייתי. כלומר... זה מסובך. שב. טוב, אין כיסא. תעמוד.');
          } else {
            await stomachGrowl(g);
          }

          // Dialogue tree
          var keepTalking = true;
          while (keepTalking) {
            var choice = await g.choose([
              { text: 'מה בדיוק קרה לך היום?', value: 'story' },
              { text: 'אז למה שלא תאכל כבר?', value: 'tevila' },
              { text: 'איך אני יכול לעזור?', value: 'quest' },
              { text: 'אחזור אליך. תחזיק מעמד, פנחס.', value: 'bye' }
            ]);
            switch (choice) {
              case 'story':
                await reenactSheretz(g);
                break;
              case 'tevila':
                await explainTevila(g);
                break;
              case 'quest':
                await explainQuest(g);
                break;
              default:
                await kSay(g, 'לך... אבל תחזור עם כוכבים. שלושה. בינוניים. אני סומך עליך יותר מעל הבטן שלי.');
                keepTalking = false;
                break;
            }
          }
        },

        take: async function (g) {
          await g.playerSay('לקחת כהן? יש לו משפחה. ותרומה.');
        },

        use: async function (g, itemId) {
          if (itemId === 'starproof') {
            if (g.hasSeal && g.hasSeal('stars')) {
              await kSay(g, 'כבר אכלתי, ידידי. הקלף הזה שייך להיסטוריה. כמוני.');
              return;
            }
            await feedingCutscene(g);
            return;
          }
          if (itemId === 'daf') {
            await g.playerSay('כתוב פה: «מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן».');
            await kSay(g, 'זה אני! אני הכהנים! טוב, כהן אחד. אבל רעב כמו שלושה.');
            return;
          }
          await g.playerSay('להשתמש בכהן? הוא לא כלי. טוב, הוא כלי קודש. אבל לא כזה.');
        }
      },

      /* ---------------- The Terumah ---------------- */
      {
        id: 'terumah',
        name: 'התרומה',
        type: 'object',
        x: 138, y: 74, w: 40, h: 32,
        walkTo: { x: 158, y: 132 },

        look: async function (g) {
          if (g.flag('kohen_fed')) {
            await g.playerSay('פירורים. פירורים מאושרים של חלה שמילאה את ייעודה.');
            return;
          }
          await g.playerSay('חלה זהובה, זוהרת, מתחת לפעמון זכוכית. אני כמעט שומע אותה לוחשת "אֱכֹל אוֹתִי".');
          await g.playerSay('...אסור לי. אני לא כהן. אבל הריר שלי לא מכיר הלכות.');
        },

        take: async function (g) {
          if (g.flag('kohen_fed')) {
            await g.playerSay('לקחת פירורים? גם לרעב יש כבוד.');
            return;
          }
          try { g.sfx('fail'); } catch (err) { /* fail silent */ }
          if (!g.flag('terumah_zapped')) {
            g.flag('terumah_zapped', true);
            await g.say('אַתָּה לֹא כֹּהֵן!!!', { color: BOOM_COLOR, x: 156, y: 64 });
            await g.playerSay('טוב!! סליחה!! רק בדקתי!!');
            await kSay(g, 'תרומה נאכלת רק על ידי כהן טהור. הפעמון הזה יודע הלכות יותר טוב משנינו.');
          } else {
            await g.say('גַּם עַכְשָׁו אַתָּה לֹא כֹּהֵן!!!', { color: BOOM_COLOR, x: 156, y: 64 });
            await g.playerSay('שווה היה לנסות. לא שווה. לא היה שווה.');
          }
        },

        use: async function (g, itemId) {
          if (itemId === 'starproof') {
            await g.playerSay('ההוכחה לא בשביל החלה — היא בשביל פנחס. הוא זה שסופר כוכבים.');
            return;
          }
          if (itemId === 'daf') {
            await g.playerSay('כתוב בדף: הכהנים נכנסים לאכול בתרומתן משעת צאת הכוכבים. החלה מחכה בדיוק לזה.');
            return;
          }
          await g.playerSay('הפעמון סגור, והקול ההוא כבר צעק עליי פעם אחת.');
        }
      },

      /* ---------------- The Mikveh ---------------- */
      {
        id: 'mikveh',
        name: 'המקווה',
        type: 'object',
        x: 6, y: 78, w: 62, h: 40,
        walkTo: { x: 76, y: 130 },

        look: async function (g) {
          await g.playerSay('מים כשרים למהדרין. גם קרים למהדרין. שאלו את פנחס.');
        },

        take: async function (g) {
          await g.playerSay('לקחת מקווה? יש גבול למה שנכנס לתיק.');
        },

        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('כתוב בדף: «בִּיאַת שִׁמְשׁוֹ מְעַכַּבְתּוֹ, וְאֵין כַּפָּרָתוֹ מְעַכַּבְתּוֹ». הטבילה כאן — השקיעה בשמים.');
            return;
          }
          // Toe-dip gag
          var dips = g.flag('mikveh_dips') || 0;
          g.flag('mikveh_dips', dips + 1);
          g.flag('mikveh_splash_until', Date.now() + 1600);
          try { g.sfx('step'); } catch (err) { /* fail silent */ }
          await g.playerSay('רגע, רק בודק את הטמפרטורה...');
          await g.wait(400);
          try { g.sfx('fail'); } catch (err) { /* fail silent */ }
          if (dips === 0) {
            await g.playerSay('אָאוּץ׳!!! קַר!!! איך פנחס טבל בזה?!');
            await kSay(g, 'בצרחות, ידידי. טבלתי בצרחות.');
          } else {
            await g.playerSay('עדיין קר. המדע עקבי, והבוהן שלי סובלת.');
          }
        }
      },

      /* ---------------- Grandfather Clock ---------------- */
      {
        id: 'clock',
        name: 'שעון סבא',
        type: 'object',
        x: 250, y: 28, w: 34, h: 84,
        walkTo: { x: 262, y: 130 },

        look: async function (g) {
          await g.playerSay('שעון הסבא מראה "בערך לילה?". מחוג אחד נפל, והשני מצביע על ציור של דג.');
          await g.playerSay('אולי בגלל זה ההלכה לא סומכת על שעונים — היא סומכת על השמים. כוכבים אף פעם לא צריכים כיוון.');
        },

        talk: async function (g) {
          await g.say('טִיק... ... ... טַק?', { color: '#8f8fb0', x: 266, y: 30 });
          await g.playerSay('הוא עושה כמיטב יכולתו.');
        },

        take: async function (g) {
          await g.playerSay('הוא גדול ממני פי שניים, וגם ככה אף אחד לא יודע מה השעה.');
        },

        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('בדף אין אף שעון. יש כוכבים, עמוד השחר וכהנים רעבים. עובד כבר אלפיים שנה.');
            return;
          }
          try { g.sfx('click'); } catch (err) { /* fail silent */ }
          await g.playerSay('הזזתי את המחוג. עכשיו כתוב "בערך בערך לילה". שיפור.');
        }
      },

      /* ---------------- Fireplace (flavor) ---------------- */
      {
        id: 'fireplace',
        name: 'האח',
        type: 'object',
        x: 198, y: 68, w: 52, h: 44,
        walkTo: { x: 222, y: 132 },

        look: async function (g) {
          await g.playerSay('אש ביתית נעימה. פנחס חימם עליה קומקום בשביל המקווה. המקווה נשאר קרח. הקומקום נעלב.');
        },

        take: async function (g) {
          await g.playerSay('חם. בוער. לא נכנס לתיק. שלוש סיבות מצוינות.');
        },

        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('לא שורפים דף גמרא. במיוחד לא כשהוא הדף הראשון.');
            return;
          }
          await g.playerSay('יש לי כבר נר משלי, תודה. אנחנו מאושרים ביחד.');
        }
      },

      /* ---------------- Exit to the square ---------------- */
      {
        id: 'exit-square',
        name: 'היציאה לכיכר',
        type: 'exit',
        x: 286, y: 54, w: 34, h: 60,
        walkTo: { x: 302, y: 130 },
        target: 'square',
        spawn: { x: 62, y: 150 },

        look: async function (g) {
          await g.playerSay('הדלת החוצה, אל כיכר הכפר. הלילה שם קר — וכאן יש אח בוערת. החיים קשים.');
        }
      }
    ]
  });

})();
