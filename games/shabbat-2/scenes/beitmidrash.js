'use strict';
/* ============================================================
 * DAF QUEST (Shabbat 2) — scene 'beitmidrash' (בית המדרש)
 * The study hall at dusk: bookshelves, hanging oil lamps, a bimah with
 * the giant Gemara, the sage trio, the Rav Mattana / Abaye counting
 * argument (SEAL 3: count), and the finale — שַׁעַר הָרְשֻׁיּוֹת
 * (the Gate of Domains), which needs all 3 seals + a 4-question quiz.
 * Owns ONLY this file. Relies on GAME / SPRITES / AUDIO contracts.
 * ============================================================ */
(function () {

  if (!window.GAME || typeof window.GAME.registerScene !== 'function') {
    if (window.console && console.warn) console.warn('beitmidrash.js: GAME.registerScene missing, scene not registered');
    return;
  }

  /* ---------------- palette (dusk interior — warm, not indigo) ---------------- */
  var PAL = {
    ceil: '#241a1c', beam: '#180f10',
    wall: '#4f3f52', wallDark: '#42344a',
    floor: '#5a3a24', floorLine: '#472d1b', floorLight: '#6b4530',
    wood: '#5a3a24', woodHi: '#7a512f', woodDark: '#4a2e1c', woodDeep: '#3a2416',
    brass: '#8a6a34', brassHi: '#caa84f',
    parch: '#e8d8a8', parchHi: '#f0e4bc', parchShade: '#c9b585', ink: '#5a4a33',
    amber: '#ffd166', amberMid: '#ffb347', amberDeep: '#ff8c42',
    stone: '#6b6b8f', stoneHi: '#8f8fb0', stoneDark: '#4a4a68',
    red: '#e63946', violet: '#a26bd4', teal: '#1f7a8c',
    skin: '#e8c39e',
    dusk1: '#3a2050', dusk2: '#7a3d5c', dusk3: '#d97a4a', dusk4: '#ffb347',
    rug: '#6e2436', rugHi: '#8a2f44', dark: '#241722'
  };

  var BOOK_COLS = ['#6e2436', '#1f7a8c', '#7a512f', '#a26bd4', '#3f6e3a', '#caa84f', '#4a5a8f', '#8a2f44'];

  var SEAL_SLOTS = ['handoff', 'domains', 'count'];
  var SEAL_COLORS = { handoff: '#e63946', domains: '#a26bd4', count: '#ffd166' };
  var SEAL_LABELS = { handoff: 'חותם המשא ומתן', domains: 'חותם הרשויות', count: 'חותם המניין' };

  /* ------------- scene-local animation state ------------- */
  var lastT = 0;
  var hiFiveAt = -99;     // sage trio's failed triple high-five
  var wokeAt = -99;       // gate flash-awake moment
  var argHopAt = -99;     // rav-matna/abaye extra emphatic gesture beat
  var argRunning = false; // guards the count puzzle from double-launch
  var quizRunning = false;

  /* ---------------- tiny draw helpers (fail-soft, no deps) ---------------- */
  function R(ctx, x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  }

  function ditherFill(ctx, x, y, w, h, c1, c2) {
    try {
      if (window.SPRITES && typeof SPRITES.dither === 'function') { SPRITES.dither(ctx, x, y, w, h, c1, c2); return; }
    } catch (e) { /* fall through */ }
    R(ctx, x, y, w, h, c1);
    ctx.fillStyle = c2;
    for (var yy = 0; yy < h; yy++) {
      for (var xx = (yy % 2); xx < w; xx += 2) ctx.fillRect(x + xx, y + yy, 1, 1);
    }
  }

  function safeGlow(ctx, x, y, r, color, alpha) {
    try {
      if (window.SPRITES && typeof SPRITES.glow === 'function') { SPRITES.glow(ctx, x, y, r, color, alpha); return; }
    } catch (e) { /* fall through */ }
    var steps = 4;
    for (var i = steps; i > 0; i--) {
      var rr = r * i / steps;
      ctx.globalAlpha = (alpha || 0.1) * (1 - i / (steps + 1));
      R(ctx, x - rr, y - rr / 2, rr * 2, rr, color);
    }
    ctx.globalAlpha = 1;
  }

  function safeStar(ctx, x, y, t, size, color) {
    try {
      if (window.SPRITES && typeof SPRITES.star === 'function') { SPRITES.star(ctx, x, y, t, size, color); return; }
    } catch (e) { /* fall through */ }
    if (Math.sin(t * 3 + x * 7 + y * 3) > -0.4) R(ctx, x, y, 1, 1, color || '#fff');
  }

  function safeCandle(ctx, x, y, t, scale) {
    try {
      if (window.SPRITES && typeof SPRITES.candle === 'function') { SPRITES.candle(ctx, x, y, t, scale); return; }
    } catch (e) { /* fall through */ }
    R(ctx, x - 1, y - 4, 3, 4, PAL.parch);
    var fh = 2 + (Math.sin(t * 12 + x) > 0.2 ? 1 : 0);
    R(ctx, x, y - 4 - fh, 1, fh, PAL.amber);
  }

  function safeSfx(name) {
    try { if (window.AUDIO && typeof AUDIO.sfx === 'function') AUDIO.sfx(name); }
    catch (e) { /* fail silent */ }
  }

  function safeMusic(mode) {
    try { if (window.AUDIO && typeof AUDIO.music === 'function') AUDIO.music(mode); }
    catch (e) { /* fail silent */ }
  }

  function hasSealSafe(g, id) {
    try { return !!(g && typeof g.hasSeal === 'function' && g.hasSeal(id)); }
    catch (e) { return false; }
  }

  function sealsIn(S) {
    return (S && S.seals) ? S.seals : [];
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

  function isBlink(t, phase) {
    return ((t + phase) % 3.9) < 0.13;
  }

  function hash2(a, b) {
    var n = (a * 73856093) ^ (b * 19349663);
    return Math.abs(n | 0);
  }

  /* ---------------- generic sage figure ---------------- */
  // Feet anchored at (x,y). o: {robe, robeShade, trim, hat, beard, stern,
  // armL, armR (0..1 raise), bobAmp, bobPh, blinkPh, alpha}
  function drawSage(ctx, x, y, t, o) {
    var a = (o.alpha == null) ? 1 : o.alpha;
    if (a < 1) { ctx.save(); ctx.globalAlpha = a; }
    var amp = (o.bobAmp == null) ? 0.9 : o.bobAmp;
    var by = y + Math.round(Math.sin(t * 1.9 + (o.bobPh || 0)) * amp);

    R(ctx, x - 6, by - 16, 12, 16, o.robe);
    R(ctx, x + 3, by - 16, 3, 16, o.robeShade);
    R(ctx, x - 6, by - 2, 12, 2, o.trim);
    R(ctx, x - 1, by - 16, 1, 14, o.trim);

    drawSageArm(ctx, x, by, -1, o.armL || 0, o);
    drawSageArm(ctx, x, by, 1, o.armR || 0, o);

    R(ctx, x - 4, by - 25, 8, 8, PAL.skin);
    if (!isBlink(t, o.blinkPh || 0)) {
      R(ctx, x - 3, by - 22, 1, 1, '#1a1a2e');
      R(ctx, x + 2, by - 22, 1, 1, '#1a1a2e');
    }
    if (o.stern) {
      R(ctx, x - 3, by - 23, 2, 1, '#8f8fb0');
      R(ctx, x + 1, by - 23, 2, 1, '#8f8fb0');
    }

    R(ctx, x - 3, by - 19, 6, 2, o.beard);
    R(ctx, x - 2, by - 17, 4, 4, o.beard);

    R(ctx, x - 4, by - 27, 8, 2, o.hat);
    R(ctx, x - 5, by - 25, 10, 1, o.hat);

    R(ctx, x - 4, by - 1, 3, 1, '#2a1c12');
    R(ctx, x + 1, by - 1, 3, 1, '#2a1c12');

    if (a < 1) ctx.restore();
  }

  function drawSageArm(ctx, x, by, side, raise, o) {
    var ax = x + (side < 0 ? -8 : 6);
    if (raise > 0.45) {
      var topY = by - 14 - Math.round(raise * 10);
      R(ctx, ax, topY, 2, (by - 10) - topY, o.robeShade);
      R(ctx, ax, topY - 2, 2, 2, PAL.skin);
    } else {
      R(ctx, ax, by - 15, 2, 6, o.robeShade);
      R(ctx, ax, by - 9, 2, 2, PAL.skin);
    }
  }

  /* ---------------- background pieces ---------------- */

  function drawShelf(ctx, x, w, seed) {
    R(ctx, x - 2, 16, w + 4, 104, PAL.woodDark);
    R(ctx, x, 18, w, 100, '#2e2018');
    for (var sy = 30; sy <= 114; sy += 14) {
      R(ctx, x, sy, w, 2, PAL.wood);
      var bx = x + 2;
      while (bx < x + w - 3) {
        var h1 = hash2(bx + seed, sy);
        if (h1 % 11 === 0) { bx += 4; continue; }
        var bw = 2 + (h1 % 3);
        var bh = 8 + (h1 % 4);
        R(ctx, bx, sy - bh, bw, bh, BOOK_COLS[(h1 >> 3) % BOOK_COLS.length]);
        if (h1 % 7 === 0) R(ctx, bx, sy - bh, bw, 1, PAL.brassHi);
        if (h1 % 13 === 0) R(ctx, bx, sy - bh - 3, bw + 3, 3, BOOK_COLS[(h1 >> 5) % BOOK_COLS.length]);
        bx += bw + 1;
      }
    }
    R(ctx, x - 2, 14, w + 4, 3, PAL.woodHi);
  }

  // Dusk sky through the window: violet horizon edges -> rose -> gold band.
  function drawWindow(ctx, t) {
    R(ctx, 64, 28, 30, 32, PAL.stone);
    R(ctx, 66, 34, 26, 24, PAL.dusk1);
    R(ctx, 68, 30, 22, 4, PAL.dusk1);
    ditherFill(ctx, 66, 40, 26, 6, PAL.dusk1, PAL.dusk2);
    R(ctx, 66, 46, 26, 6, PAL.dusk2);
    ditherFill(ctx, 66, 52, 26, 4, PAL.dusk2, PAL.dusk3);
    R(ctx, 66, 56, 26, 2, PAL.dusk4);
    // mullion cross
    R(ctx, 78, 30, 2, 28, PAL.stone);
    R(ctx, 66, 44, 26, 2, PAL.stone);
    // a few evening stars near the top, sun-glow low
    safeStar(ctx, 72, 36, t, 1, '#ffffff');
    safeStar(ctx, 87, 40, t + 1.4, 1, '#ffe9c0');
    safeGlow(ctx, 79, 56, 16, PAL.dusk4, 0.10 + 0.03 * Math.sin(t * 1.1));
    // a small bird silhouette drifting home before Shabbat
    var bx = 68 + ((t * 4) % 22);
    R(ctx, bx, 44 - Math.abs(Math.sin(t * 5)) * 2, 2, 1, PAL.dark);
    R(ctx, bx - 1, 45 - Math.abs(Math.sin(t * 5)) * 2, 1, 1, PAL.dark);
    // sill
    R(ctx, 64, 58, 30, 2, PAL.stoneHi);
  }

  function drawExitDoor(ctx, t) {
    R(ctx, 0, 70, 24, 66, PAL.stone);
    R(ctx, 2, 80, 18, 54, PAL.dark);
    R(ctx, 4, 76, 14, 4, PAL.dark);
    R(ctx, 6, 73, 10, 3, PAL.dark);
    R(ctx, 20, 82, 3, 10, PAL.stoneHi);
    R(ctx, 20, 102, 3, 10, PAL.stoneHi);
    R(ctx, 20, 122, 3, 10, PAL.stoneHi);
    R(ctx, 4, 71, 6, 3, PAL.stoneHi);
    R(ctx, 13, 71, 6, 3, PAL.stoneHi);
    R(ctx, 20, 96, 2, 5, PAL.brassHi);
    R(ctx, 21, 95, 1, 1, PAL.brassHi);
    R(ctx, 0, 134, 22, 3, PAL.stoneHi);
    // warm dusk light spilling in from the square (not cold night blue)
    safeGlow(ctx, 10, 112, 16, PAL.amberMid, 0.06 + 0.02 * Math.sin(t * 1.3));
  }

  function drawBimah(ctx, t) {
    R(ctx, 102, 116, 40, 10, PAL.wood);
    R(ctx, 102, 116, 40, 2, PAL.woodHi);
    R(ctx, 108, 126, 28, 4, PAL.woodDark);
    R(ctx, 112, 104, 20, 12, PAL.woodHi);
    R(ctx, 112, 104, 20, 1, PAL.brassHi);
    R(ctx, 114, 106, 2, 8, PAL.woodDark);
    R(ctx, 128, 106, 2, 8, PAL.woodDark);
    // the giant open Gemara
    R(ctx, 105, 92, 2, 13, PAL.rug);
    R(ctx, 137, 92, 2, 13, PAL.rug);
    R(ctx, 107, 92, 15, 12, PAL.parch);
    R(ctx, 122, 92, 15, 12, PAL.parchHi);
    R(ctx, 121, 92, 1, 12, PAL.parchShade);
    R(ctx, 107, 103, 30, 2, PAL.parchShade);
    var r;
    for (r = 0; r < 4; r++) {
      R(ctx, 109, 94 + r * 2, 7 - (r % 2) * 2, 1, PAL.ink);
      R(ctx, 117 - (r % 2), 94 + r * 2, 3, 1, PAL.ink);
    }
    for (r = 0; r < 4; r++) {
      R(ctx, 124, 94 + r * 2, 5 + (r % 2) * 3, 1, PAL.ink);
      R(ctx, 132, 94 + r * 2, 3 - (r % 2), 1, PAL.ink);
    }
    R(ctx, 124, 93, 10, 1, PAL.rugHi);
    safeGlow(ctx, 122, 96, 14, PAL.amber, 0.06);
    safeCandle(ctx, 139, 116, t, 1);
    R(ctx, 104, 113, 3, 3, '#1a1a2e');
    R(ctx, 106, 110, 1, 1, '#e8e8e8');
    R(ctx, 107, 109, 1, 1, '#e8e8e8');
    R(ctx, 108, 108, 1, 1, '#e8e8e8');
  }

  /* ---------------- שער הרשויות — the Gate of Domains (finale) ---------------- */
  function disc(ctx, cx, cy, r, c) {
    for (var dy = -r; dy <= r; dy++) {
      var dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      R(ctx, cx - dx, cy + dy, dx * 2 + 1, 1, c);
    }
  }

  function handLine(ctx, cx, cy, ang, len, c) {
    for (var i = 2; i <= len; i++) {
      R(ctx, cx + Math.round(Math.cos(ang) * i), cy + Math.round(Math.sin(ang) * i), 1, 1, c);
    }
  }

  function drawGate(ctx, t, S) {
    var seals = sealsIn(S);
    var flags = (S && S.flags) ? S.flags : {};
    var full = seals.length >= 3;
    var open = !!flags.won;

    // side columns
    R(ctx, 146, 44, 6, 80, PAL.wood);
    R(ctx, 146, 44, 2, 80, PAL.woodHi);
    R(ctx, 196, 44, 6, 80, PAL.wood);
    R(ctx, 196, 44, 2, 80, PAL.woodHi);
    R(ctx, 144, 40, 10, 4, PAL.brassHi);
    R(ctx, 194, 40, 10, 4, PAL.brassHi);

    // stepped arch top
    R(ctx, 158, 36, 32, 8, PAL.wood);
    R(ctx, 158, 35, 32, 1, PAL.brassHi);
    R(ctx, 165, 30, 18, 6, PAL.wood);
    R(ctx, 165, 29, 18, 1, PAL.brassHi);
    R(ctx, 171, 25, 6, 4, PAL.wood);

    // two door leaves — separate a little once opened (won)
    var gapOpen = open ? 5 : 0;
    R(ctx, 152, 44, 22 - gapOpen, 80, PAL.woodDark);
    R(ctx, 176 + gapOpen, 44, 22 - gapOpen, 80, PAL.woodDark);
    R(ctx, 155, 48, 16 - gapOpen, 72, PAL.wood);
    R(ctx, 178 + gapOpen, 48, 16 - gapOpen, 72, PAL.wood);
    // glowing seam of light when open
    if (open) {
      safeGlow(ctx, 174, 84, 10 + gapOpen * 2, PAL.amber, 0.35);
      R(ctx, 172, 48, 4, 72, PAL.amberHi || PAL.amber);
    }

    // carved parochet-like folds on each leaf
    for (var i = 0; i < 4; i++) {
      R(ctx, 157 + i * 4, 49, 4, 12, (i % 2 === 0) ? PAL.rug : PAL.rugHi);
      R(ctx, 179 + gapOpen + i * 4, 49, 4, 12, (i % 2 === 0) ? PAL.rugHi : PAL.rug);
    }
    R(ctx, 155, 60, 16 - gapOpen, 1, PAL.brassHi);
    R(ctx, 178 + gapOpen, 60, 16 - gapOpen, 1, PAL.brassHi);

    // ---- the domains dial (compass of ר"ה / ר"י / כרמלית / מקום פטור) ----
    disc(ctx, 174, 76, 12, '#2a1c30');
    disc(ctx, 174, 76, 11, PAL.brassHi);
    disc(ctx, 174, 76, 9, PAL.parch);
    // four soft quadrant tints hinting at the four domains
    ctx.save();
    ctx.globalAlpha = 0.5;
    R(ctx, 174, 67, 9, 9, PAL.stoneDark);   // ר"ה: open/public (top-right-ish, walled block)
    R(ctx, 165, 76, 9, 9, PAL.teal);        // ר"י: walled private
    R(ctx, 174, 76, 9, 9, '#3f6e3a');       // כרמלית: field green
    R(ctx, 165, 67, 9, 9, PAL.amberMid);    // מקום פטור: small raised ledge
    ctx.restore();
    for (var k = 0; k < 8; k++) {
      var a = k * Math.PI / 4;
      R(ctx, 174 + Math.round(Math.cos(a) * 8), 76 + Math.round(Math.sin(a) * 8), 1, 1, PAL.wood);
    }
    var ang;
    if (open) ang = -0.5;
    else if (full) ang = t * 0.8;
    else ang = Math.PI + Math.sin(t * 0.9) * 0.06;
    handLine(ctx, 174, 76, ang, 7, PAL.woodDark);
    R(ctx, 174, 76, 1, 1, PAL.red);

    // ---- three keyhole-seal-slots ----
    for (var s = 0; s < 3; s++) {
      var kx = 161 + s * 12;
      var id = SEAL_SLOTS[s];
      var has = seals.indexOf(id) !== -1;
      R(ctx, kx - 4, 94, 9, 13, PAL.brass);
      R(ctx, kx - 4, 94, 9, 1, PAL.brassHi);
      if (has) {
        var col = SEAL_COLORS[id] || PAL.amber;
        R(ctx, kx - 1, 97, 3, 3, col);
        R(ctx, kx, 100, 1, 4, col);
        if (Math.sin(t * 4 + s * 2) > 0.55) R(ctx, kx - 1, 97, 1, 1, '#ffffff');
        safeGlow(ctx, kx, 100, 8, col, 0.22);
      } else {
        R(ctx, kx - 1, 97, 3, 3, '#140d08');
        R(ctx, kx, 100, 1, 4, '#140d08');
      }
    }

    R(ctx, 173, 108, 1, 12, '#2a1a10');
    R(ctx, 170, 112, 2, 2, PAL.brassHi);
    R(ctx, 176, 112, 2, 2, PAL.brassHi);
    R(ctx, 144, 124, 60, 4, PAL.woodDeep);
    R(ctx, 144, 124, 60, 1, PAL.woodHi);

    if (open) {
      safeGlow(ctx, 174, 78, 50, PAL.amber, 0.18 + 0.05 * Math.sin(t * 3));
    } else if (full) {
      safeGlow(ctx, 174, 80, 40, PAL.amber, 0.08 + 0.04 * Math.sin(t * 2.5));
    } else {
      safeGlow(ctx, 174, 80, 26, PAL.amberMid, 0.04 + 0.015 * Math.sin(t * 0.8));
    }

    // recently woken by the quiz — dramatic flash
    if (lastT - wokeAt < 2.2 && wokeAt > 0) {
      safeGlow(ctx, 174, 76, 50, '#ffffff', 0.18 * Math.max(0, 1 - (lastT - wokeAt) / 2.2));
    }

    // idle murmur shimmer while incomplete (in place of the ark's snore)
    if (!full) {
      var mph = (t * 0.6) % 6;
      if (mph < 1.2) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 0.5 - mph * 0.35);
        R(ctx, 168, 44, 12, 2, PAL.stoneHi);
        ctx.restore();
      }
    }
  }

  /* ---------------- decor / micro-details ---------------- */
  function drawDecor(ctx, t, S) {
    // stacked books
    R(ctx, 30, 128, 12, 3, PAL.teal);
    R(ctx, 31, 125, 10, 3, PAL.rug);
    R(ctx, 32, 122, 9, 3, PAL.brassHi);
    R(ctx, 33, 122, 1, 3, PAL.parch);

    // scroll basket
    R(ctx, 296, 126, 14, 6, PAL.woodHi);
    R(ctx, 296, 126, 14, 1, PAL.woodDark);
    R(ctx, 298, 122, 3, 4, PAL.parch);
    R(ctx, 302, 121, 3, 5, PAL.parchHi);
    R(ctx, 306, 123, 3, 3, PAL.parch);

    // hourglass — sand falls forever (animated micro-detail)
    R(ctx, 291, 60, 8, 1, PAL.brass);
    R(ctx, 291, 69, 8, 1, PAL.brass);
    R(ctx, 291, 61, 1, 8, PAL.brass);
    R(ctx, 298, 61, 1, 8, PAL.brass);
    R(ctx, 293, 62, 4, 2, PAL.parch);
    R(ctx, 293, 66, 4, 2, PAL.parchShade);
    R(ctx, 294 + Math.floor(t * 2) % 2, 64 + Math.floor(t * 6) % 2, 1, 1, PAL.parch);

    // wall notice: a hand-drawn diagram of the four domains, mostly scribbles
    R(ctx, 214, 52, 16, 20, PAL.parch);
    R(ctx, 221, 51, 2, 2, PAL.red);
    R(ctx, 216, 56, 12, 1, PAL.ink);
    R(ctx, 216, 59, 4, 4, PAL.ink);   // little walled square = ר"י
    R(ctx, 222, 60, 6, 1, PAL.ink);   // open line = ר"ה
    R(ctx, 216, 66, 5, 3, PAL.ink);   // field blob = כרמלית
    R(ctx, 224, 68, 1, 1, PAL.ink);   // tiny dot = מקום פטור

    // cobweb, top-right corner (static, texture only)
    ctx.save();
    ctx.globalAlpha = 0.3;
    R(ctx, 314, 16, 6, 1, PAL.stoneHi);
    R(ctx, 316, 18, 4, 1, PAL.stoneHi);
    R(ctx, 318, 21, 2, 1, PAL.stoneHi);
    R(ctx, 315, 16, 1, 3, PAL.stoneHi);
    R(ctx, 317, 16, 1, 6, PAL.stoneHi);
    ctx.restore();

    // mouse peeking from the left shelf
    var mph = t % 9;
    if (mph < 1.5) {
      var mo = Math.min(Math.round(mph * 6), 2);
      R(ctx, 42, 84 - mo, 4, 2, PAL.stoneHi);
      R(ctx, 41, 84 - mo, 1, 1, PAL.stoneHi);
      R(ctx, 42, 84 - mo, 1, 1, '#1a1a2e');
      R(ctx, 46, 85 - mo, 2, 1, '#c9a0a0');
    }

    // dust motes in the lamplight
    ctx.save();
    ctx.globalAlpha = 0.25;
    for (var d = 0; d < 8; d++) {
      var base = (d < 4) ? 88 : 232;
      var dx = base + Math.round(Math.sin(t * 0.4 + d * 1.7) * 12);
      var dy = 34 + ((t * 3.5 + d * 17) % 52);
      R(ctx, dx, Math.round(dy), 1, 1, PAL.amber);
    }
    ctx.restore();

    // ner tamid above the gate
    R(ctx, 173, 14, 1, 4, PAL.brass);
    R(ctx, 171, 18, 5, 4, PAL.red);
    R(ctx, 172, 17, 3, 1, PAL.brassHi);
    if (Math.sin(t * 9) > -0.3) R(ctx, 173, 19, 1, 2, PAL.amber);
    safeGlow(ctx, 173, 20, 10, PAL.red, 0.10);

    // callback sight gag: a little two-candle candelabra on the right shelf,
    // candles light one by one as seals are collected (erev Shabbat urgency)
    var n = sealsIn(S).length;
    R(ctx, 290, 46, 2, 6, PAL.brass);
    R(ctx, 306, 46, 2, 6, PAL.brass);
    R(ctx, 289, 51, 4, 2, PAL.brassHi);
    R(ctx, 305, 51, 4, 2, PAL.brassHi);
    if (n >= 1) {
      var f1 = Math.sin(t * 9 + 1) > 0.1 ? 1 : 0;
      R(ctx, 290, 44 - f1, 2, 2 + f1, PAL.amberDeep);
      safeGlow(ctx, 291, 44, 6, PAL.amberMid, 0.10);
    }
    if (n >= 2) {
      var f2 = Math.sin(t * 9 + 2.4) > 0.1 ? 1 : 0;
      R(ctx, 306, 44 - f2, 2, 2 + f2, PAL.amberDeep);
      safeGlow(ctx, 307, 44, 6, PAL.amberMid, 0.10);
    }
  }

  function drawLamp(ctx, t, anchorX, phase) {
    var ang = Math.sin(t * 1.4 + phase) * 0.12;
    var lx = anchorX + Math.round(Math.sin(ang) * 26);
    var ly = 12 + Math.round(Math.cos(ang) * 14);
    for (var i = 0; i < 5; i++) {
      var cx = anchorX + Math.round((lx - anchorX) * i / 5);
      var cy = Math.round(ly * i / 5) + 2;
      R(ctx, cx, cy, 1, 2, PAL.brass);
    }
    R(ctx, lx - 6, ly, 12, 1, PAL.brassHi);
    R(ctx, lx - 5, ly + 1, 10, 3, PAL.brass);
    R(ctx, lx - 3, ly + 4, 6, 2, PAL.brass);
    R(ctx, lx - 1, ly + 6, 2, 1, PAL.brassHi);
    var fh = 3 + (Math.sin(t * 13 + phase * 7) > 0.25 ? 1 : 0);
    R(ctx, lx - 1, ly - fh, 3, fh, PAL.amberDeep);
    R(ctx, lx, ly - fh + 1, 1, fh - 1, PAL.amber);
    safeGlow(ctx, lx, ly, 24, PAL.amberMid, 0.09 + 0.02 * Math.sin(t * 5 + phase));
  }

  /* ---------------- characters ---------------- */

  // חבורת החכמים — three sages, always in unison (same bob/blink phase)
  function drawSagesTrio(ctx, t) {
    var xs = [213, 227, 241];
    var robes = [
      { robe: PAL.teal, shade: '#175e6d', hat: '#134c58' },
      { robe: '#7a4a9e', shade: '#5f3a7c', hat: '#4d2f66' },
      { robe: '#a63946', shade: '#832d38', hat: '#6e2436' }
    ];
    var dt = t - hiFiveAt;
    var raise = 0;
    if (dt > 0 && dt < 1.8) {
      if (dt < 0.8) raise = dt / 0.8;
      else if (dt < 1.2) raise = 1;
      else raise = Math.max(0, (1.8 - dt) / 0.6);
    }
    for (var i = 0; i < 3; i++) {
      var miss = [1.0, 0.65, 0.85][i]; // mismatched heights = the miss
      drawSage(ctx, xs[i], 142, t, {
        robe: robes[i].robe, robeShade: robes[i].shade, trim: PAL.brassHi,
        hat: robes[i].hat, beard: '#d8d8d8',
        armL: (i > 0) ? raise * miss : 0,
        armR: (i < 2) ? raise * miss : 0,
        bobAmp: 1.1, bobPh: 0, blinkPh: 0
      });
    }
  }

  // רב מתנה — pointing/arguing, exaggerated up-down gesture loop
  function drawRavMatna(ctx, t, x, y) {
    var arg = (Math.sin(t * 2.6) + 1) / 2; // 0..1 loop
    drawSage(ctx, x, y, t, {
      robe: '#832d38', robeShade: '#661f28', trim: PAL.brassHi,
      hat: '#5a1e24', beard: '#e8e0d0', stern: true,
      armR: 0.5 + 0.5 * arg, armL: 0,
      bobAmp: 1.0, bobPh: 0.4, blinkPh: 0.5
    });
  }

  // אביי — retorting, opposite-phase gesture loop (their arms cross paths)
  function drawAbaye(ctx, t, x, y) {
    var arg = (Math.sin(t * 2.6 + Math.PI) + 1) / 2;
    drawSage(ctx, x, y, t, {
      robe: '#4d2f66', robeShade: '#3a2450', trim: PAL.brassHi,
      hat: '#2c1c40', beard: '#c9bfae',
      armL: 0.5 + 0.5 * arg, armR: 0,
      bobAmp: 1.0, bobPh: 1.1, blinkPh: 1.6
    });
  }

  /* ---------------- dialogue: sage trio (the "collect the set" gag) ---------------- */

  async function sagesTalk(g) {
    var col = '#9ad1e0';
    if (!g.flag('bm_met_sages')) {
      g.flag('bm_met_sages', true);
      await g.say('שְׁתַּיִם שֶׁהֵן אַרְבַּע! שְׁתַּיִם שֶׁהֵן אַרְבַּע!!', { who: 'sages', color: col });
      await g.playerSay('אתם שרים את זה, או שזה סתם ככה יוצא לכם?');
      await g.say('זו לא שירה. זו תבנית! משנתנו פותחת ב"שתים שהן ארבע" — ואנחנו מוצאים אותה בכל מקום!', { who: 'sages', color: col });
    }
    var going = true;
    while (going) {
      var v = await g.choose([
        { text: 'איפה עוד היא מופיעה?', value: 'find' },
        { text: 'למה יש כל כך הרבה תבניות כאלה?', value: 'why' },
        { text: 'תנסו את הכיף המשולש?', value: 'five' },
        { text: 'להתראות, רבותיי.', value: 'bye' }
      ]);
      if (v === 'find') {
        await g.say('תְּנַן הָתָם: שְׁבוּעוֹת, שְׁתַּיִם שֶׁהֵן אַרְבַּע!', { who: 'sages', color: col });
        await g.say('וגם: יְדִיעוֹת הַטֻּמְאָה, שְׁתַּיִם שֶׁהֵן אַרְבַּע!', { who: 'sages', color: col });
        await g.say('וגם! וגם! מַרְאוֹת נְגָעִים, שְׁנַיִם שֶׁהֵן אַרְבָּעָה!', { who: 'sages', color: col });
        await g.say('שלוש דוגמאות נוספות! זה כבר אוסף!', { who: 'sages', color: col });
        hiFiveAt = lastT;
        g.sfx('quiz');
        await g.wait(700);
        g.sfx('fail');
        await g.say('(שלושתם מנסים כיף משולש חגיגי. ידיים מפספסות ידיים. באלגנטיות.)', { x: 227, y: 100 });
        await g.say('בהלכה תמיד מדויקים. בתיאום ידיים — עוד נלמד.', { who: 'sages', color: col });
      } else if (v === 'why') {
        await g.say('כי ככה לומדים תנאים: מלמדים דרך דוגמה חוזרת, עד שהתבנית נחקקת בלב.', { who: 'sages', color: col });
        await g.say('שבועות, טומאה, נגעים, ורשויות שבת — כולם באותו תבנית. תלמיד שמזהה אותה — כבר חצי מומחה.', { who: 'sages', color: col });
      } else if (v === 'five') {
        hiFiveAt = lastT;
        g.sfx('quiz');
        await g.wait(700);
        g.sfx('fail');
        await g.say('(שוב מפספסים. באותה הצלחה בדיוק.)', { x: 227, y: 100 });
        await g.say('תרתי סרי ניסיונות שהן ארבע עשרה. גם זה תבנית, כנראה.', { who: 'sages', color: col });
      } else {
        await g.say('שלום! שלום! שלום!', { who: 'sages', color: col });
        await g.playerSay('...בקול אחד. כמובן.');
        going = false;
      }
    }
  }

  /* ---------------- dialogue: Rav Mattana & Abaye — the counting fight ---------------- */

  function rmSay(g, text) { return g.say(text, { who: 'ravmatna', color: '#ff9a9a' }); }
  function abSay(g, text) { return g.say(text, { who: 'abaye', color: '#c9a0e8' }); }

  var COUNT_OPTIONS_BASE = [
    { text: '8', value: 8 },
    { text: '12', value: 12 },
    { text: '16', value: 16 },
    { text: '6', value: 6 }
  ];

  async function countArgument(g) {
    if (argRunning) {
      await g.playerSay('רגע... הם עדיין באמצע. שלא אפריע לספירה.');
      return;
    }
    if (hasSealSafe(g, 'count')) {
      await rmSay(g, 'עדיין תריסר, לדעתי. תריסר מכובד ומדויק.');
      await abSay(g, 'ואני עדיין חושב שש עשרה. אבל זה כבר לדף הבא.');
      return;
    }
    argRunning = true;
    try {
      await g.cutscene(async function () {
        argHopAt = lastT;
        g.sfx('click');
        await rmSay(g, 'אֲמַר לֵיהּ רַב מַתְנָה לְאַבָּיֵי: הָא תַּמְנֵי הָוְיָין?!');
        await rmSay(g, 'תַּרְתֵּי סְרֵי הָוְיָין!! שְׁמוֹנֶה זֶה לֹא נָכוֹן — יֵשׁ תְּרֵיסָר!');
        await g.playerSay('רגע, שמונה? תריסר? על מה בדיוק מדברים פה?');
        await rmSay(g, 'על המשנה שלנו! שישה מקרים, אבל בארבעה מהם שניים פועלים יחד — אחד פושט יד, השני נוטל או נותן.');
        await rmSay(g, 'ארבעה מקרים "שניהם פטורים" — ובכל אחד מהם שתי פעולות נפרדות. זה שמונה פעולות. ועוד ארבעה המקרים הפשוטים. יחד — תריסר!');
        argHopAt = lastT;
        await abSay(g, 'וְלִיטַעְמָיךְ שִׁיתְסְרֵי הָוְיָין!!', { who: 'abaye' });
        await abSay(g, 'אם אתה סופר כל יד בנפרד — גם בארבעת המקרים הפשוטים יש יד נותנת ויד מקבלת! שמונה ועוד שמונה — שש עשרה!');
        await rmSay(g, 'אָמַר לֵיהּ — הָא לָא קַשְׁיָא: בִּשְׁלָמָא...');
        await g.say('(שניהם קופאים באמצע המשפט. איכשהו יודעים ששנייה זו תסתיים רק בדף הבא.)', { x: 66, y: 96 });
        await g.playerSay('...זהו? זה נגמר ככה?');
        await rmSay(g, 'זה נמשך. תמיד נמשך. ככה זה בגמרא.');
        await rmSay(g, 'נו, זרח. אתה עומד שם עם עיניים גדולות. כמה פעולות יש כאן באמת, לדעתי?');
        var solved = false;
        while (!solved) {
          var ans = await g.choose(shuffled(COUNT_OPTIONS_BASE));
          if (ans === 12) {
            solved = true;
            g.sfx('seal');
            await rmSay(g, 'תְּרֵיסָר! בדיוק! ארבעה מקרים פשוטים ועוד שמונה פעולות מארבעת המקרים המשותפים.');
            g.addSeal('count', 'חותם המניין');
            await abSay(g, 'לפי שעה. אני עוד לא ויתרתי על השש עשרה שלי, שיהיה ברור.');
            await g.playerSay('אז זה עוד לא נגמר?');
            await abSay(g, 'אביי עוד לא ויתר. הוויכוח הזה ימשיך גם בדף הבא.');
            await g.playerSay('קיבלתי — חותם המניין! עוד רגע שער הרשויות ייפתח.');
          } else if (ans === 16) {
            await rmSay(g, 'זו דעתו של אביי — אבל אני, רב מתנה, טוען אחרת. תספור שוב לפי השיטה שלי.');
            g.sfx('click');
          } else {
            g.sfx('fail');
            await rmSay(g, 'לא ולא. תספור שוב — שישה מקרים, ותשומת לב למי עשה כל פעולה בעצמו.');
          }
        }
      });
    } finally {
      argRunning = false;
    }
  }

  /* ---------------- dialogue: gate finale ---------------- */

  var GATE_QUIZ = [
    {
      q: 'שאלה ראשונה: «יְצִיאוֹת הַשַּׁבָּת, שְׁתַּיִם שֶׁהֵן ___»',
      correct: 'ארבע',
      wrong: ['שלוש', 'שמונה']
    },
    {
      q: 'שאלה שנייה: הֶעָנִי פָּשַׁט אֶת יָדוֹ לִפְנִים וְנָתַן לְתוֹךְ יָדוֹ שֶׁל בַּעַל הַבַּיִת — מי חייב?',
      correct: 'העני חייב, בעל הבית פטור',
      wrong: ['בעל הבית חייב, העני פטור', 'שניהם פטורים']
    },
    {
      q: 'שאלה שלישית: מהי כַּרְמְלִית?',
      correct: 'מקום שאינו מוקף כראוי (מחיצות נמוכות מ־10 טפחים) ואין הרבים עוברים בו',
      wrong: [
        'מקום המוקף מחיצות גבוהות מ־10 טפחים, לפחות 4 על 4 טפחים',
        'מקום קטן מ־4 על 4 טפחים, מוגבה לפחות 3 טפחים מסביבתו'
      ]
    },
    {
      q: 'שאלה אחרונה: באיזה עוד שני מקומות במשנה מופיעה התבנית "שתים שהן ארבע"?',
      correct: 'שבועות ומראות נגעים',
      wrong: ['עירובין וסוכה', 'פסחים ותרומות']
    }
  ];

  var GATE_MOCK = [
    'לא בדיוק. אבל השער סבלני — הוא ריהוט אבן, יש לו זמן.',
    'טעות. נסה שוב, אין כאן שום עונש חוץ מקצת בושה קלה.',
    'הממם... לא. אפילו הדף הראשון לא מוותר עליך כל כך מהר. שוב!'
  ];

  var GATE_PRAISE = ['נכון!', 'מדויק!', 'דברי אמת!', 'כתוב כך בדף!'];

  function gateSay(g, text) {
    return g.say(text, { x: 174, y: 30, color: '#ffd166' });
  }

  async function gateFinale(g) {
    if (quizRunning) return;
    if (g.flag('won')) {
      await g.playerSay('השער כבר פתוח, והכפר כולו מדליק נרות. שבת שלום, זרח.');
      return;
    }

    var missing = [];
    for (var i = 0; i < SEAL_SLOTS.length; i++) {
      if (!g.hasSeal(SEAL_SLOTS[i])) missing.push(SEAL_SLOTS[i]);
    }

    if (missing.length > 0) {
      await gateSay(g, 'שָׁלוֹשׁ רְשֻׁיּוֹת חֲסֵרוֹת. שָׁלוֹשׁ הֲבָנוֹת חֲסֵרוֹת.');
      var names = [];
      for (var m = 0; m < missing.length; m++) names.push(SEAL_LABELS[missing[m]]);
      await g.playerSay('חסרים לי עוד: ' + names.join(', ') + '.');
      var hints = {
        handoff: 'את חותם המשא ומתן תמצא במבוי הקפוא — שני שכנים קפואים באמצע העברת יד.',
        domains: 'את חותם הרשויות ייתן לך הרוכל שמעון בשוק ערב שבת.',
        count: 'ואת חותם המניין תשמע מרב מתנה ואביי — הם ממש כאן, באותו חדר, עדיין מתווכחים.'
      };
      if (hints[missing[0]]) await g.playerSay(hints[missing[0]]);
      return;
    }

    quizRunning = true;
    try {
      await g.cutscene(async function () {
        safeMusic('tense');
        wokeAt = lastT;
        g.sfx('magic');
        await gateSay(g, 'שָׁלוֹשׁ רְשֻׁיּוֹת... שְׁלֵמוֹת. מי מעז לגשת אל שער הרשויות?');
        await g.playerSay('זרח מכפר שבתא! הבאתי את שלושת החותמות!');
        await gateSay(g, 'חותמות אכן פותחות מנעולים — אבל שער זה נפתח בדעת, לא רק במפתחות.');
        await gateSay(g, 'ארבע שאלות מן הדף. תטעה? ננסה שוב. אני שער, לא שופט.');

        for (var qi = 0; qi < GATE_QUIZ.length; qi++) {
          var q = GATE_QUIZ[qi];
          g.sfx('quiz');
          await gateSay(g, q.q);
          var options = shuffled(
            [{ text: q.correct, value: true }]
              .concat(q.wrong.map(function (w) { return { text: w, value: false }; }))
          );
          var mockIdx = 0;
          while (true) {
            var ans = await g.choose(options);
            if (ans === true) {
              g.sfx('seal');
              await gateSay(g, GATE_PRAISE[qi % GATE_PRAISE.length]);
              break;
            }
            g.sfx('fail');
            await gateSay(g, GATE_MOCK[mockIdx % GATE_MOCK.length]);
            mockIdx++;
          }
        }

        await gateSay(g, 'יְצִיאוֹת הַשַּׁבָּת... שְׁתַּיִם שֶׁהֵן אַרְבַּע... הֵבַנְתָּ אֶת הַכֹּל. הַשַּׁעַר נִפְתָּח!');
        await g.playerSay('מְחִיצַת הָרְשֻׁיּוֹת חוזרת למקומה! כל הכפר יכול לדעת שוב מה בפנים ומה בחוץ!');
        g.sfx('win');
        await g.wait(400);
        g.win();
      });
    } finally {
      quizRunning = false;
    }
  }

  /* ---------------- scene registration ---------------- */

  GAME.registerScene('beitmidrash', {
    name: 'בית המדרש',
    floor: { yMin: 120, yMax: 172 },

    paint: function (ctx, t, S) {
      lastT = t;
      try {
        // base fill + ceiling
        R(ctx, 0, 0, 320, 180, PAL.wall);
        R(ctx, 0, 0, 320, 12, PAL.ceil);
        R(ctx, 0, 12, 320, 2, PAL.beam);
        R(ctx, 38, 0, 4, 12, PAL.beam);
        R(ctx, 118, 0, 4, 12, PAL.beam);
        R(ctx, 198, 0, 4, 12, PAL.beam);
        R(ctx, 278, 0, 4, 12, PAL.beam);

        R(ctx, 0, 14, 320, 10, PAL.wallDark);

        R(ctx, 0, 112, 320, 8, PAL.woodDark);
        R(ctx, 0, 112, 320, 1, PAL.woodHi);

        R(ctx, 0, 120, 320, 60, PAL.floor);
        var ys = [123, 127, 132, 138, 145, 153, 162, 171];
        for (var i = 0; i < ys.length; i++) R(ctx, 0, ys[i], 320, 1, PAL.floorLine);
        for (var v = 0; v < 10; v++) {
          R(ctx, 16 + v * 32 + (v % 2) * 12, 132, 1, 6, PAL.floorLine);
          R(ctx, 8 + v * 34 + (v % 3) * 8, 153, 1, 9, PAL.floorLine);
        }

        // warm rug in front of the gate
        R(ctx, 118, 142, 110, 22, PAL.rug);
        R(ctx, 122, 144, 102, 18, PAL.rugHi);
        R(ctx, 128, 148, 90, 10, PAL.rug);
        R(ctx, 118, 142, 110, 1, PAL.brassHi);
        R(ctx, 118, 163, 110, 1, PAL.brassHi);
        for (var rd = 0; rd < 6; rd++) R(ctx, 134 + rd * 16, 152, 2, 2, PAL.brassHi);

        drawExitDoor(ctx, t);
        drawShelf(ctx, 26, 36, 3);
        drawShelf(ctx, 276, 40, 11);
        drawWindow(ctx, t);
        drawBimah(ctx, t);
        drawGate(ctx, t, S);
        drawDecor(ctx, t, S);

        drawLamp(ctx, t, 88, 0);
        drawLamp(ctx, t, 232, 2.4);

        safeGlow(ctx, 160, 92, 92, PAL.amberMid, 0.05);
      } catch (e) {
        // never let a paint bug kill the frame
        R(ctx, 0, 0, 320, 180, '#241722');
      }
    },

    onEnter: async function (g) {
      try {
        if (!g.flag('bm_visited')) {
          g.flag('bm_visited', true);
          await g.cutscene(async function () {
            await g.playerSay('בית המדרש זוהר גם עכשיו, בין השמשות. שלושה חורי מנעול על השער... שלושה חותמות.');
            await g.playerSay('ושם — רב מתנה ואביי. נשמע כמו ויכוח שלא נגמר.');
          });
        } else if (!g.flag('won') &&
          g.hasSeal('handoff') && g.hasSeal('domains') && g.hasSeal('count') &&
          !g.flag('bm_ready_hint')) {
          g.flag('bm_ready_hint', true);
          await g.playerSay('שלושת החותמות אצלי! שער הרשויות מחכה.');
        }
      } catch (e) { /* never crash on entry */ }
    },

    hotspots: [

      /* ---- exit back to the square ---- */
      {
        id: 'exit_square', name: 'היציאה לכיכר', type: 'exit',
        x: 0, y: 76, w: 22, h: 60,
        walkTo: { x: 14, y: 140 },
        target: 'square', spawn: { x: 160, y: 150 },
        look: async function (g) {
          await g.playerSay('הדלת חזרה לכיכר כפר שבתא. השמש עוד לא שקעה לגמרי — עוד יש זמן.');
        }
      },

      /* ---- חבורת החכמים ---- */
      {
        id: 'sages', name: 'חבורת החכמים', type: 'char',
        x: 204, y: 104, w: 46, h: 40,
        walkTo: { x: 227, y: 148 },
        draw: function (ctx, t) { drawSagesTrio(ctx, t); },
        look: async function (g) {
          await g.playerSay('שלושה חכמים לומדים יחד, נושמים יחד, ומצטטים יחד. קצת מפחיד, קצת מרגש.');
        },
        talk: sagesTalk,
        take: async function (g) {
          await g.playerSay('אי אפשר לקחת רק אחד. הם באים בשלישייה, כמו התבנית שהם אוהבים כל כך.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('כתוב כאן: «יציאות השבת, שתים שהן ארבע בפנים, ושתים שהן ארבע בחוץ».');
            await g.say('זו התבנית! זו התבנית שלנו!', { who: 'sages', color: '#9ad1e0' });
          } else {
            await g.playerSay('הם מסונכרנים מדי בשביל זה.');
          }
        }
      },

      /* ---- רב מתנה ---- */
      {
        id: 'ravmatna', name: 'רב מתנה', type: 'char',
        x: 34, y: 100, w: 22, h: 40,
        walkTo: { x: 48, y: 144 },
        draw: function (ctx, t) { drawRavMatna(ctx, t, 46, 140); },
        look: async function (g) {
          if (hasSealSafe(g, 'count')) {
            await g.playerSay('רב מתנה, שקט להפליא לאחר ניצחון. לבינתיים.');
          } else {
            await g.playerSay('רב מתנה מונה על אצבעותיו, שוב ושוב. אצבעותיו כבר עייפות.');
          }
        },
        talk: countArgument,
        take: async function (g) {
          await g.playerSay('לקחת חכם באמצע ויכוח? זה כמעט תמיד רעיון רע.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('הדף עדיין לא מכריע בין רב מתנה לאביי. גם הוא מחכה לדף הבא.');
          } else {
            await g.playerSay('הוא באמצע ספירה. עדיף לא להפריע.');
          }
        }
      },

      /* ---- אביי ---- */
      {
        id: 'abaye', name: 'אביי', type: 'char',
        x: 60, y: 100, w: 22, h: 40,
        walkTo: { x: 74, y: 144 },
        draw: function (ctx, t) { drawAbaye(ctx, t, 72, 140); },
        look: async function (g) {
          if (hasSealSafe(g, 'count')) {
            await g.playerSay('אביי, זרוע מונפת עדיין. הוא לא באמת ויתר.');
          } else {
            await g.playerSay('אביי מונה גם הוא, בדיוק הפוך מרב מתנה. משהו כאן לא ייגמר בקרוב.');
          }
        },
        talk: countArgument,
        take: async function (g) {
          await g.playerSay('אביי לא מפסיק לספור באמצע. גם לא כדי להילקח.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('«אָמַר לֵיהּ — הָא לָא קַשְׁיָא: בִּשְׁלָמָא...» — והדף פשוט נגמר שם. אכזרי.');
          } else {
            await g.playerSay('גם הוא באמצע ספירה. תור.');
          }
        }
      },

      /* ---- ספר גמרא ענק ---- */
      {
        id: 'gemara', name: 'ספר גמרא ענק', type: 'object',
        x: 100, y: 84, w: 44, h: 46,
        walkTo: { x: 122, y: 142 },
        look: async function (g) {
          await g.say('«יְצִיאוֹת הַשַּׁבָּת, שְׁתַּיִם שֶׁהֵן אַרְבַּע בִּפְנִים, וּשְׁתַּיִם שֶׁהֵן אַרְבַּע בַּחוּץ.»', { x: 122, y: 84, color: '#e8d8a8' });
          await g.playerSay('שתיים... שהן ארבע... בפנים... ואז עוד ארבע בחוץ. כדאי שיהיה לי דף משלי.');
        },
        talk: async function (g) {
          await g.playerSay('הספר לא עונה. אבל אם מקשיבים חזק — שומעים ניגון של סוגיה, ומריחים אבק ישן.');
        },
        take: async function (g) {
          if (!g.has('daf')) {
            g.give('daf');
            await g.playerSay('לקחתי דף אחד. דף היומי, פשוטו כמשמעו.');
            await g.playerSay('אם אתקע — אשתמש בו. הוא כבר יודע את כל הסיפור.');
          } else {
            await g.playerSay('דף אחד ליום. יותר מזה — צריך חברותא.');
          }
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('להשתמש בדף על הספר שממנו הוא הגיע? זה מעגלי מדי בשבילי.');
          } else {
            await g.playerSay('עדיף לא להניח דברים על הגמרא. יש כבוד.');
          }
        }
      },

      /* ---- שער הרשויות — THE FINALE ---- */
      {
        id: 'gate', name: 'שער הרשויות', type: 'object',
        x: 144, y: 24, w: 60, h: 104,
        walkTo: { x: 174, y: 144 },
        look: async function (g) {
          var n = 0;
          for (var i = 0; i < SEAL_SLOTS.length; i++) if (g.hasSeal(SEAL_SLOTS[i])) n++;
          await g.playerSay('שער עתיק, גדול, עם חוגה שנעה בין ארבע רשויות ושלושה חורי מנעול.');
          if (n === 0) await g.playerSay('שלושת חורי המנעול ריקים. השער רוטט קלות, כמו ממלמל משהו.');
          else if (n < 3) await g.playerSay('שלושה חורי מנעול. ' + n + ' מהם כבר זוהרים. עוד קצת.');
          else await g.playerSay('שלושת החורים זוהרים! החוגה מסתובבת... השער מתעורר!');
        },
        talk: function (g) { return gateFinale(g); },
        use: function (g, itemId) {
          if (itemId === 'daf') {
            return (async function () {
              await g.playerSay('אני מצמיד את הדף לשער...');
              await gateSay(g, 'ריח של תורה. נחמד. אבל אני נפתח בחותמות ובדעת, לא בנייר.');
            })();
          }
          return gateFinale(g);
        },
        take: async function (g) {
          await g.playerSay('הוא שער. אני זרח. יש הבדלי משקל מהותיים בינינו.');
        }
      }
    ]
  });

})();
