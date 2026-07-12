'use strict';

// ============================================================================
// Scene: 'square' — the village square of Kfar Berakhot (hub scene).
// Night. Dithered indigo sky, stars, crescent moon, well, olive tree,
// laundry line with a tzitzit sock, sleeping cat, amber windows.
// Hotspots: gabbai Gershon (quest/recap), the pauper of the Braita,
// the well (Aramaic echo), Rashi the cat, the notice board, tzitzit sock,
// and 4 exits: beitmidrash / kohen / road / roof.
// ============================================================================

(function () {

  // --------------------------------------------------------------------------
  // Drawing helpers — delegate to SPRITES when available, fail soft otherwise.
  // --------------------------------------------------------------------------

  function px(ctx, x, y, w, h, c) {
    ctx.fillStyle = c;
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
      ctx.globalAlpha = Math.max(0, alpha * (i / 8));
      var rr = Math.round(r * i / 3);
      ctx.fillStyle = color;
      ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    ctx.restore();
  }

  function drawStar(ctx, x, y, t, size, phase) {
    if (window.SPRITES && SPRITES.star) { SPRITES.star(ctx, x, y, t + phase, size, '#e8e8ff'); return; }
    var a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2 + phase * 7));
    ctx.globalAlpha = a;
    ctx.fillStyle = '#e8e8ff';
    ctx.fillRect(x, y, 1, 1);
    if (size > 1) {
      ctx.globalAlpha = a * 0.5;
      ctx.fillRect(x - 1, y, 1, 1);
      ctx.fillRect(x + 1, y, 1, 1);
      ctx.fillRect(x, y - 1, 1, 1);
      ctx.fillRect(x, y + 1, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawMoon(ctx, x, y) {
    if (window.SPRITES && SPRITES.moon) { SPRITES.moon(ctx, x, y, 0.35); return; }
    // Fallback crescent: big disc minus an offset shadow disc, row by row.
    var R = 9, O = 8, ox = 4;
    ctx.fillStyle = '#e8e0b8';
    for (var dy = -R; dy <= R; dy++) {
      var w = Math.floor(Math.sqrt(R * R - dy * dy));
      var x1 = x - w, x2 = x + w;
      var end = x2;
      if (Math.abs(dy) <= O) {
        var w2 = Math.floor(Math.sqrt(O * O - dy * dy));
        end = Math.min(x2, x + ox - w2);
      }
      if (end > x1) ctx.fillRect(x1, y + dy, end - x1, 1);
    }
  }

  function drawMap(ctx, map, pal, x, y, scale, flip) {
    if (window.SPRITES && SPRITES.draw) { SPRITES.draw(ctx, map, pal, x, y, scale, flip); return; }
    scale = scale || 1;
    for (var r = 0; r < map.length; r++) {
      var row = map[r];
      for (var c = 0; c < row.length; c++) {
        var ch = flip ? row[row.length - 1 - c] : row[c];
        if (ch === '.' || ch === ' ') continue;
        var col = pal[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
      }
    }
  }

  // Safe state accessors (never crash on a missing engine method).
  function safeSeal(g, id) {
    try { return !!(g && g.hasSeal && g.hasSeal(id)); } catch (e) { return false; }
  }
  function safeFlag(g, name) {
    try { return g && g.flag ? g.flag(name) : false; } catch (e) { return false; }
  }
  function sfx(g, name) {
    try { if (g && g.sfx) g.sfx(name); } catch (e) { /* silent */ }
  }

  // --------------------------------------------------------------------------
  // Static star field (deterministic, filtered away from buildings/moon).
  // --------------------------------------------------------------------------

  var STARS = [];
  (function buildStars() {
    var s = 7;
    for (var i = 0; i < 40; i++) {
      s = (s * 73 + 19) % 997;
      var x = s % 320;
      s = (s * 73 + 19) % 997;
      var y = (s % 68) + 2;
      if (x < 76 && y > 50) continue;              // left house
      if (x > 244 && y > 32) continue;             // beit midrash wall
      if (x > 260 && y > 18) continue;             // dome
      if (x > 74 && x < 132 && y > 62) continue;   // olive tree canopy
      var dx = x - 206, dy = y - 28;
      if (dx * dx + dy * dy < 210) continue;       // moon area
      STARS.push({ x: x, y: y, size: (i % 5 === 0) ? 2 : 1, ph: i * 1.7 });
    }
  })();

  // --------------------------------------------------------------------------
  // Static background layer, painted once to an offscreen canvas.
  // --------------------------------------------------------------------------

  var bg = null;

  function buildBG() {
    if (typeof document === 'undefined' || !document.createElement) return;
    var c = document.createElement('canvas');
    c.width = 320; c.height = 180;
    var ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    // ---- sky: dithered indigo gradient bands ----
    px(ctx, 0, 0, 320, 28, '#0a0a23');
    dither(ctx, 0, 28, 320, 6, '#0a0a23', '#141440');
    px(ctx, 0, 34, 320, 28, '#141440');
    dither(ctx, 0, 62, 320, 6, '#141440', '#232366');
    px(ctx, 0, 68, 320, 50, '#232366');

    // ---- crescent moon ----
    drawMoon(ctx, 206, 28);

    // ---- distant house silhouettes behind the back wall ----
    px(ctx, 84, 76, 20, 16, '#1a1a38');
    px(ctx, 110, 72, 16, 20, '#181834');
    px(ctx, 132, 78, 20, 14, '#1a1a38');
    px(ctx, 200, 74, 18, 18, '#181834');
    px(ctx, 126, 62, 3, 18, '#101028');  // cypress
    px(ctx, 127, 58, 1, 5, '#101028');
    px(ctx, 90, 82, 2, 2, '#c98a3a');    // tiny lit windows
    px(ctx, 115, 80, 2, 2, '#c98a3a');
    px(ctx, 206, 80, 2, 2, '#8a6a2e');

    // ---- back wall with the road gate ----
    px(ctx, 72, 92, 176, 26, '#3f3f5e');
    px(ctx, 72, 90, 176, 3, '#565678');
    // stone seams
    var i;
    for (i = 0; i < 9; i++) {
      px(ctx, 78 + i * 19, 99, 5, 1, '#333350');
      px(ctx, 86 + i * 19, 109, 5, 1, '#333350');
    }
    // gate opening (arched) — moonlit road, tiny wedding tent far away
    px(ctx, 162, 90, 32, 28, '#101030');
    px(ctx, 166, 88, 24, 2, '#101030');
    px(ctx, 170, 86, 16, 2, '#101030');
    px(ctx, 162, 90, 32, 10, '#141440');            // far sky in opening
    px(ctx, 162, 100, 32, 18, '#26264a');           // far ground
    for (i = 0; i < 18; i++) {                      // road narrowing away
      var rw = 4 + Math.round(i * 0.9);
      px(ctx, 178 - Math.round(rw / 2), 117 - i, rw, 1, '#3d3d66');
    }
    px(ctx, 168, 97, 9, 3, '#d8c898');              // wedding tent
    px(ctx, 170, 95, 5, 2, '#d8c898');
    px(ctx, 172, 94, 1, 1, '#e8d8a8');
    px(ctx, 172, 98, 1, 2, '#ffb347');              // warm light in the tent
    // gate posts
    px(ctx, 158, 84, 4, 34, '#6b6b8f');
    px(ctx, 194, 84, 4, 34, '#6b6b8f');
    px(ctx, 157, 82, 6, 3, '#8f8fb0');
    px(ctx, 193, 82, 6, 3, '#8f8fb0');

    // ---- left house: the kohen's home ----
    px(ctx, 0, 58, 72, 60, '#4a4a68');
    px(ctx, 0, 54, 74, 5, '#5a5a7e');
    px(ctx, 0, 54, 74, 1, '#6d6d92');
    px(ctx, 30, 64, 22, 10, '#565678');   // plaster patches
    px(ctx, 6, 96, 16, 12, '#565678');
    px(ctx, 8, 42, 8, 13, '#4a4a68');     // chimney
    px(ctx, 7, 40, 10, 3, '#5a5a7e');
    // amber window (the signature warm light)
    px(ctx, 9, 70, 18, 16, '#2c2c44');
    dither(ctx, 11, 72, 14, 12, '#ffd166', '#ffb347');
    px(ctx, 17, 72, 1, 12, '#2c2c44');
    px(ctx, 11, 77, 14, 1, '#2c2c44');
    px(ctx, 9, 86, 18, 2, '#5a5a7e');
    // arched wooden door
    px(ctx, 32, 78, 24, 2, '#6b6b8f');
    px(ctx, 32, 80, 2, 38, '#6b6b8f');
    px(ctx, 54, 80, 2, 38, '#6b6b8f');
    px(ctx, 34, 84, 20, 34, '#241a10');
    px(ctx, 35, 86, 18, 32, '#5a3a24');
    px(ctx, 36, 82, 16, 3, '#5a3a24');
    px(ctx, 39, 80, 10, 2, '#5a3a24');
    for (i = 0; i < 5; i++) px(ctx, 38 + i * 3, 86, 1, 32, '#4a2f1c');
    px(ctx, 50, 102, 2, 2, '#c9a86a');    // handle
    px(ctx, 52, 90, 1, 4, '#e8d8a8');     // mezuzah on the doorpost
    // lantern bracket (flame is dynamic)
    px(ctx, 58, 84, 4, 1, '#3a3a4e');
    px(ctx, 59, 85, 5, 7, '#2c2c3e');
    px(ctx, 60, 87, 3, 4, '#7a5a20');
    // potted plant by the door
    px(ctx, 25, 110, 10, 2, '#b8663c');
    px(ctx, 26, 112, 8, 6, '#a2542f');
    px(ctx, 27, 105, 2, 5, '#2f7a4f');
    px(ctx, 30, 103, 2, 7, '#3f8a5c');
    px(ctx, 24, 107, 2, 4, '#2f7a4f');

    // ---- right building: the beit midrash ----
    px(ctx, 248, 36, 72, 82, '#565678');
    px(ctx, 248, 36, 72, 3, '#6d6d92');
    px(ctx, 264, 20, 44, 18, '#4e4e72');   // tower
    px(ctx, 270, 12, 32, 8, '#5a4a7e');    // dome
    px(ctx, 274, 8, 24, 4, '#6a5a92');
    px(ctx, 280, 5, 12, 3, '#7a6aa6');
    px(ctx, 285, 2, 2, 3, '#ffd166');      // finial
    // rose window (inner glow is dynamic)
    px(ctx, 281, 47, 11, 11, '#3a2c1e');
    dither(ctx, 283, 49, 7, 7, '#ffb347', '#ff8c42');
    px(ctx, 286, 48, 1, 9, '#3a2c1e');
    px(ctx, 282, 52, 9, 1, '#3a2c1e');
    // big arched double doors
    px(ctx, 264, 72, 44, 3, '#8f8fb0');
    px(ctx, 264, 75, 2, 43, '#8f8fb0');
    px(ctx, 306, 75, 2, 43, '#8f8fb0');
    px(ctx, 266, 78, 40, 40, '#2c1f14');
    px(ctx, 270, 78, 32, 4, '#5a3a24');
    px(ctx, 274, 75, 24, 3, '#5a3a24');
    px(ctx, 280, 73, 12, 2, '#5a3a24');
    px(ctx, 268, 82, 17, 36, '#5a3a24');
    px(ctx, 287, 82, 17, 36, '#5a3a24');
    for (i = 0; i < 5; i++) {
      px(ctx, 270 + i * 3, 84, 1, 34, '#4a2f1c');
      px(ctx, 289 + i * 3, 84, 1, 34, '#4a2f1c');
    }
    px(ctx, 285, 82, 2, 36, '#1a1208');    // seam (light pulses over it)
    px(ctx, 282, 100, 2, 2, '#c9a86a');    // handles
    px(ctx, 288, 100, 2, 2, '#c9a86a');
    // stone steps at the entrance
    px(ctx, 262, 114, 48, 2, '#8f8fb0');
    px(ctx, 264, 116, 44, 2, '#7c7c9e');
    // notice board on the wall left of the doors
    px(ctx, 246, 86, 18, 30, '#5a3a24');
    px(ctx, 248, 88, 14, 26, '#3a2c1e');
    px(ctx, 249, 90, 6, 7, '#e8d8a8');
    px(ctx, 256, 92, 6, 8, '#dcc890');
    px(ctx, 250, 99, 7, 6, '#e8d8a8');
    px(ctx, 256, 102, 6, 7, '#d0bc88');
    px(ctx, 251, 107, 5, 5, '#c94a3f');    // one urgent red notice
    px(ctx, 251, 90, 1, 1, '#8f8fb0');     // pins
    px(ctx, 258, 92, 1, 1, '#8f8fb0');
    px(ctx, 253, 99, 1, 1, '#8f8fb0');

    // ---- external stone staircase up to the roof ----
    for (i = 0; i < 9; i++) {
      var colH = (i + 1) * 4;
      px(ctx, 212 + i * 4, 118 - colH, 4, colH, '#6b6b8f');
      px(ctx, 212 + i * 4, 118 - colH, 4, 1, '#8f8fb0');
    }
    // railing
    for (i = 0; i < 9; i += 2) px(ctx, 213 + i * 4, 118 - (i + 1) * 4 - 5, 1, 5, '#4a4a68');
    px(ctx, 212, 108, 36, 1, '#4a4a68');
    // barrel at the stairs' foot
    px(ctx, 201, 107, 10, 11, '#7a512f');
    px(ctx, 202, 106, 8, 1, '#5a3a24');
    px(ctx, 201, 109, 10, 1, '#4a3a2a');
    px(ctx, 201, 114, 10, 1, '#4a3a2a');

    // ---- olive tree trunk (canopy sways, drawn dynamically) ----
    px(ctx, 95, 108, 6, 18, '#5a3a24');
    px(ctx, 96, 98, 5, 12, '#5a3a24');
    px(ctx, 97, 92, 4, 8, '#5a3a24');
    px(ctx, 92, 96, 5, 3, '#5a3a24');
    px(ctx, 100, 90, 6, 3, '#5a3a24');
    px(ctx, 95, 108, 2, 18, '#6d4a2e');
    px(ctx, 93, 124, 10, 2, '#4a3020');

    // ---- cobblestone floor ----
    px(ctx, 0, 118, 320, 62, '#2b2b44');
    for (var ry = 120; ry < 176; ry += 6) {
      var off = ((ry / 6) % 2) ? 5 : 0;
      for (var rx = -4 + off; rx < 322; rx += 10) {
        var v = ((rx * 13 + ry * 7) % 23 + 23) % 23;
        var col = v < 8 ? '#262640' : (v < 16 ? '#30304c' : '#3a3a5c');
        px(ctx, rx, ry, 8, 4, col);
      }
    }
    px(ctx, 0, 174, 320, 6, '#1f1f34');   // dark foreground edge
    // faint moonlight pool on the stones
    ctx.globalAlpha = 0.05;
    px(ctx, 190, 148, 32, 3, '#c8c8ff');
    px(ctx, 184, 151, 44, 4, '#c8c8ff');
    px(ctx, 190, 155, 32, 3, '#c8c8ff');
    ctx.globalAlpha = 1;

    bg = c;
  }

  // --------------------------------------------------------------------------
  // Dynamic layers (animated with t).
  // --------------------------------------------------------------------------

  function drawCanopy(ctx, t) {
    var sx = Math.round(Math.sin(t * 0.6) * 1.5);
    // dark mass
    px(ctx, 80 + sx, 74, 40, 4, '#24503a');
    px(ctx, 76 + sx, 78, 48, 14, '#24503a');
    px(ctx, 80 + sx, 92, 40, 6, '#24503a');
    px(ctx, 86 + sx, 98, 26, 4, '#24503a');
    // mid greens
    px(ctx, 82 + sx, 78, 20, 10, '#2f6a4a');
    px(ctx, 104 + sx, 80, 16, 12, '#2f6a4a');
    px(ctx, 88 + sx, 90, 24, 8, '#2f6a4a');
    // moonlit highlights
    px(ctx, 82 + sx, 76, 14, 4, '#3f8a5c');
    px(ctx, 100 + sx, 78, 10, 3, '#3f8a5c');
    px(ctx, 90 + sx, 88, 8, 3, '#3f8a5c');
    px(ctx, 84 + sx, 77, 2, 1, '#4fa06c');
    px(ctx, 102 + sx, 79, 2, 1, '#4fa06c');
    // olives
    px(ctx, 88 + sx, 84, 1, 1, '#1a1a2e');
    px(ctx, 108 + sx, 86, 1, 1, '#1a1a2e');
    px(ctx, 96 + sx, 95, 1, 1, '#1a1a2e');
    px(ctx, 114 + sx, 92, 1, 1, '#1a1a2e');
  }

  function drawLaundry(ctx, t) {
    // sagging rope from the house wall to the olive trunk
    ctx.globalAlpha = 0.7;
    for (var s = 0; s <= 1.001; s += 0.08) {
      var lx = Math.round(70 + 26 * s);
      var ly = Math.round(74 + 16 * s + Math.sin(Math.PI * s) * 3);
      px(ctx, lx, ly, 1, 1, '#aaaacc');
    }
    ctx.globalAlpha = 1;
    // little shirt
    var sw1 = Math.round(Math.sin(t * 1.5) * 1.2);
    px(ctx, 75 + sw1, 81, 7, 5, '#7ab0c8');
    px(ctx, 74 + sw1, 81, 1, 2, '#7ab0c8');
    px(ctx, 82 + sw1, 81, 1, 2, '#7ab0c8');
    px(ctx, 77 + sw1, 80, 1, 1, '#e63946');   // clothespin
    // THE sock with tzitzit
    var sw2 = Math.round(Math.sin(t * 1.5 + 1.4) * 1.2);
    px(ctx, 85 + sw2, 84, 3, 4, '#e8e8e8');
    px(ctx, 86 + sw2, 88, 3, 2, '#e8e8e8');
    px(ctx, 86 + sw2, 83, 1, 1, '#e63946');   // clothespin
    for (var k = 0; k < 4; k++) {
      var kc = (k === 1) ? '#4169c8' : '#e8e8e8';   // one tekhelet string
      var kw = ((k % 2) === 0) ? sw2 : Math.round(sw2 * 0.5);
      px(ctx, 86 + k + kw, 90, 1, 3, kc);
    }
    // small towel
    var sw3 = Math.round(Math.sin(t * 1.5 + 2.8) * 1.2);
    px(ctx, 91 + sw3, 87, 5, 4, '#c98a8a');
    px(ctx, 91 + sw3, 88, 5, 1, '#a86a6a');
  }

  function paint(ctx, t, S) {
    if (!bg) buildBG();
    if (bg) ctx.drawImage(bg, 0, 0);
    else px(ctx, 0, 0, 320, 180, '#0a0a23');

    var i;
    // twinkling stars + occasional shooting star
    for (i = 0; i < STARS.length; i++) {
      var st = STARS[i];
      drawStar(ctx, st.x, st.y, t, st.size, st.ph);
    }
    var sp = t % 21;
    if (sp < 0.6) {
      var fx = Math.round(60 + sp * 260), fy = Math.round(8 + sp * 40);
      ctx.globalAlpha = 1 - sp / 0.6;
      px(ctx, fx, fy, 2, 1, '#ffffff');
      px(ctx, fx - 3, fy - 1, 2, 1, '#b8b8e8');
      px(ctx, fx - 6, fy - 2, 2, 1, '#8888c8');
      ctx.globalAlpha = 1;
    }
    // moon halo
    glow(ctx, 206, 28, 14, '#e8e0b8', 0.06 + 0.02 * Math.sin(t * 0.8));

    // chimney smoke wisps
    for (i = 0; i < 3; i++) {
      var sy = (t * 7 + i * 9) % 27;
      ctx.globalAlpha = 0.3 * (1 - sy / 27);
      px(ctx, Math.round(10 + Math.sin((t + i * 2) * 1.3) * 2), Math.round(38 - sy), 3, 2, '#c8c8dc');
    }
    ctx.globalAlpha = 1;

    // blinking window in a distant silhouette
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 0.9);
    px(ctx, 137, 82, 2, 2, '#c98a3a');
    ctx.globalAlpha = 1;

    // festive light string over the gate (wedding vibes from the road)
    for (i = 0; i < 5; i++) {
      ctx.globalAlpha = 0.35 + 0.65 * ((Math.sin(t * 3 + i * 2.1) > 0) ? 1 : 0.25);
      px(ctx, 164 + i * 7, 91, 1, 1, (i % 2) ? '#ffd166' : '#ff8c42');
    }
    ctx.globalAlpha = 1;

    // olive tree canopy (sways) + laundry line
    drawCanopy(ctx, t);
    drawLaundry(ctx, t);

    // lantern flame by the kohen's door
    var fl = Math.sin(t * 11) + Math.sin(t * 17) * 0.5;
    px(ctx, 60, 87 + (fl > 0.4 ? 0 : 1), 3, fl > 0.4 ? 4 : 3, '#ffd166');
    px(ctx, 61, 88, 1, 2, '#ff8c42');
    glow(ctx, 61, 89, 5, '#ffb347', 0.22 + 0.05 * fl);

    // amber window glow + light spill on the ground
    glow(ctx, 18, 78, 8, '#ffd166', 0.18 + 0.04 * Math.sin(t * 2.3));
    for (i = 0; i < 4; i++) {
      ctx.globalAlpha = (0.1 + 0.02 * Math.sin(t * 2.3)) * (1 - i / 4);
      px(ctx, 6 + i, 118 + i * 2, 26 - i * 2, 2, '#ffd166');
    }
    ctx.globalAlpha = 1;

    // beit midrash: rose window glow + pulsing light seam + door spill
    glow(ctx, 286, 52, 7, '#ffb347', 0.2 + 0.05 * Math.sin(t * 1.9));
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 1.7);
    px(ctx, 285, 82, 2, 36, '#ffd166');
    ctx.globalAlpha = 1;
    glow(ctx, 286, 108, 8, '#ffb347', 0.14 + 0.03 * Math.sin(t * 1.7));
    for (i = 0; i < 5; i++) {
      ctx.globalAlpha = (0.09 + 0.02 * Math.sin(t * 1.7)) * (1 - i / 5);
      px(ctx, 270 - i, 118 + i * 2, 34 + i * 2, 2, '#ffd166');
    }
    ctx.globalAlpha = 1;

    // fireflies near the olive tree
    for (i = 0; i < 2; i++) {
      var ffx = Math.round(108 + Math.sin(t * 0.5 + i * 2.6) * 16);
      var ffy = Math.round(104 + Math.sin(t * 0.83 + i * 1.9) * 7);
      ctx.globalAlpha = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 2.7 + i * 3));
      px(ctx, ffx, ffy, 1, 1, '#d8ff8a');
    }
    ctx.globalAlpha = 1;
  }

  // --------------------------------------------------------------------------
  // Characters & animated hotspot props.
  // --------------------------------------------------------------------------

  var GABBAI_PAL = {
    h: '#1a1a2e', f: '#e8c8a0', b: '#e8e8e0',
    c: '#7a512f', d: '#5a3a24', w: '#ffd166', s: '#3a3a5c'
  };
  var GABBAI_MAP = [
    '...hhhhhh...',
    '..hhhhhhhh..',
    '.hhhhhhhhhh.',
    '...ffffff...',
    '...ffffff...',
    '..bffffffb..',
    '..bbbbbbbb..',
    '...bbbbbb...',
    '..cccccccc..',
    '..cccccccc..',
    '..ccwwcccc..',
    '..ccwwcccc..',
    '..cccccccc..',
    '..cccccccc..',
    '..cdccccdc..',
    '..cccccccc..',
    '..dccccccd..',
    '..dddddddd..',
    '...ssssss...',
    '...ss..ss...',
    '...ss..ss...',
    '...ss..ss...',
    '..sss..sss..',
    '..sss..sss..'
  ];

  function drawQmark(ctx, x, y, c) {
    px(ctx, x, y, 3, 1, c);
    px(ctx, x + 2, y + 1, 1, 1, c);
    px(ctx, x + 1, y + 2, 1, 1, c);
    px(ctx, x + 1, y + 4, 1, 1, c);
  }

  function drawGabbai(ctx, t) {
    // paces nervously left-right around x=60
    var cx = 60 + Math.sin(t * 0.7) * 5;
    var flip = Math.cos(t * 0.7) < 0;
    var x = Math.round(cx);
    var y = 140 - Math.round(Math.abs(Math.sin(t * 5)));
    drawMap(ctx, GABBAI_MAP, GABBAI_PAL, x - 6, y - 24, 1, flip);
    // eyes + nose (blink)
    if ((t % 3.4) > 0.15) {
      px(ctx, x - 3, y - 20, 1, 1, '#1a1a2e');
      px(ctx, x + 1, y - 20, 1, 1, '#1a1a2e');
    }
    px(ctx, x - 1, y - 19, 1, 1, '#d8a070');
    // arms: flailing in panic, or hanging while catching breath
    var panic = Math.sin(t * 2.3) > 0.45;
    if (panic) {
      px(ctx, x - 8, y - 22, 2, 8, '#7a512f');
      px(ctx, x + 6, y - 22, 2, 8, '#7a512f');
      px(ctx, x - 8, y - 24, 2, 2, '#e8c8a0');
      px(ctx, x + 6, y - 24, 2, 2, '#e8c8a0');
    } else {
      px(ctx, x - 7, y - 15, 2, 7, '#7a512f');
      px(ctx, x + 5, y - 15, 2, 7, '#7a512f');
      px(ctx, x - 7, y - 8, 2, 2, '#e8c8a0');
      px(ctx, x + 5, y - 8, 2, 2, '#e8c8a0');
    }
    // pocket-watch chain + glint
    px(ctx, x + 2, y - 13, 1, 1, '#c9a86a');
    if (((t * 2) % 1.9) < 0.12) px(ctx, x - 1, y - 14, 1, 1, '#ffffff');
    // a floating question mark — his watch shows one too
    var q = t % 4.5;
    if (q < 1.2) {
      ctx.globalAlpha = q < 0.3 ? q / 0.3 : (q > 0.9 ? (1.2 - q) / 0.3 : 1);
      drawQmark(ctx, x + 8, y - 34, '#ffd166');
      ctx.globalAlpha = 1;
    }
  }

  function drawPauper(ctx, t) {
    var x = 229, y = 154;
    // crate seat
    px(ctx, x - 8, y - 6, 18, 6, '#5a3a24');
    px(ctx, x - 8, y - 6, 18, 1, '#7a512f');
    // folded legs
    px(ctx, x - 7, y - 3, 13, 3, '#4a3a5c');
    // patched robe
    px(ctx, x - 5, y - 13, 11, 10, '#6b5a8c');
    px(ctx, x - 5, y - 13, 11, 1, '#7d6ba0');
    px(ctx, x - 4, y - 9, 2, 2, '#e63946');
    px(ctx, x + 3, y - 7, 2, 2, '#2f7a4f');
    // head (faces left, toward the square)
    px(ctx, x - 2, y - 18, 6, 4, '#e8c8a0');
    px(ctx, x - 2, y - 19, 6, 2, '#5a4a3a');
    if ((t % 3.7) > 0.15) {
      px(ctx, x - 1, y - 17, 1, 1, '#1a1a2e');
      px(ctx, x + 1, y - 17, 1, 1, '#1a1a2e');
    }
    px(ctx, x - 1, y - 15, 2, 1, '#a05a3a');   // content smile
    // arm cycle: raise pita, chew, lower
    var ph = (t * 0.9) % 3;
    var raise = ph < 0.6 ? ph / 0.6 : (ph < 1.4 ? 1 : (ph < 2 ? (2 - ph) / 0.6 : 0));
    var ay = Math.round(raise * 5);
    px(ctx, x - 7, y - 11 - ay, 3, 2, '#6b5a8c');
    px(ctx, x - 8, y - 12 - ay, 2, 2, '#e8c8a0');
    px(ctx, x - 12, y - 13 - ay, 5, 3, '#e8d8a8');   // the famous pita
    px(ctx, x - 12, y - 11 - ay, 5, 1, '#c9a86a');
    if (raise > 0.85 && Math.sin(t * 10) > 0) px(ctx, x - 1, y - 15, 1, 1, '#1a1a2e'); // chewing
    // salt bowl — the second course
    px(ctx, x + 9, y - 3, 6, 3, '#8f8fb0');
    px(ctx, x + 10, y - 4, 4, 1, '#f0f0f0');
    // crumbs
    px(ctx, x - 10, y - 1, 1, 1, '#e8d8a8');
    px(ctx, x - 4, y - 1, 1, 1, '#e8d8a8');
  }

  function drawCat(ctx, t) {
    var x = 181, y = 154;
    var br = (Math.sin(t * 1.8) > 0) ? 1 : 0;   // breathing
    // curled body
    px(ctx, x - 7, y - 5 - br, 14, 5 + br, '#c98a4b');
    px(ctx, x - 6, y - 6 - br, 12, 1, '#c98a4b');
    px(ctx, x - 4, y - 5 - br, 1, 3, '#a26a33');
    px(ctx, x - 1, y - 5 - br, 1, 3, '#a26a33');
    px(ctx, x + 2, y - 5 - br, 1, 3, '#a26a33');
    // tucked head
    px(ctx, x - 10, y - 6, 6, 5, '#d99a58');
    var tw = ((t % 6) < 0.25) ? 1 : 0;          // ear twitch
    px(ctx, x - 10, y - 7 - tw, 1, 1 + tw, '#c98a4b');
    px(ctx, x - 6, y - 7, 1, 1, '#c98a4b');
    px(ctx, x - 9, y - 4, 2, 1, '#7a4a20');     // closed eye
    // wrapped tail with a lazy flick
    var flick = ((t % 7) < 0.5) ? 1 : 0;
    px(ctx, x - 2, y - 1, 8, 1, '#a26a33');
    px(ctx, x + 5, y - 2 - flick, 2, 1, '#a26a33');
    // drifting Zzz
    var zp = (t % 2.8) / 2.8;
    ctx.globalAlpha = 0.8 * (1 - zp);
    var zx = x - 13 - Math.round(zp * 3), zy = y - 10 - Math.round(zp * 8);
    px(ctx, zx, zy, 3, 1, '#cfcfe8');
    px(ctx, zx + 1, zy + 1, 1, 1, '#cfcfe8');
    px(ctx, zx, zy + 2, 3, 1, '#cfcfe8');
    ctx.globalAlpha = 1;
  }

  function drawWell(ctx, t) {
    // little gabled roof on wooden posts
    px(ctx, 136, 112, 3, 26, '#5a3a24');
    px(ctx, 157, 112, 3, 26, '#5a3a24');
    px(ctx, 133, 110, 30, 3, '#7a512f');
    px(ctx, 131, 108, 34, 2, '#5a3a24');
    px(ctx, 135, 106, 26, 2, '#7a512f');
    px(ctx, 140, 104, 16, 2, '#5a3a24');
    // rope + swaying bucket
    var sway = Math.round(Math.sin(t * 1.2) * 2);
    px(ctx, 147, 113, 1, 5, '#c9a86a');
    px(ctx, 147 + Math.round(sway / 2), 118, 1, 5, '#c9a86a');
    px(ctx, 144 + sway, 123, 7, 5, '#7a512f');
    px(ctx, 144 + sway, 125, 7, 1, '#4a3a2a');
    // crank handle
    px(ctx, 160, 111, 4, 1, '#8f8fb0');
    px(ctx, 163, 109, 1, 3, '#8f8fb0');
    // stone body
    px(ctx, 135, 136, 26, 2, '#8f8fb0');
    px(ctx, 133, 138, 30, 12, '#6b6b8f');
    px(ctx, 133, 150, 30, 2, '#4a4a68');
    var i;
    for (i = 0; i < 6; i++) px(ctx, 136 + i * 5, 141, 1, 4, '#4a4a68');
    px(ctx, 139, 136, 18, 3, '#0f0f28');   // dark mouth
    // pigeon dozing on the roof, head bobbing
    var hb = (Math.sin(t * 3) > 0.5) ? 1 : 0;
    px(ctx, 149, 101, 4, 3, '#9f9fb8');
    px(ctx, 152, 100 + hb, 2, 2, '#9f9fb8');
    px(ctx, 154, 101 + hb, 1, 1, '#ffb347');
  }

  // --------------------------------------------------------------------------
  // Dialogue — Gershon the gabbai (quest giver + seal recap).
  // --------------------------------------------------------------------------

  async function talkGabbai(g) {
    function gs(text) { return g.say(text, { who: 'gabbai', color: '#ffd166' }); }

    if (!safeFlag(g, 'metGabbai')) {
      g.flag('metGabbai', true);
      await gs('זרח! ברוך שמצאתי אותך! אסון! שֶׁבֶר! קטסטרופה עם ניקוד!');
      await g.playerSay('גרשון, לאט. נשימה עמוקה. מה קרה?');
      await gs('שכחנו מתי קוראים שמע של ערבית! כל הכפר! אף אחד לא זוכר!');
      await gs('וארון הזמנים בבית המדרש... נעל את עצמו! הוא מסרב להיפתח!');
      await g.playerSay('ארונות לא נועלים את עצמם סתם ככה.');
      await gs('הוא ייפתח רק למי שיאסוף שלושה חותמות ויענה על שאלות הדף. שלושה! חותמות!');
      await g.playerSay('ואיך בדיוק כפר שלם שוכח מה השעה?');
      await gs('...בוא לא ניכנס לשאלת האשמה. (מכרתי בטעות את תחושת הזמן של הקהילה במכירת חצר. אל תשפוט.)');
    }

    var looping = true;
    while (looping) {
      var v = await g.choose([
        { text: 'אילו חותמות עוד חסרים לי?', value: 'seals' },
        { text: 'איפה משיגים את החותמות?', value: 'where' },
        { text: 'מה השעה עכשיו, גרשון?', value: 'time' },
        { text: 'תזכיר לי — מה השאלה הגדולה?', value: 'question' },
        { text: 'אני על זה. שמע ישראל בדרך!', value: 'bye' }
      ]);

      if (v === 'seals') {
        var hasStars = safeSeal(g, 'stars');
        var hasMid = safeSeal(g, 'midnight');
        var hasWatch = safeSeal(g, 'watch');
        if (hasStars && hasMid && hasWatch) {
          await gs('שלושה חותמות?! ואתה עומד פה ומדבר איתי?!');
          await gs('לבית המדרש! הארון! רוץ כמו שליח ציבור שאיחר!');
          looping = false;
        } else {
          if (hasStars) await gs('חותם הכוכבים — יש לך! ידעתי שאפשר לסמוך עליך!');
          else await gs('חותם הכוכבים — עדיין אצל הכהן פנחס. הבית עם החלון המואר, משמאל.');
          if (hasMid) await gs('חותם חצות — אצלך! בני רבן גמליאל בטח קוראים שמע ברגע זה.');
          else await gs('חותם חצות — אצל בני רבן גמליאל, בדרך מהחתונה. מעבר לשער.');
          if (hasWatch) await gs('חותם המשמרות — יש! איך הסתדרת עם האריה?! לא, אל תספר לי.');
          else await gs('חותם המשמרות — אצל שומר הלילה שבדרך. הוא... איך לומר... אריה. אריה אמיתי. עם שעון נוכחות.');
        }
      } else if (v === 'where') {
        await gs('חותם הכוכבים — אצל הכהן פנחס. הבית עם החלון המואר משמאל. הוא מבין בכוכבים. וברעב.');
        await gs('חותם חצות וחותם המשמרות — בדרך מהחתונה, מעבר לשער שמאחוריי.');
        await gs('ואם תסתבך — יש ספר גמרא ענק בבית המדרש. ענק. תיזהר שלא ייפול עליך.');
      } else if (v === 'time') {
        await gs('רגע, יש לי שעון כיס!');
        sfx(g, 'click');
        await gs('השעון מראה... סימן שאלה.');
        await gs('אתמול הוא הראה שני סימני שאלה. אז יש שיפור.');
        await g.playerSay('אולי בגלל זה ההלכה הולכת לפי השמים ולא לפי שעונים.');
        await gs('אל תתחכם. רגע — כן, תתחכם! זה בדיוק מה שאנחנו צריכים עכשיו!');
      } else if (v === 'question') {
        await gs('«מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִית?» — המילים הראשונות של כל התלמוד!');
        await gs('דף ב עמוד א. ההתחלה של הכול. ואנחנו שכחנו את התשובה.');
        await gs('אם בכפר שליד ישמעו על זה — אני עובר לגור בתוך הבאר.');
        await g.playerSay('שתדע, הבאר מדברת רק ארמית.');
      } else {
        await gs('רוץ, זרח! ואם תפגוש את תחושת הזמן שלי — היא עונה לשם "בערך".');
        looping = false;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Dialogue — the pauper of the Braita (Berakhot 2b: bread with salt).
  // --------------------------------------------------------------------------

  async function talkPauper(g) {
    function ps(text) { return g.say(text, { who: 'pauper', color: '#e8d8a8' }); }

    if (!safeFlag(g, 'metPauper')) {
      g.flag('metPauper', true);
      await ps('ערב טוב, בחור! הצטרף לסעודה! מנה ראשונה: פת. מנה שנייה: מלח.');
      await g.playerSay('ו... מנה עיקרית?');
      await ps('פת במלח! שף, אל תמהר — תן לזה להגיע.');
    }

    var looping = true;
    while (looping) {
      var v = await g.choose([
        { text: 'מי אתה בעצם?', value: 'who' },
        { text: 'מה הקשר בינך לבין הזמן?', value: 'clock' },
        { text: 'איך האוכל?', value: 'food' },
        { text: 'בתיאבון! להתראות.', value: 'bye' }
      ]);

      if (v === 'who') {
        await ps('אני העני מהברייתא! דף ב עמוד ב: «מִשָּׁעָה שֶׁהֶעָנִי נִכְנָס לֶאֱכֹל פִּתּוֹ בְּמֶלַח».');
        await ps('אני לא סתם עני — אני סימן זמן הלכתי מהלך!');
        await ps('אנשים שואלים אותי מה השעה. אני עונה: שעת ארוחת הערב שלי. מדויק להפליא.');
        await ps('אני לא עני. אני שעון!');
      } else if (v === 'clock') {
        await ps('כשמחשיך — אני נכנס לאכול. עני כמוני לא מבזבז שמן על נרות, אז אוכלים עם ערב, מוקדם.');
        await ps('הברייתא מונה את הזמן שלי כאחד הסימנים לתחילת זמן קריאת שמע של ערבית!');
        await ps('ויש אומרים: עני וכהן — שיעור אחד הוא. אני והכהן פנחס אוכלים באותה שעה.');
        await ps('הוא בתרומה, אני במלח. לכל אחד הגורמה שלו.');
        await g.playerSay('שני שעונים חיים בכפר אחד. מי צריך צאת הכוכבים... רגע. כן צריך.');
      } else if (v === 'food') {
        await ps('מרהיב. הפת: תווים עמוקים של קמח, רמזים עדינים של אפייה.');
        await ps('המלח: נועז, ים־תיכוני, עם גימור... מלוח.');
        await ps('מבקר המסעדות נתן לי כוכב. לקחתי אותו. זה בטח אחד משלושת כוכבי צאת הכוכבים.');
        await g.playerSay('אני די בטוח שזה לא עובד ככה.');
      } else {
        await ps('תבוא מחר! יהיה בדיוק אותו תפריט. יציבות — זה כל הסוד בהלכה.');
        looping = false;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Scene registration.
  // --------------------------------------------------------------------------

  if (!window.GAME || typeof GAME.registerScene !== 'function') {
    console.warn('square.js: GAME engine not found, scene not registered');
    return;
  }

  GAME.registerScene('square', {
    name: 'כיכר כפר ברכות',
    floor: { yMin: 118, yMax: 172 },
    paint: paint,

    onEnter: async function (g) {
      try { if (window.AUDIO && AUDIO.music) AUDIO.music('night'); } catch (e) { /* silent */ }
      if (!safeFlag(g, 'squareSeen')) {
        g.flag('squareSeen', true);
      }
    },

    hotspots: [

      // ---- Gershon the gabbai ----
      {
        id: 'gabbai', name: 'הגבאי גרשון', type: 'char',
        x: 44, y: 112, w: 32, h: 28,
        walkTo: { x: 84, y: 144 },
        draw: function (ctx, t) { drawGabbai(ctx, t); },
        look: async function (g) {
          await g.playerSay('גרשון הגבאי. מזיע, מנופף בידיים, ובודק כל שנייה שעון שמראה סימן שאלה.');
        },
        talk: talkGabbai,
        take: async function (g) {
          await g.playerSay('לגבאי יש כלל ברזל: אף אחד לא מרים את הגבאי.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.say('הדף! תחזיק אותו חזק! כל התשובות שם — דף ב עמוד א!', { who: 'gabbai', color: '#ffd166' });
          } else {
            await g.playerSay('מה שיעזור לגרשון זה חותמות, לא זה.');
          }
        }
      },

      // ---- the pauper of the Braita ----
      {
        id: 'pauper', name: 'העני של הברייתא', type: 'char',
        x: 216, y: 134, w: 28, h: 20,
        walkTo: { x: 206, y: 158 },
        draw: function (ctx, t) { drawPauper(ctx, t); },
        look: async function (g) {
          await g.playerSay('העני של הברייתא. לבוש טלאים, מחייך כמו מי שיודע שהוא מקור תנאי.');
        },
        talk: talkPauper,
        take: async function (g) {
          await g.playerSay('אי אפשר לקחת שעון ציבורי. גם כשהוא אוכל פיתה.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.say('«מִשָּׁעָה שֶׁהֶעָנִי נִכְנָס לֶאֱכֹל פִּתּוֹ בְּמֶלַח» — הנה אני! אני בדף! שמור לי חתימה.', { who: 'pauper', color: '#e8d8a8' });
          } else {
            await g.say('תודה, אבל יש לי כל מה שצריך: פת. וגם מלח.', { who: 'pauper', color: '#e8d8a8' });
          }
        }
      },

      // ---- the well ----
      {
        id: 'well', name: 'הבאר', type: 'object',
        x: 128, y: 104, w: 40, h: 48,
        walkTo: { x: 148, y: 158 },
        draw: function (ctx, t) { drawWell(ctx, t); },
        look: async function (g) {
          await g.playerSay('הַלּוֹ...?');
          await g.say('...לוֹ? ...לוֹ?', { who: 'well', color: '#8fd0e8' });
          await g.playerSay('מי שם?');
          await g.say('מַאי?', { who: 'well', color: '#8fd0e8' });
          await g.playerSay('באר שעונה בארמית. הגיוני לגמרי בכפר שלומד גמרא.');
        },
        take: async function (g) {
          await g.playerSay('לקחת באר. בטח. אשים אותה בכיס, ליד עמוד השחר שאבד.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('לזרוק את הדף לבאר?! יש גבול לניסויים מדעיים.');
            return;
          }
          if (itemId) {
            sfx(g, 'hic');
            await g.playerSay('*פְּלוּנְק!* ...בסדר, בסדר, שלפתי את זה בחזרה.');
            await g.say('מַאי דָּא?!', { who: 'well', color: '#8fd0e8' });
          } else {
            sfx(g, 'hic');
            await g.playerSay('זרקתי חלוק אבן קטן. *פלונק.*');
            await g.say('מַאי?', { who: 'well', color: '#8fd0e8' });
            await g.playerSay('אין לי מושג. בשביל זה אני פה.');
          }
        }
      },

      // ---- Rashi the cat ----
      {
        id: 'cat', name: 'רש"י החתול', type: 'char',
        x: 168, y: 142, w: 24, h: 12,
        walkTo: { x: 196, y: 158 },
        draw: function (ctx, t) { drawCat(ctx, t); },
        look: async function (g) {
          await g.playerSay('חתול הכפר, רש"י. ישן על אבן חמה, תמיד בצד הפנימי של הדף.');
        },
        talk: async function (g) {
          await g.playerSay('רש"י? אתה ער?');
          await g.say('...מְיָאו.', { who: 'cat', color: '#ffb347' });
          await g.playerSay('מה הפירוש?');
          await g.say('מְיָאו. פירוש: מיאו.', { who: 'cat', color: '#ffb347' });
          await g.playerSay('הפירוש הכי ברור ששמעתי היום.');
        },
        take: async function (g) {
          await g.playerSay('אני מרים אותו בעדינות...');
          await g.say('מְיָאוּ?! אמרו חכמים: אין מגביהין חתול מעל אבן חמה!', { who: 'cat', color: '#ffb347' });
          await g.playerSay('רגע... זה לא כתוב בדף.');
          await g.say('זה לא בדף. זה חתול.', { who: 'cat', color: '#ffb347' });
          sfx(g, 'snore');
          await g.playerSay('והוא חזר לישון. ניצחון חתולי בנקודות.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('רש"י מרחרח את הדף... ונרדם עליו.');
            await g.playerSay('מעולה. עכשיו יש לדף פירוש רש"י מלמעלה.');
          } else {
            await g.playerSay('רש"י פותח עין אחת, מריח... ולא מתרשם. חתולים.');
          }
        }
      },

      // ---- the notice board ----
      {
        id: 'board', name: 'לוח המודעות', type: 'object',
        x: 244, y: 84, w: 22, h: 32,
        walkTo: { x: 252, y: 124 },
        look: async function (g) {
          var o = { x: 253, y: 80, color: '#e8d8a8' };
          await g.say('לוח המודעות של כפר ברכות:', o);
          await g.say('«אבד: עמוד השחר. המוצא הישר מתבקש להחזירו לפני הבוקר.»', o);
          await g.say('«דרוש: שומר לילה. ניסיון בשאגות — יתרון משמעותי.»', o);
          await g.say('«שיעור הדף היומי נדחה עד שהארון ייפתח. באשמת... לא חשוב. — הגבאי»', o);
          await g.say('ובפינה, קלף ישן: «מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִית? מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן»', o);
          await g.playerSay('כהנים... תרומה... רגע — זה בדיוק הבית של פנחס הכהן! החלון המואר משמאל!');
        },
        take: async function (g) {
          await g.playerSay('לגנוב את לוח המודעות? עוד יפרסמו עליי מודעה.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('לתלות את הדף על הלוח? ואז ממה אלמד — מהמודעה על עמוד השחר?');
          } else {
            await g.playerSay('הלוח מלא. אפילו הפינות תפוסות.');
          }
        }
      },

      // ---- the tzitzit sock on the laundry line ----
      {
        id: 'sock', name: 'גרב עם ציצית', type: 'object',
        x: 82, y: 82, w: 9, h: 12,
        walkTo: { x: 88, y: 124 },
        look: async function (g) {
          await g.playerSay('גרב אחת על חבל הכביסה — עם ציצית. מהדרין מן המהדרין.');
          await g.playerSay('אפילו חוט תכלת יש לה. לגרב.');
        },
        take: async function (g) {
          await g.playerSay('היא עוד רטובה. וגם — ציצית של מישהו אחר לא לוקחים.');
        }
      },

      // ---- exit: beit midrash (big arched doors, right) ----
      {
        id: 'exit_beitmidrash', name: 'בית המדרש', type: 'exit',
        x: 266, y: 66, w: 42, h: 52,
        target: 'beitmidrash',
        walkTo: { x: 286, y: 124 },
        spawn: { x: 30, y: 142 }, // beitmidrash door is at its far left
        look: async function (g) {
          await g.playerSay('דלתות בית המדרש. מבפנים בוקע אור חם — וויכוח. כנראה על השאלה מתי מותר להתווכח.');
        }
      },

      // ---- exit: the kohen's house (left, amber window) ----
      {
        id: 'exit_kohen', name: 'בית הכהן פנחס', type: 'exit',
        x: 32, y: 78, w: 25, h: 40,
        target: 'kohen',
        walkTo: { x: 45, y: 124 },
        spawn: { x: 296, y: 134 }, // kohen door is at its far right
        look: async function (g) {
          await g.playerSay('ביתו של פנחס הכהן. החלון מואר, ומבפנים נשמע... קרקור בטן?');
        }
      },

      // ---- exit: the road (background gate) ----
      {
        id: 'exit_road', name: 'הדרך מהחתונה', type: 'exit',
        x: 158, y: 82, w: 40, h: 36,
        target: 'road',
        walkTo: { x: 178, y: 120 },
        spawn: { x: 30, y: 150 }, // road gate is at its far left
        look: async function (g) {
          await g.playerSay('השער אל הדרך. רחוק שם מהבהבת חתונה, שומעים חליל... ושאגות?');
        }
      },

      // ---- exit: the roof (external stone staircase) ----
      {
        id: 'exit_roof', name: 'המדרגות לגג', type: 'exit',
        x: 210, y: 76, w: 36, h: 42,
        target: 'roof',
        walkTo: { x: 220, y: 122 },
        spawn: { x: 34, y: 146 }, // roof stairs opening is at its far left
        look: async function (g) {
          await g.playerSay('מדרגות אבן אל גג המצפה. משם רואים את כל השמים. וגם את הכביסה של השכנים.');
        }
      }
    ]
  });

})();
