'use strict';

// ============================================================================
// Scene: 'square' — כיכר כפר שבתא (hub scene, player starts here).
// Erev Shabbat dusk: warm gold/rose/amber sky sliding to violet at the edges,
// a well, an alley mouth toward the frozen courtyard, a gate toward the
// market (setting sun beyond it), external stairs to the roof, and the beit
// midrash with its notice board. Windows light with Shabbat candles
// progressively as t increases and as seals are collected.
// Hotspots: הכרוז זבדיה (recap NPC), חנה מוכרת הדגים, עוקצין החתול,
// לוח המודעות, הבאר, and 4 exits: courtyard / market / beitmidrash / roof.
// No seal puzzle of its own — pure flavor + navigation hub.
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
      ctx.globalAlpha = Math.max(0, alpha * (i / 8));
      var rr = Math.round(r * i / 3);
      ctx.fillStyle = color;
      ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    ctx.restore();
  }

  function twinkle(ctx, x, y, t, size, color, phase) {
    if (window.SPRITES && typeof SPRITES.star === 'function') {
      try { SPRITES.star(ctx, x, y, t + phase, size, color); return; } catch (e) { /* fall through */ }
    }
    var a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2 + phase * 7));
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
    ctx.globalAlpha = 1;
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
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function sealCount(S) {
    return (S && S.seals && S.seals.length) || 0;
  }

  // --------------------------------------------------------------------------
  // Palette (dusk — erev Shabbat, per art direction).
  // --------------------------------------------------------------------------

  var SKY_TOP = '#241636';
  var SKY_VIOLET = '#3a2050';
  var SKY_ROSE = '#7a3d5c';
  var SKY_GOLD = '#d97a4a';
  var SKY_HORIZON = '#ffb347';
  var STONE1 = '#4a4a68';
  var STONE2 = '#6b6b8f';
  var STONE3 = '#8f8fb0';
  var WOOD1 = '#5a3a24';
  var WOOD2 = '#7a512f';
  var WARM1 = '#ffd166';
  var WARM2 = '#ffb347';
  var WARM3 = '#ff8c42';
  var PARCH = '#e8d8a8';
  var ACCENT_RED = '#e63946';
  var ACCENT_PURPLE = '#a26bd4';
  var COBBLE1 = '#332944';
  var COBBLE2 = '#3f3350';
  var COBBLE3 = '#4b3d5c';

  // --------------------------------------------------------------------------
  // Sparse violet-corner stars (dusk sky is mostly warm; only the far
  // top corners still show the fading violet night behind it).
  // --------------------------------------------------------------------------

  var STARS = [
    { x: 8, y: 6, size: 1, ph: 0.4 },
    { x: 22, y: 14, size: 1, ph: 1.9 },
    { x: 14, y: 24, size: 2, ph: 3.1 },
    { x: 296, y: 8, size: 1, ph: 2.2 },
    { x: 308, y: 18, size: 1, ph: 0.7 },
    { x: 288, y: 22, size: 1, ph: 4.4 }
  ];

  // --------------------------------------------------------------------------
  // Static background layer, painted once to an offscreen canvas.
  // Everything here does NOT need depth-sorting against the player.
  // --------------------------------------------------------------------------

  var bg = null;

  function buildBG() {
    if (typeof document === 'undefined' || !document.createElement) return;
    var c = document.createElement('canvas');
    c.width = 320; c.height = 180;
    var ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    // ---- sky: dithered dusk gradient, violet top sliding to gold horizon ----
    px(ctx, 0, 0, 320, 14, SKY_TOP);
    dither(ctx, 0, 14, 320, 5, SKY_TOP, SKY_VIOLET);
    px(ctx, 0, 19, 320, 15, SKY_VIOLET);
    dither(ctx, 0, 34, 320, 5, SKY_VIOLET, SKY_ROSE);
    px(ctx, 0, 39, 320, 16, SKY_ROSE);
    dither(ctx, 0, 55, 320, 5, SKY_ROSE, SKY_GOLD);
    px(ctx, 0, 60, 320, 18, SKY_GOLD);
    dither(ctx, 0, 78, 320, 5, SKY_GOLD, SKY_HORIZON);
    px(ctx, 0, 83, 320, 13, SKY_HORIZON);

    // ---- distant hill silhouette, low along the horizon ----
    px(ctx, 0, 92, 320, 8, '#2a1c3a');
    px(ctx, 96, 88, 60, 6, '#2a1c3a');
    px(ctx, 210, 86, 70, 8, '#2a1c3a');
    px(ctx, 280, 90, 40, 5, '#2a1c3a');
    // a couple of distant cypress trees on the ridge
    px(ctx, 118, 80, 2, 9, '#221631');
    px(ctx, 236, 78, 2, 10, '#221631');

    // ---- setting sun, low in the market gate's opening ----
    glow(ctx, 190, 92, 20, WARM2, 0.10);
    px(ctx, 180, 84, 20, 20, WARM1);
    px(ctx, 182, 84, 16, 2, '#fff2c9');
    px(ctx, 180, 100, 20, 4, SKY_HORIZON); // lower rim melts into the horizon band

    // ---- left house ----
    px(ctx, 0, 54, 58, 64, STONE1);
    px(ctx, 0, 50, 60, 5, STONE2);
    px(ctx, 0, 50, 60, 1, STONE3);
    px(ctx, 24, 62, 20, 10, '#565678'); // plaster patch
    px(ctx, 4, 100, 14, 12, '#565678');
    px(ctx, 8, 38, 8, 13, WOOD1); // chimney
    px(ctx, 7, 36, 10, 3, WOOD2);
    // candle window (dark base — dynamic layer lights it up over time)
    px(ctx, 12, 68, 18, 16, '#241c30');
    px(ctx, 14, 70, 14, 12, '#150f1e');
    px(ctx, 20, 70, 1, 12, '#241c30');
    px(ctx, 14, 75, 14, 1, '#241c30');
    px(ctx, 12, 84, 18, 2, STONE2);

    // ---- courtyard alley mouth (recessed passage toward the frozen alley) ----
    px(ctx, 58, 62, 36, 56, STONE1);
    px(ctx, 58, 60, 36, 3, STONE2);
    px(ctx, 65, 66, 22, 52, '#140f1c'); // dark passage
    px(ctx, 67, 68, 18, 48, '#0e0a15'); // deeper shadow
    // torch bracket at the alley mouth (flame drawn dynamically)
    px(ctx, 60, 78, 3, 2, WOOD1);
    px(ctx, 61, 74, 2, 5, WOOD1);
    // the faintest hint of a frozen figure, deep in the shadow (teaser)
    px(ctx, 78, 96, 3, 10, '#1e1826');
    px(ctx, 76, 92, 3, 4, '#1e1826');

    // ---- back wall spanning to the roof stairs, with the market gate cut in ----
    px(ctx, 94, 94, 130, 24, STONE1);
    px(ctx, 94, 92, 130, 3, STONE2);
    var i;
    for (i = 0; i < 7; i++) px(ctx, 100 + i * 18, 102, 5, 1, '#3a3a56');
    // market gate opening (sky + sun + distant stalls already painted behind
    // the wall, so the opening itself is simply left unpainted here)
    px(ctx, 160, 88, 4, 30, STONE3);
    px(ctx, 194, 88, 4, 30, STONE3);
    px(ctx, 158, 84, 42, 4, STONE2);
    // tiny distant market stall silhouette glimpsed through the gate
    px(ctx, 172, 96, 16, 8, '#241c30');
    px(ctx, 174, 92, 4, 4, '#241c30');
    px(ctx, 182, 92, 4, 4, '#241c30');

    // ---- external stone staircase up to the roof ----
    for (i = 0; i < 9; i++) {
      var colH = (i + 1) * 4;
      px(ctx, 210 + i * 4, 118 - colH, 4, colH, STONE3);
      px(ctx, 210 + i * 4, 118 - colH, 4, 1, '#c9c9e0');
    }
    for (i = 0; i < 9; i += 2) px(ctx, 211 + i * 4, 118 - (i + 1) * 4 - 5, 1, 5, STONE1);
    px(ctx, 210, 108, 36, 1, STONE1);

    // ---- beit midrash ----
    px(ctx, 250, 36, 70, 82, STONE2);
    px(ctx, 250, 36, 70, 3, STONE3);
    px(ctx, 266, 20, 42, 18, '#5a4a7e'); // tower
    px(ctx, 272, 12, 30, 8, '#6a5a92');  // dome
    px(ctx, 276, 8, 22, 4, '#7a6aa6');
    px(ctx, 280, 5, 10, 3, '#8a7ab6');
    px(ctx, 284, 2, 2, 3, WARM1); // finial
    // rose window (dark base; glows warm dynamically)
    px(ctx, 282, 47, 11, 11, '#3a2c1e');
    px(ctx, 284, 49, 7, 7, '#241c14');
    px(ctx, 287, 48, 1, 9, '#3a2c1e');
    px(ctx, 283, 52, 9, 1, '#3a2c1e');
    // notice board, mounted on the wall left of the doors
    px(ctx, 248, 84, 20, 32, WOOD1);
    px(ctx, 250, 86, 16, 28, '#3a2c1e');
    px(ctx, 251, 88, 7, 8, PARCH);
    px(ctx, 259, 90, 6, 9, '#dcc890');
    px(ctx, 252, 98, 8, 7, PARCH);
    px(ctx, 259, 101, 6, 8, '#c94a3f');
    px(ctx, 252, 88, 1, 1, STONE3);
    px(ctx, 260, 90, 1, 1, STONE3);
    px(ctx, 253, 98, 1, 1, STONE3);
    // big arched double doors
    px(ctx, 270, 72, 44, 3, STONE3);
    px(ctx, 270, 75, 2, 43, STONE3);
    px(ctx, 312, 75, 2, 43, STONE3);
    px(ctx, 272, 78, 40, 40, '#2c1f14');
    px(ctx, 276, 78, 32, 4, WOOD1);
    px(ctx, 280, 75, 24, 3, WOOD1);
    px(ctx, 286, 73, 12, 2, WOOD1);
    px(ctx, 274, 82, 17, 36, WOOD1);
    px(ctx, 293, 82, 17, 36, WOOD1);
    for (i = 0; i < 5; i++) {
      px(ctx, 276 + i * 3, 84, 1, 34, '#4a2f1c');
      px(ctx, 295 + i * 3, 84, 1, 34, '#4a2f1c');
    }
    px(ctx, 291, 82, 2, 36, '#1a1208'); // center seam (light pulses over it)
    px(ctx, 288, 100, 2, 2, '#c9a86a'); // handles
    px(ctx, 294, 100, 2, 2, '#c9a86a');
    // stone steps
    px(ctx, 268, 114, 48, 2, STONE3);
    px(ctx, 270, 116, 44, 2, STONE2);

    // ---- cobblestone floor (dusk-violet tones, not indigo night) ----
    px(ctx, 0, 118, 320, 62, COBBLE1);
    for (var ry = 120; ry < 176; ry += 6) {
      var off = ((ry / 6) % 2) ? 5 : 0;
      for (var rx = -4 + off; rx < 322; rx += 10) {
        var v = ((rx * 13 + ry * 7) % 23 + 23) % 23;
        var col = v < 8 ? COBBLE1 : (v < 16 ? COBBLE2 : COBBLE3);
        px(ctx, rx, ry, 8, 4, col);
      }
    }
    px(ctx, 0, 174, 320, 6, '#1f1830'); // dark foreground edge
    // faint warm light pool on the stones near the gate
    ctx.globalAlpha = 0.06;
    px(ctx, 168, 148, 40, 3, WARM2);
    px(ctx, 160, 152, 56, 4, WARM2);
    ctx.globalAlpha = 1;

    bg = c;
  }

  // --------------------------------------------------------------------------
  // Window lighting — progressive, per art direction's "recurring sight gag":
  // windows light up as t advances AND as seals are collected.
  // --------------------------------------------------------------------------

  var WINDOWS = [
    { x: 14, y: 70, w: 14, h: 12 },  // left house
    { x: 284, y: 49, w: 7, h: 7 }    // beit midrash rose window (nearly always warm)
  ];

  function litWindowCount(t, S) {
    var byTime = Math.min(1, Math.floor((t || 0) / 25));
    var bySeals = Math.min(2, sealCount(S));
    return Math.min(WINDOWS.length, byTime + bySeals + 1); // rose window starts lit
  }

  function drawWindows(ctx, t, S) {
    var lit = litWindowCount(t, S);
    for (var i = 0; i < WINDOWS.length; i++) {
      var w = WINDOWS[i];
      if (i < lit) {
        var flick = 0.75 + 0.25 * Math.sin(t * 4.3 + i * 2.1);
        ctx.globalAlpha = flick;
        dither(ctx, w.x, w.y, w.w, w.h, WARM1, WARM2);
        ctx.globalAlpha = 1;
        glow(ctx, w.x + w.w / 2, w.y + w.h / 2, w.w * 1.1, WARM2, 0.08 + 0.03 * Math.sin(t * 4.3 + i));
      }
    }
  }

  // --------------------------------------------------------------------------
  // Dynamic layers (animated every frame).
  // --------------------------------------------------------------------------

  function drawSkyLife(ctx, t) {
    // corner stars, twinkling in the fading violet
    for (var i = 0; i < STARS.length; i++) {
      var s = STARS[i];
      twinkle(ctx, s.x, s.y, t, s.size, '#e8d8f0', s.ph);
    }
    // a pair of birds crossing the dusk sky, looping every ~14s
    for (var b = 0; b < 2; b++) {
      var ph = (t * 0.09 + b * 0.5) % 1;
      var bx = -10 + ph * 340;
      var by = 24 + b * 14 + Math.sin(ph * 9 + b) * 3;
      var flap = Math.sin(t * 9 + b * 3) > 0;
      ctx.fillStyle = '#1e1830';
      if (flap) {
        px(ctx, bx - 2, by, 2, 1, '#1e1830');
        px(ctx, bx + 1, by, 2, 1, '#1e1830');
      } else {
        px(ctx, bx - 2, by + 1, 2, 1, '#1e1830');
        px(ctx, bx + 1, by - 1, 2, 1, '#1e1830');
      }
    }
    // sun's halo, breathing gently
    glow(ctx, 190, 92, 22, WARM2, 0.05 + 0.02 * Math.sin(t * 0.6));
  }

  function drawChimneySmoke(ctx, t) {
    for (var i = 0; i < 3; i++) {
      var sy = (t * 6 + i * 9) % 26;
      ctx.globalAlpha = 0.28 * (1 - sy / 26);
      px(ctx, Math.round(11 + Math.sin((t + i * 2) * 1.3) * 2), Math.round(36 - sy), 3, 2, '#c8bcd0');
    }
    ctx.globalAlpha = 1;
  }

  function drawAlleyShimmer(ctx, t) {
    // the paradox-frozen alley leaks a faint sparkle into the square
    for (var i = 0; i < 3; i++) {
      var ph = (t * 0.6 + i * 1.7) % 1;
      var sx = 70 + Math.sin(t * 1.1 + i * 2) * 8;
      var sy = 84 + i * 8;
      ctx.globalAlpha = (1 - ph) * 0.25;
      px(ctx, Math.round(sx), Math.round(sy), 1, 1, ACCENT_PURPLE);
    }
    ctx.globalAlpha = 1;
    // torch flame at the alley mouth
    var fl = Math.sin(t * 11) + Math.sin(t * 17) * 0.5;
    px(ctx, 61, 74 + (fl > 0.4 ? 0 : 1), 2, fl > 0.4 ? 4 : 3, WARM1);
    glow(ctx, 62, 75, 6, WARM2, 0.16 + 0.04 * fl);
  }

  function drawGatePennant(ctx, t) {
    var wob = Math.round(Math.sin(t * 4) * 2);
    px(ctx, 172, 90, 1, 5, WOOD1);
    px(ctx, 173, 90, 4 + wob, 2, ACCENT_RED);
    // heat-shimmer dust drifting near the gate opening
    for (var i = 0; i < 2; i++) {
      var ph = (t * 0.4 + i * 0.6) % 1;
      ctx.globalAlpha = 0.18 * (1 - ph);
      px(ctx, Math.round(168 + i * 14 + Math.sin(t + i) * 4), Math.round(100 - ph * 8), 1, 1, WARM1);
    }
    ctx.globalAlpha = 1;
  }

  function drawBeitMidrashLife(ctx, t) {
    glow(ctx, 287, 52, 7, WARM2, 0.20 + 0.05 * Math.sin(t * 1.9));
    ctx.globalAlpha = 0.5 + 0.25 * Math.sin(t * 1.7);
    px(ctx, 291, 82, 2, 36, WARM1);
    ctx.globalAlpha = 1;
    glow(ctx, 292, 110, 8, WARM2, 0.12 + 0.03 * Math.sin(t * 1.7));
  }

  function paint(ctx, t, S) {
    try {
      if (!bg) buildBG();
      if (bg) ctx.drawImage(bg, 0, 0);
      else px(ctx, 0, 0, 320, 180, SKY_VIOLET);

      drawSkyLife(ctx, t);
      drawWindows(ctx, t, S);
      drawChimneySmoke(ctx, t);
      drawAlleyShimmer(ctx, t);
      drawGatePennant(ctx, t);
      drawBeitMidrashLife(ctx, t);
    } catch (e) {
      // never let a paint bug kill the frame loop
      px(ctx, 0, 0, 320, 180, SKY_VIOLET);
    }
  }

  // --------------------------------------------------------------------------
  // Characters & animated props (drawn via hotspot.draw for depth-sorting).
  // --------------------------------------------------------------------------

  var CRIER_DOMAIN_LINE_X = 60; // the imaginary line he keeps panicking about

  function drawCrier(ctx, t) {
    var cx = 60 + Math.sin(t * 0.7) * 14;
    var flip = Math.cos(t * 0.7) < 0;
    var x = Math.round(cx);
    var crossing = Math.abs(x - CRIER_DOMAIN_LINE_X) < 2.5;
    var startle = crossing ? -2 : 0;
    var y = 140 - Math.round(Math.abs(Math.sin(t * 5))) + startle;

    // legs
    px(ctx, x - 3, y - 8, 2, 8, '#3a2a1c');
    px(ctx, x + 1, y - 8, 2, 8, '#3a2a1c');
    // robe (amber/rust, dusk-appropriate)
    px(ctx, x - 5, y - 22, 10, 15, '#a2542f');
    px(ctx, x - 5, y - 22, 10, 2, '#c9683c');
    px(ctx, x - 5, y - 9, 10, 2, '#7a3d20');
    // sash
    px(ctx, x - 5, y - 15, 10, 2, WARM1);
    // head + turban-cap
    px(ctx, x - 3, y - 29, 6, 6, '#e8c8a0');
    px(ctx, x - 4, y - 32, 8, 4, PARCH);
    px(ctx, x - 4, y - 32, 8, 1, '#d0bd88');
    // face
    if ((t % 3.2) > 0.15) {
      px(ctx, x - 2, y - 27, 1, 1, '#1a1a2e');
      px(ctx, x + 1, y - 27, 1, 1, '#1a1a2e');
    }
    px(ctx, x - 1, y - 25, 2, 1, '#a05a3a'); // worried mouth

    // arms: one holds a small bell, flailing when panicked
    var panic = Math.sin(t * 2.3) > 0.3 || crossing;
    if (panic) {
      px(ctx, x - 8, y - 21, 2, 7, '#a2542f');
      px(ctx, x + 6, y - 21, 2, 7, '#a2542f');
      px(ctx, x - 9, y - 24, 3, 3, WARM2); // bell, hand raised
      px(ctx, x - 8, y - 22, 1, 1, '#7a5a20');
    } else {
      px(ctx, x - 7, y - 15, 2, 6, '#a2542f');
      px(ctx, x + 5, y - 15, 2, 6, '#a2542f');
      px(ctx, x - 8, y - 10, 3, 3, WARM2);
    }

    // the voice-crack gag: a jagged red squiggle bursts near his mouth
    var crack = (t % 4.4);
    if (crack < 0.6) {
      ctx.globalAlpha = crack < 0.15 ? crack / 0.15 : (crack > 0.45 ? (0.6 - crack) / 0.15 : 1);
      px(ctx, x + 3, y - 30, 2, 1, ACCENT_RED);
      px(ctx, x + 4, y - 29, 1, 1, ACCENT_RED);
      px(ctx, x + 3, y - 28, 2, 1, ACCENT_RED);
      px(ctx, x + 5, y - 27, 1, 1, ACCENT_RED);
      ctx.globalAlpha = 1;
    }

    // a faint chalk line scratched at his feet — "the domain line", his idea
    ctx.globalAlpha = 0.35;
    px(ctx, CRIER_DOMAIN_LINE_X, 145, 1, 6, '#e8d8a8');
    ctx.globalAlpha = 1;
  }

  function drawFishmonger(ctx, t) {
    var x = 220, y = 154;
    // stall: crates + awning
    px(ctx, x - 12, y - 24, 30, 4, WOOD1);
    px(ctx, x - 14, y - 26, 34, 3, ACCENT_RED);
    px(ctx, x - 10, y - 20, 4, 20, WOOD2);
    px(ctx, x + 12, y - 20, 4, 20, WOOD2);
    px(ctx, x - 12, y - 8, 26, 5, WOOD1); // counter
    // baskets
    px(ctx, x - 9, y - 13, 8, 6, '#7a512f');
    px(ctx, x + 2, y - 13, 8, 6, '#7a512f');

    // Chana herself, behind the counter
    px(ctx, x - 3, y - 22, 8, 10, '#5a3a5c'); // robe
    px(ctx, x - 2, y - 30, 6, 8, '#e8c8a0');  // head
    px(ctx, x - 3, y - 32, 8, 4, '#8a4a4a');  // headscarf
    if ((t % 3.6) > 0.15) {
      px(ctx, x - 1, y - 27, 1, 1, '#1a1a2e');
      px(ctx, x + 2, y - 27, 1, 1, '#1a1a2e');
    }
    px(ctx, x, y - 25, 2, 1, '#a05a3a');

    // THE fish, flopping right at the boundary between her stall (private-ish
    // floor) and the open road (public cobblestones) — the running gag.
    var fp = (t * 1.6) % 2; // 0..2 hop cycle
    var arc = fp < 1 ? Math.sin(fp * Math.PI) : Math.sin((fp - 1) * Math.PI);
    var fx = x - 18 + (fp < 1 ? 0 : 6);
    var fy = y + 2 - arc * 6;
    px(ctx, Math.round(fx), Math.round(fy), 6, 2, '#7fb0c8');
    px(ctx, Math.round(fx) - 1, Math.round(fy), 2, 2, '#6a98ac'); // tail
    px(ctx, Math.round(fx) + 5, Math.round(fy), 1, 1, '#1a1a2e'); // eye
    // she reacts with a startled head-turn each time it flops toward the road
    if (arc > 0.7) {
      px(ctx, x - 1, y - 28, 1, 1, '#a05a3a'); // little "oh!" mouth pop
    }
  }

  function drawCat(ctx, t) {
    var x = 176, y = 156;
    var br = (Math.sin(t * 1.6) > 0) ? 1 : 0; // breathing
    // curled grey-and-white body
    px(ctx, x - 7, y - 5 - br, 14, 5 + br, '#6b6b7a');
    px(ctx, x - 6, y - 6 - br, 12, 1, '#7d7d8c');
    px(ctx, x - 4, y - 5 - br, 1, 3, '#4a4a56');
    px(ctx, x - 1, y - 5 - br, 1, 3, '#4a4a56');
    px(ctx, x + 2, y - 5 - br, 1, 3, '#4a4a56');
    // tucked head
    px(ctx, x - 10, y - 6, 6, 5, '#8a8a9a');
    var tw = ((t % 6) < 0.25) ? 1 : 0; // ear twitch
    px(ctx, x - 10, y - 7 - tw, 1, 1 + tw, '#6b6b7a');
    px(ctx, x - 6, y - 7, 1, 1, '#6b6b7a');
    px(ctx, x - 9, y - 4, 2, 1, '#3a3a44'); // closed eye
    // tail with a lazy flick
    var flick = ((t % 7) < 0.5) ? 1 : 0;
    px(ctx, x - 2, y - 1, 8, 1, '#7d7d8c');
    px(ctx, x + 5, y - 2 - flick, 2, 1, '#7d7d8c');
  }

  function drawWell(ctx, t) {
    // gabled roof on wooden posts
    px(ctx, 136, 112, 3, 26, WOOD1);
    px(ctx, 157, 112, 3, 26, WOOD1);
    px(ctx, 133, 110, 30, 3, WOOD2);
    px(ctx, 131, 108, 34, 2, WOOD1);
    px(ctx, 135, 106, 26, 2, WOOD2);
    px(ctx, 140, 104, 16, 2, WOOD1);
    // rope + swaying bucket
    var sway = Math.round(Math.sin(t * 1.2) * 2);
    px(ctx, 147, 113, 1, 5, '#c9a86a');
    px(ctx, 147 + Math.round(sway / 2), 118, 1, 5, '#c9a86a');
    px(ctx, 144 + sway, 123, 7, 5, WOOD2);
    px(ctx, 144 + sway, 125, 7, 1, '#4a3a2a');
    // crank handle
    px(ctx, 160, 111, 4, 1, STONE3);
    px(ctx, 163, 109, 1, 3, STONE3);
    // stone body
    px(ctx, 135, 136, 26, 2, STONE3);
    px(ctx, 133, 138, 30, 12, STONE2);
    px(ctx, 133, 150, 30, 2, STONE1);
    var i;
    for (i = 0; i < 6; i++) px(ctx, 136 + i * 5, 141, 1, 4, STONE1);
    px(ctx, 139, 136, 18, 3, '#100f28'); // dark mouth
    // dove dozing on the roof, head bobbing
    var hb = (Math.sin(t * 3) > 0.5) ? 1 : 0;
    px(ctx, 149, 101, 4, 3, '#c9c0b0');
    px(ctx, 152, 100 + hb, 2, 2, '#c9c0b0');
    px(ctx, 154, 101 + hb, 1, 1, WARM2);
  }

  // --------------------------------------------------------------------------
  // Dialogue — הכרוז זבדיה (Zevadia the town crier): recap NPC.
  // The intro cutscene is owned by main.js; this hotspot only re-hears
  // a recap of which seals remain, plus the running "domain voice" gag.
  // --------------------------------------------------------------------------

  var CRIER_OPENERS = [
    'זְרַח! עֵ... עֵרֶב טוֹ— (הקול שלי בורח לי שוב.)',
    'רגע, אתה שומע אותי בסדר? כי אני עדיין לא בטוח אם הקול שלי "יצא" כמו שצריך.',
    'הִנֵּה זְרַח! בוא, בוא, לפני שאני שוב אכריז משהו מבפנים הביתה החוצה ואצטרך לבדוק אם זה נחשב.'
  ];

  async function talkCrier(g) {
    function cs(text) { return g.say(text, { who: 'crier', color: '#ffd166' }); }

    await cs(pick(CRIER_OPENERS));

    var hasHandoff = safeSeal(g, 'handoff');
    var hasDomains = safeSeal(g, 'domains');
    var hasCount = safeSeal(g, 'count');
    var have = (hasHandoff ? 1 : 0) + (hasDomains ? 1 : 0) + (hasCount ? 1 : 0);

    if (have >= 3) {
      await cs('שלושה חותמות?! שְׁמַע... בעצם לא, אל תשמע, זה לא הזמן להתחיל עם זה שוב.');
      await cs('רוץ לשער הרשויות בבית המדרש! לפני השקיעה!');
    } else {
      var going = true;
      while (going) {
        var v = await g.choose([
          { text: 'אילו חותמות עוד חסרים לי?', value: 'seals' },
          { text: 'למה הקול שלך כל הזמן נשבר ככה?', value: 'voice' },
          { text: 'תזכיר לי מה בכלל קרה כאן.', value: 'recap' },
          { text: 'אני רץ. השמש לא מחכה.', value: 'bye' }
        ]);
        if (v === 'seals') {
          if (hasHandoff) await cs('חותם המשא ומתן — יש לך! שני האומללים במבוי כבר לא קפואים באמצע פעולה.');
          else await cs('חותם המשא ומתן — עדיין במבוי הקפוא. שני אנשים תקועים באמצע להעביר חפץ. תעזור להם להבין מי בכלל חייב.');
          if (hasDomains) await cs('חותם הרשויות — יש! אתה כבר יודע להבדיל רשות היחיד מרשות הרבים, כמוני. כמעט.');
          else await cs('חותם הרשויות — בשוק. תלמד לסווג ארבע רשויות: יחיד, רבים, כרמלית, ומקום פטור.');
          if (hasCount) await cs('חותם המניין — יש! גם אני עוד לא סופר כמו רב מתנה, ואני עומד כאן ומכריז מספרים כל היום.');
          else await cs('חותם המניין — בבית המדרש. שם רב מתנה ואביי מתווכחים כמה פעולות באמת יש. תתפלא.');
        } else if (v === 'voice') {
          await cs('אני עומד בפתח הבית שלי — רשות היחיד שלי, כביכול — ומכריז החוצה לכיכר — רשות הרבים.');
          await cs('אז אני שואל את עצמי: אם ה־קוֹל שלי "יוצא" מפנים לחוץ... זה נחשב הוצאה?!');
          await cs('לילה שלם לא ישנתי בגלל זה. ואז זה קרה שוב — הקול נשבר. תסמונת. יש לי תסמונת.');
          await g.playerSay('זבדיה, אני חושב שקול זה לא "חפץ". אתה יכול לנשום.');
          await cs('קל לך להגיד. אתה לא זה שהמחיצה שלו נשברה.');
        } else if (v === 'recap') {
          await cs('מְחִיצַת הָרְשֻׁיּוֹת נשברה. שני אנשים במבוי קפואים באמצע מסירת חפץ — לא ברור מי חייב ומי פטור.');
          await cs('שער הרשויות בבית המדרש ננעל. הוא ייפתח רק לשלושה חותמות: משא ומתן, רשויות, ומניין.');
          await cs('והשמש יורדת, זרח. עוד מעט קריאת שמע וכניסת שבת. אין הרבה זמן.');
        } else {
          await cs('לך! ואם משהו לא ברור — תבדוק בדף. הדף תמיד יודע.');
          going = false;
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Dialogue — חנה מוכרת הדגים (pure flavor, no puzzle mechanics).
  // --------------------------------------------------------------------------

  var FISH_LINES = [
    'תראה אותו! כל הזמן מנסה לברוח מהדוכן שלי אל הרחוב. הוא לא מבין ברשויות, אני מבינה.',
    'אם אתה לא יודע איפה נגמרת רשות היחיד ומתחילה רשות הרבים — גם הדג לא יודע.',
    'לפעמים אני חושבת שהוא עושה את זה בכוונה. דג עם דעות הלכתיות. משוגע.'
  ];

  async function talkFishmonger(g) {
    function hs(text) { return g.say(text, { who: 'fishmonger', color: '#a0d0d8' }); }
    await hs(pick(FISH_LINES));
    await g.playerSay('אולי כדאי לו סתם להישאר בתוך הסל.');
    await hs('נסה להסביר את זה לדג.');
  }

  // --------------------------------------------------------------------------
  // Dialogue — עוקצין החתול (village cats named after mesechtot — the joke).
  // --------------------------------------------------------------------------

  var CAT_MEOWS = [
    'מְעוּקְצָן... כלומר, מְיָאוּ.',
    'מיאו. (זה מסכת קטנה ועלומה. גם אני קטן ועלום. זה מתאים.)',
    'מיאו־מיאו. פירוש: תוריד את היד.'
  ];

  async function talkCat(g) {
    await g.playerSay('עוקצין? כמו המסכת?');
    await g.say(pick(CAT_MEOWS), { who: 'cat', color: WARM2 });
    await g.playerSay('כל חתולי הכפר קרויים על שם מסכתות. מוזר. חמוד. מוזר.');
  }

  // --------------------------------------------------------------------------
  // Scene registration.
  // --------------------------------------------------------------------------

  if (!window.GAME || typeof GAME.registerScene !== 'function') {
    if (window.console && console.warn) console.warn('square.js: GAME engine not found, scene not registered');
    return;
  }

  GAME.registerScene('square', {
    name: 'כיכר כפר שבתא',
    floor: { yMin: 118, yMax: 172 },
    paint: paint,

    onEnter: async function (g) {
      try { if (window.AUDIO && typeof AUDIO.music === 'function') AUDIO.music('night'); } catch (e) { /* silent */ }
      try { if (g && g.flag && !g.flag('squareSeen')) g.flag('squareSeen', true); } catch (e) { /* silent */ }
    },

    hotspots: [

      // ---- הכרוז זבדיה ----
      {
        id: 'crier', name: 'הכרוז זבדיה', type: 'char',
        x: 44, y: 108, w: 32, h: 32,
        walkTo: { x: 84, y: 144 },
        draw: function (ctx, t) { try { drawCrier(ctx, t); } catch (e) { /* fail silent */ } },
        look: async function (g) {
          await g.playerSay('זבדיה הכרוז. מזיע, נסער, ומודד כל הזמן את המרחק בינו לבין דלת הבית שלו.');
        },
        talk: talkCrier,
        take: async function (g) {
          await g.playerSay('אף אחד לא מרים כרוז. גם אם הוא ממש רוצה לשבת רגע.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.say('הדף! תחזיק אותו חזק! «יְצִיאוֹת הַשַּׁבָּת, שְׁתַּיִם שֶׁהֵן אַרְבַּע» — הכול שם!', { who: 'crier', color: '#ffd166' });
          } else {
            await g.playerSay('מה שיעזור לזבדיה זה חותמות, לא זה.');
          }
        }
      },

      // ---- חנה מוכרת הדגים ----
      {
        id: 'fishmonger', name: 'חנה מוכרת הדגים', type: 'char',
        x: 200, y: 128, w: 42, h: 32,
        walkTo: { x: 214, y: 160 },
        draw: function (ctx, t) { try { drawFishmonger(ctx, t); } catch (e) { /* fail silent */ } },
        look: async function (g) {
          await g.playerSay('חנה עומדת מאחורי הדוכן, עין אחת על הקונים ועין שנייה על הדג שמנסה לברוח.');
        },
        talk: talkFishmonger,
        take: async function (g) {
          await g.playerSay('לקחת דג? היא תבחין. היא תמיד מבחינה.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('הדף לא מדבר דגים. חבל, זה בדיוק מה שהיה עוזר כאן.');
          } else {
            await g.say('אם זה לא כסף ולא לוקח את הדג — אני לא מעוניינת, תודה.', { who: 'fishmonger', color: '#a0d0d8' });
          }
        }
      },

      // ---- עוקצין החתול ----
      {
        id: 'cat', name: 'עוקצין', type: 'char',
        x: 168, y: 148, w: 20, h: 12,
        walkTo: { x: 194, y: 160 },
        draw: function (ctx, t) { try { drawCat(ctx, t); } catch (e) { /* fail silent */ } },
        look: async function (g) {
          await g.playerSay('חתול הכפר, עוקצין. ישן על אבן חמה, שם על פי מסכת קטנה שאף אחד לא זוכר בעל פה.');
        },
        talk: talkCat,
        take: async function (g) {
          await g.playerSay('אני מנסה להרים אותו בעדינות...');
          await g.say('זה לא בדף, זה חתול.', { who: 'cat', color: WARM2 });
          await g.playerSay('טיעון הלכתי חזק להפליא, בהתחשב במקור.');
          sfx(g, 'snore');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('עוקצין מריח את הדף... ומחליט שהוא לא מסכת שלו. חבל.');
          } else {
            await g.playerSay('עוקצין פוקח עין אחת, שוקל את המצב, וחוזר לישון.');
          }
        }
      },

      // ---- לוח המודעות ----
      {
        id: 'board', name: 'לוח המודעות', type: 'object',
        x: 248, y: 84, w: 20, h: 32,
        walkTo: { x: 256, y: 124 },
        look: async function (g) {
          var o = { x: 258, y: 80, color: PARCH };
          await g.say('לוח המודעות של כפר שבתא:', o);
          await g.say('«אבד: תחושת הכיוון בין רשות היחיד לרשות הרבים. המוצא מתבקש להחזיר לפני כניסת שבת.»', o);
          await g.say('«דרוש: כרוז בעל קול יציב. ניסיון בצעקות שלא חוצות רשויות — יתרון.»', o);
          await g.say('ובפינה, קלף עתיק: «יציאות השבת שתים שהן ארבע בפנים ושתים שהן ארבע בחוץ.»', o);
          await g.playerSay('שתיים שהן ארבע... אז יש כאן דפוס. שווה לזכור את זה.');
        },
        take: async function (g) {
          await g.playerSay('לגנוב לוח מודעות? אולי יתלו עליי מודעה בתגובה.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('הדף כבר מצוטט על הלוח. אין טעם לתלות אותו פעמיים.');
          } else {
            await g.playerSay('הלוח מלא מקצה לקצה. אפילו הפינות תפוסות.');
          }
        }
      },

      // ---- הבאר ----
      {
        id: 'well', name: 'הבאר', type: 'object',
        x: 128, y: 100, w: 40, h: 52,
        walkTo: { x: 148, y: 158 },
        draw: function (ctx, t) { try { drawWell(ctx, t); } catch (e) { /* fail silent */ } },
        look: async function (g) {
          await g.playerSay('הַלּוֹ...?');
          await g.say('...לוֹ? ...לוֹ?', { who: 'well', color: '#8fd0e8' });
          await g.playerSay('מי שם?');
          await g.say('מַאי?', { who: 'well', color: '#8fd0e8' });
          await g.playerSay('באר שעונה בארמית. בכפר שלמד גמרא כבר דורות — הגיוני להפליא.');
        },
        take: async function (g) {
          await g.playerSay('לקחת באר הביתה? אין לי איפה לשים אותה. וגם היא לא ממש ניידת.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('לזרוק דף גמרא לבאר?! יש גבול לניסויים, גם בערב שבת.');
            return;
          }
          if (itemId) {
            sfx(g, 'click');
            await g.playerSay('*פְּלוּנְק!* ...בסדר, בסדר, שלפתי את זה בחזרה.');
            await g.say('מַאי דָּא?!', { who: 'well', color: '#8fd0e8' });
          } else {
            sfx(g, 'click');
            await g.playerSay('זרקתי חלוק אבן קטן. *פלונק.*');
            await g.say('מַאי?', { who: 'well', color: '#8fd0e8' });
            await g.playerSay('אין לי מושג. בשביל זה אני כאן, כנראה.');
          }
        }
      },

      // ---- exit: courtyard (the narrow alley toward the frozen handoff) ----
      {
        id: 'exit_courtyard', name: 'המבוי הקפוא', type: 'exit',
        x: 58, y: 62, w: 36, h: 56,
        target: 'courtyard',
        walkTo: { x: 76, y: 128 },
        spawn: { x: 40, y: 150 },
        look: async function (g) {
          await g.playerSay('המבוי הצדדי. משהו שם נראה... קפוא. ממש. תזוזה אפסית, ברק מוזר באוויר.');
        }
      },

      // ---- exit: market (the gate toward the erev-Shabbat market road) ----
      {
        id: 'exit_market', name: 'שוק ערב שבת', type: 'exit',
        x: 158, y: 84, w: 42, h: 34,
        target: 'market',
        walkTo: { x: 179, y: 120 },
        spawn: { x: 30, y: 148 },
        look: async function (g) {
          await g.playerSay('השער אל השוק. השמש שוקעת בדיוק מעבר לו — ומריחים משם דגים, בשמים, ולחץ זמן.');
        }
      },

      // ---- exit: roof (external stone staircase) ----
      {
        id: 'exit_roof', name: 'המדרגות לגג', type: 'exit',
        x: 210, y: 76, w: 36, h: 42,
        target: 'roof',
        walkTo: { x: 220, y: 122 },
        spawn: { x: 34, y: 146 },
        look: async function (g) {
          await g.playerSay('מדרגות אבן אל הגג. משם אפשר לראות את כל השמים הנצבעים בזהב וסגול.');
        }
      },

      // ---- exit: beit midrash (big arched doors, right) ----
      {
        id: 'exit_beitmidrash', name: 'בית המדרש', type: 'exit',
        x: 266, y: 66, w: 46, h: 52,
        target: 'beitmidrash',
        walkTo: { x: 288, y: 124 },
        spawn: { x: 30, y: 142 },
        look: async function (g) {
          await g.playerSay('דלתות בית המדרש. מבפנים בוקע אור חם — וכבר נשמע ויכוח. תמיד יש ויכוח.');
        }
      }
    ]
  });

})();
