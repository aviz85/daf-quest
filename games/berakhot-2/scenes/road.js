'use strict';
/*
 * Scene: road — "The Road from the Wedding" (moonlit road out of the village).
 * Teaches (Berakhot 2a + 3a):
 *   A. The sons of Rabban Gamliel returning after midnight — the actual Mishnah story.
 *      Correct ruling: "if dawn has not risen you are obligated to read" -> midnight seal.
 *   B. The lion watchman — the three night watches and their signs -> watch seal.
 * Owns ONLY this file. Registers via GAME.registerScene('road', {...}).
 */
(function () {

  // ---------------------------------------------------------------------
  // Module-local animation / ambience state (persists across visits)
  // ---------------------------------------------------------------------
  var bgCache = null;          // offscreen canvas with the static background
  var donkeyBrayUntil = 0;     // ms timestamp — donkey bray animation window
  var lionRoarUntil = 0;       // ms timestamp — lion roar animation window
  var nextHicTime = 5;         // t (seconds) of next ambient hiccup sfx
  var nextRoarTime = 18;       // t (seconds) of next ambient watch-roar

  // ---------------------------------------------------------------------
  // Tiny drawing helpers (self-contained; SPRITES used only when present)
  // ---------------------------------------------------------------------
  function px(c, x, y, w, h, col) {
    c.fillStyle = col;
    c.fillRect(x, y, w, h);
  }

  function dither(c, x, y, w, h, c1, c2) {
    px(c, x, y, w, h, c1);
    c.fillStyle = c2;
    for (var yy = 0; yy < h; yy++) {
      for (var xx = (yy % 2); xx < w; xx += 2) {
        c.fillRect(x + xx, y + yy, 1, 1);
      }
    }
  }

  function glow(c, x, y, r, col, alpha) {
    if (window.SPRITES && typeof SPRITES.glow === 'function') {
      try { SPRITES.glow(c, x, y, r, col, alpha); return; } catch (e) { /* fall through */ }
    }
    c.fillStyle = col;
    for (var k = r; k > 0; k -= 2) {
      c.globalAlpha = alpha;
      c.fillRect(x - k, y - k, k * 2, k * 2);
    }
    c.globalAlpha = 1;
  }

  function safeSfx(name) {
    try {
      if (window.AUDIO && typeof AUDIO.sfx === 'function') { AUDIO.sfx(name); }
    } catch (e) { /* fail silent */ }
  }

  function hasSealSafe(g, id) {
    try { return !!(g && typeof g.hasSeal === 'function' && g.hasSeal(id)); }
    catch (e) { return false; }
  }

  function sealInState(S, id) {
    return !!(S && S.seals && S.seals.indexOf && S.seals.indexOf(id) >= 0);
  }

  // ---------------------------------------------------------------------
  // STATIC BACKGROUND (painted once into an offscreen canvas)
  // ---------------------------------------------------------------------
  function paintStatic(c) {
    var i, x, y;

    // --- sky: dithered indigo/violet gradient bands ---
    px(c, 0, 0, 320, 28, '#0a0a23');
    dither(c, 0, 28, 320, 4, '#0a0a23', '#141440');
    px(c, 0, 32, 320, 28, '#141440');
    dither(c, 0, 60, 320, 4, '#141440', '#232366');
    px(c, 0, 64, 320, 28, '#232366');
    dither(c, 0, 92, 320, 4, '#232366', '#2b2b70');
    px(c, 0, 96, 320, 6, '#2b2b70');

    // --- big crescent moon (top-left) ---
    glow(c, 46, 26, 20, '#c9c9ee', 0.05);
    if (window.SPRITES && typeof SPRITES.moon === 'function') {
      try { SPRITES.moon(c, 46, 26, 0.6); } catch (e) { drawMoonFallback(c, 46, 26); }
    } else {
      drawMoonFallback(c, 46, 26);
    }

    // --- distant hills silhouette ---
    px(c, 0, 94, 320, 8, '#14142e');
    px(c, 120, 91, 70, 4, '#14142e');
    px(c, 200, 88, 60, 7, '#14142e');
    px(c, 270, 90, 50, 5, '#14142e');
    // distant cypress trees
    px(c, 130, 84, 2, 8, '#101028');
    px(c, 148, 86, 2, 6, '#101028');
    px(c, 210, 82, 2, 7, '#101028');

    // --- ground base ---
    px(c, 0, 102, 320, 78, '#35283f');

    // --- the moonlit road: trapezoid from the tent area down to the front ---
    for (y = 102; y < 180; y++) {
      var cx = 250 - (y - 102) * 1.05;
      var hw = 6 + (y - 102) * 1.78;
      px(c, Math.round(cx - hw), y, Math.round(hw * 2), 1, '#4a3a58');
      // wheel ruts
      px(c, Math.round(cx - hw * 0.45), y, 2, 1, '#3d2f4a');
      px(c, Math.round(cx + hw * 0.45), y, 2, 1, '#3d2f4a');
      // soft dithered edges
      if (y % 2 === 0) {
        px(c, Math.round(cx - hw) - 2, y, 2, 1, '#40314c');
        px(c, Math.round(cx + hw), y, 2, 1, '#40314c');
      }
    }

    // --- wedding tent (distant, right) ---
    drawTentStatic(c);

    // --- vineyard rows (left-mid background) ---
    drawVineyard(c);

    // --- donkey pen dirt patch (behind the fence) ---
    px(c, 240, 112, 80, 12, '#2e2336');

    // --- village gate towers (left edge; the exit back to the square) ---
    drawGate(c);

    // --- guard post booth (lion's station) ---
    drawBooth(c);

    // --- road props: milestone, wine jug, footprints, stones, thistles ---
    // milestone
    px(c, 31, 151, 12, 11, '#6b6b8f');
    px(c, 33, 149, 8, 2, '#6b6b8f');
    px(c, 31, 158, 12, 4, '#565678');
    px(c, 34, 153, 1, 4, '#3a3a55'); // three chiseled notches
    px(c, 37, 153, 1, 4, '#3a3a55');
    px(c, 40, 153, 1, 4, '#3a3a55');

    // dropped wine jug + puddle (evidence of the party)
    px(c, 206, 155, 12, 3, '#3a2440');   // wine puddle
    px(c, 210, 147, 7, 8, '#7a512f');    // jug body
    px(c, 212, 144, 3, 3, '#5a3a24');    // neck
    px(c, 217, 149, 2, 3, '#5a3a24');    // handle
    px(c, 219, 153, 2, 2, '#e8d8a8');    // popped cork

    // stumbling footprint trail from the tent toward the brothers
    for (i = 0; i < 6; i++) {
      px(c, 240 - i * 6, 147 + ((i % 2) ? 4 : 0), 2, 1, '#2c2138');
    }

    // scattered pebbles
    px(c, 120, 160, 3, 2, '#56466a');
    px(c, 265, 166, 3, 2, '#56466a');
    px(c, 60, 172, 4, 2, '#2c2138');
    px(c, 180, 174, 3, 2, '#56466a');
    px(c, 300, 150, 3, 2, '#2c2138');

    // roadside thistles (violet heads)
    drawThistle(c, 122, 168);
    drawThistle(c, 302, 158);
    drawThistle(c, 46, 166);

    // grass tufts
    px(c, 140, 156, 1, 3, '#2c4a30');
    px(c, 142, 157, 1, 2, '#2c4a30');
    px(c, 228, 162, 1, 3, '#2c4a30');
    px(c, 230, 163, 1, 2, '#2c4a30');
    px(c, 88, 158, 1, 3, '#2c4a30');
  }

  function drawMoonFallback(c, mx, my) {
    // blocky crescent moon
    var r = 11, dx, dy;
    for (dy = -r; dy <= r; dy++) {
      for (dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          // carve the crescent with an offset circle
          var ox = dx - 5, oy = dy - 2;
          if (ox * ox + oy * oy > (r - 2) * (r - 2)) {
            px(c, mx + dx, my + dy, 1, 1, '#e8e8f8');
          }
        }
      }
    }
    // craters on the lit rim
    px(c, mx + 6, my - 3, 2, 2, '#c9c9dd');
    px(c, mx + 8, my + 4, 1, 1, '#c9c9dd');
  }

  function drawTentStatic(c) {
    var y, hw;
    // striped canopy: stepped triangle, apex at (272,74), base y=96
    for (y = 74; y <= 96; y++) {
      hw = (y - 74) * 1.8 + 3;
      var stripe = (Math.floor((y - 74) / 4) % 2 === 0) ? '#6e2e3e' : '#8a7a55';
      px(c, Math.round(272 - hw), y, Math.round(hw * 2), 1, stripe);
    }
    px(c, 268, 72, 8, 3, '#b89060'); // ridge cap
    // walls / interior shadow
    px(c, 240, 96, 64, 16, '#241a30');
    // warm open entrance (dancers get drawn dynamically over this)
    px(c, 256, 93, 34, 19, '#ffb347');
    px(c, 260, 95, 26, 17, '#ffd166');
    glow(c, 273, 104, 14, '#ffb347', 0.05);
    // poles
    px(c, 238, 94, 2, 20, '#5a3a24');
    px(c, 304, 94, 2, 20, '#5a3a24');
    // warm light spilling on the ground
    dither(c, 254, 112, 38, 4, '#4a3a58', '#6e5a4a');
    dither(c, 260, 116, 26, 3, '#4a3a58', '#5c4a48');
    // little fire pit beside the tent (smoke is dynamic)
    px(c, 224, 110, 6, 3, '#3a2c2e');
    px(c, 226, 109, 2, 2, '#ff8c42');
  }

  function drawVineyard(c) {
    // three receding vine rows with posts, wire, leaves and glowing-violet grapes
    var rows = [
      { y: 104, x0: 110, x1: 210, step: 20 },
      { y: 110, x0: 104, x1: 216, step: 18 },
      { y: 117, x0: 98, x1: 224, step: 17 }
    ];
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      // wire
      px(c, row.x0, row.y - 4, row.x1 - row.x0, 1, '#241c2e');
      for (var vx = row.x0; vx <= row.x1; vx += row.step) {
        px(c, vx, row.y - 6, 2, 7, '#4a3428');          // post
        px(c, vx - 3, row.y - 4, 8, 3, '#24402c');       // vine clump
        px(c, vx - 1, row.y - 5, 4, 1, '#2c5034');       // leaf highlight
        // grape cluster
        px(c, vx + 3, row.y - 2, 2, 2, '#7a4a9a');
        px(c, vx + 4, row.y - 1, 1, 1, '#a26bd4');
      }
    }
  }

  function drawGate(c) {
    // stone gate wall + arch on the left edge (exit to the square)
    px(c, 0, 70, 22, 110, '#3f3f5c');
    // stone courses
    for (var gy = 74; gy < 176; gy += 7) {
      px(c, 0, gy, 22, 1, '#33334e');
    }
    px(c, 5, 78, 3, 2, '#4a4a68');
    px(c, 12, 92, 4, 2, '#4a4a68');
    px(c, 3, 118, 4, 2, '#4a4a68');
    // crenellation
    px(c, 0, 64, 5, 6, '#33334e');
    px(c, 8, 64, 5, 6, '#33334e');
    px(c, 16, 64, 5, 6, '#33334e');
    // dark arch (the way back)
    px(c, 4, 104, 15, 56, '#16162e');
    px(c, 6, 100, 11, 6, '#16162e');
    // torch bracket (flame is dynamic)
    px(c, 22, 100, 3, 2, '#5a3a24');
    px(c, 23, 96, 2, 5, '#5a3a24');
  }

  function drawBooth(c) {
    // wooden guard booth
    px(c, 54, 98, 38, 38, '#4e3826');            // back wall
    for (var by = 104; by < 134; by += 6) {      // plank seams
      px(c, 54, by, 38, 1, '#3a2a1c');
    }
    px(c, 58, 102, 28, 30, '#241a14');           // dark interior
    px(c, 48, 92, 48, 7, '#5a3a24');             // roof
    px(c, 48, 92, 48, 2, '#7a512f');             // roof highlight
    px(c, 54, 99, 3, 37, '#6e4a2c');             // support posts
    px(c, 89, 99, 3, 37, '#6e4a2c');
    // hanging lantern (flame dynamic): chain + frame
    px(c, 58, 99, 1, 4, '#3a2a1c');
    px(c, 56, 103, 5, 7, '#3a2a1c');
    px(c, 57, 104, 3, 5, '#241a14');
    // punch clock box on the right post
    px(c, 90, 100, 13, 17, '#6b6b8f');
    px(c, 90, 100, 13, 2, '#8f8fb0');
    px(c, 92, 103, 9, 9, '#d8d8e8');             // clock face
    px(c, 96, 104, 1, 1, '#4a4a68');             // 12 o'clock tick
    px(c, 96, 110, 1, 1, '#4a4a68');
    px(c, 93, 107, 1, 1, '#4a4a68');
    px(c, 99, 107, 1, 1, '#4a4a68');
    px(c, 103, 105, 3, 2, '#4a4a68');            // lever arm
    px(c, 105, 104, 2, 2, '#e63946');            // lever knob
    px(c, 92, 113, 9, 3, '#241a14');             // card slot
  }

  function drawThistle(c, x, y) {
    px(c, x, y - 4, 1, 4, '#2c4a30');
    px(c, x - 1, y - 6, 3, 3, '#a26bd4');
    px(c, x, y - 7, 1, 1, '#c490ea');
  }

  function getBG() {
    if (bgCache) { return bgCache; }
    try {
      var cv = document.createElement('canvas');
      cv.width = 320;
      cv.height = 180;
      var c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      paintStatic(c);
      bgCache = cv;
    } catch (e) {
      bgCache = null;
    }
    return bgCache;
  }

  // ---------------------------------------------------------------------
  // DYNAMIC LAYERS (every frame)
  // ---------------------------------------------------------------------
  function drawStars(c, t) {
    for (var i = 0; i < 36; i++) {
      var sx = (i * 89 + 13) % 320;
      var sy = ((i * 53 + 7) % 84) + 2;
      if (sx > 20 && sx < 74 && sy < 46) { continue; } // keep the moon clear
      var tw = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.3 + i * 1.7));
      c.globalAlpha = tw;
      if (i % 9 === 0 && window.SPRITES && typeof SPRITES.star === 'function') {
        try { SPRITES.star(c, sx, sy, t + i, 2, '#e8e8ff'); } catch (e) { px(c, sx, sy, 1, 1, '#e8e8ff'); }
      } else if (i % 9 === 0) {
        px(c, sx - 1, sy, 3, 1, '#e8e8ff');
        px(c, sx, sy - 1, 1, 3, '#e8e8ff');
      } else {
        px(c, sx, sy, 1, 1, (i % 3 === 0) ? '#c9c9ee' : '#8f8fb0');
      }
    }
    c.globalAlpha = 1;
    // occasional shooting star
    var ph = t % 23;
    if (ph < 0.7) {
      var mx = 290 - ph * 180;
      var my = 10 + ph * 42;
      px(c, Math.round(mx), Math.round(my), 2, 1, '#ffffff');
      c.globalAlpha = 0.4;
      px(c, Math.round(mx + 3), Math.round(my - 1), 4, 1, '#c9c9ee');
      c.globalAlpha = 1;
    }
  }

  function drawTentLife(c, t) {
    // dancing silhouettes in the glowing entrance (a hora circle, obviously)
    for (var i = 0; i < 4; i++) {
      var dx = 261 + i * 7;
      var h = 9 + (i % 2) * 2;
      var bob = Math.abs(Math.sin(t * 3.2 + i * 1.4)) * 2;
      var base = 112 - Math.round(bob);
      px(c, dx, base - h, 3, h - 2, '#1a1226');           // body
      px(c, dx, base - h - 2, 3, 3, '#1a1226');           // head
      if (Math.sin(t * 3.2 + i) > 0) {                    // arms up!
        px(c, dx - 1, base - h - 1, 1, 2, '#1a1226');
        px(c, dx + 3, base - h - 1, 1, 2, '#1a1226');
      } else {
        px(c, dx - 1, base - h + 2, 1, 2, '#1a1226');
        px(c, dx + 3, base - h + 2, 1, 2, '#1a1226');
      }
    }
    // flicker of the entrance light
    c.globalAlpha = 0.10 + 0.06 * Math.sin(t * 7);
    px(c, 258, 94, 30, 18, '#ffd166');
    c.globalAlpha = 1;
    // waving pennants
    var wob = Math.round(Math.sin(t * 4) * 2);
    px(c, 272, 66, 1, 7, '#5a3a24');
    px(c, 273, 66, 5 + wob, 3, '#e63946');
    px(c, 238, 90, 4 + wob, 2, '#a26bd4');
    px(c, 304, 90, 4 - wob, 2, '#a26bd4');
    // string lights sagging between the poles
    for (var lx = 240; lx <= 304; lx += 6) {
      var sag = Math.sin(Math.PI * (lx - 238) / 68) * 6;
      var col = (lx % 18 === 0) ? '#ffd166' : ((lx % 12 === 0) ? '#e63946' : '#a26bd4');
      c.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 6 + lx));
      px(c, lx, Math.round(96 + sag), 1, 1, col);
      c.globalAlpha = 1;
    }
    // smoke wisps from the fire pit
    for (var k = 0; k < 3; k++) {
      var rise = (t * 8 + k * 11) % 32;
      var sx = 227 + Math.sin((t + k) * 2) * 3;
      c.globalAlpha = Math.max(0, 0.28 - rise * 0.008);
      px(c, Math.round(sx), Math.round(107 - rise), 2, 2, '#6b6b8f');
      c.globalAlpha = 1;
    }
    // fire pit ember flicker
    c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 11);
    px(c, 226, 109, 2, 2, '#ffd166');
    c.globalAlpha = 1;
  }

  function drawDonkey(c, t) {
    var bx = 258, by = 98;
    var bob = Math.round(Math.sin(t * 0.8));
    var braying = Date.now() < donkeyBrayUntil;
    // legs (fence rails will cover parts of them)
    px(c, bx + 2, by + 10, 2, 9, '#6e5e50');
    px(c, bx + 8, by + 10, 2, 9, '#6e5e50');
    px(c, bx + 15, by + 10, 2, 9, '#6e5e50');
    px(c, bx + 20, by + 10, 2, 9, '#6e5e50');
    // body
    px(c, bx, by, 24, 11, '#8a7868');
    px(c, bx, by + 8, 24, 3, '#6e5e50');
    // tail with a lazy swish
    px(c, bx + 24, by + 2, 2, 6, '#5c4e42');
    px(c, bx + 24, by + 8 + Math.round(Math.sin(t * 0.9) * 2), 2, 2, '#3a3028');
    if (braying) {
      // head thrown up, mouth open, sound lines
      px(c, bx - 4, by - 6, 6, 9, '#8a7868');            // neck raised
      px(c, bx - 11, by - 11, 10, 6, '#8a7868');         // head up
      px(c, bx - 13, by - 9, 3, 3, '#2a2018');           // open mouth
      px(c, bx - 13, by - 9, 3, 1, '#d8c8b0');           // teeth
      px(c, bx - 9, by - 16, 2, 6, '#7a6a5a');           // ears pinned
      px(c, bx - 5, by - 16, 2, 6, '#7a6a5a');
      px(c, bx - 6, by - 10, 1, 1, '#241a14');           // eye
      c.globalAlpha = 0.5;
      px(c, bx - 18, by - 12, 3, 1, '#e8d8a8');
      px(c, bx - 20, by - 8, 4, 1, '#e8d8a8');
      px(c, bx - 18, by - 4, 3, 1, '#e8d8a8');
      c.globalAlpha = 1;
    } else {
      px(c, bx - 3, by - 3 + bob, 6, 8, '#8a7868');      // neck
      px(c, bx - 10, by - 4 + bob, 9, 6, '#8a7868');     // head
      px(c, bx - 12, by - 3 + bob, 3, 4, '#b0a090');     // muzzle
      px(c, bx - 8, by - 10 + bob, 2, 7, '#7a6a5a');     // ears
      px(c, bx - 4, by - 10 + bob, 2, 7, '#7a6a5a');
      px(c, bx - 8, by - 3 + bob, 1, 1, '#241a14');      // eye
    }
    // mane ridge
    px(c, bx - 2, by - 5 + (braying ? -5 : bob), 4, 2, '#5c4e42');
  }

  function drawFence(c) {
    for (var fx = 238; fx <= 318; fx += 14) {
      px(c, fx, 104, 2, 22, '#5a3a24');
      px(c, fx, 104, 2, 2, '#7a512f');
    }
    px(c, 236, 110, 84, 2, '#6e4628');
    px(c, 236, 118, 84, 2, '#6e4628');
  }

  function drawFlame(c, x, y, t, seed) {
    var f = Math.sin(t * 9 + seed);
    px(c, x, y - 2 + (f > 0 ? 0 : 1), 2, 3, '#ff8c42');
    px(c, x, y - 1 + (f > 0.3 ? -1 : 0), 2, 2, '#ffd166');
    glow(c, x + 1, y, 7, '#ffb347', 0.06);
  }

  function drawClockLive(c, t, S) {
    // rotating hands on the punch clock face
    var cx = 96.5, cy = 107.5;
    var a = t * 0.35;
    var k;
    for (k = 1; k <= 3; k++) {
      px(c, Math.round(cx + Math.cos(a) * k), Math.round(cy + Math.sin(a) * k), 1, 1, '#2a2a44');
    }
    var ha = t * 0.06 + 2;
    for (k = 1; k <= 2; k++) {
      px(c, Math.round(cx + Math.cos(ha) * k), Math.round(cy + Math.sin(ha) * k), 1, 1, '#2a2a44');
    }
    // shift card poking out of the slot; stamped once the watch seal is earned
    px(c, 94, 111, 5, 4, '#e8d8a8');
    if (sealInState(S, 'watch')) {
      px(c, 95, 112, 3, 2, '#a26bd4');
    }
  }

  function drawFireflies(c, t) {
    for (var k = 0; k < 3; k++) {
      var fx = 150 + Math.sin(t * 0.5 + k * 2.1) * 50 + k * 25;
      var fy = 128 + Math.sin(t * 1.1 + k * 1.7) * 9;
      var pulse = 0.4 + 0.6 * Math.abs(Math.sin(t * 2.4 + k * 3));
      c.globalAlpha = pulse;
      px(c, Math.round(fx), Math.round(fy), 1, 1, '#d8f09a');
      c.globalAlpha = pulse * 0.25;
      px(c, Math.round(fx) - 1, Math.round(fy) - 1, 3, 3, '#d8f09a');
      c.globalAlpha = 1;
    }
  }

  function ambientSfx(t, S) {
    try {
      if (!window.AUDIO || typeof AUDIO.sfx !== 'function') { return; }
      // tipsy hiccups until the brothers say Shema
      if (!sealInState(S, 'midnight') && t > nextHicTime) {
        nextHicTime = t + 6 + ((t * 7) % 5);
        AUDIO.sfx('hic');
      }
      // the heavenly roar at each watch (compressed night schedule)
      if (t > nextRoarTime) {
        nextRoarTime = t + 34 + ((t * 13) % 14);
        lionRoarUntil = Date.now() + 900;
        AUDIO.sfx('roar');
      }
    } catch (e) { /* fail silent */ }
  }

  // ---------------------------------------------------------------------
  // CHARACTERS (drawn via hotspot.draw so the engine depth-sorts vs player)
  // ---------------------------------------------------------------------
  function drawSon(c, x, y, t, pal, sealed, phase) {
    var lean = sealed ? Math.sin(t * 1.1) * 0.5 : Math.sin(t * 2.2) * 2; // synchronized wobble
    var l = Math.round(lean);
    var hop = (!sealed && ((t + phase) % 3.7) < 0.14) ? -2 : 0;          // hiccup hop
    y += hop;
    // legs, wide drunk stance
    px(c, x - 4, y - 6, 2, 6, '#241a30');
    px(c, x + 2, y - 6, 2, 6, '#241a30');
    px(c, x - 5, y - 1, 3, 1, '#160f20');
    px(c, x + 2, y - 1, 3, 1, '#160f20');
    // robe
    var rx = x - 4 + Math.round(l * 0.5);
    px(c, rx, y - 15, 9, 10, pal.robe);
    px(c, rx, y - 7, 9, 2, pal.robeDark);
    px(c, rx, y - 10, 9, 2, '#ffd166');                  // festive sash
    // outer arm flailing for balance
    if (!sealed) {
      px(c, (pal.side < 0 ? rx - 3 : rx + 9), y - 14 + Math.round(Math.sin(t * 2.2) * 1.5), 3, 2, pal.robe);
    }
    // head
    var hx = x - 3 + l;
    px(c, hx, y - 22, 7, 7, '#e8c8a0');
    px(c, hx, y - 24, 7, 3, pal.cap);
    // wedding garland dots on the cap
    px(c, hx + 1, y - 24, 1, 1, '#ffd166');
    px(c, hx + 3, y - 25, 1, 1, '#e63946');
    px(c, hx + 5, y - 24, 1, 1, '#ffd166');
    // face
    if (sealed) {
      px(c, hx + 1, y - 19, 1, 1, '#241a14');            // bright open eyes
      px(c, hx + 4, y - 19, 1, 1, '#241a14');
      px(c, hx + 2, y - 16, 3, 1, '#8a4a4a');            // serene smile
    } else {
      px(c, hx + 1, y - 19, 2, 1, '#241a14');            // droopy eyes
      px(c, hx + 4, y - 19, 2, 1, '#241a14');
      px(c, hx + 2, y - 16, 2, 1, '#8a4a4a');            // wavy grin
      px(c, hx + 3, y - 17, 2, 1, '#8a4a4a');
    }
    px(c, hx, y - 17, 1, 1, '#d08070');                  // tipsy blush
    px(c, hx + 6, y - 17, 1, 1, '#d08070');
  }

  function drawSons(c, t, S) {
    var sealed = sealInState(S, 'midnight');
    var xA = 188, xB = 204, fy = 146;
    // linked arms: each holds the other's shoulder (until they sober up)
    if (!sealed) {
      var l = Math.round(Math.sin(t * 2.2) * 2);
      px(c, xA + 3 + l, fy - 14, 5, 2, '#b04048');
      px(c, xB - 8 + l, fy - 14, 5, 2, '#2e7a8c');
    }
    drawSon(c, xA, fy, t, { robe: '#b04048', robeDark: '#8c2f3a', cap: '#7a2a34', side: -1 }, sealed, 0);
    drawSon(c, xB, fy, t, { robe: '#2e7a8c', robeDark: '#1f5f70', cap: '#1a4a5a', side: 1 }, sealed, 1.85);
  }

  function drawLion(c, t) {
    var x = 72, y = 140;
    var roar = Date.now() < lionRoarUntil;
    var breath = Math.sin(t * 1.3) > 0 ? 1 : 0;
    var hy = roar ? -2 : 0;
    // tail with flicking tuft
    px(c, x - 16, y - 10, 2, 7, '#8a6a34');
    px(c, x - 18, y - 12 + Math.round(Math.sin(t * 1.7) * 3), 3, 3, '#5a3a24');
    // haunch
    px(c, x - 14, y - 15, 13, 15, '#9a7a3e');
    px(c, x - 14, y - 4, 13, 4, '#6e5628');
    px(c, x - 13, y - 2, 6, 2, '#8a6a34');               // hind paw
    // body / raised chest (breathes)
    px(c, x - 4, y - 18 + breath, 14, 18 - breath, '#a8843c');
    // front legs + paws
    px(c, x + 2, y - 9, 3, 9, '#8a6a34');
    px(c, x + 7, y - 9, 3, 9, '#8a6a34');
    px(c, x + 1, y - 2, 5, 2, '#6e5628');
    px(c, x + 6, y - 2, 5, 2, '#6e5628');
    // majestic mane with a jagged rim
    px(c, x + 1, y - 32 + hy, 17, 15, '#5a3a24');
    px(c, x, y - 28 + hy, 1, 6, '#8a5a2e');
    px(c, x + 2, y - 33 + hy, 3, 1, '#8a5a2e');
    px(c, x + 8, y - 34 + hy, 4, 1, '#8a5a2e');
    px(c, x + 15, y - 33 + hy, 3, 1, '#8a5a2e');
    px(c, x + 18, y - 27 + hy, 1, 5, '#8a5a2e');
    px(c, x + 1, y - 18 + hy, 3, 1, '#8a5a2e');
    // head + ear
    px(c, x + 6, y - 30 + hy, 9, 9, '#b08a48');
    px(c, x + 6, y - 32 + hy, 3, 2, '#8a6a34');
    // muzzle: open mid-roar, dignified otherwise
    if (roar) {
      px(c, x + 12, y - 27 + hy, 6, 3, '#d0aa6a');
      px(c, x + 12, y - 24 + hy, 6, 4, '#2a1810');
      px(c, x + 12, y - 24 + hy, 1, 1, '#e8d8a8');       // teeth
      px(c, x + 17, y - 24 + hy, 1, 1, '#e8d8a8');
      px(c, x + 16, y - 27 + hy, 2, 2, '#3a2418');       // nose
      c.globalAlpha = 0.45;                              // roar shockwave arcs
      px(c, x + 21, y - 28 + hy, 1, 6, '#e8d8a8');
      px(c, x + 24, y - 30 + hy, 1, 10, '#e8d8a8');
      px(c, x + 27, y - 32 + hy, 1, 14, '#e8d8a8');
      c.globalAlpha = 1;
    } else {
      px(c, x + 12, y - 26 + hy, 6, 4, '#d0aa6a');
      px(c, x + 16, y - 26 + hy, 2, 2, '#3a2418');       // nose
      px(c, x + 12, y - 22 + hy, 5, 1, '#8a6a34');       // mouth line
      px(c, x + 18, y - 25 + hy, 2, 1, '#e8d8a8');       // whiskers
    }
    // golden eye with a slow blink
    if ((t % 5) > 0.18) {
      px(c, x + 9, y - 28 + hy, 2, 2, '#ffd166');
      px(c, x + 9, y - 28 + hy, 1, 1, '#fff0b0');
    } else {
      px(c, x + 9, y - 27 + hy, 2, 1, '#3a2418');
    }
  }

  // ---------------------------------------------------------------------
  // DIALOGUE — the sons of Rabban Gamliel (Mishnah, Berakhot 2a)
  // ---------------------------------------------------------------------
  function sonsSuccess(g, viaDaf) {
    return g.cutscene(async function () {
      if (viaDaf) {
        await g.playerSay('רגע, יש לי את זה כתוב בדף! «מעשה שבאו בניו מבית המשתה... אמר להם: אם לא עלה עמוד השחר — חייבין אתם לקרות».');
      }
      await g.say('רגע... באמת?! עוד לא עלה עמוד השחר!', { who: 'sons', color: '#ffb0a0' });
      g.sfx('magic');
      await g.say('שְׁמַע יִשְׂרָאֵל ה׳ אֱלֹקֵינוּ ה׳ אֶחָד!!!', { who: 'sons', color: '#ffd166' });
      await g.say('...בכוונה עצומה. ראית איזו כוונה? הרגשנו אותה עד קצות הציפורניים.', { who: 'sons', color: '#ffb0a0' });
      await g.say('וזה בדיוק מה שאבא לימד אותנו: כל מה שאמרו חכמים עד חצות — מצוותן עד שיעלה עמוד השחר!', { who: 'sons', color: '#ffb0a0' });
      await g.say('ולמה אמרו חכמים עד חצות? כדי להרחיק את האדם מן העבירה!', { who: 'sons', color: '#ffb0a0' });
      await g.say('קח, מגיע לך — חותם חצות!', { who: 'sons', color: '#ffb0a0' });
      g.addSeal('midnight', 'חותם חצות');
      await g.playerSay('פסק ההלכה של רבן גמליאל בכבודו ובעצמו. ישר מהדף!');
    });
  }

  async function sonsTalk(g) {
    if (hasSealSafe(g, 'midnight')) {
      await g.say('הִיק... כלומר — סליחה, זה מכוח ההרגל. ההיקים כבר עברו לגמרי!', { who: 'sons', color: '#ffb0a0' });
      await g.say('קראנו שמע בזמן, ואנחנו אנשים חדשים. תמסור לאבא שאנחנו בדרך. אחרי עוד ריקוד אחד. קטן.', { who: 'sons', color: '#ffb0a0' });
      return;
    }
    g.sfx('hic');
    await g.say('הִיק! זְרַח! הַצִּילוּ!', { who: 'sons', color: '#ffb0a0' });
    await g.say('חזרנו מבית המשתה אחרי חצות!! לא קראנו שמע!! אבא יהרוג אותנו!!', { who: 'sons', color: '#ffb0a0' });
    await g.say('אבא זה רבן גמליאל, דרך אגב. הִיק. הנשיא. שום לחץ.', { who: 'sons', color: '#ffb0a0' });
    var going = true;
    while (going) {
      var pick = await g.choose([
        { text: 'מאוחר מדי, הלך עליכם.', value: 'wrong' },
        { text: 'אם לא עלה עמוד השחר — חייבין אתם לקרות!', value: 'right' },
        { text: 'רגע, אבדוק בדף.', value: 'daf' },
        { text: 'תנו לי רגע לחשוב.', value: 'leave' }
      ]);
      if (pick === 'wrong') {
        g.sfx('fail');
        await g.say('אוֹיָה!! אוֹי וַאֲבוֹי!! הִיק!!', { who: 'sons', color: '#ffb0a0' });
        g.sfx('hic');
        await g.say('רגע... אתה בטוח? זה ממש לא נשמע כמו משהו שאבא היה פוסק...', { who: 'sons', color: '#ffb0a0' });
        await g.playerSay('אמממ. אולי ננסה שוב.');
      } else if (pick === 'right') {
        await g.playerSay('אם לא עלה עמוד השחר — חייבין אתם לקרות!');
        going = false;
        await sonsSuccess(g, false);
      } else if (pick === 'daf') {
        if (g.has && g.has('daf')) {
          going = false;
          await sonsSuccess(g, true);
        } else {
          await g.playerSay('רגע... אין לי דף גמרא עליי. אולי כדאי לקחת אחד מבית המדרש.');
          await g.say('אנחנו מחכים. הִיק. לא זזים מפה. גם ככה קשה לזוז.', { who: 'sons', color: '#ffb0a0' });
        }
      } else {
        await g.say('תחשוב מהר!! השחר לא מחכה לאף אחד! הִיק!', { who: 'sons', color: '#ffb0a0' });
        going = false;
      }
    }
  }

  // ---------------------------------------------------------------------
  // DIALOGUE — the lion watchman (Gemara, Berakhot 3a: the three watches)
  // ---------------------------------------------------------------------
  var WATCH_NAMES = ['אשמורה ראשונה', 'אשמורה שנייה', 'אשמורה שלישית'];
  var WATCH_SIGNS = [
    { sign: 'חמור נוער', watch: 0, donkey: true },
    { sign: 'כלבים צועקים', watch: 1, donkey: false },
    { sign: 'תינוק יונק ואשה מספרת עם בעלה', watch: 2, donkey: false }
  ];

  function shuffled(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  async function lionQuiz(g) {
    g.sfx('quiz');
    await g.say('שלושה סימנים, שלוש אשמורות. אל תתבלבל — אני מתעטש כשטועים לי בהלכה.', { who: 'lion', color: '#ffd166' });
    var order = shuffled(WATCH_SIGNS);
    for (var q = 0; q < order.length; q++) {
      var item = order[q];
      var solved = false;
      var misses = 0;
      while (!solved) {
        await g.say('הסימן: «' + item.sign + '» — לאיזו אשמורה הוא שייך?', { who: 'lion', color: '#ffd166' });
        // rotate option order each question so it never feels fixed
        var opts = [];
        for (var k = 0; k < 3; k++) {
          var wi = (k + q + misses) % 3;
          opts.push({ text: WATCH_NAMES[wi], value: wi });
        }
        opts.push({ text: 'רגע, אחזור אליך.', value: -1 });
        var ans = await g.choose(opts);
        if (ans === -1) {
          await g.say('אני כאן כל הלילה. שלוש אשמורות, ליתר דיוק.', { who: 'lion', color: '#ffd166' });
          return false;
        }
        if (ans === item.watch) {
          solved = true;
          g.sfx('click');
          await g.say('נכון מאוד!', { who: 'lion', color: '#ffd166' });
          if (item.donkey) {
            // the donkey brays on cue, as contractually obligated
            donkeyBrayUntil = Date.now() + 1600;
            g.sfx('hic');
            await g.say('אִיָּה־אִיָּה!!', { who: 'donkey', color: '#c8b89a' });
            await g.say('כן, כן. הוא מאוד גאה בתפקיד.', { who: 'lion', color: '#ffd166' });
          }
        } else {
          misses++;
          g.sfx('roar');
          lionRoarUntil = Date.now() + 700;
          await g.say('אַפְּ... אַפְּצִ׳י־רְרְרוֹאָר!!', { who: 'lion', color: '#ffd166' });
          g.sfx('fail');
          await g.say('...סליחה. אמרתי לך שאני מתעטש. נסה שוב.', { who: 'lion', color: '#ffd166' });
          if (misses >= 2 && g.has && g.has('daf')) {
            await g.playerSay('אולי אציץ רגע בדף הגמרא שלי... «ראשונה חמור נוער, שנייה כלבים צועקים, שלישית תינוק יונק ואשה מספרת עם בעלה».');
          }
        }
      }
    }
    // all three matched
    await g.say('כל הסימנים במקומם! ראשונה — חמור נוער. שנייה — כלבים צועקים. שלישית — תינוק יונק ואשה מספרת עם בעלה.', { who: 'lion', color: '#ffd166' });
    g.sfx('click');
    await g.say('דִּינְג!', { x: 97, y: 96, color: '#ffd166' });
    await g.say('שעון הנוכחות מאשר: משמרת מוצלחת. קח — חותם המשמרות!', { who: 'lion', color: '#ffd166' });
    g.addSeal('watch', 'חותם המשמרות');
    await g.playerSay('שלוש משמרות הוי הלילה. עכשיו אני אזכור את זה לתמיד.');
    return true;
  }

  async function lionTalk(g) {
    if (hasSealSafe(g, 'watch')) {
      await g.say('שקט עכשיו. עד המשמרת הבאה — ואז, רְרְרוֹאָר קטן ומכובד.', { who: 'lion', color: '#ffd166' });
      await g.say('זכור: על כל משמר ומשמר יושב הקב״ה ושואג כארי. אני רק ההד המקומי.', { who: 'lion', color: '#ffd166' });
      return;
    }
    g.sfx('roar');
    lionRoarUntil = Date.now() + 900;
    await g.say('רְרְרוֹאָר!!', { who: 'lion', color: '#ffd166' });
    await g.playerSay('אַיי!! אריה!!');
    await g.say('רגוע, נער. זה לא אני — אני רק מצטרף לשאגה של מעלה.', { who: 'lion', color: '#ffd166' });
    await g.say('על כל משמר ומשמר יושב הקב״ה ושואג כארי. שלוש משמרות הוי הלילה — ואני שומר המשמרות של הכפר.', { who: 'lion', color: '#ffd166' });
    await g.say('אבל יש לי צרה: איבדתי את לוח המשמרות! בלי הסימנים אינני יודע מתי לשאוג.', { who: 'lion', color: '#ffd166' });
    await g.say('התאם לי כל סימן לאשמורה שלו — ואחתים לך את חותם המשמרות. עסקה?', { who: 'lion', color: '#ffd166' });
    var pick = await g.choose([
      { text: 'בטח! תן את הסימנים.', value: 'go' },
      { text: 'אולי אחר כך. יש לי חתונה לא־ללכת אליה.', value: 'later' }
    ]);
    if (pick === 'go') {
      await lionQuiz(g);
    } else {
      await g.say('אני כאן כל הלילה. שלוש אשמורות, ליתר דיוק.', { who: 'lion', color: '#ffd166' });
    }
  }

  // ---------------------------------------------------------------------
  // SCENE DEFINITION
  // ---------------------------------------------------------------------
  var roadScene = {
    name: 'הדרך מהחתונה',
    floor: { yMin: 124, yMax: 170 },

    paint: function (ctx, t, S) {
      var bg = getBG();
      if (bg) {
        ctx.drawImage(bg, 0, 0);
      } else {
        paintStatic(ctx); // fallback: draw static layer directly
      }
      drawStars(ctx, t);
      // gentle pulsing halo around the moon
      glow(ctx, 46, 26, 14, '#c9c9ee', 0.02 + 0.015 * Math.sin(t * 0.7));
      drawTentLife(ctx, t);
      drawDonkey(ctx, t);
      drawFence(ctx);
      drawFlame(ctx, 23, 96, t, 0);          // gate torch
      drawFlame(ctx, 57, 105, t, 2.4);       // booth lantern
      glow(ctx, 58, 107, 10, '#ffb347', 0.05);
      drawClockLive(ctx, t, S);
      drawFireflies(ctx, t);
      ambientSfx(t, S);
    },

    onEnter: async function (g) {
      try {
        if (g.flag && !g.flag('roadIntroDone')) {
          g.flag('roadIntroDone', true);
          await g.playerSay('הדרך אל מחוץ לכפר... מוזיקת חתונה מרחוק, וריח של ענבים.');
          g.sfx('hic');
          await g.say('הִיק!', { who: 'sons', color: '#ffb0a0' });
          await g.playerSay('ומשהו כאן נשמע שמח מדי בשביל אחרי חצות.');
        }
      } catch (e) { /* never crash on entry */ }
    },

    hotspots: [
      // --- the sons of Rabban Gamliel ---
      {
        id: 'sons',
        name: 'בני רבן גמליאל',
        type: 'char',
        x: 176, y: 120, w: 38, h: 28,
        walkTo: { x: 196, y: 152 },
        draw: function (ctx, t, S) { drawSons(ctx, t, S); },
        look: async function (g) {
          if (hasSealSafe(g, 'midnight')) {
            await g.playerSay('שני בחורים עומדים זקוף, זוהרים מקריאת שמע. פלא מה עושה עמוד שחר אחד שלא עלה.');
          } else {
            await g.playerSay('שני בחורים מתנדנדים בתיאום מושלם. כמו מקהלה — בלי שירה, עם הרבה הִיק.');
          }
        },
        talk: sonsTalk,
        take: async function (g) {
          await g.playerSay('אני לא סוחב אותם הביתה. הם כבדים, ושמחים מדי.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            if (hasSealSafe(g, 'midnight')) {
              await g.playerSay('«מעשה שבאו בניו מבית המשתה» — כבר סגרנו את הסיפור הזה. בכבוד.');
            } else {
              await sonsSuccess(g, true);
            }
          } else {
            await g.playerSay('הם צריכים פסק הלכה, לא את זה.');
          }
        }
      },

      // --- the lion watchman ---
      {
        id: 'lion',
        name: 'אריה השומר',
        type: 'char',
        x: 54, y: 108, w: 38, h: 34,
        walkTo: { x: 112, y: 146 },
        draw: function (ctx, t, S) { drawLion(ctx, t); },
        look: async function (g) {
          await g.playerSay('אריה מלכותי עם שעון נוכחות. הרעמה שלו מסורקת יותר טוב מהשיער שלי.');
        },
        talk: lionTalk,
        take: async function (g) {
          g.sfx('roar');
          lionRoarUntil = Date.now() + 700;
          await g.say('רְרְר... נסה שוב ותגלה כמה מהר נגמרת אשמורה.', { who: 'lion', color: '#ffd166' });
          await g.playerSay('נסוג. בכבוד. ובמהירות.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('«שלוש משמרות הוי הלילה, ועל כל משמר ומשמר יושב הקב״ה ושואג כארי».');
            await g.say('מדויק כמו שאגה בזמן. תלמיד חכם!', { who: 'lion', color: '#ffd166' });
          } else {
            await g.say('אני אריה, לא ארנק. דבר איתי.', { who: 'lion', color: '#ffd166' });
          }
        }
      },

      // --- the punch clock (flavor) ---
      {
        id: 'punchclock',
        name: 'שעון הנוכחות',
        type: 'object',
        x: 92, y: 98, w: 14, h: 20,
        walkTo: { x: 108, y: 144 },
        look: async function (g) {
          await g.playerSay('שעון נוכחות לאריות. שלוש החתמות בלילה, תנאים סוציאליים מצוינים.');
        },
        use: async function (g, itemId) {
          await g.say('רק חתולים גדולים מחתימים כאן.', { who: 'lion', color: '#ffd166' });
        }
      },

      // --- the donkey behind the vineyard fence ---
      {
        id: 'donkey',
        name: 'חמור',
        type: 'char',
        x: 242, y: 86, w: 44, h: 32,
        walkTo: { x: 264, y: 128 },
        look: async function (g) {
          await g.playerSay('חמור מאחורי גדר הכרם. נראה גאה בעצמו באופן חשוד.');
        },
        talk: async function (g) {
          donkeyBrayUntil = Date.now() + 1600;
          g.sfx('hic');
          await g.say('אִיָּה־אִיָּה!!', { who: 'donkey', color: '#c8b89a' });
          await g.playerSay('תרגום חופשי: «אני הסימן של האשמורה הראשונה, ואל תשכח את זה».');
        },
        take: async function (g) {
          await g.playerSay('הוא לא זז. כמו... טוב, כמו חמור.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('«משמרה ראשונה — חמור נוער». כתוב עליך בדף!');
            donkeyBrayUntil = Date.now() + 1600;
            g.sfx('hic');
            await g.say('אִיָּה!! (בגאווה)', { who: 'donkey', color: '#c8b89a' });
          } else {
            await g.playerSay('החמור מרים גבה. לחמורים אין גבות, וזה עדיין מרשים.');
          }
        }
      },

      // --- the distant wedding tent (flavor) ---
      {
        id: 'tent',
        name: 'אוהל החתונה',
        type: 'object',
        x: 232, y: 70, w: 84, h: 42,
        walkTo: { x: 272, y: 134 },
        look: async function (g) {
          await g.playerSay('אוהל החתונה. הצלליות רוקדות שם כבר שעות. מזל טוב!');
          await g.playerSay('...מעניין אם מישהו שם זוכר שצריך גם לקרוא שמע.');
        },
        talk: async function (g) {
          await g.playerSay('היי!! ... הם לא שומעים אותי מעל המוזיקה. וזו החתונה השלישית השבוע, לפי רבן גמליאל.');
        }
      },

      // --- the dropped wine jug (flavor) ---
      {
        id: 'jug',
        name: 'קנקן יין',
        type: 'object',
        x: 204, y: 142, w: 18, h: 17,
        walkTo: { x: 214, y: 160 },
        look: async function (g) {
          await g.playerSay('קנקן יין ריק. מוצג מרכזי בתיק «למה חזרנו רק אחרי חצות».');
        },
        take: async function (g) {
          await g.playerSay('לא נוגע. זו ראיה.');
        }
      },

      // --- exit back to the village square ---
      {
        id: 'exit-square',
        name: 'חזרה לכיכר הכפר',
        type: 'exit',
        x: 0, y: 96, w: 22, h: 72,
        walkTo: { x: 14, y: 150 },
        target: 'square',
        spawn: { x: 178, y: 126 }, // below the square's back gate, clear of the well
        look: async function (g) {
          await g.playerSay('השער חזרה לכיכר כפר ברכות. הלפיד עוד דולק — סימן שמחכים לי.');
        }
      }
    ]
  };

  if (window.GAME && typeof GAME.registerScene === 'function') {
    GAME.registerScene('road', roadScene);
  } else {
    console.warn('road.js: GAME.registerScene unavailable; scene not registered');
  }

})();
