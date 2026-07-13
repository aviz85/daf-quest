/* ============================================================
 * DAF QUEST — scene 'beitmidrash' (בית המדרש)
 * The glowing study hall: sages, the giant Gemara, and the
 * ancient Ark of Times ("ארון הזמנים") with its clock-lock.
 * Owns ONLY this file. Relies on GAME / SPRITES / AUDIO contracts.
 * ============================================================ */
(function () {
  'use strict';

  if (!window.GAME || typeof window.GAME.registerScene !== 'function') {
    return; // engine missing — fail silent
  }

  /* ---------------- palette ---------------- */
  var PAL = {
    ceil: '#241812', beam: '#170e08',
    wall: '#3d3159', wallDark: '#332a4d',
    floor: '#5a3a24', floorLine: '#472d1b', floorLight: '#6b4530',
    wood: '#5a3a24', woodHi: '#7a512f', woodDark: '#4a2e1c', woodDeep: '#3a2416',
    brass: '#8a6a34', brassHi: '#caa84f',
    parch: '#e8d8a8', parchHi: '#f0e4bc', parchShade: '#c9b585', ink: '#5a4a33',
    amber: '#ffd166', amberMid: '#ffb347', amberDeep: '#ff8c42',
    stone: '#6b6b8f', stoneHi: '#8f8fb0',
    red: '#e63946', violet: '#a26bd4', teal: '#1f7a8c',
    skin: '#e8c39e', night: '#0a0a23', night2: '#141440', night3: '#232366',
    rug: '#6e2436', rugHi: '#8a2f44', dark: '#161028'
  };

  var BOOK_COLS = ['#6e2436', '#1f7a8c', '#7a512f', '#a26bd4', '#3f6e3a', '#caa84f', '#4a5a8f', '#8a2f44'];

  var SEAL_SLOTS = ['stars', 'midnight', 'watch'];
  var SEAL_COLORS = { stars: '#ffd166', midnight: '#a26bd4', watch: '#e63946' };
  var SEAL_LABELS = { stars: 'חותם הכוכבים', midnight: 'חותם חצות', watch: 'חותם המשמרות' };

  /* ------------- scene-local animation state ------------- */
  var lastT = 0;        // updated every paint frame
  var hiFiveAt = -99;   // when the sages attempted the triple high-five
  var snoreAt = -99;    // when the ark last snored
  var wokeAt = -99;     // when the ark woke for the quiz
  var quizRunning = false;

  /* ---------------- tiny draw helpers ---------------- */
  function R(ctx, x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  }

  function safeGlow(ctx, x, y, r, color, alpha) {
    try {
      if (window.SPRITES && SPRITES.glow) SPRITES.glow(ctx, x, y, r, color, alpha);
    } catch (e) { /* fail silent */ }
  }

  function safeStar(ctx, x, y, t, size, color) {
    try {
      if (window.SPRITES && SPRITES.star) { SPRITES.star(ctx, x, y, t, size, color); return; }
    } catch (e) { /* fall through */ }
    // fallback: twinkling pixel
    if (Math.sin(t * 3 + x * 7 + y * 3) > -0.4) R(ctx, x, y, 1, 1, color || '#fff');
  }

  function safeCandle(ctx, x, y, t, scale) {
    try {
      if (window.SPRITES && SPRITES.candle) { SPRITES.candle(ctx, x, y, t, scale); return; }
    } catch (e) { /* fall through */ }
    // fallback candle: stub + flicker
    R(ctx, x - 1, y - 4, 3, 4, PAL.parch);
    var fh = 2 + (Math.sin(t * 12 + x) > 0.2 ? 1 : 0);
    R(ctx, x, y - 4 - fh, 1, fh, PAL.amber);
  }

  function disc(ctx, cx, cy, r, c) {
    for (var dy = -r; dy <= r; dy++) {
      var dx = Math.floor(Math.sqrt(r * r - dy * dy));
      R(ctx, cx - dx, cy + dy, dx * 2 + 1, 1, c);
    }
  }

  function handLine(ctx, cx, cy, ang, len, c) {
    for (var i = 2; i <= len; i++) {
      R(ctx, cx + Math.round(Math.cos(ang) * i), cy + Math.round(Math.sin(ang) * i), 1, 1, c);
    }
  }

  function isBlink(t, phase) {
    return ((t + phase) % 3.9) < 0.13;
  }

  // deterministic pseudo-random for decor (stable per frame)
  function hash2(a, b) {
    var n = (a * 73856093) ^ (b * 19349663);
    return Math.abs(n | 0);
  }

  /* ---------------- character drawing ---------------- */

  // Generic standing sage, feet anchored at (x,y). ~14w x 27h.
  // o: {robe, robeShade, trim, hat, beard, stern, armL, armR, bobAmp, bobPh, blinkPh, alpha}
  function drawSage(ctx, x, y, t, o) {
    var a = (o.alpha == null) ? 1 : o.alpha;
    if (a < 1) { ctx.save(); ctx.globalAlpha = a; }
    var amp = (o.bobAmp == null) ? 0.9 : o.bobAmp;
    var by = y + Math.round(Math.sin(t * 1.9 + (o.bobPh || 0)) * amp);

    // robe body
    R(ctx, x - 6, by - 16, 12, 16, o.robe);
    R(ctx, x + 3, by - 16, 3, 16, o.robeShade);
    R(ctx, x - 6, by - 2, 12, 2, o.trim);
    R(ctx, x - 1, by - 16, 1, 14, o.trim); // center seam

    // arms (sleeves), raise 0..1
    drawSageArm(ctx, x, by, -1, o.armL || 0, o);
    drawSageArm(ctx, x, by, 1, o.armR || 0, o);

    // head
    R(ctx, x - 4, by - 25, 8, 8, PAL.skin);
    if (!isBlink(t, o.blinkPh || 0)) {
      R(ctx, x - 3, by - 22, 1, 1, '#1a1a2e');
      R(ctx, x + 2, by - 22, 1, 1, '#1a1a2e');
    }
    if (o.stern) { // bushy stern eyebrows
      R(ctx, x - 3, by - 23, 2, 1, '#8f8fb0');
      R(ctx, x + 1, by - 23, 2, 1, '#8f8fb0');
    }

    // beard hanging over the collar
    R(ctx, x - 3, by - 19, 6, 2, o.beard);
    R(ctx, x - 2, by - 17, 4, 4, o.beard);

    // turban / hat
    R(ctx, x - 4, by - 27, 8, 2, o.hat);
    R(ctx, x - 5, by - 25, 10, 1, o.hat);

    // feet
    R(ctx, x - 4, by - 1, 3, 1, '#2a1c12');
    R(ctx, x + 1, by - 1, 3, 1, '#2a1c12');

    if (a < 1) ctx.restore();
  }

  function drawSageArm(ctx, x, by, side, raise, o) {
    var ax = x + (side < 0 ? -8 : 6);
    if (raise > 0.45) {
      var topY = by - 14 - Math.round(raise * 10);
      R(ctx, ax, topY, 2, (by - 10) - topY, o.robeShade);
      R(ctx, ax, topY - 2, 2, 2, PAL.skin); // hand up
    } else {
      R(ctx, ax, by - 15, 2, 6, o.robeShade);
      R(ctx, ax, by - 9, 2, 2, PAL.skin); // hand down
    }
  }

  // Empty wooden chair (Rabbi Eliezer's rival), feet line at (x,y)
  function drawChair(ctx, x, y) {
    R(ctx, x - 5, y - 8, 10, 2, PAL.woodHi);   // seat
    R(ctx, x - 5, y - 6, 1, 6, PAL.woodDark);  // legs
    R(ctx, x + 4, y - 6, 1, 6, PAL.woodDark);
    R(ctx, x - 3, y - 6, 1, 5, PAL.wood);
    R(ctx, x + 2, y - 6, 1, 5, PAL.wood);
    R(ctx, x + 3, y - 20, 2, 12, PAL.wood);    // backrest post
    R(ctx, x - 5, y - 18, 8, 1, PAL.woodHi);   // back slats
    R(ctx, x - 5, y - 15, 8, 1, PAL.woodHi);
    R(ctx, x - 5, y - 12, 8, 1, PAL.woodHi);
  }

  // Rabban Gamliel, seated with tea, feet line at (x,y). Faces left.
  function drawGamliel(ctx, x, y, t) {
    // divan
    R(ctx, x - 9, y - 7, 22, 7, PAL.rug);
    R(ctx, x - 9, y - 7, 22, 1, PAL.brassHi);
    R(ctx, x - 8, y - 1, 2, 1, PAL.woodDark);
    R(ctx, x + 10, y - 1, 2, 1, PAL.woodDark);

    // lap (legs folded forward, to the left)
    R(ctx, x - 9, y - 10, 9, 4, '#c9bfae');
    // torso
    R(ctx, x - 5, y - 20, 11, 11, '#ddd3c2');
    R(ctx, x + 3, y - 20, 3, 11, '#c9bfae');
    R(ctx, x - 5, y - 20, 11, 1, PAL.brassHi); // collar trim

    // head
    R(ctx, x - 4, y - 28, 8, 8, PAL.skin);
    if (!isBlink(t, 1.7)) {
      R(ctx, x - 3, y - 25, 1, 1, '#1a1a2e');
      R(ctx, x + 2, y - 25, 1, 1, '#1a1a2e');
    }
    // long calm white beard
    R(ctx, x - 3, y - 22, 6, 2, '#f0f0f0');
    R(ctx, x - 2, y - 20, 4, 5, '#f0f0f0');
    // white turban with a tiny jewel
    R(ctx, x - 4, y - 30, 8, 3, '#f0ead8');
    R(ctx, x - 5, y - 28, 10, 1, '#f0ead8');
    R(ctx, x - 1, y - 29, 1, 1, PAL.red);

    // tea: cup cycles between lap and mouth
    var sip = (t + 1.2) % 5;
    var cupX, cupY;
    if (sip < 0.9) { cupX = x - 8; cupY = y - 24; } // at mouth
    else { cupX = x - 10; cupY = y - 13; }          // on lap
    // arm sleeve toward cup
    R(ctx, x - 7, Math.min(cupY + 2, y - 13), 3, 3, '#c9bfae');
    // cup + tea + handle
    R(ctx, cupX, cupY, 3, 3, '#f4f4f4');
    R(ctx, cupX, cupY, 3, 1, PAL.woodHi);
    R(ctx, cupX + 3, cupY + 1, 1, 1, '#f4f4f4');
    // steam
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (var k = 0; k < 2; k++) {
      var sx = cupX + 1 + Math.round(Math.sin(t * 3 + k * 2.1));
      R(ctx, sx, cupY - 2 - k * 2, 1, 1, '#cccccc');
    }
    ctx.restore();

    // side table with teapot
    R(ctx, x + 13, y - 9, 10, 2, PAL.woodHi);
    R(ctx, x + 14, y - 7, 1, 7, PAL.woodDark);
    R(ctx, x + 21, y - 7, 1, 7, PAL.woodDark);
    R(ctx, x + 15, y - 13, 6, 4, PAL.brassHi); // teapot body
    R(ctx, x + 14, y - 12, 1, 2, PAL.brass);   // spout
    R(ctx, x + 17, y - 14, 2, 1, PAL.brass);   // lid
  }

  // Ghostly Tanna floating near the ceiling. (x,y) = bottom of his robe.
  function drawTanna(ctx, x, y, t, pasuk) {
    var bobAmp = pasuk ? 0.8 : 2.5;
    var gy = y + Math.round(Math.sin(t * 1.6) * bobAmp);

    // floating glowing pasuk scroll he stands on (after the gag)
    if (pasuk) {
      var sy = y + 2;
      safeGlow(ctx, x, sy + 3, 20, PAL.amber, 0.14);
      R(ctx, x - 16, sy, 32, 7, PAL.parch);
      R(ctx, x - 16, sy, 32, 1, PAL.parchHi);
      R(ctx, x - 18, sy, 2, 7, PAL.parchShade); // rolled ends
      R(ctx, x + 16, sy, 2, 7, PAL.parchShade);
      // unreadable holy dashes
      R(ctx, x - 12, sy + 2, 8, 1, PAL.ink);
      R(ctx, x - 2, sy + 2, 6, 1, PAL.ink);
      R(ctx, x - 10, sy + 4, 5, 1, PAL.ink);
      R(ctx, x - 3, sy + 4, 9, 1, PAL.ink);
      if (Math.sin(t * 4) > 0.5) R(ctx, x + 14, sy - 1, 1, 1, '#ffffff');
      if (Math.sin(t * 4 + 2) > 0.5) R(ctx, x - 17, sy + 6, 1, 1, '#ffffff');
      gy = sy - 1; // stand ON the scroll
    }

    ctx.save();
    ctx.globalAlpha = 0.6 + 0.08 * Math.sin(t * 2.6);
    safeGlow(ctx, x, gy - 12, 16, '#bcd4e8', 0.10);

    // wavy ghost tail (no feet — he is a ghost, not a poseq of gravity)
    for (var k = 0; k < 3; k++) {
      var off = Math.round(Math.sin(t * 3 + k * 2));
      R(ctx, x - 5 + k * 4 + off, gy - 2, 3, 2, '#a9c4dd');
    }
    // robe
    R(ctx, x - 6, gy - 16, 12, 14, '#bcd4e8');
    R(ctx, x + 3, gy - 16, 3, 14, '#a9c4dd');
    // arms slightly spread
    R(ctx, x - 8, gy - 15, 2, 5, '#a9c4dd');
    R(ctx, x + 6, gy - 15, 2, 5, '#a9c4dd');
    R(ctx, x - 8, gy - 10, 2, 2, '#e8f0f8');
    R(ctx, x + 6, gy - 10, 2, 2, '#e8f0f8');
    // head
    R(ctx, x - 4, gy - 25, 8, 8, '#e8f0f8');
    if (!isBlink(t, 2.9)) {
      R(ctx, x - 3, gy - 22, 1, 1, '#3a5a7a');
      R(ctx, x + 2, gy - 22, 1, 1, '#3a5a7a');
    }
    // beard + turban, all pale
    R(ctx, x - 3, gy - 19, 6, 2, '#ffffff');
    R(ctx, x - 2, gy - 17, 4, 3, '#ffffff');
    R(ctx, x - 4, gy - 27, 8, 2, '#d8e6f2');
    R(ctx, x - 5, gy - 25, 10, 1, '#d8e6f2');
    ctx.restore();
  }

  // Little pixel "Z" (for the snoring ark)
  function drawZ(ctx, x, y, c) {
    R(ctx, x, y, 3, 1, c);
    R(ctx, x + 1, y + 1, 1, 1, c);
    R(ctx, x, y + 2, 3, 1, c);
  }

  /* ---------------- background pieces ---------------- */

  function drawShelf(ctx, x, w, seed) {
    // frame + dark interior
    R(ctx, x - 2, 16, w + 4, 104, PAL.woodDark);
    R(ctx, x, 18, w, 100, '#2e1c10');
    // shelf boards + books
    for (var sy = 30; sy <= 114; sy += 14) {
      R(ctx, x, sy, w, 2, PAL.wood);
      var bx = x + 2;
      while (bx < x + w - 3) {
        var h1 = hash2(bx + seed, sy);
        if (h1 % 11 === 0) { bx += 4; continue; } // gap
        var bw = 2 + (h1 % 3);
        var bh = 8 + (h1 % 4);
        R(ctx, bx, sy - bh, bw, bh, BOOK_COLS[(h1 >> 3) % BOOK_COLS.length]);
        if (h1 % 7 === 0) R(ctx, bx, sy - bh, bw, 1, PAL.brassHi); // gilded top
        if (h1 % 13 === 0) { // a book lying flat on top of its friends
          R(ctx, bx, sy - bh - 3, bw + 3, 3, BOOK_COLS[(h1 >> 5) % BOOK_COLS.length]);
        }
        bx += bw + 1;
      }
    }
    R(ctx, x - 2, 14, w + 4, 3, PAL.woodHi); // crown
  }

  function drawWindow(ctx, t) {
    // arched window at (66..92, 30..58): cold night vs warm room
    R(ctx, 64, 28, 30, 32, PAL.stone);
    R(ctx, 66, 34, 26, 24, PAL.night);
    R(ctx, 68, 30, 22, 4, PAL.night);
    R(ctx, 66, 46, 26, 6, PAL.night2);
    R(ctx, 66, 52, 26, 6, PAL.night3);
    // mullion cross
    R(ctx, 78, 30, 2, 28, PAL.stone);
    R(ctx, 66, 44, 26, 2, PAL.stone);
    // stars + tiny crescent
    safeStar(ctx, 72, 38, t, 1, '#ffffff');
    safeStar(ctx, 87, 41, t + 1.4, 1, '#ffd166');
    safeStar(ctx, 84, 55, t + 0.7, 1, '#ffffff');
    R(ctx, 73, 49, 2, 4, PAL.parchHi);
    R(ctx, 72, 50, 1, 2, PAL.parchHi);
    R(ctx, 74, 48, 1, 1, PAL.night2); // crescent bite
    // sill
    R(ctx, 64, 58, 30, 2, PAL.stoneHi);
  }

  function drawExitDoor(ctx) {
    // arched doorway to the square, left edge
    R(ctx, 0, 70, 24, 66, PAL.stone);
    R(ctx, 2, 80, 18, 54, PAL.dark);
    R(ctx, 4, 76, 14, 4, PAL.dark);
    R(ctx, 6, 73, 10, 3, PAL.dark);
    // stone blocks on the frame
    R(ctx, 20, 82, 3, 10, PAL.stoneHi);
    R(ctx, 20, 102, 3, 10, PAL.stoneHi);
    R(ctx, 20, 122, 3, 10, PAL.stoneHi);
    R(ctx, 4, 71, 6, 3, PAL.stoneHi);
    R(ctx, 13, 71, 6, 3, PAL.stoneHi);
    // mezuzah (slanted-ish)
    R(ctx, 20, 96, 2, 5, PAL.brassHi);
    R(ctx, 21, 95, 1, 1, PAL.brassHi);
    // threshold step + faint cold light spilling in
    R(ctx, 0, 134, 22, 3, PAL.stoneHi);
    safeGlow(ctx, 10, 110, 16, '#8f8fb0', 0.05);
  }

  function drawBimah(ctx, t) {
    // raised platform
    R(ctx, 102, 116, 40, 10, PAL.wood);
    R(ctx, 102, 116, 40, 2, PAL.woodHi);
    R(ctx, 108, 126, 28, 4, PAL.woodDark); // front step
    // lectern column
    R(ctx, 112, 104, 20, 12, PAL.woodHi);
    R(ctx, 112, 104, 20, 1, PAL.brassHi);
    R(ctx, 114, 106, 2, 8, PAL.woodDark);
    R(ctx, 128, 106, 2, 8, PAL.woodDark);
    // THE giant open Gemara
    R(ctx, 105, 92, 2, 13, PAL.rug);       // left cover
    R(ctx, 137, 92, 2, 13, PAL.rug);       // right cover
    R(ctx, 107, 92, 15, 12, PAL.parch);    // left page
    R(ctx, 122, 92, 15, 12, PAL.parchHi);  // right page
    R(ctx, 121, 92, 1, 12, PAL.parchShade);
    R(ctx, 107, 103, 30, 2, PAL.parchShade); // page block
    // mishnah text lines (unreadable pixel dashes, Rashi-script energy)
    var r;
    for (r = 0; r < 4; r++) {
      R(ctx, 109, 94 + r * 2, 7 - (r % 2) * 2, 1, PAL.ink);
      R(ctx, 117 - (r % 2), 94 + r * 2, 3, 1, PAL.ink);
    }
    for (r = 0; r < 4; r++) {
      R(ctx, 124, 94 + r * 2, 5 + (r % 2) * 3, 1, PAL.ink);
      R(ctx, 132, 94 + r * 2, 3 - (r % 2), 1, PAL.ink);
    }
    R(ctx, 124, 93, 10, 1, PAL.rugHi); // title strip
    safeGlow(ctx, 122, 96, 14, PAL.amber, 0.06);
    // candle + inkwell + quill on the platform
    safeCandle(ctx, 139, 116, t, 1);
    R(ctx, 104, 113, 3, 3, '#1a1a2e'); // inkwell
    R(ctx, 106, 110, 1, 1, '#e8e8e8'); // quill tip
    R(ctx, 107, 109, 1, 1, '#e8e8e8');
    R(ctx, 108, 108, 1, 1, '#e8e8e8');
  }

  function drawArk(ctx, t, S) {
    var seals = (S && S.seals) ? S.seals : [];
    var flags = (S && S.flags) ? S.flags : {};
    var full = seals.length >= 3;

    // side columns
    R(ctx, 146, 44, 6, 80, PAL.wood);
    R(ctx, 146, 44, 2, 80, PAL.woodHi);
    R(ctx, 196, 44, 6, 80, PAL.wood);
    R(ctx, 196, 44, 2, 80, PAL.woodHi);
    R(ctx, 144, 40, 10, 4, PAL.brassHi);
    R(ctx, 194, 40, 10, 4, PAL.brassHi);

    // body + inner panel
    R(ctx, 152, 44, 44, 80, PAL.woodDark);
    R(ctx, 155, 48, 38, 72, PAL.wood);

    // stepped arch top + mini tablets
    R(ctx, 158, 36, 32, 8, PAL.wood);
    R(ctx, 158, 35, 32, 1, PAL.brassHi);
    R(ctx, 165, 30, 18, 6, PAL.wood);
    R(ctx, 165, 29, 18, 1, PAL.brassHi);
    R(ctx, 171, 25, 6, 4, PAL.wood);
    R(ctx, 168, 31, 5, 6, PAL.stoneHi);
    R(ctx, 169, 30, 3, 1, PAL.stoneHi);
    R(ctx, 175, 31, 5, 6, PAL.stoneHi);
    R(ctx, 176, 30, 3, 1, PAL.stoneHi);

    // parochet folds (curtain) above the clock
    for (var i = 0; i < 9; i++) {
      R(ctx, 156 + i * 4, 49, 4, 12, (i % 2 === 0) ? PAL.rug : PAL.rugHi);
    }
    R(ctx, 156, 60, 36, 1, PAL.brassHi);

    // ---- the mechanical clock-lock ----
    disc(ctx, 174, 76, 12, '#2a1c30');
    disc(ctx, 174, 76, 11, PAL.brassHi);
    disc(ctx, 174, 76, 9, PAL.parch);
    // tick marks
    for (var k = 0; k < 8; k++) {
      var a = k * Math.PI / 4;
      R(ctx, 174 + Math.round(Math.cos(a) * 8), 76 + Math.round(Math.sin(a) * 8), 1, 1, PAL.wood);
    }
    // dial icons: moon (evening, left) and sun (morning, right)
    R(ctx, 167, 74, 2, 4, PAL.night3);
    R(ctx, 168, 73, 1, 1, PAL.night3);
    R(ctx, 168, 78, 1, 1, PAL.night3);
    R(ctx, 180, 75, 2, 2, PAL.amberDeep);
    R(ctx, 181, 73, 1, 1, PAL.amberDeep);
    R(ctx, 181, 78, 1, 1, PAL.amberDeep);
    R(ctx, 179, 74, 1, 1, PAL.amberDeep);
    R(ctx, 182, 76, 1, 1, PAL.amberDeep);
    // hand: sleeps pointing at the moon; spins when all seals are in; dawn when won
    var ang;
    if (flags.won) ang = -0.5;
    else if (full) ang = t * 0.8;
    else ang = Math.PI + Math.sin(t * 0.9) * 0.06;
    handLine(ctx, 174, 76, ang, 7, PAL.woodDark);
    R(ctx, 174, 76, 1, 1, PAL.red);

    // ---- three keyholes, filling as seals are collected ----
    for (var s = 0; s < 3; s++) {
      var kx = 161 + s * 12; // keyhole center x
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

    // doors seam + handles + base
    R(ctx, 173, 108, 1, 12, '#2a1a10');
    R(ctx, 170, 112, 2, 2, PAL.brassHi);
    R(ctx, 176, 112, 2, 2, PAL.brassHi);
    R(ctx, 144, 124, 60, 4, PAL.woodDeep);
    R(ctx, 144, 124, 60, 1, PAL.woodHi);

    // ambient glow: gentle when sleeping, breathing when ready, blazing when won
    if (flags.won) {
      safeGlow(ctx, 174, 78, 46, PAL.amber, 0.16 + 0.05 * Math.sin(t * 3));
    } else if (full) {
      safeGlow(ctx, 174, 80, 40, PAL.amber, 0.08 + 0.04 * Math.sin(t * 2.5));
    } else {
      safeGlow(ctx, 174, 80, 26, PAL.amberMid, 0.04 + 0.015 * Math.sin(t * 0.8));
    }

    // recently woken by the quiz — dramatic flash
    if (lastT - wokeAt < 2.2 && wokeAt > 0) {
      safeGlow(ctx, 174, 76, 50, '#ffffff', 0.18 * Math.max(0, 1 - (lastT - wokeAt) / 2.2));
    }

    // snoring Z's drifting up from the ark
    var dz = t - snoreAt;
    if (dz > 0 && dz < 3.2) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 0.85 - dz * 0.25);
      for (var z = 0; z < 3; z++) {
        var zy = 34 - ((dz * 9 + z * 8) % 26);
        var zx = 190 + z * 4 + Math.round(Math.sin(t * 2 + z) * 2);
        drawZ(ctx, zx, zy, '#bcd4e8');
      }
      ctx.restore();
    }
  }

  function drawLamp(ctx, t, anchorX, phase) {
    var ang = Math.sin(t * 1.4 + phase) * 0.12;
    var lx = anchorX + Math.round(Math.sin(ang) * 26);
    var ly = 12 + Math.round(Math.cos(ang) * 14);
    // chain
    for (var i = 0; i < 5; i++) {
      var cx = anchorX + Math.round((lx - anchorX) * i / 5);
      var cy = Math.round(ly * i / 5) + 2;
      R(ctx, cx, cy, 1, 2, PAL.brass);
    }
    // brass oil bowl
    R(ctx, lx - 6, ly, 12, 1, PAL.brassHi);
    R(ctx, lx - 5, ly + 1, 10, 3, PAL.brass);
    R(ctx, lx - 3, ly + 4, 6, 2, PAL.brass);
    R(ctx, lx - 1, ly + 6, 2, 1, PAL.brassHi);
    // flame (flickers with t)
    var fh = 3 + (Math.sin(t * 13 + phase * 7) > 0.25 ? 1 : 0);
    R(ctx, lx - 1, ly - fh, 3, fh, PAL.amberDeep);
    R(ctx, lx, ly - fh + 1, 1, fh - 1, PAL.amber);
    safeGlow(ctx, lx, ly, 24, PAL.amberMid, 0.09 + 0.02 * Math.sin(t * 5 + phase));
  }

  function drawDecor(ctx, t) {
    // stacked books on the floor near the left shelf
    R(ctx, 30, 128, 12, 3, PAL.teal);
    R(ctx, 31, 125, 10, 3, PAL.rug);
    R(ctx, 32, 122, 9, 3, PAL.brassHi);
    R(ctx, 33, 122, 1, 3, PAL.parch);

    // scroll basket on the floor near the right shelf
    R(ctx, 296, 126, 14, 6, PAL.woodHi);
    R(ctx, 296, 126, 14, 1, PAL.woodDark);
    R(ctx, 298, 122, 3, 4, PAL.parch);
    R(ctx, 302, 121, 3, 5, PAL.parchHi);
    R(ctx, 306, 123, 3, 3, PAL.parch);

    // hourglass on a right-shelf board (sand pixel falls forever)
    R(ctx, 291, 60, 8, 1, PAL.brass);
    R(ctx, 291, 69, 8, 1, PAL.brass);
    R(ctx, 291, 61, 1, 8, PAL.brass);
    R(ctx, 298, 61, 1, 8, PAL.brass);
    R(ctx, 293, 62, 4, 2, PAL.parch);
    R(ctx, 293, 66, 4, 2, PAL.parchShade);
    R(ctx, 294 + Math.floor(t * 2) % 2, 64 + Math.floor(t * 6) % 2, 1, 1, PAL.parch);

    // wall notice near the choir: the daily-times chart, mostly question marks
    R(ctx, 214, 52, 16, 20, PAL.parch);
    R(ctx, 221, 51, 2, 2, PAL.red); // pin
    R(ctx, 216, 56, 12, 1, PAL.ink);
    R(ctx, 216, 59, 8, 1, PAL.ink);
    R(ctx, 216, 62, 10, 1, PAL.ink);
    // a big scribbled "?" (mirrored — it is an RTL question mark)
    R(ctx, 219, 64, 4, 1, PAL.rugHi);
    R(ctx, 222, 65, 1, 2, PAL.rugHi);
    R(ctx, 220, 67, 2, 1, PAL.rugHi);
    R(ctx, 221, 69, 1, 1, PAL.rugHi);

    // cobweb, top-right corner
    ctx.save();
    ctx.globalAlpha = 0.3;
    R(ctx, 314, 16, 6, 1, PAL.stoneHi);
    R(ctx, 316, 18, 4, 1, PAL.stoneHi);
    R(ctx, 318, 21, 2, 1, PAL.stoneHi);
    R(ctx, 315, 16, 1, 3, PAL.stoneHi);
    R(ctx, 317, 16, 1, 6, PAL.stoneHi);
    ctx.restore();

    // mouse peeking from the left shelf (a talmid chacham in training)
    var mph = t % 9;
    if (mph < 1.5) {
      var mo = Math.min(Math.round(mph * 6), 2);
      R(ctx, 42, 84 - mo, 4, 2, PAL.stoneHi); // body
      R(ctx, 41, 84 - mo, 1, 1, PAL.stoneHi); // ear
      R(ctx, 42, 84 - mo, 1, 1, '#1a1a2e');   // eye
      R(ctx, 46, 85 - mo, 2, 1, '#c9a0a0');   // tail
    }

    // dust motes floating in the lamplight
    ctx.save();
    ctx.globalAlpha = 0.25;
    for (var d = 0; d < 8; d++) {
      var base = (d < 4) ? 88 : 232;
      var dx = base + Math.round(Math.sin(t * 0.4 + d * 1.7) * 12);
      var dy = 34 + ((t * 3.5 + d * 17) % 52);
      R(ctx, dx, Math.round(dy), 1, 1, PAL.amber);
    }
    ctx.restore();

    // ner tamid hanging above the ark
    R(ctx, 173, 14, 1, 4, PAL.brass);
    R(ctx, 171, 18, 5, 4, PAL.red);
    R(ctx, 172, 17, 3, 1, PAL.brassHi);
    if (Math.sin(t * 9) > -0.3) R(ctx, 173, 19, 1, 2, PAL.amber);
    safeGlow(ctx, 173, 20, 10, PAL.red, 0.10);
  }

  /* ---------------- the finale quiz ---------------- */

  var QUIZ = [
    {
      q: 'שאלה ראשונה: «מאימתי קורין את שמע בערבין?»',
      correct: 'משעה שהכהנים נכנסים לאכול בתרומתן',
      wrong: ['משעה שהעני שם שעון מעורר', 'משעה שהחתול רש"י מפהק']
    },
    {
      q: 'שאלה שנייה: ומה הסימן בשמים שהגיע זמן קריאת שמע?',
      correct: 'צאת הכוכבים — שלושה כוכבים בינוניים',
      wrong: ['כשהירח מדליק פנס', 'כשהינשוף מוריד את המשקפיים']
    },
    {
      q: 'שאלה שלישית: עד מתי אמרו חכמים לקרות — ולמה?',
      correct: 'עד חצות — כדי להרחיק את האדם מן העבירה',
      wrong: ['עד חצות — כי אז נגמר התה של רבן גמליאל', 'עד שהגבאי גרשון מוצא את השעון שלו']
    },
    {
      q: 'שאלה אחרונה: ולמה שנה התנא ערבית תחילה?',
      correct: 'שנאמר «ויהי ערב ויהי בקר», וכתיב «בשכבך ובקומך»',
      wrong: ['כי בבוקר כולם עוד ישנים', 'כי התנא קם על צד שמאל של המיטה']
    }
  ];

  var MOCK = [
    'לא. אפילו הכיסא של רבי אליעזר יודע את זה. נסה שוב!',
    'טעות. אבל אהבתי את הביטחון העצמי. עוד פעם!',
    'הממם... לא. אני ארון בן אלפיים שנה, יש לי סבלנות. שוב!'
  ];

  var PRAISE = ['נכון!', 'יפה מאוד!', 'דברי אמת!', 'כך כתוב בדף!'];

  function shuffled(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function arkSay(g, text) {
    return g.say(text, { x: 174, y: 30, color: '#ffd166' });
  }

  function safeMusic(mode) {
    try {
      if (window.AUDIO && AUDIO.music) AUDIO.music(mode);
    } catch (e) { /* fail silent */ }
  }

  async function arkFinale(g) {
    if (quizRunning) return;
    if (g.flag('won')) {
      await g.playerSay('הארון כבר פתוח, הכפר כבר קרא שמע. לילה טוב לכולם.');
      return;
    }

    var missing = [];
    for (var i = 0; i < SEAL_SLOTS.length; i++) {
      if (!g.hasSeal(SEAL_SLOTS[i])) missing.push(SEAL_SLOTS[i]);
    }

    if (missing.length > 0) {
      // the ark is fast asleep
      snoreAt = lastT;
      g.sfx('snore');
      await arkSay(g, 'זזזזז... חרררר... זזזזז...');
      await arkSay(g, 'הארון ישן. חסרים חותמות.');
      var names = [];
      for (var m = 0; m < missing.length; m++) names.push(SEAL_LABELS[missing[m]]);
      await g.playerSay('חסרים לי עוד: ' + names.join(', ') + '.');
      var hints = {
        stars: 'את חותם הכוכבים ייתן הכהן פנחס — אם אוכיח לו שיצאו הכוכבים. הגג נראה מקום טוב להתחיל.',
        midnight: 'חותם חצות נמצא אצל בני רבן גמליאל, בדרך שחוזרת מהחתונה.',
        watch: 'ואת חותם המשמרות שומר האריה שבדרך. אריה. שומר. כמובן.'
      };
      if (hints[missing[0]]) await g.playerSay(hints[missing[0]]);
      return;
    }

    // ---- ALL THREE SEALS: THE QUIZ ----
    quizRunning = true;
    try {
      await g.cutscene(async function () {
        safeMusic('tense');
        wokeAt = lastT;
        g.sfx('magic');
        await arkSay(g, 'מ... מי מעיר ארון באמצע הלילה?!');
        await g.playerSay('זרח מכפר ברכות! הבאתי את שלושת החותמות!');
        await arkSay(g, 'חותמות... אכן. שלושה חורים — שלושה חותמות. מרשים.');
        await arkSay(g, 'אבל ארון הזמנים אינו נפתח במפתחות בלבד — אלא בדעת!');
        await arkSay(g, 'ארבע שאלות מן הדף. טעית? ננסה שוב. אין לי לאן למהר — אני רהיט.');

        for (var qi = 0; qi < QUIZ.length; qi++) {
          var q = QUIZ[qi];
          g.sfx('quiz');
          await arkSay(g, q.q);
          var options = shuffled(
            [{ text: q.correct, value: true }]
              .concat(q.wrong.map(function (w) { return { text: w, value: false }; }))
          );
          var mockIdx = 0;
          while (true) {
            var ans = await g.choose(options);
            if (ans === true) {
              g.sfx('seal');
              await arkSay(g, PRAISE[qi % PRAISE.length]);
              break;
            }
            g.sfx('fail');
            await arkSay(g, MOCK[mockIdx % MOCK.length]);
            mockIdx++;
          }
        }

        await arkSay(g, 'ידעת את הדף כולו... זרח מכפר ברכות — הארון נפתח!');
        await g.playerSay('כולם! אפשר לקרוא שמע! משעה שהכהנים נכנסים לאכול בתרומתן!');
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

      // base fill + ceiling
      R(ctx, 0, 0, 320, 180, PAL.wall);
      R(ctx, 0, 0, 320, 12, PAL.ceil);
      R(ctx, 0, 12, 320, 2, PAL.beam);
      R(ctx, 38, 0, 4, 12, PAL.beam);
      R(ctx, 118, 0, 4, 12, PAL.beam);
      R(ctx, 198, 0, 4, 12, PAL.beam);
      R(ctx, 278, 0, 4, 12, PAL.beam);

      // upper wall shading band
      R(ctx, 0, 14, 320, 10, PAL.wallDark);

      // wainscot at the wall/floor junction
      R(ctx, 0, 112, 320, 8, PAL.woodDark);
      R(ctx, 0, 112, 320, 1, PAL.woodHi);

      // wooden floor with perspective plank lines
      R(ctx, 0, 120, 320, 60, PAL.floor);
      var ys = [123, 127, 132, 138, 145, 153, 162, 171];
      for (var i = 0; i < ys.length; i++) R(ctx, 0, ys[i], 320, 1, PAL.floorLine);
      for (var v = 0; v < 10; v++) {
        R(ctx, 16 + v * 32 + (v % 2) * 12, 132, 1, 6, PAL.floorLine);
        R(ctx, 8 + v * 34 + (v % 3) * 8, 153, 1, 9, PAL.floorLine);
      }

      // warm rug in front of the ark
      R(ctx, 118, 142, 110, 22, PAL.rug);
      R(ctx, 122, 144, 102, 18, PAL.rugHi);
      R(ctx, 128, 148, 90, 10, PAL.rug);
      R(ctx, 118, 142, 110, 1, PAL.brassHi);
      R(ctx, 118, 163, 110, 1, PAL.brassHi);
      for (var rd = 0; rd < 6; rd++) R(ctx, 134 + rd * 16, 152, 2, 2, PAL.brassHi);

      // furniture & architecture
      drawExitDoor(ctx);
      drawShelf(ctx, 26, 36, 3);
      drawShelf(ctx, 276, 40, 11);
      drawWindow(ctx, t);
      drawBimah(ctx, t);
      drawArk(ctx, t, S);
      drawDecor(ctx, t);

      // swinging oil lamps (drawn late so their glow washes the room)
      drawLamp(ctx, t, 88, 0);
      drawLamp(ctx, t, 232, 2.4);

      // overall warm "glowing interior" wash
      safeGlow(ctx, 160, 92, 92, PAL.amberMid, 0.05);
    },

    onEnter: async function (g) {
      if (!g.flag('bm_visited')) {
        g.flag('bm_visited', true);
        await g.cutscene(async function () {
          await g.playerSay('וואו... בית המדרש זוהר גם בחצות הלילה.');
          await g.playerSay('וזה בטח ארון הזמנים. שלושה חורי מנעול... שלושה חותמות.');
        });
      } else if (!g.flag('won') &&
        g.hasSeal('stars') && g.hasSeal('midnight') && g.hasSeal('watch') &&
        !g.flag('bm_ready_hint')) {
        g.flag('bm_ready_hint', true);
        await g.playerSay('שלושת החותמות אצלי. הארון מחכה לי!');
      }
    },

    hotspots: [

      /* ---- exit back to the square ---- */
      {
        id: 'toSquare', name: 'היציאה לכיכר', type: 'exit',
        x: 0, y: 76, w: 22, h: 60,
        walkTo: { x: 14, y: 140 },
        target: 'square', spawn: { x: 272, y: 150 }
      },

      /* ---- the ghostly Tanna (easter egg) ---- */
      {
        id: 'tanna', name: 'התנא', type: 'char',
        x: 103, y: 14, w: 32, h: 36,
        walkTo: { x: 119, y: 138 },
        draw: function (ctx, t, S) {
          drawTanna(ctx, 119, 44, t, !!(S && S.flags && S.flags.bm_pasuk));
        },
        look: async function (g) {
          await g.playerSay('רוח של תנא מרחפת ליד התקרה. הוא נראה רגוע להפליא בשביל מישהו בלי רצפה.');
        },
        talk: async function (g) {
          if (!g.flag('bm_pasuk')) {
            await g.playerSay('סליחה... תנא היכא קאי?');
            await g.say('אקרא קאי!', { who: 'tanna', color: '#bcd4e8' });
            g.sfx('magic');
            g.flag('bm_pasuk', true);
            await g.say('(פסוק זוהר צץ באוויר: «בשכבך ובקומך». התנא נוחת עליו. בסטייל.)', { x: 119, y: 60 });
            await g.say('התנא על הפסוק עומד! «ובשכבך ובקומך» — שמע של ערב ושמע של בוקר!', { who: 'tanna', color: '#bcd4e8' });
            await g.playerSay('ולמה שנית ערבית קודם, ולא שחרית?');
            await g.say('כברייתו של עולם, ילדי: «ויהי ערב ויהי בקר — יום אחד». קודם ערב, אחר כך בוקר.', { who: 'tanna', color: '#bcd4e8' });
            await g.say('וגם — בבוקר אני בקושי תנא. לפני הקפה אני מקסימום ברייתא.', { who: 'tanna', color: '#bcd4e8' });
          } else {
            await g.say('עדיין על הפסוק. הבסיס הכי יציב בעולם — כתוב בתורה.', { who: 'tanna', color: '#bcd4e8' });
          }
        },
        take: async function (g) {
          await g.playerSay('לקחת תנא? הוא קאי על קרא, לא על מדף.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.say('הדף הזה? אני גר בו. עמוד א, שורה ראשונה. שכנים טובים.', { who: 'tanna', color: '#bcd4e8' });
          } else {
            await g.playerSay('לא בטוח שאפשר להשתמש במשהו על רוח.');
          }
        }
      },

      /* ---- Rabbi Eliezer + his rival, the empty chair ---- */
      {
        id: 'eliezer', name: 'רבי אליעזר', type: 'char',
        x: 63, y: 100, w: 18, h: 40,
        walkTo: { x: 80, y: 144 },
        draw: function (ctx, t) {
          // argues with the chair in bursts, forever
          var ph = t % 6;
          var arguing = ph < 1.4;
          drawSage(ctx, 72, 138, t, {
            robe: '#3f3a5e', robeShade: '#332e4d', trim: PAL.brassHi,
            hat: '#2c2844', beard: '#e8e8e8', stern: true,
            armR: arguing ? (0.7 + 0.3 * Math.sin(t * 9)) : 0,
            bobAmp: 0.6, bobPh: 0.3, blinkPh: 0.9
          });
        },
        look: async function (g) {
          await g.playerSay('רבי אליעזר. מחמיר, חד, ומנהל כרגע מחלוקת סוערת עם רהיט.');
        },
        talk: async function (g) {
          var col = '#e8d8a8';
          if (!g.flag('bm_met_eliezer')) {
            g.flag('bm_met_eliezer', true);
            await g.say('...ולכן, כפי שאמרתי — עד סוף האשמורה הראשונה! יש לך תשובה? אין לך? ניצחתי.', { who: 'eliezer', color: col });
            await g.playerSay('אה... הוא מדבר עם כיסא ריק.');
            await g.say('אה, זרח! אל תפריע, אני באמצע ניצחון.', { who: 'eliezer', color: col });
          }
          while (true) {
            var v = await g.choose([
              { text: 'עד מתי קוראים קריאת שמע של ערבית?', value: 'shita' },
              { text: 'למה אתה מתווכח עם כיסא ריק?', value: 'chair' },
              { text: 'מי לומד כאן באמצע הלילה?', value: 'night' },
              { text: 'להתראות, רבי.', value: 'bye' }
            ]);
            if (v === 'shita') {
              await g.say('דעתי ברורה כליל הירח: עד סוף האשמורה הראשונה!', { who: 'eliezer', color: col });
              await g.say('הלילה מחולק למשמרות, ולכל משמרת יש סימן משלה. מי שמכיר את הסימנים — לא מאחר את הזמן.', { who: 'eliezer', color: col });
              await g.say('האריה ששומר על הדרך יודע הכל על המשמרות. לך שאל אותו. וקח משהו לאוזניים.', { who: 'eliezer', color: col });
            } else if (v === 'chair') {
              await g.say('זה לא סתם כיסא. זה בר הפלוגתא הטוב ביותר שהיה לי — הוא אף פעם לא קוטע אותי.', { who: 'eliezer', color: col });
              await g.say('(הכיסא שותק. בעוצמה.)', { x: 90, y: 106 });
              g.sfx('click');
              await g.say('שמעת? שתיקה כהודאה. ניצחתי שוב.', { who: 'eliezer', color: col });
            } else if (v === 'night') {
              await g.say('כולם! בלילה התורה מתוקה מדבש. וגם — אין תור לספרים.', { who: 'eliezer', color: col });
            } else {
              await g.say('לך לשלום. ואם תראה בדרך עוד כיסאות — שלח אותם אליי. יש לי טיעונים.', { who: 'eliezer', color: col });
              break;
            }
          }
        },
        take: async function (g) {
          await g.playerSay('לקחת רבי? רבנים לא לוקחים. מקבלים מהם.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('כתוב כאן: רבי אליעזר אומר — עד סוף האשמורה הראשונה.');
            await g.say('אני יודע. אני אמרתי. תמסור לדף שהוא מצטט מצוין.', { who: 'eliezer', color: '#e8d8a8' });
          } else {
            await g.playerSay('אני לא בטוח שזה יעזור לו בוויכוח עם הכיסא.');
          }
        }
      },

      /* ---- the empty chair (bonus gag) ---- */
      {
        id: 'chair', name: 'הכיסא הריק', type: 'object',
        x: 83, y: 114, w: 14, h: 26,
        walkTo: { x: 90, y: 144 },
        draw: function (ctx, t) {
          drawChair(ctx, 90, 138);
          // it trembles slightly when losing the argument
          if ((t % 6) < 1.4 && Math.sin(t * 20) > 0.6) {
            R(ctx, 96, 120 - 2, 1, 1, PAL.woodHi);
          }
        },
        look: async function (g) {
          await g.playerSay('כיסא ריק. הוא מפסיד כרגע במחלוקת, אבל בכבוד רב.');
        },
        talk: async function (g) {
          await g.playerSay('אה... שלום, כיסא.');
          await g.say('(שתיקה רועמת.)', { x: 90, y: 108 });
          await g.say('אל תתאמץ. הוא נפתח רק בסוגיות עמוקות באמת.', { who: 'eliezer', color: '#e8d8a8' });
        },
        take: async function (g) {
          await g.playerSay('ולהשאיר את רבי אליעזר בלי בר פלוגתא? אכזרי מדי.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('הכיסא מעיין בדף בריכוז. או שלא. קשה לדעת עם כיסאות.');
          } else {
            await g.playerSay('הכיסא לא משתף פעולה. עיקרון.');
          }
        }
      },

      /* ---- the giant Gemara on the bimah ---- */
      {
        id: 'gemara', name: 'ספר גמרא ענק', type: 'object',
        x: 100, y: 84, w: 44, h: 46,
        walkTo: { x: 122, y: 142 },
        look: async function (g) {
          await g.say('«מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִית? מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן»', { x: 122, y: 84, color: '#e8d8a8' });
          await g.playerSay('כהנים... תרומה... נשמע כמו רמז בגודל של בית.');
          await g.playerSay('כדאי לבקר את פנחס הכהן ולראות מתי הוא נכנס לאכול.');
        },
        talk: async function (g) {
          await g.playerSay('הספר לא עונה. אבל אם מקשיבים חזק — שומעים ניגון של סוגיה.');
        },
        take: async function (g) {
          if (!g.has('daf')) {
            g.give('daf');
            await g.playerSay('לקחתי דף אחד. דף היומי — פשוטו כמשמעו.');
            await g.playerSay('אם אתקע — אשתמש בדף. הוא יודע הכל.');
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

      /* ---- THE ARK OF TIMES (the finale) ---- */
      {
        id: 'ark', name: 'ארון הזמנים', type: 'object',
        x: 144, y: 24, w: 60, h: 104,
        walkTo: { x: 174, y: 144 },
        look: async function (g) {
          var n = 0;
          for (var i = 0; i < SEAL_SLOTS.length; i++) if (g.hasSeal(SEAL_SLOTS[i])) n++;
          await g.playerSay('ארון עתיק עם מנעול־שעון ענק, וחוגה שנעה בין ירח לשמש.');
          if (n === 0) await g.playerSay('שלושה חורי מנעול, כולם ריקים. והוא נוחר. ארונות נוחרים, מסתבר.');
          else if (n < 3) await g.playerSay('שלושה חורי מנעול. ' + n + ' מהם כבר זוהרים. מתקדמים!');
          else await g.playerSay('שלושת החורים זוהרים! המחוג מסתובב... הארון מתעורר!');
        },
        talk: function (g) { return arkFinale(g); },
        use: function (g, itemId) {
          if (itemId === 'daf') {
            return (async function () {
              await g.playerSay('אני מצמיד את הדף לארון...');
              await arkSay(g, 'זזז... ריח של תורה... נחמד... אבל אני נפתח בחותמות ובדעת, לא בנייר.');
            })();
          }
          return arkFinale(g);
        },
        take: async function (g) {
          await g.playerSay('הוא ארון. אני זרח. יש הבדלי משקל מהותיים בינינו.');
        }
      },

      /* ---- the choir of sages (three, in perfect unison) ---- */
      {
        id: 'choir', name: 'מקהלת החכמים', type: 'char',
        x: 204, y: 104, w: 46, h: 40,
        walkTo: { x: 227, y: 148 },
        draw: function (ctx, t) {
          // unison bob: same phase for all three, that is the joke
          var xs = [213, 227, 241];
          var robes = [
            { robe: PAL.teal, shade: '#175e6d', hat: '#134c58' },
            { robe: '#7a4a9e', shade: '#5f3a7c', hat: '#4d2f66' },
            { robe: '#a63946', shade: '#832d38', hat: '#6e2436' }
          ];
          // triple high-five attempt animation (they always miss)
          var dt = t - hiFiveAt;
          var raise = 0;
          if (dt > 0 && dt < 1.8) {
            if (dt < 0.8) raise = dt / 0.8;
            else if (dt < 1.2) raise = 1;
            else raise = Math.max(0, (1.8 - dt) / 0.6);
          }
          for (var i = 0; i < 3; i++) {
            // mismatched raise heights = the miss
            var miss = [1.0, 0.65, 0.85][i];
            drawSage(ctx, xs[i], 142, t, {
              robe: robes[i].robe, robeShade: robes[i].shade, trim: PAL.brassHi,
              hat: robes[i].hat, beard: '#d8d8d8',
              armL: (i > 0) ? raise * miss : 0,
              armR: (i < 2) ? raise * miss : 0,
              bobAmp: 1.1, bobPh: 0, blinkPh: 0 // identical phases: full unison
            });
          }
        },
        look: async function (g) {
          await g.playerSay('שלושה חכמים. הם נושמים ביחד, ממצמצים ביחד, ופוסקים ביחד.');
        },
        talk: async function (g) {
          var col = '#9ad1e0';
          await g.say('אנחנו אומרים: עד חצות!', { who: 'choir', color: col });
          while (true) {
            var v = await g.choose([
              { text: 'למה דווקא עד חצות?', value: 'why' },
              { text: 'איך אתם מדברים ככה ביחד?', value: 'how' },
              { text: 'להתראות, רבותיי.', value: 'bye' }
            ]);
            if (v === 'why') {
              await g.say('«כדי להרחיק את האדם מן העבירה!»', { who: 'choir', color: col });
              hiFiveAt = lastT;
              await g.wait(700);
              g.sfx('fail');
              await g.say('(שלושת החכמים מנסים לתת כיף משולש. הם מפספסים. שוב.)', { x: 227, y: 100 });
              await g.say('יום אחד נצליח בכיף. בהלכה — כבר הצלחנו!', { who: 'choir', color: col });
            } else if (v === 'how') {
              await g.say('שנים של חברותא!', { who: 'choir', color: col });
              await g.say('רגע — גם עכשיו זה יצא ביחד?', { who: 'choir', color: col });
              await g.say('מצוין!', { who: 'choir', color: col });
            } else {
              await g.say('שלום! שלום! שלום!', { who: 'choir', color: col });
              await g.playerSay('...וזה היה בקול אחד. כמובן.');
              break;
            }
          }
        },
        take: async function (g) {
          await g.playerSay('אי אפשר לקחת רק אחד. הם באים בשלישייה.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('כתוב כאן: וחכמים אומרים — עד חצות.');
            await g.say('זה אנחנו! אנחנו בדף! תראו!', { who: 'choir', color: '#9ad1e0' });
          } else {
            await g.playerSay('הם מסונכרנים מדי בשביל זה.');
          }
        }
      },

      /* ---- Rabban Gamliel, calmly sipping tea ---- */
      {
        id: 'gamliel', name: 'רבן גמליאל', type: 'char',
        x: 250, y: 108, w: 36, h: 38,
        walkTo: { x: 242, y: 148 },
        draw: function (ctx, t) {
          drawGamliel(ctx, 260, 144, t);
        },
        look: async function (g) {
          await g.playerSay('רבן גמליאל, הנשיא. לוגם תה בשלווה של מי שיודע שיש זמן עד עלות השחר.');
        },
        talk: async function (g) {
          var col = '#f0ead8';
          if (!g.flag('bm_met_gamliel')) {
            g.flag('bm_met_gamliel', true);
            await g.say('(לוגם תה באריכות) שלום, צעיר. תה? לא? חבל. תה פותח את הלב ללימוד.', { who: 'gamliel', color: col });
          }
          while (true) {
            var v = await g.choose([
              { text: 'עד מתי אפשר לקרוא קריאת שמע?', value: 'shita' },
              { text: 'איפה הבנים שלך הערב?', value: 'sons' },
              { text: 'להתראות, רבן גמליאל.', value: 'bye' }
            ]);
            if (v === 'shita') {
              await g.say('עד שיעלה עמוד השחר. כל הלילה כשר לקריאת שמע.', { who: 'gamliel', color: col });
              await g.say('חכמים אמרו «עד חצות»? רק כדי להרחיק את האדם מן העבירה. הדין עצמו — עד עלות השחר.', { who: 'gamliel', color: col });
              await g.say('(לוגם עוד לגימה, מנצח בשקט.)', { x: 260, y: 106 });
            } else if (v === 'sons') {
              await g.say('בחתונה. שוב חתונה. שלישית השבוע.', { who: 'gamliel', color: col });
              await g.say('הם יחזרו בדרך אחרי חצות, לחוצים כרגיל, וישאלו אם עוד מותר לקרוא שמע.', { who: 'gamliel', color: col });
              await g.say('אם תפגוש אותם בדרך מהחתונה — תרגיע אותם. או אל תרגיע. גם מלחץ לומדים.', { who: 'gamliel', color: col });
            } else {
              await g.say('לך לשלום. והתה — עד חצות. אחר כך הוא קר, ועל זה אין מחלוקת.', { who: 'gamliel', color: col });
              break;
            }
          }
        },
        take: async function (g) {
          await g.playerSay('לקחת את הנשיא? יש לזה ועדה מיוחדת, ואני לא בה.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('כתוב כאן: רבן גמליאל אומר — עד שיעלה עמוד השחר.');
            await g.say('מדויק. ותוסיף בשוליים: התה שלו היה מצוין.', { who: 'gamliel', color: '#f0ead8' });
          } else {
            await g.playerSay('הוא מרוכז מדי בתה. חבל להפריע.');
          }
        }
      }
    ]
  });
})();
