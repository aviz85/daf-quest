'use strict';
/**
 * DAF QUEST — sprites.js
 * Pixel-art sprite toolkit + the hero "Zerach" (player character).
 * Exposes window.SPRITES. Zero dependencies, Canvas 2D only.
 *
 * Contract:
 *   SPRITES.draw(ctx, map, pal, x, y, scale, flip)
 *   SPRITES.px(ctx, x, y, w, h, color)
 *   SPRITES.dither(ctx, x, y, w, h, c1, c2)
 *   SPRITES.glow(ctx, x, y, r, color, alpha)
 *   SPRITES.star(ctx, x, y, t, size, color)
 *   SPRITES.candle(ctx, x, y, t, scale)
 *   SPRITES.torch(ctx, x, y, t)
 *   SPRITES.moon(ctx, x, y, phase)
 *   SPRITES.drawPlayer(ctx, x, y, t, walking, flip, scale)
 * Bonus (reusable by scenes): SPRITES.flame(ctx, x, y, t, size)
 */
(function () {

  // ---------------------------------------------------------------------
  // Core helpers
  // ---------------------------------------------------------------------

  /** fillRect shorthand. */
  function px(ctx, x, y, w, h, color) {
    if (!ctx) { return; }
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  /**
   * Draw a string-map sprite. map = array of equal-length strings,
   * pal = { char: '#hex' }. '.' and ' ' (and unknown chars) are transparent.
   * (x, y) is the TOP-LEFT of the sprite. Each cell is scale x scale.
   * Runs of identical cells are merged into one fillRect for speed.
   */
  function draw(ctx, map, pal, x, y, scale, flip) {
    if (!ctx || !map || !map.length || !pal) { return; }
    scale = (scale == null) ? 1 : scale;
    var w = map[0].length;
    // Tiny overlap kills hairline seams when scale is fractional.
    var eps = (scale % 1 === 0) ? 0 : 0.05;
    for (var r = 0; r < map.length; r++) {
      var row = map[r];
      if (!row) { continue; }
      var c = 0;
      while (c < row.length) {
        var ch = row[c];
        if (ch === '.' || ch === ' ' || !pal[ch]) { c++; continue; }
        var c2 = c + 1;
        while (c2 < row.length && row[c2] === ch) { c2++; }
        var dx = flip ? x + (w - c2) * scale : x + c * scale;
        ctx.fillStyle = pal[ch];
        ctx.fillRect(dx, y + r * scale, (c2 - c) * scale + eps, scale + eps);
        c = c2;
      }
    }
  }

  /** Checkerboard 1px dither fill (cached 2x2 canvas pattern). */
  var _ditherCache = {};
  function dither(ctx, x, y, w, h, c1, c2) {
    if (!ctx) { return; }
    try {
      var key = c1 + '|' + c2;
      var pat = _ditherCache[key];
      if (!pat) {
        var pc = document.createElement('canvas');
        pc.width = 2; pc.height = 2;
        var pctx = pc.getContext('2d');
        pctx.fillStyle = c1; pctx.fillRect(0, 0, 2, 2);
        pctx.fillStyle = c2; pctx.fillRect(0, 0, 1, 1); pctx.fillRect(1, 1, 1, 1);
        pat = ctx.createPattern(pc, 'repeat');
        _ditherCache[key] = pat;
      }
      ctx.save();
      ctx.fillStyle = pat;
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    } catch (e) {
      // Fail soft: plain fill.
      px(ctx, x, y, w, h, c1);
    }
  }

  /**
   * Radial-ish glow: concentric additive rects, brightest at center.
   * (x, y) = glow center, r = outer radius, alpha = overall strength.
   */
  function glow(ctx, x, y, r, color, alpha) {
    if (!ctx || !r || r <= 0) { return; }
    alpha = (alpha == null) ? 0.15 : alpha;
    ctx.save();
    try { ctx.globalCompositeOperation = 'lighter'; } catch (e) { /* keep default */ }
    var steps = 4;
    for (var i = steps; i >= 1; i--) {
      var ri = r * i / steps;
      ctx.globalAlpha = Math.min(1, Math.max(0, alpha * 0.38));
      ctx.fillStyle = color;
      // Slightly flattened block "oval" — reads as a warm pool of light.
      ctx.fillRect(x - ri, y - ri * 0.8, ri * 2, ri * 1.6);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------
  // Generic props
  // ---------------------------------------------------------------------

  /** Twinkling star. size 1 = single pixel, 2-3 = cross with sparkle. */
  function star(ctx, x, y, t, size, color) {
    if (!ctx) { return; }
    t = t || 0;
    size = size || 1;
    color = color || '#ffffff';
    // Deterministic per-position phase so each star twinkles differently.
    var ph = x * 12.9898 + y * 78.233;
    var tw = 0.5 + 0.5 * Math.sin(t * (1.3 + (ph % 1.1)) + ph);
    ctx.save();
    ctx.globalAlpha = 0.30 + 0.70 * tw;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
    if (size >= 2) {
      var a = Math.max(1, Math.round((size - 1) * tw));
      ctx.globalAlpha = (0.30 + 0.70 * tw) * 0.55;
      ctx.fillRect(x - a, y, a * 2 + 1, 1);
      ctx.fillRect(x, y - a, 1, a * 2 + 1);
    }
    if (size >= 3 && tw > 0.86) {
      // Rare diagonal sparkle on the brightest moment.
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x - 1, y - 1, 1, 1);
      ctx.fillRect(x + 1, y + 1, 1, 1);
      ctx.fillRect(x - 1, y + 1, 1, 1);
      ctx.fillRect(x + 1, y - 1, 1, 1);
    }
    ctx.restore();
  }

  /**
   * Flickering flame. (x, y) = flame BOTTOM center, size ~ 1 for a candle.
   * Layered teardrop: outer orange, mid amber, bright core, white-hot spot.
   */
  function flame(ctx, x, y, t, size) {
    if (!ctx) { return; }
    t = t || 0;
    var s = size || 1;
    var fl = Math.sin(t * 11 + x * 0.7) * 0.6 + Math.sin(t * 23.7 + x * 0.31) * 0.4; // -1..1
    var sway = fl * 0.55 * s;
    var h = (3.6 + fl * 0.55) * s;
    px(ctx, x - 1.0 * s + sway * 0.4, y - h,        2.0 * s, h,        '#ff8c42');
    px(ctx, x - 0.7 * s + sway * 0.55, y - h * 0.78, 1.4 * s, h * 0.78, '#ffb347');
    px(ctx, x - 0.4 * s + sway * 0.7, y - h * 0.52, 0.8 * s, h * 0.52, '#ffd166');
    px(ctx, x - 0.2 * s + sway * 0.7, y - h * 0.30, 0.45 * s, h * 0.24, '#fff7d6');
    if (fl > 0.35) {
      // Detached tip pixel on strong flicker.
      px(ctx, x - 0.5 * s + sway, y - h - 1.1 * s, s, s, '#ff8c42');
    }
  }

  /** Standing candle. (x, y) = base bottom center. */
  function candle(ctx, x, y, t, scale) {
    if (!ctx) { return; }
    t = t || 0;
    var s = scale || 1;
    // Wax body + shaded edge + a drip.
    px(ctx, x - 1.5 * s, y - 5 * s, 3 * s, 5 * s, '#f0e6c8');
    px(ctx, x + 0.5 * s, y - 5 * s, 1 * s, 5 * s, '#d9c89a');
    px(ctx, x - 1.5 * s, y - 3 * s, 1 * s, 2 * s, '#fbf5e2');
    // Wick.
    px(ctx, x - 0.5 * s, y - 6 * s, 1 * s, 1 * s, '#3a2a1e');
    flame(ctx, x, y - 6 * s, t, 0.9 * s);
    var flick = 0.5 + 0.5 * Math.sin(t * 9.3 + x);
    glow(ctx, x, y - 7 * s, 9 * s, '#ffb347', 0.10 + flick * 0.05);
  }

  /** Wall/post torch. (x, y) = handle bottom center. */
  function torch(ctx, x, y, t) {
    if (!ctx) { return; }
    t = t || 0;
    // Wooden handle with highlight.
    px(ctx, x - 1, y - 13, 3, 13, '#5a3a24');
    px(ctx, x - 1, y - 13, 1, 13, '#7a512f');
    // Cloth binding.
    px(ctx, x - 2, y - 16, 5, 3, '#7a512f');
    px(ctx, x - 2, y - 14, 5, 1, '#3a2a1e');
    // Charred top.
    px(ctx, x - 1, y - 17, 3, 1, '#2a1a12');
    flame(ctx, x + 0.5, y - 16, t, 1.6);
    // Rising sparks.
    ctx.save();
    for (var k = 0; k < 2; k++) {
      var sp = (t * 7 + k * 4.7) % 9;
      ctx.globalAlpha = Math.max(0, (1 - sp / 9)) * 0.8;
      px(ctx, x + Math.sin(t * 4 + k * 2.1) * 2, y - 18 - sp, 1, 1, '#ffd166');
    }
    // A wisp of smoke.
    var sm = (t * 5) % 14;
    ctx.globalAlpha = Math.max(0, 0.25 * (1 - sm / 14));
    px(ctx, x + Math.sin(t * 2) * 3, y - 20 - sm, 2, 2, '#8f8fb0');
    ctx.restore();
    glow(ctx, x, y - 18, 14, '#ff8c42', 0.12 + 0.05 * Math.sin(t * 9));
  }

  /**
   * Crescent moon. (x, y) = center. phase 0 = thin sliver, 1 = near full.
   * Optional 5th arg r = radius (default 13). Lit side faces right.
   */
  function moon(ctx, x, y, phase, r) {
    if (!ctx) { return; }
    r = r || 13;
    phase = (phase == null) ? 0.35 : Math.max(0, Math.min(1, phase));
    var d = (0.45 + 1.35 * phase) * r; // shadow-circle offset to the left
    for (var dy = -r; dy <= r; dy++) {
      var hw = Math.sqrt(Math.max(0, r * r - dy * dy));
      var xs = Math.round(x - hw);
      var xe = Math.round(x + hw);
      var shw = Math.sqrt(Math.max(0, r * r * 1.02 - dy * dy));
      var shadowRight = Math.round(x - d + shw);
      var lit0 = Math.max(xs, shadowRight);
      if (lit0 < xe) {
        px(ctx, lit0, y + dy, xe - lit0, 1, '#f4eecb');
        // Bright rim pixel on the outer edge.
        px(ctx, xe - 1, y + dy, 1, 1, '#fffbe8');
      }
    }
    // A few craters on the lit side (deterministic positions).
    px(ctx, x + r * 0.55, y - r * 0.25, 2, 2, '#ddd0a0');
    px(ctx, x + r * 0.35, y + r * 0.35, 2, 1, '#ddd0a0');
    px(ctx, x + r * 0.68, y + r * 0.10, 1, 1, '#ddd0a0');
    // Soft halo around the lit limb.
    glow(ctx, x + r * 0.35, y, r * 1.7, '#f4eecb', 0.045);
  }

  // ---------------------------------------------------------------------
  // The hero — Zerach ("זרח"), young Talmud student
  // 16 x 30 cells, feet anchored at (x, y). Chibi: big head, big shiny
  // eyes, indigo cap with amber button, teal robe with amber sash, and a
  // little candle held up beside his cheek.
  // ---------------------------------------------------------------------

  var PLAYER_PAL = {
    C: '#2e2e75', // cap
    c: '#4a4aad', // cap highlight
    B: '#ffb347', // amber (cap button + sash)
    b: '#d98c2b', // amber shade (sash knot)
    h: '#4a2e1a', // hair
    S: '#f6c9a0', // skin
    s: '#d99a6c', // skin shade
    o: '#f0937a', // blush
    E: '#ffffff', // eye white / sparkle
    P: '#26183a', // pupil
    M: '#a34632', // mouth
    R: '#1f7a8c', // robe teal
    r: '#145563', // robe shade
    q: '#2f9cb0', // robe highlight (front fold)
    W: '#f0e6c8', // candle wax
    w: '#d9c89a', // hem trim / wax shade
    k: '#3a2a1e', // wick
    F: '#4a3020'  // shoes
  };

  // Rows 0-25: head + torso (candle wax at cols 14-15, hand at row 17).
  var PLAYER_BODY = [
    '......CcBcC.....', //  0 cap dome + amber button
    '....CCccccCC....', //  1
    '...CCCCCCCCCC...', //  2 cap brim
    '..hhShSSSShShh..', //  3 bangs peeking out
    '.hSSSSSSSSSSSSh.', //  4
    '.SSSSSSSSSSSSSS.', //  5
    '.SSSPESSSSPESSS.', //  6 big dark eyes, white catchlight
    '.SSSPPSSSSPPSSS.', //  7
    '.SSSPPSSSSPPSSS.', //  8
    '.SoSSSSssSSSSoS.', //  9 blush + button nose
    '..SSSSsMMsSSSS..', // 10 little smile
    '..SSSSSSSSSSSS..', // 11
    '...SSSSSSSSSS...', // 12
    '....ssssssss..k.', // 13 chin shade + candle wick
    '......ssss....WW', // 14 neck + wax
    '...RRRRRRRRRR.WW', // 15 shoulders
    '..rRRRRRRRRRRRWW', // 16
    '..rRRRRRRRRRrrSS', // 17 sleeve + hand gripping candle
    '..rRBBBbbBBBRr..', // 18 amber sash + knot
    '..rRRRRRRRRRRr..', // 19
    '..rRRRRqqRRRRr..', // 20 front fold highlight
    '..rRRRRqqRRRRr..', // 21
    '.rRRRRRqqRRRRRr.', // 22 robe widens
    '.rRRRRRqqRRRRRr.', // 23
    '.rRRRRRRRRRRRRr.', // 24
    '.wwwwwwwwwwwwww.'  // 25 cream hem trim
  ];

  // Rows 26-29 variants (drawn under the body).
  var PLAYER_LEGS_IDLE = [
    '...ss......ss...',
    '...ss......ss...',
    '..FFF......FFF..',
    '..FFF......FFF..'
  ];
  var PLAYER_LEGS_WALK_A = [ // stride: legs spread wide
    '..ss........ss..',
    '..ss........ss..',
    '.FFF........FFF.',
    '.FFF........FFF.'
  ];
  var PLAYER_LEGS_WALK_B = [ // passing: legs together, right foot lifted
    '.....ss...ss....',
    '.....ss...ss....',
    '....FFF..FFF....',
    '....FFF.........'
  ];

  var PLAYER_W = 16;
  var PLAYER_H = 30;
  var PLAYER_LEG_ROWS = 4;

  /**
   * Draw the hero. (x, y) = feet anchor (bottom center).
   * t drives: candle flicker + glow, 2-frame walk (t*6), idle sway, blink.
   * flip=true mirrors him (candle moves to his other hand).
   */
  function drawPlayer(ctx, x, y, t, walking, flip, scale) {
    if (!ctx) { return; }
    t = t || 0;
    scale = (scale == null) ? 1 : scale;

    var bodyRows = PLAYER_H - PLAYER_LEG_ROWS;
    var frame = walking ? (Math.floor(t * 6) % 2) : 0;
    var bob = walking ? (frame === 1 ? -0.9 * scale : 0) : 0;
    var sway = walking ? 0 : Math.sin(t * 1.7) * 0.55 * scale;

    var left = x - (PLAYER_W * scale) / 2;
    var top = y - PLAYER_H * scale + bob;
    var legsTop = top + bodyRows * scale;

    // Ground shadow (keeps him planted in the scene).
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = 0.20;
    ctx.fillRect(x - 6 * scale, y - 1.2 * scale, 12 * scale, 2 * scale);
    ctx.globalAlpha = 0.14;
    ctx.fillRect(x - 4 * scale, y + 0.4 * scale, 8 * scale, 1.2 * scale);
    ctx.restore();

    // Legs (planted; only the body sways when idle).
    var legs = walking
      ? (frame === 1 ? PLAYER_LEGS_WALK_B : PLAYER_LEGS_WALK_A)
      : PLAYER_LEGS_IDLE;
    draw(ctx, legs, PLAYER_PAL, left, legsTop, scale, flip);

    // Body + head.
    var bodyX = left + sway;
    draw(ctx, PLAYER_BODY, PLAYER_PAL, bodyX, top, scale, flip);

    // Blink: quick eyelid close every ~3.4s (eyes at rows 6-8, symmetric
    // columns 4-5 and 10-11, so no flip math needed).
    var bt = t % 3.4;
    if (bt > 3.22) {
      var ey = top + 6 * scale;
      px(ctx, bodyX + 4 * scale, ey, 2 * scale, 3 * scale, PLAYER_PAL.S);
      px(ctx, bodyX + 10 * scale, ey, 2 * scale, 3 * scale, PLAYER_PAL.S);
      var lidH = Math.max(1, 0.9 * scale);
      px(ctx, bodyX + 4 * scale, ey + 1.6 * scale, 2 * scale, lidH, '#a06a44');
      px(ctx, bodyX + 10 * scale, ey + 1.6 * scale, 2 * scale, lidH, '#a06a44');
    }

    // Candle flame above the wax (wax spans map cols 14-16 -> center 15).
    var candCol = flip ? (PLAYER_W - 15) : 15;
    var candX = bodyX + candCol * scale;
    var flameY = top + 13.6 * scale;
    flame(ctx, candX, flameY, t, 0.85 * scale);

    // Warm candle glow, drawn last so it lights his face and the ground.
    var flick = 0.5 + 0.5 * Math.sin(t * 9.1) + 0.12 * Math.sin(t * 23);
    glow(ctx, candX, flameY - 2 * scale, 11 * scale, '#ffb347',
      Math.max(0.06, 0.10 + flick * 0.05));
  }

  // ---------------------------------------------------------------------
  // Sanity check: every map row must be equal length (dev aid, warn only).
  // ---------------------------------------------------------------------
  function validateMaps() {
    var sets = {
      PLAYER_BODY: PLAYER_BODY,
      PLAYER_LEGS_IDLE: PLAYER_LEGS_IDLE,
      PLAYER_LEGS_WALK_A: PLAYER_LEGS_WALK_A,
      PLAYER_LEGS_WALK_B: PLAYER_LEGS_WALK_B
    };
    for (var name in sets) {
      var m = sets[name];
      for (var i = 0; i < m.length; i++) {
        if (m[i].length !== PLAYER_W) {
          console.warn('SPRITES: map ' + name + ' row ' + i +
            ' has length ' + m[i].length + ', expected ' + PLAYER_W);
        }
      }
    }
    if (PLAYER_BODY.length + PLAYER_LEGS_IDLE.length !== PLAYER_H) {
      console.warn('SPRITES: player body+legs rows != ' + PLAYER_H);
    }
  }
  validateMaps();

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------
  window.SPRITES = {
    draw: draw,
    px: px,
    dither: dither,
    glow: glow,
    star: star,
    flame: flame,
    candle: candle,
    torch: torch,
    moon: moon,
    drawPlayer: drawPlayer
  };

})();
