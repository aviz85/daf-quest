'use strict';
/*
 * Scene: cellar — the wine cellar (martef ha-yayin)
 * DAF QUEST — Pesachim 2a-2b ("The Mystery of the Lost Light")
 *
 * THE DARK SCENE. First visits are near-total darkness (silhouettes + a grey
 * stair wedge). Freida the ancient cellar-keeper hands the player the UNLIT
 * candle 'ner'. Once the player returns holding 'nerlit' (lit at the summit
 * beacon), onEnter sets flag 'cellarLit' and the cellar reveals itself —
 * the daf experienced: "bodkin et he-chametz le-or ha-ner" (checking for
 * chametz by candlelight).
 * Then: Quiz A (what needs bedikah at all, 3 rounds with a forced-restatement
 * beat on wrong answers) and the CLICKABLE rows puzzle (Beit Hillel's
 * "two outer rows which are the upper ones") yields item 'pita' +
 * seal 'bedikah'.
 *
 * Owns ONLY this file. Registers via GAME.registerScene('cellar', {...}).
 * Relies on GAME / SPRITES / AUDIO contracts (all guarded, never crashes).
 */
(function () {
  if (!window.GAME || typeof window.GAME.registerScene !== 'function') {
    console.warn('cellar.js: GAME.registerScene unavailable — scene not registered');
    return;
  }

  /* ---------------- palette — candle-lit wine cellar, warm wood on cool stone ---- */
  var DARK_BG   = '#050510';   // near-black darkness base
  var DARK_FLR  = '#070714';
  var SIL       = '#0b0b1e';   // silhouette blocks in the dark
  var SIL_DIM   = '#090918';
  var WEDGE     = '#3a3a55';   // grey "rumor of light" from the stairs
  var STONE_D   = '#241d33';   // lit back wall
  var STONE_M   = '#2b2440';
  var STONE_L   = '#3a3152';
  var FLOOR_D   = '#1c1626';
  var FLOOR_L   = '#241c30';
  var WOOD_D    = '#5a3a24';   // barrel body
  var WOOD_L    = '#7a512f';
  var WOOD_HI   = '#96683c';
  var COPPER    = '#b0662f';   // barrel hoops
  var PARCH     = '#e8d8a8';
  var AMBER     = '#ffd166';
  var AMBER_D   = '#ff8c42';
  var FLAME_MID = '#ffb347';
  var WEB       = '#8a8aa0';
  var GARLIC_C  = '#e8e0cc';
  var CURTAIN   = '#7a3d5c';
  var FREIDA_C  = '#d9b8ff';   // her speech color

  /* ---------------- barrel-wall grid geometry (the puzzle centerpiece) ---------- */
  var BW = { x0: 58, y0: 32, cols: 6, colW: 22, rowH: 23 };
  var ROW_Y = { top: 32, second: 55, third: 78, bottom: 101 }; // wall ends at y=124

  /* ---------------- module state (visual one-shots + puzzle scratch) ------------ */
  var lastT = 0;
  var saluteAt = -99;      // Freida raises the feather (milestones)
  var saluteBig = false;   // feather AND spoon (seal moment)
  var lowerAt = -99;       // Freida lowers the feather slowly (wrong answers)
  var glintAt = -99;       // correct rows sparkle cascade
  var knockAt = -99;       // barrel knock wobble
  var mouseWinkAt = -99;   // mouse double-blink (unlit-candle easter egg)
  var rowPick = [];        // clicked row keys, max 2
  var quizRunning = false; // double-launch guard
  var playerPos = { x: 160, y: 150 }; // last known player feet position (via draw hook)

  // Pass-through wrap of SPRITES.drawPlayer that only RECORDS the player's
  // position, so the candle light can follow the candle-holder ("the cellar is
  // lit ONLY by the player's candle cone"). Original draw behavior untouched;
  // wraps at most once, fully guarded.
  function hookPlayerPos() {
    try {
      if (!window.SPRITES || typeof SPRITES.drawPlayer !== 'function') return;
      if (SPRITES.drawPlayer.__cellarPosHook) return;
      var orig = SPRITES.drawPlayer;
      var wrapped = function (c, x, y) {
        try {
          if (typeof x === 'number' && typeof y === 'number') {
            playerPos.x = x; playerPos.y = y;
          }
        } catch (e) {}
        return orig.apply(this, arguments);
      };
      wrapped.__cellarPosHook = true;
      SPRITES.drawPlayer = wrapped;
    } catch (e) {}
  }

  /* ---------------- safe helpers (never rely on globals blindly) ---------------- */
  function px(ctx, x, y, w, h, c) {
    try { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); } catch (e) {}
  }
  function ditherS(ctx, x, y, w, h, c1, c2) {
    try {
      if (window.SPRITES && SPRITES.dither) { SPRITES.dither(ctx, x, y, w, h, c1, c2); return; }
    } catch (e) {}
    px(ctx, x, y, w, h, c1);
  }
  function glowS(ctx, x, y, r, color, alpha) {
    try {
      if (window.SPRITES && SPRITES.glow) { SPRITES.glow(ctx, x, y, r, color, alpha); return; }
    } catch (e) {}
    try {
      ctx.save(); ctx.globalAlpha = (alpha || 0.15) * 0.5; ctx.fillStyle = color;
      ctx.fillRect(x - r, y - r * 0.8, r * 2, r * 1.6); ctx.restore();
    } catch (e2) {}
  }
  function starS(ctx, x, y, t, size, color) {
    try {
      if (window.SPRITES && SPRITES.star) { SPRITES.star(ctx, x, y, t, size, color); return; }
    } catch (e) {}
    if (Math.sin(t * 3 + x + y) > 0.3) px(ctx, x, y, 1, 1, color || '#ffffff');
  }
  function flameS(ctx, x, y, t, size) {
    try { if (window.SPRITES && SPRITES.flame) { SPRITES.flame(ctx, x, y, t, size); return; } } catch (e) {}
    px(ctx, x - 1, y - 3, 2, 3, AMBER);
  }
  function safeMusic(mode) {
    try { if (window.AUDIO && AUDIO.music) AUDIO.music(mode); } catch (e) {}
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffled(arr) {
    var a = arr.slice(), i, j, tmp;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1)); tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }
  function flagsOf(S) { return (S && S.flags) ? S.flags : {}; }
  function isLit(S) { return !!flagsOf(S).cellarLit; }
  function hash2(a, b) {
    var n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }
  function hasSealSafe(id) {
    try {
      var s = window.GAME && GAME.state && GAME.state.seals;
      return !!(s && s.indexOf(id) >= 0);
    } catch (e) { return false; }
  }
  function talkedToCat() {
    // cross-scene courtesy flag from the inn (checked defensively — any spelling)
    var f = flagsOf(window.GAME && GAME.state);
    return !!(f.innCatMet || f.catTalked || f.metCat || f.catHint || f.talkedCat || f.beitzahTalked);
  }
  function fSay(g, text) { return g.say(text, { who: 'freida', color: FREIDA_C }); }

  /* ============================ PAINT — DARK MODE ============================ */
  // Darkness with silhouettes; a full-scene wash (see 'darkwash' hotspot) dims
  // even the player sprite to a silhouette. A grey wedge leaks from the
  // stairs — "a rumor of light".
  function paintDark(ctx, t, S) {
    px(ctx, 0, 0, 320, 180, DARK_BG);
    px(ctx, 0, 124, 320, 56, DARK_FLR);

    // silhouette barrel wall — the cellar is there, waiting for a candle
    var r, c;
    for (r = 0; r < 4; r++) {
      for (c = 0; c < BW.cols; c++) {
        px(ctx, BW.x0 + c * BW.colW, BW.y0 + r * BW.rowH, BW.colW - 1, BW.rowH - 1, SIL);
      }
    }
    // shelf + garlic silhouettes
    px(ctx, 8, 34, 44, 40, SIL_DIM);
    px(ctx, 208, 6, 3, 26, SIL_DIM);
    px(ctx, 220, 6, 3, 30, SIL_DIM);
    px(ctx, 230, 6, 3, 22, SIL_DIM);

    // stairs silhouette (right side)
    var i;
    for (i = 0; i < 8; i++) px(ctx, 254 + i * 8, 116 - i * 12, 66 - i * 8, 12, '#101024');

    // grey light wedge from the stairway — pulses faintly ("a rumor of light")
    var pulse = 0.10 + 0.03 * Math.sin(t * 0.8);
    try {
      ctx.save(); ctx.globalAlpha = pulse; ctx.fillStyle = WEDGE;
      for (i = 0; i < 10; i++) ctx.fillRect(250 + i * 7, 0, 7, 150 - i * 11);
      ctx.restore();
    } catch (e) {}

    // dust motes drifting inside the wedge — the only "weather" down here
    for (i = 0; i < 5; i++) {
      var mx = 258 + hash2(i, 7) * 52 + Math.sin(t * 0.5 + i * 2.1) * 3;
      var my = 20 + ((t * (4 + i) + hash2(i, 3) * 90) % 100);
      px(ctx, Math.floor(mx), Math.floor(my), 1, 1, 'rgba(170,170,200,0.35)');
    }

    // two restless shadow blobs — "even the shadows here wait for a candle"
    var sx = 100 + Math.sin(t * 0.23) * 40;
    px(ctx, Math.floor(sx), 130, 34, 10, '#03030b');
    var sx2 = 180 + Math.sin(t * 0.31 + 2) * 30;
    px(ctx, Math.floor(sx2), 150, 26, 8, '#03030b');

    drawMouseHole(ctx, t, S, false);
  }

  /* ============================ PAINT — LIT MODE ============================= */
  function paintLit(ctx, t, S) {
    // back wall — old stone, warmed by candlelight
    px(ctx, 0, 0, 320, 124, STONE_D);
    ditherS(ctx, 0, 0, 320, 10, STONE_D, '#1e1830');
    var i, r, c;
    // sparse stone blocks
    for (r = 0; r < 6; r++) {
      for (c = 0; c < 11; c++) {
        if (hash2(r, c) > 0.72) {
          px(ctx, c * 30 + ((r % 2) * 15), 12 + r * 19, 22, 12, STONE_M);
          px(ctx, c * 30 + ((r % 2) * 15), 12 + r * 19, 22, 1, STONE_L);
        }
      }
    }
    // ceiling beams
    px(ctx, 0, 0, 320, 5, '#3a2818');
    px(ctx, 0, 5, 320, 1, '#241708');

    // floor — packed earth and old planks
    px(ctx, 0, 124, 320, 56, FLOOR_D);
    ditherS(ctx, 0, 124, 320, 4, FLOOR_L, FLOOR_D);
    for (i = 0; i < 6; i++) px(ctx, i * 56, 130 + (i % 3) * 14, 40, 1, '#140f1e');

    drawShelf(ctx, t);
    drawBarrelWall(ctx, t, S);
    drawGarlic(ctx, t);
    drawStairs(ctx, t);
    drawCobwebs(ctx, t);
    drawMouseHole(ctx, t, S, true);
    drawDrip(ctx, t);

    // bedikah kit motif: a spare feather + wooden spoon resting on a barrel top
    px(ctx, 62, 29, 6, 1, '#f0ead8');
    px(ctx, 67, 28, 2, 1, '#f0ead8');
    px(ctx, 72, 29, 5, 1, WOOD_L);
    px(ctx, 76, 28, 2, 2, WOOD_L);

    // the player's candle — the only light source; the cone travels with him
    drawCandleCone(ctx, t);

    // vignette — candlelight does not reach the corners
    try {
      ctx.save(); ctx.globalAlpha = 0.32; ctx.fillStyle = '#020208';
      ctx.fillRect(0, 0, 26, 180); ctx.fillRect(294, 0, 26, 180); ctx.fillRect(0, 0, 320, 8);
      ctx.restore();
    } catch (e) {}
  }

  /* ---- the candle cone — a flickering wedge of light anchored to the player - */
  function drawCandleCone(ctx, t) {
    var cx = Math.max(12, Math.min(308, Math.round(playerPos.x)));
    var cy = Math.round(playerPos.y);
    var fl = 0.10 + 0.02 * Math.sin(t * 9) + 0.015 * Math.sin(t * 23 + 1);
    var handY = cy - 34;   // candle held at chest height
    var footY = cy + 6;    // light pools just past the feet
    var steps = 8, span = footY - handY, i;
    try {
      ctx.save();
      ctx.fillStyle = FLAME_MID;
      for (i = 0; i < steps; i++) {
        var y0 = handY + Math.floor(span * i / steps);
        var hh = Math.ceil(span / steps) + 1;
        var half = 3 + Math.round(i * 3.4); // cone widens toward the floor
        ctx.globalAlpha = Math.max(0.035, 0.10 - i * 0.008) * (fl / 0.10);
        ctx.fillRect(cx - half, y0, half * 2, hh);
      }
      ctx.restore();
    } catch (e) {}
    // warm glow around the flame + amber pool where the light lands
    glowS(ctx, cx, cy - 12, 46, FLAME_MID, fl);
    glowS(ctx, cx, footY - 4, 30, AMBER, fl * 0.8);
  }

  /* ---- barrel wall: 4 rows x 6 cols, the rows must read clearly ------------- */
  function drawBarrelWall(ctx, t, S) {
    var r, c, keys = ['top', 'second', 'third', 'bottom'];
    for (r = 0; r < 4; r++) {
      var upper = (r < 2);
      for (c = 0; c < BW.cols; c++) {
        drawBarrel(ctx, BW.x0 + c * BW.colW, BW.y0 + r * BW.rowH, upper, hash2(r, c));
      }
      // upper (outer) rows catch slightly more candlelight — visual distinction
      if (upper) {
        try {
          ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = AMBER;
          ctx.fillRect(BW.x0, BW.y0 + r * BW.rowH, BW.cols * BW.colW, BW.rowH);
          ctx.restore();
        } catch (e) {}
      }
    }
    // support plank under the stack
    px(ctx, BW.x0 - 3, 122, BW.cols * BW.colW + 6, 3, '#3a2818');

    // one barrel wears a cobweb kippah (top row, rightmost) — pure dignity
    var kx = BW.x0 + 5 * BW.colW + 4;
    ditherS(ctx, kx, 29, 13, 3, WEB, STONE_D);
    px(ctx, kx + 3, 28, 7, 1, WEB);

    // vintage chalk mark on one barrel ("bottled a while ago")
    px(ctx, BW.x0 + 2 * BW.colW + 5, ROW_Y.third + 8, 8, 1, '#c8c0a8');
    px(ctx, BW.x0 + 2 * BW.colW + 5, ROW_Y.third + 11, 6, 1, '#c8c0a8');

    // knock wobble — the barrel that was just knocked answers in Aramaic
    var kd = lastT - knockAt;
    if (kd >= 0 && kd < 0.8) {
      var wob = Math.sin(kd * 30) * (1 - kd / 0.8) * 2;
      px(ctx, BW.x0 + 3 * BW.colW + 2 + Math.round(wob), ROW_Y.third + 2, BW.colW - 5, 2, WOOD_HI);
    }

    // success glint cascade on the two correct (upper) rows
    var gd = lastT - glintAt;
    if (gd >= 0 && gd < 2.6) {
      var n;
      for (n = 0; n < 10; n++) {
        var gx = BW.x0 + 4 + hash2(n, 11) * (BW.cols * BW.colW - 8);
        var gy = ROW_Y.top + 3 + hash2(n, 5) * (BW.rowH * 2 - 6);
        if (hash2(n, 2) * 2.2 < gd) starS(ctx, Math.floor(gx), Math.floor(gy), t, 2, '#fff7d6');
      }
      // the kippah barrel sparkles LAST — it woke up late
      if (gd > 1.7) starS(ctx, BW.x0 + 5 * BW.colW + 10, 31, t, 3, '#aef6ff');
    }
    // post-seal: a quiet lasting sparkle on the two checked rows
    if (hasSealSafe('bedikah') && gd >= 2.6) {
      starS(ctx, BW.x0 + 18, ROW_Y.top + 6, t, 1, '#fff7d6');
      starS(ctx, BW.x0 + 96, ROW_Y.second + 9, t, 1, '#fff7d6');
    }
  }

  function drawBarrel(ctx, x, y, upper, seed) {
    var w = BW.colW - 1, h = BW.rowH - 1;
    var s = (typeof seed === 'number') ? seed : 0.5;
    var body = (s > 0.55) ? WOOD_D : '#523420'; // two wood batches, mixed stack
    var midY = y + Math.floor(h / 2);
    px(ctx, x, y + 1, w, h - 2, body);
    px(ctx, x + 1, y, w - 2, h, body);
    px(ctx, x + 2, y + 1, w - 4, 2, upper ? WOOD_HI : WOOD_L); // top highlight
    // belly bulge: 1px swell at mid-height on both flanks
    px(ctx, x - 1, midY - 1, 1, 3, body);
    px(ctx, x + w, midY - 1, 1, 3, body);
    // staves — x jittered per barrel so no two read identical
    var j = Math.floor(s * 3); // 0..2
    px(ctx, x + 5 + j, y + 1, 1, h - 2, '#4a2f1c');
    px(ctx, x + 12 + ((j + 1) % 3), y + 1, 1, h - 2, '#4a2f1c');
    // hoops
    px(ctx, x + 1, y + 4, w - 2, 1, COPPER);
    px(ctx, x + 1, y + h - 5, w - 2, 1, COPPER);
    // bung — drifts a little; the coopers were human
    var bx = x + Math.floor(w / 2) - 1 + ((s > 0.66) ? 1 : ((s < 0.33) ? -1 : 0));
    px(ctx, bx, midY - 1, 2, 2, '#3a2414');
  }

  /* ---- Pesach-dishes shelf with a fluttering curtain ------------------------ */
  function drawShelf(ctx, t) {
    px(ctx, 8, 34, 44, 42, '#3a2818');
    px(ctx, 10, 36, 40, 38, '#241708');
    px(ctx, 10, 54, 40, 2, '#3a2818'); // middle plank
    // dishes peeking above the curtain (they wait for their annual move)
    px(ctx, 14, 40, 8, 5, PARCH);
    px(ctx, 26, 38, 10, 7, '#c8b888');
    px(ctx, 40, 41, 6, 4, PARCH);
    // curtain covering the lower half — flutters at the free edge
    var i;
    for (i = 0; i < 20; i++) {
      var wave = Math.round(Math.sin(t * 2 + i * 0.8) * 1.2);
      px(ctx, 10 + i * 2, 56, 2, 18 + ((i === 19) ? wave : 0), (i % 2) ? CURTAIN : '#6a3450');
    }
    px(ctx, 10, 56, 40, 1, '#8a4a6a');
  }

  /* ---- garlic braids — kosher for Pesach, lethal for matchmaking ------------ */
  function drawGarlic(ctx, t) {
    var braids = [{ x: 209, len: 26 }, { x: 221, len: 30 }, { x: 231, len: 22 }];
    var i, j;
    for (i = 0; i < braids.length; i++) {
      var b = braids[i];
      var sway = Math.sin(t * 1.1 + i * 1.7) * 1.5;
      px(ctx, b.x, 5, 1, 4, '#5a5a40');
      for (j = 0; j < Math.floor(b.len / 5); j++) {
        var gx = b.x - 1 + Math.round(sway * (j / 5));
        px(ctx, gx, 9 + j * 5, 4, 4, GARLIC_C);
        px(ctx, gx + 1, 9 + j * 5, 1, 4, '#ccc4a8');
      }
    }
  }

  /* ---- stairway up to the inn + grey daylight-rumor wedge ------------------- */
  function drawStairs(ctx, t) {
    var i;
    for (i = 0; i < 8; i++) {
      px(ctx, 254 + i * 8, 116 - i * 12, 66 - i * 8, 12, STONE_M);
      px(ctx, 254 + i * 8, 116 - i * 12, 66 - i * 8, 2, STONE_L);
    }
    px(ctx, 250, 20, 4, 108, '#1a1428'); // dark doorway edge
    // the grey wedge — weaker when the cellar is lit, still pulsing
    var pulse = 0.05 + 0.02 * Math.sin(t * 0.8);
    try {
      ctx.save(); ctx.globalAlpha = pulse; ctx.fillStyle = WEDGE;
      for (i = 0; i < 8; i++) ctx.fillRect(256 + i * 8, 0, 8, 130 - i * 13);
      ctx.restore();
    } catch (e) {}
    // motes in the wedge
    for (i = 0; i < 4; i++) {
      var mx = 262 + hash2(i, 9) * 44 + Math.sin(t * 0.6 + i) * 2;
      var my = 16 + ((t * (5 + i) + hash2(i, 4) * 80) % 92);
      px(ctx, Math.floor(mx), Math.floor(my), 1, 1, 'rgba(170,170,200,0.3)');
    }
  }

  /* ---- cobwebs + a bobbing spider ------------------------------------------- */
  function drawCobwebs(ctx, t) {
    var i;
    for (i = 0; i < 5; i++) {
      px(ctx, 2 + i * 5, 8 + i * 3, 4, 1, WEB);
      px(ctx, 2 + i * 3, 8 + i * 5, 1, 4, WEB);
    }
    ditherS(ctx, 2, 8, 16, 10, WEB, STONE_D);
    // spider on a thread, gently bobbing — claims territorial rights since last Pesach
    var sy = 22 + Math.sin(t * 1.4) * 3;
    px(ctx, 12, 18, 1, Math.floor(sy) - 18, '#6a6a80');
    px(ctx, 11, Math.floor(sy), 3, 2, '#2a2a3a');
    // wisps near the barrel top corner
    px(ctx, 192, 30, 6, 1, WEB);
    px(ctx, 195, 27, 1, 4, WEB);
  }

  /* ---- mouse hole: glinting eyes, a tiny feather — the mouse has its own kit - */
  function drawMouseHole(ctx, t, S, lit) {
    var hx = 30, hy = 112;
    px(ctx, hx, hy, 14, 12, '#000006');
    px(ctx, hx + 1, hy - 1, 12, 1, lit ? STONE_L : SIL); // arch
    // blinking eyes; double-wink one-shot after the unlit-candle easter egg
    var wink = (lastT - mouseWinkAt >= 0 && lastT - mouseWinkAt < 1.0) &&
               (Math.sin((lastT - mouseWinkAt) * 12) > 0);
    var blink = ((t + 1.3) % 2.7) < 0.15;
    if (!blink && !wink) {
      px(ctx, hx + 4, hy + 5, 1, 1, '#ffe9a8');
      px(ctx, hx + 8, hy + 5, 1, 1, '#ffe9a8');
    }
    // the mouse's own tiny bedikah feather leaning by the hole
    px(ctx, hx + 15, hy + 8, 1, 4, '#f0ead8');
    px(ctx, hx + 16, hy + 7, 1, 2, '#f0ead8');
    // post-seal payoff: a 1px candle glow inside — the mouse is doing bedikah too
    if (hasSealSafe('bedikah')) {
      var fl = 0.5 + 0.4 * Math.sin(t * 11);
      px(ctx, hx + 6, hy + 8, 1, 1, (fl > 0.6) ? AMBER : AMBER_D);
    }
  }

  /* ---- a slow wine drip from one barrel tap + shimmer puddle ----------------- */
  function drawDrip(ctx, t) {
    var tapX = BW.x0 + BW.colW + 10, tapY = ROW_Y.bottom + 16;
    px(ctx, tapX - 1, tapY, 3, 2, COPPER);
    var phase = (t * 0.7) % 1;
    if (phase > 0.55) {
      var dy = (phase - 0.55) / 0.45 * (124 - tapY - 2);
      px(ctx, tapX, tapY + 2 + Math.floor(dy), 1, 2, '#7a2440');
    }
    px(ctx, tapX - 3, 125, 7, 2, '#4a1830');
    if (Math.sin(t * 3.1) > 0.6) px(ctx, tapX - 1, 125, 2, 1, '#8a3450'); // shimmer
  }

  /* ============================ FREIDA — the cellar-keeper ==================== */
  // Ancient, calm, feather in one hand, wooden spoon in the other, like a
  // knight's sword and shield. Anchored at feet (224, 142).
  function drawFreida(ctx, t, S) {
    var f = flagsOf(S);
    var lit = isLit(S);
    if (!lit && !f.freidaRevealed) return; // still hiding in the dark
    var fx = 224, fy = 142;
    var bob = Math.sin(t * 1.7) * 0.8;
    var y0 = Math.round(fy + bob);

    if (!lit) {
      // silhouette in the stair-wedge grey: an outline, two calm eyes, one
      // impossibly white feather (the feather is always visible; it has seniority)
      px(ctx, fx - 6, y0 - 20, 12, 20, '#14142a');
      px(ctx, fx - 4, y0 - 26, 8, 7, '#14142a');
      if (((t + 0.7) % 3.9) > 0.13) {
        px(ctx, fx - 2, y0 - 23, 1, 1, '#ffe9a8');
        px(ctx, fx + 1, y0 - 23, 1, 1, '#ffe9a8');
      }
      px(ctx, fx + 7, y0 - 24, 2, 6, '#e8e8f0');
      return;
    }

    // shadow
    px(ctx, fx - 7, fy - 1, 14, 2, 'rgba(0,0,0,0.35)');
    // dress + shawl
    px(ctx, fx - 6, y0 - 14, 12, 14, '#4a3a5a');
    px(ctx, fx - 7, y0 - 20, 14, 7, '#6a4a7a');
    px(ctx, fx - 7, y0 - 20, 14, 1, '#8a62a0');
    // head, bun, face
    px(ctx, fx - 4, y0 - 27, 8, 8, '#e8c8a0');
    px(ctx, fx - 3, y0 - 30, 6, 4, '#cccccc');
    px(ctx, fx + 2, y0 - 31, 3, 3, '#cccccc');
    // eyes (slow, seen-everything blink)
    if (((t + 0.7) % 3.9) > 0.13) {
      px(ctx, fx - 2, y0 - 24, 1, 1, '#2a1a3a');
      px(ctx, fx + 1, y0 - 24, 1, 1, '#2a1a3a');
    }
    // small warm smile line
    px(ctx, fx - 1, y0 - 21, 2, 1, '#b08868');

    // FEATHER arm (her right / screen left side raises on salutes)
    var sd = lastT - saluteAt;
    var ld = lastT - lowerAt;
    if (sd >= 0 && sd < 1.6) {
      // salute: feather up high, proud
      px(ctx, fx - 8, y0 - 24, 2, 6, '#e8c8a0');
      px(ctx, fx - 9, y0 - 33, 3, 10, '#f0f0f8');
      px(ctx, fx - 8, y0 - 35, 1, 3, '#f0f0f8');
      if (sd < 0.6) starS(ctx, fx - 8, y0 - 37, t, 2, '#fff7d6');
      if (saluteBig) {
        // the spoon joins the salute — a rare double honor
        px(ctx, fx + 7, y0 - 24, 2, 6, '#e8c8a0');
        px(ctx, fx + 7, y0 - 32, 2, 8, WOOD_L);
        px(ctx, fx + 6, y0 - 34, 4, 3, WOOD_HI);
      }
    } else if (ld >= 0 && ld < 2.2) {
      // wrong answer: the feather descends slowly. It is somehow worse than words.
      var drop = Math.min(1, ld / 2.2);
      var fyTip = y0 - 28 + Math.round(drop * 14);
      px(ctx, fx - 8, y0 - 18, 2, 5, '#e8c8a0');
      px(ctx, fx - 9, fyTip, 2, 8, '#e8e8f0');
    } else {
      // idle: feather held like a sceptre, tiny twirl
      var tw = Math.round(Math.sin(t * 2.3) * 1);
      px(ctx, fx - 8, y0 - 18, 2, 5, '#e8c8a0');
      px(ctx, fx - 9 + tw, y0 - 27, 2, 9, '#e8e8f0');
    }
    // SPOON hand (rest position, unless big salute already drew it raised)
    if (!(sd >= 0 && sd < 1.6 && saluteBig)) {
      px(ctx, fx + 7, y0 - 16, 2, 5, '#e8c8a0');
      px(ctx, fx + 8, y0 - 13, 1, 6, WOOD_L);
      px(ctx, fx + 7, y0 - 8, 3, 2, WOOD_HI);
    }
  }

  /* ============================ ROW SELECTION DRAW ============================ */
  function drawRowState(ctx, t, S, key) {
    if (!isLit(S)) return;
    var f = flagsOf(S);
    var y = ROW_Y[key];
    if (f.rowsActive && !hasSealSafe('bedikah')) {
      // soft hint frame while the puzzle is live
      try {
        ctx.save(); ctx.globalAlpha = 0.18 + 0.08 * Math.sin(t * 3);
        ctx.fillStyle = '#aef6ff';
        ctx.fillRect(BW.x0 - 2, y, 1, BW.rowH - 1);
        ctx.fillRect(BW.x0 + BW.cols * BW.colW + 1, y, 1, BW.rowH - 1);
        ctx.restore();
      } catch (e) {}
    }
    if (rowPick.indexOf(key) >= 0 && !hasSealSafe('bedikah')) {
      // selected row: pulsing amber outline
      try {
        ctx.save(); ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 5);
        ctx.fillStyle = AMBER;
        ctx.fillRect(BW.x0 - 1, y - 1, BW.cols * BW.colW + 2, 1);
        ctx.fillRect(BW.x0 - 1, y + BW.rowH - 1, BW.cols * BW.colW + 2, 1);
        ctx.fillRect(BW.x0 - 1, y - 1, 1, BW.rowH);
        ctx.fillRect(BW.x0 + BW.cols * BW.colW, y - 1, 1, BW.rowH);
        ctx.restore();
      } catch (e) {}
    }
  }

  /* ============================ QUIZ A — what needs bedikah =================== */
  var QUIZ_A = [
    {
      q: 'סיבוב ראשון: המרתף הזה עצמו. מוציאים ממנו יין באמצע הסעודה — ביד שהחזיקה הרגע לחם. צריך בדיקה?',
      correct: 'need',
      praise: 'בדיוק! «וּבַמָּה אָמְרוּ ״שְׁתֵּי שׁוּרוֹת בַּמַּרְתֵּף״ — מָקוֹם שֶׁמַּכְנִיסִין בּוֹ חָמֵץ». יד עם לחם נכנסה — המרתף צריך בדיקה.',
      extra: 'וכמה בודקים כאן? לא את כל המרתף — רק שתי שורות. תיכף נגיע לזה.',
      reject: 'אין צריך?! מפה מוציאים יין באמצע הסעודה — עם היד שהחזיקה עכשיו לחם! «מָקוֹם שֶׁמַּכְנִיסִין בּוֹ חָמֵץ» — צריך בדיקה, חביבי.'
    },
    {
      q: 'סיבוב שני: ארון כלי הפסח החתום — חמץ מעולם לא נכנס אליו. צריך בדיקה?',
      correct: 'noneed',
      praise: 'נכון. «כׇּל מָקוֹם שֶׁאֵין מַכְנִיסִין בּוֹ חָמֵץ, אֵין צָרִיךְ בְּדִיקָה». הכלל פשוט: אין כניסת חמץ — אין בדיקה.',
      extra: '',
      reject: 'לבדוק ארון שחמץ מעולם לא נכנס אליו? «כׇּל מָקוֹם שֶׁאֵין מַכְנִיסִין בּוֹ חָמֵץ, אֵין צָרִיךְ בְּדִיקָה». תחסוך את הנר, הוא יחיד בכפר.'
    },
    {
      q: 'סיבוב שלישי: הכיסים במעיל של גד. הוא אוכל קרעפלעך תוך כדי ריצה. צריך בדיקה?',
      correct: 'need',
      praise: 'צריך, ועוד איך. מקום שמכניסים בו חמץ — צריך בדיקה. וגד מכניס. הו, גד מכניס.',
      extra: '',
      reject: 'אין צריך?! ראית פעם את הכיסים של גד? יש שם פירורים עם ותק. מקום שמכניסים בו חמץ — צריך בדיקה. וגד מכניס בכל ריצה.'
    }
  ];

  // forced-restatement beat: a wrong pick means the RULE is fuzzy, not the luck
  async function restateRule(g) {
    await fSay(g, 'רגע. לפני שמנחשים שוב — תגיד לי במילים שלך: מה הכלל?');
    var ok = false;
    while (!ok) {
      var v = await g.choose(shuffled([
        { text: 'בודקים בכל מקום שמכניסים בו חמץ; מקום שאין מכניסים בו — אין צריך בדיקה.', value: 'right' },
        { text: 'בודקים רק במקומות חשוכים במיוחד.', value: 'dark' },
        { text: 'בודקים בכל מקום שיש בו אוכל, גם אוכל של פסח.', value: 'food' }
      ]));
      if (v === 'right') {
        ok = true;
        g.sfx('click');
        await fSay(g, 'זה הכלל. עכשיו תענה כמו מי שמבין, לא כמו מי שמנחש.');
      } else if (v === 'dark') {
        g.sfx('fail');
        await fSay(g, 'לא. החושך זה רק התפאורה. השאלה היא אם חמץ נכנס לשם — לא כמה אפל שם.');
      } else {
        g.sfx('fail');
        await fSay(g, 'לא. אוכל של פסח חף מפשע. שאלה אחת יש בלילה הזה: האם מכניסים לשם חָמֵץ. שאלה אחת — אלפיים שנה שהיא לא משתנה.');
      }
    }
  }

  async function runQuizA(g) {
    await fSay(g, 'לפני שנוגעים בחביות — נבדוק שאתה יודע מה בכלל צריך בדיקה. שלושה סיבובים. הנוצה שופטת.');
    var i;
    for (i = 0; i < QUIZ_A.length; i++) {
      var round = QUIZ_A[i];
      var solved = false;
      var wasWrong = false;
      await fSay(g, round.q);
      while (!solved) {
        var v = await g.choose(shuffled([
          { text: 'צריך בדיקה', value: 'need' },
          { text: 'אין צריך בדיקה', value: 'noneed' }
        ]));
        if (v === round.correct) {
          solved = true;
          g.sfx('seal');
          saluteAt = lastT; saluteBig = false;
          await fSay(g, round.praise);
          if (round.extra) await fSay(g, round.extra);
        } else {
          g.sfx('fail');
          lowerAt = lastT; // the feather descends slowly. It is worse than words.
          await fSay(g, round.reject);
          if (!wasWrong) { wasWrong = true; await restateRule(g); }
          await fSay(g, 'עוד פעם: ' + round.q);
        }
      }
    }
    g.flag('quizADone', true);
    await fSay(g, 'עברת. עכשיו — החלק שבגללו יש לי ברכיים של מרתפנית.');
    await startRows(g);
  }

  /* ============================ QUIZ B — the ROWS puzzle ====================== */
  async function startRows(g) {
    g.flag('rowsActive', true);
    rowPick = [];
    await fSay(g, 'המשנה: «שְׁתֵּי שׁוּרוֹת בַּמַּרְתֵּף». לפי בית הלל — אילו שתי שורות בודקים? לחץ על שתי שורות בקיר החביות.');
    await g.playerSay('קיר של עשרים וארבע חביות, ואני צריך רק... רגע, שתי שורות. לא שתי חביות. זה כבר נשמע הוגן.');
  }

  async function promptRows(g) {
    if (!flagsOf(GAME.state).rowsActive) g.flag('rowsActive', true);
    if (rowPick.length === 1) {
      await fSay(g, 'בחרת שורה אחת. «שְׁתֵּי שׁוּרוֹת» — שתיים. גם בית שמאי וגם בית הלל מסכימים על המספר.');
    } else {
      await fSay(g, 'שתי שורות, לפי בית הלל. לחץ עליהן שם, על הקיר. הנוצה מוכנה.');
    }
  }

  async function rowClicked(g, key) {
    var S = GAME.state, f = flagsOf(S);
    if (hasSealSafe('bedikah')) {
      if (key === 'top') {
        await g.playerSay('הסדק ריק. הפיתה בכיס שלי, השורות נבדקו — ואחרי אלפיים שנות בדיקות, סוף סוף נמצא פה משהו. טוב, אני מצאתי. פרידא תספר את זה אחרת.');
      } else if (key === 'second') {
        await g.playerSay(pick([
          'שורה בדוקה. יש לה עכשיו ביטחון עצמי של חבית שעברה ביקורת.',
          'נבדק. אושר. חתום. החביות יכולות לנוח.'
        ]));
      } else {
        await g.playerSay('השורה הזאת בכלל לא נבדקה — ולא צריך. «הַחִיצוֹנוֹת שֶׁהֵן הָעֶלְיוֹנוֹת» — כל השאר פטורות. תראה איזה שקט נפשי יש לה.');
      }
      return;
    }
    if (!isLit(S)) {
      await g.playerSay('אני רואה בערך צל של חבית. «בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר» — לא לאור הניחוש.');
      return;
    }
    if (!f.rowsActive) {
      var names = { top: 'השורה העליונה', second: 'השורה השנייה', third: 'השורה השלישית', bottom: 'השורה התחתונה' };
      await g.playerSay(names[key] + '. חביות במנוחה. פרידא עוד לא נתנה אות — והנוצה שלה לא זזה בלי אישור מהכף.');
      return;
    }
    if (quizRunning) return;
    // toggle selection
    var idx = rowPick.indexOf(key);
    if (idx >= 0) {
      rowPick.splice(idx, 1);
      g.sfx('click');
      await fSay(g, 'ירדה מהרשימה. הנוצה מוחקת בלי שיפוטיות.');
      return;
    }
    rowPick.push(key);
    g.sfx('click');
    if (rowPick.length < 2) {
      await fSay(g, pick(['אחת. עוד אחת.', 'נרשם. «שְׁתֵּי שׁוּרוֹת» — עוד שורה אחת.']));
      return;
    }
    await evalRows(g);
  }

  async function evalRows(g) {
    if (quizRunning) return;
    quizRunning = true;
    try {
      var hasTop = rowPick.indexOf('top') >= 0;
      var hasSecond = rowPick.indexOf('second') >= 0;
      var hasBottom = rowPick.indexOf('bottom') >= 0;
      if (hasTop && hasSecond) {
        await rowsSuccess(g);
        return;
      }
      g.sfx('fail');
      lowerAt = lastT;
      if (hasTop !== hasSecond) {
        // exactly one of the two correct rows was picked — acknowledge the half
        await fSay(g, 'חצי נכון! אחת מהשתיים באמת נבדקת. עכשיו תמצא לה בת זוג: «הַחִיצוֹנוֹת שֶׁהֵן הָעֶלְיוֹנוֹת» — תישאר למעלה.');
      } else if (hasBottom) {
        await fSay(g, 'התחתונות?! מי מגיש יין מהשורה שצריך לזחול אליה? בית הלל אמרו «הַחִיצוֹנוֹת שֶׁהֵן הָעֶלְיוֹנוֹת» — היד הולכת למעלה ולחוץ, והחמץ הולך אחריה.');
      } else {
        await fSay(g, 'אמצע? באמצע גרות רק חביות ביישניות. חיצונות ועליונות — איפה שהיד מגיעה, שם החמץ מבקר.');
      }
      rowPick = [];
      await fSay(g, 'עוד פעם. שתי השורות של בית הלל.');
    } catch (e) {
      console.warn('cellar.js: evalRows failed', e);
    } finally {
      quizRunning = false;
    }
  }

  async function rowsSuccess(g) {
    glintAt = lastT;
    g.sfx('star');
    await g.wait(1000);
    g.sfx('seal');
    saluteAt = lastT; saluteBig = false;
    await fSay(g, 'אלה. «שְׁתֵּי שׁוּרוֹת הַחִיצוֹנוֹת שֶׁהֵן הָעֶלְיוֹנוֹת» — כבית הלל.');
    // comprehension gate: success by clicking is not success by understanding
    var ok = false;
    while (!ok) {
      await fSay(g, 'ולמה לא בודקים «שְׁתֵּי שׁוּרוֹת עַל פְּנֵי כׇּל הַמַּרְתֵּף»?');
      var v = await g.choose(shuffled([
        { text: 'זו שיטת בית שמאי; ההלכה כבית הלל — רק החיצונות שהן העליונות.', value: 'right' },
        { text: 'כי חושך ואי אפשר לראות את שאר השורות.', value: 'dark' },
        { text: 'כי היין בשאר השורות עדין מדי בשביל ביקורת.', value: 'wine' }
      ]));
      if (v === 'right') {
        ok = true;
        g.sfx('click');
        await fSay(g, 'בדיוק. בית שמאי מחמירים יפה — והברכיים שלי מודות לבית הלל.');
      } else if (v === 'dark') {
        g.sfx('fail');
        await fSay(g, 'הנר בידך ואתה עוד מאשים את החושך? לא. זו מחלוקת בית שמאי ובית הלל — לא בעיית תאורה.');
      } else {
        g.sfx('fail');
        await fSay(g, 'היין לא צד בדיון. בית שמאי — שתי שורות על פני כל המרתף; בית הלל — החיצונות שהן העליונות. והלכה כבית הלל.');
      }
    }
    await fSay(g, 'איך סופרים בדיוק "חיצונות" ו"עליונות"? יש על זה דיון שלם. בדף אחר.');
    // the candle catches something in a barrel-top crack
    await g.wait(400);
    g.sfx('magic');
    await g.playerSay('רגע. הנר תופס משהו בסדק של החבית העליונה...');
    await g.playerSay('פיתה. עתיקה. קשה כאבן. אני כמעט בטוח שיש לה טבעות עצים.');
    try { g.give('pita'); } catch (e) {}
    await fSay(g, 'מצאת חמץ! הנוצה שלי הרגישה את זה מאלפיים שנה. זו בדיקה אמיתית — בלילה, לאור הנר, ובשורות הנכונות. מחר בשעת הביעור היא בוערת. הלילה — בודקים.');
    try { g.addSeal('bedikah', 'חותם הבדיקה'); } catch (e) {}
    g.flag('rowsActive', false);
    rowPick = [];
    // the double salute — feather AND spoon. A rare honor.
    saluteAt = lastT; saluteBig = true;
    await fSay(g, 'הצדעה מלאה. נוצה וגם כף.');
    await fSay(g, 'סליחה, כף. אתה בדרך כלל תפקיד שקט.');
    await g.playerSay('חותם ראשון של בדיקה — ופחמימה ארכיאולוגית. לילה מוצלח.');
  }

  /* ============================ FREIDA TALK ROUTER ============================ */
  async function freidaTalk(g) {
    if (quizRunning) return;
    var S = GAME.state, f = flagsOf(S);

    // --- dark phase -------------------------------------------------------
    if (!isLit(S)) {
      if (!f.freidaMet) {
        quizRunning = true;
        try {
          if (talkedToCat()) {
            await fSay(g, 'החתולה שלחה אותך? היא מריחה פירורים דרך שתי קומות. חבל שהיא מוקצה, לדעתה — הייתה הבודקת הכי טובה בכפר.');
          } else {
            await fSay(g, 'שלום, בחור. פרידא המרתפנית. אלפיים שנה של בדיקות במרתף הזה — ואתה הראשון שמגיע בלי אש.');
          }
          await g.playerSay('באתי לבדוק חמץ. הבאתי ידיים, כוונה טובה, ואפס יכולת לראות.');
          await fSay(g, 'קח נר. כבוי, כמו כל הכפר — כל להבה אצלנו נדלקת מהמנורה שבבית הבד, והמנורה כבתה וסירבה.');
          try { g.give('ner'); } catch (e) {}
          await fSay(g, 'אש עוד יש רק לאחד: בועז מהפסגה. איש של אש. קצת שרוף בעצמו. תמסור לו שפרידא עדיין שומרת לו את החבית מהחתונה שלא הייתה.');
          await g.playerSay('נר בלי אש ומסר בלי הקשר. יוצא לדרך.');
          g.flag('freidaMet', true);
          saluteAt = lastT; saluteBig = false;
        } catch (e) {
          console.warn('cellar.js: freida intro failed', e);
        } finally {
          quizRunning = false;
        }
        return;
      }
      // met, still dark: the gate line
      if (!g.has('ner') && !g.has('nerlit')) {
        await fSay(g, 'איבדת את הנר? קח אחד חדש. אל תשאל מאיפה יש לי, מרתפנית טובה מוכנה לכל תרחיש.');
        try { g.give('ner'); } catch (e) {}
        return;
      }
      if (!g.flag('cellarGateLineSaid')) {
        g.flag('cellarGateLineSaid', true);
        await fSay(g, 'בדיקה בלי נר? «בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר». אין נר — אין בדיקה. תביא אש, גיבור.');
        return;
      }
      await fSay(g, pick([
        'בדיקה בלי נר? «בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר». אין נר — אין בדיקה. תביא אש, גיבור.',
        'הנר עדיין כבוי. בועז. פסגה. אש. ואל תשכח את העניין עם החבית.',
        'אלפיים שנה של בדיקות, ואף פעם לא מצאתי כלום מתחת לחבית השלישית. השנה זה קורה. אני מרגישה בנוצה.'
      ]));
      return;
    }

    // --- lit phase --------------------------------------------------------
    if (!hasSealSafe('bedikah')) {
      if (!f.quizADone) {
        quizRunning = true;
        try { await runQuizA(g); }
        catch (e) { console.warn('cellar.js: quiz A failed', e); }
        finally { quizRunning = false; }
        return;
      }
      await promptRows(g);
      return;
    }

    // --- post-seal menu — small, warm, all daf-boundary gags ---------------
    var talking = true;
    while (talking) {
      var v = await g.choose([
        { text: 'ואם עכבר ייקח פירור אחרי הבדיקה?', value: 'mouse' },
        { text: 'ומה אם מוצאים חמץ בפסח עצמו?', value: 'pesach' },
        { text: 'מה יש לארוחת ערב?', value: 'dinner' },
        { text: 'להתראות, פרידא.', value: 'bye' }
      ]);
      if (v === 'mouse') {
        await fSay(g, 'אל תפתח לי את הנושא. יש על זה דף שלם. דף ט. לא הדף שלנו.');
      } else if (v === 'pesach') {
        await fSay(g, 'דף ו. לא הדף שלנו.');
        await g.playerSay('יש לך גבולות גזרה מרשימים.');
      } else if (v === 'dinner') {
        await fSay(g, 'גם לא הדף שלנו, אבל מותר לשאול. יש מרק. בלי קרעפלעך — לא בגלל ההלכה, חביבי, בגלל גד. הוא גמר את כולם תוך כדי ריצה.');
      } else {
        await fSay(g, 'לך תאיר, בחור. המרתף כבר בדוק — עכשיו תורו של הכפר.');
        talking = false;
      }
    }
  }

  /* ============================ SCENE REGISTRATION ============================ */
  GAME.registerScene('cellar', {
    name: 'מַרְתֵּף הַיַּיִן',
    floor: { yMin: 128, yMax: 168 },

    paint: function (ctx, t, S) {
      lastT = t;
      hookPlayerPos(); // lazy, once — load-order independent
      try {
        if (isLit(S)) paintLit(ctx, t, S);
        else paintDark(ctx, t, S);
      } catch (e) {
        try { ctx.fillStyle = DARK_BG; ctx.fillRect(0, 0, 320, 180); } catch (e2) {}
        if (!window.__cellarPaintWarned) {
          window.__cellarPaintWarned = true;
          console.warn('cellar.js: paint failed', e);
        }
      }
    },

    onEnter: async function (g) {
      try {
        rowPick = [];
        safeMusic('night');
        var S = GAME.state, f = flagsOf(S);

        // THE reveal: arriving with a lit candle turns the scene on.
        // Darkness becoming light IS the Mishnah, experienced.
        if (!f.cellarLit && g.has('nerlit')) {
          g.flag('cellarLit', true);
          g.flag('freidaRevealed', true);
          if (!f.freidaMet) g.flag('freidaMet', true);
          g.sfx('magic');
          // cutscene-wrapped so a stray click cannot cancel the core teaching beat
          await g.cutscene(async function () {
            await g.playerSay('אוֹר.');
            await fSay(g, 'עכשיו אתה מבין למה המשנה לא אמרה "בודקים ביום". «בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר» — חושך בחוץ, נר ביד, והחמץ אין לו לאן לברוח.');
            await g.playerSay('כל המרתף הזה חיכה לנר אחד.');
            saluteAt = lastT; saluteBig = false;
            await fSay(g, 'אש של בועז. אני מזהה לפי הגובה של הלהבה. החבית שלו עוד מחכה — טוב, קודם מצווה. בוא, יש לנו בדיקה לעשות.');
          });
          return;
        }

        if (!f.cellarVisited) {
          g.flag('cellarVisited', true);
          await g.playerSay('חושך. חושך של אוֹר לארבעה עשר. אפילו הצללים פה מחכים לנר.');
          return;
        }

        if (isLit(S) && f.quizADone && !hasSealSafe('bedikah')) {
          await fSay(g, 'השורות מחכות. שתיים, לפי בית הלל.');
        }
      } catch (e) {
        console.warn('cellar.js: onEnter failed', e);
      }
    },

    hotspots: [

      /* -------- dark wash overlay (dark phase only; effectively
                  non-interactive: 1x1 px at the screen bottom edge). Its depth
                  (y+h=180) sorts AFTER the player (feet max 168), so its draw
                  dims the engine-drawn player sprite into a silhouette —
                  no engine changes needed --------------------------------- */
      {
        id: 'darkwash', name: 'הַחֹשֶׁךְ', type: 'object',
        x: 0, y: 179, w: 1, h: 1,
        visible: function (S) { return !isLit(S); },
        draw: function (ctx) {
          try {
            ctx.save();
            ctx.fillStyle = 'rgba(5,5,16,0.55)';
            ctx.fillRect(0, 0, 252, 180);  // full wash over the room
            ctx.globalAlpha = 0.45;        // lighter over the stair wedge
            ctx.fillRect(252, 0, 68, 180);
            ctx.restore();
          } catch (e) {}
        }
      },

      /* -------- the darkness itself (dark phase only; declared early so every
                  other hotspot wins hit-testing over it) -------------------- */
      {
        id: 'darkness', name: 'הַחֹשֶׁךְ', type: 'object',
        x: 0, y: 0, w: 248, h: 124,
        visible: function (S) { return !isLit(S); },
        look: async function (g) {
          var f = flagsOf(GAME.state);
          var n = (f.cellarPokes || 0) + 1;
          g.flag('cellarPokes', n);
          if (n === 1) {
            await g.playerSay('אני מגשש... נגעתי במשהו עגול. אני מקווה שזו חבית ולא דעה של מישהו.');
            g.sfx('step');
            if (!f.freidaRevealed && !f.freidaMet) {
              await g.say('זהירות על החביות, בחור. הן ותיקות ממך.', { x: 224, y: 116, color: FREIDA_C });
              g.flag('freidaRevealed', true);
              await g.playerSay('יש פה מישהי. עם נוצה. אני רואה רק את הנוצה.');
            }
            return;
          }
          await g.playerSay(pick([
            'משהו רך. אני מקווה שזה קור עכביש. אני ממש מקווה.',
            'חושך כזה — אפילו החמץ פה לא מוצא את עצמו.',
            'הבנתי את הרעיון: בלי אור — אין בדיקה. מישהו היה צריך לכתוב את זה במשנה. רגע. כתבו.'
          ]));
        },
        take: async function (g) {
          await g.playerSay('לקחת חושך? יש לי כבר מספיק בתרמיל הרגשי.');
        },
        use: async function (g, itemId) {
          if (itemId === 'ner') {
            await g.playerSay('נר כבוי נגד חושך. תיקו טכני, החושך מוביל בנקודות.');
            return;
          }
          await g.playerSay('החושך לא משתף פעולה. הוא מחכה לנר, כמו כולנו.');
        }
      },

      /* -------- barrel wall (behind the row hotspots) ---------------------- */
      {
        id: 'barrels', name: 'קִיר הֶחָבִיּוֹת', type: 'object',
        x: BW.x0 - 2, y: BW.y0 - 4, w: BW.cols * BW.colW + 4, h: 96,
        walkTo: { x: 124, y: 136 },
        look: async function (g) {
          if (!isLit(GAME.state)) {
            await g.playerSay('גוש צללים בצורת חביות. או חביות בצורת צללים. נדע כשיהיה אור.');
            if (!g.flag('cellarDarkSearchLine')) {
              g.flag('cellarDarkSearchLine', true);
              await g.playerSay('«בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר» — לא לאור הניחוש. בלי להבה אין פה בדיקה.');
            }
            var fd = flagsOf(GAME.state);
            if (!fd.freidaRevealed && !fd.freidaMet) {
              // second discovery path for Freida — the quest must not hinge
              // on a single unlabeled darkness click
              await g.say('חביות, בחור. עשרים וארבע. אני סופרת אותן כבר אלפיים שנה.', { x: 224, y: 116, color: FREIDA_C });
              g.flag('freidaRevealed', true);
              await g.playerSay('יש פה מישהי. עם נוצה. אני רואה רק את הנוצה.');
            }
            return;
          }
          await g.playerSay(pick([
            'עשרים וארבע חביות. שתי שורות צריכות בדיקה. השאר סתם עושות פרצוף חשוב.',
            'כתוב על אחת "בציר תשס״ד". פרידא טוענת שהיין רק מתחיל להתבגר. כמו כולנו.'
          ]));
        },
        take: async function (g) {
          await g.playerSay('להרים חבית? אני תלמיד ישיבה, לא מלגזה.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('«וּבַמָּה אָמְרוּ ״שְׁתֵּי שׁוּרוֹת בַּמַּרְתֵּף״ — מָקוֹם שֶׁמַּכְנִיסִין בּוֹ חָמֵץ». זה המרתף. אלה השורות.');
            return;
          }
          if (itemId === 'ner' && !g.has('nerlit')) {
            await g.playerSay('נר כבוי מול חבית. החבית מנצחת בנוק־אאוט.');
            return;
          }
          if (itemId === 'pita') {
            await g.playerSay('להחזיר את הפיתה לסדק? היא בקושי יצאה משם. יש לה טראומה.');
            return;
          }
          // bare-handed use = knock. The vessels of this village learned Aramaic first.
          knockAt = lastT;
          g.sfx('step');
          await g.say('בּוּם. בּוּם. מַאי?', { x: 124, y: 60, color: '#c8a8ff' });
          var f = flagsOf(GAME.state);
          if (!f.cellarEcho && (isLit(GAME.state) || f.freidaRevealed)) {
            g.flag('cellarEcho', true);
            await fSay(g, 'כל הכלים בכפר הזה למדו ארמית לפני עברית.');
          }
        }
      },

      /* -------- the four ROW hotspots (the clickable puzzle) ---------------- */
      {
        id: 'rowTop', name: 'שׁוּרָה עֶלְיוֹנָה', type: 'object',
        x: BW.x0, y: ROW_Y.top, w: BW.cols * BW.colW, h: BW.rowH - 1,
        walkTo: { x: 124, y: 134 },
        visible: function (S) { return isLit(S); },
        draw: function (ctx, t, S) { drawRowState(ctx, t, S, 'top'); },
        look: function (g) { return rowClicked(g, 'top'); },
        take: async function (g) { await g.playerSay('שורה שלמה לא נכנסת לכיס. גם לא חצי חבית.'); },
        use: async function (g, itemId) {
          if (itemId === 'daf') { await g.playerSay('«הַחִיצוֹנוֹת שֶׁהֵן הָעֶלְיוֹנוֹת»... עליונות. הרמז די צועק.'); return; }
          return rowClicked(g, 'top');
        }
      },
      {
        id: 'rowSecond', name: 'שׁוּרָה שְׁנִיָּה', type: 'object',
        x: BW.x0, y: ROW_Y.second, w: BW.cols * BW.colW, h: BW.rowH - 1,
        walkTo: { x: 124, y: 134 },
        visible: function (S) { return isLit(S); },
        draw: function (ctx, t, S) { drawRowState(ctx, t, S, 'second'); },
        look: function (g) { return rowClicked(g, 'second'); },
        take: async function (g) { await g.playerSay('פרידא סופרת את החביות האלה כבר אלפיים שנה. אני לא אהיה הסיבה שהיא מתחילה מאפס.'); },
        use: async function (g, itemId) {
          if (itemId === 'daf') { await g.playerSay('שתי שורות. חיצונות. עליונות. אני סופר מלמעלה.'); return; }
          return rowClicked(g, 'second');
        }
      },
      {
        id: 'rowThird', name: 'שׁוּרָה שְׁלִישִׁית', type: 'object',
        x: BW.x0, y: ROW_Y.third, w: BW.cols * BW.colW, h: BW.rowH - 1,
        walkTo: { x: 124, y: 136 },
        visible: function (S) { return isLit(S); },
        draw: function (ctx, t, S) { drawRowState(ctx, t, S, 'third'); },
        look: function (g) { return rowClicked(g, 'third'); },
        take: async function (g) { await g.playerSay('חבית מהאמצע? זה ג׳נגה עם יין. לא.'); },
        use: async function (g, itemId) {
          if (itemId === 'daf') { await g.playerSay('הדף אומר עליונות וחיצונות. השלישית לא נשמעת לי אף אחת מהשתיים.'); return; }
          return rowClicked(g, 'third');
        }
      },
      {
        id: 'rowBottom', name: 'שׁוּרָה תַּחְתּוֹנָה', type: 'object',
        x: BW.x0, y: ROW_Y.bottom, w: BW.cols * BW.colW, h: BW.rowH,
        walkTo: { x: 124, y: 138 },
        visible: function (S) { return isLit(S); },
        draw: function (ctx, t, S) { drawRowState(ctx, t, S, 'bottom'); },
        look: function (g) { return rowClicked(g, 'bottom'); },
        take: async function (g) { await g.playerSay('השורה התחתונה מחזיקה את כל השאר. מכבדים יסודות.'); },
        use: async function (g, itemId) {
          if (itemId === 'daf') { await g.playerSay('תחתונה... «עֶלְיוֹנוֹת» כתוב. אני חושד שזה לא היא.'); return; }
          return rowClicked(g, 'bottom');
        }
      },

      /* -------- Pesach dish shelf ------------------------------------------ */
      {
        id: 'shelf', name: 'מַדַּף הַכֵּלִים', type: 'object',
        x: 6, y: 32, w: 48, h: 46,
        walkTo: { x: 44, y: 134 },
        look: async function (g) {
          if (!isLit(GAME.state)) {
            await g.playerSay('מדף חשוך. משהו מבריק שם חלש. כנראה כלים. או עיניים. עדיף כלים.');
            return;
          }
          await g.playerSay('הכלים של פסח ישנים מאחורי וילון. עוד שבוע הם מחליפים דירה עם כלי החמץ. אף צד לא מרוצה מההסדר.');
        },
        take: async function (g) {
          await g.playerSay('לגעת בכלי פסח לפני הזמן? פרידא תוריד את הנוצה. לאט.');
        },
        use: async function (g, itemId) {
          if (itemId === 'pita') {
            await g.playerSay('פיתה על מדף כלי הפסח?! יש חטאים שגם משחק לא סולח.');
            return;
          }
          if (itemId === 'daf') {
            await g.playerSay('«כׇּל מָקוֹם שֶׁאֵין מַכְנִיסִין בּוֹ חָמֵץ, אֵין צָרִיךְ בְּדִיקָה». הארון הזה — בדיוק המקרה.');
            return;
          }
          await g.playerSay('הווילון סגור. הכלים ביקשו פרטיות עד ערב פסח.');
        }
      },

      /* -------- garlic braids ---------------------------------------------- */
      {
        id: 'garlic', name: 'צַמּוֹת הַשּׁוּם', type: 'object',
        x: 204, y: 4, w: 34, h: 34,
        walkTo: { x: 218, y: 134 },
        look: async function (g) {
          if (!isLit(GAME.state)) {
            await g.playerSay('משהו תלוי מהתקרה. אני בוחר להאמין שזה שום.');
            return;
          }
          await g.playerSay('שום תלוי. כשר לפסח, קטלני לשידוכים.');
        },
        take: async function (g) {
          await g.playerSay('לקחת שום של פרידא? יש גבול גם לחקירה. וגם לריח שאני מוכן לספוג.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('חיפשתי בדף אזכור לשום. אין. השום נשאר עניין אישי ביני לבין המרתף.');
            return;
          }
          await g.playerSay('השום מתנדנד באדישות. הוא כבר ראה בודקים באים והולכים.');
        }
      },

      /* -------- cobwebs ------------------------------------------------------ */
      {
        id: 'cobwebs', name: 'קוּרֵי הָעַכָּבִישׁ', type: 'object',
        x: 0, y: 4, w: 22, h: 24,
        walkTo: { x: 40, y: 134 },
        look: async function (g) {
          await g.playerSay('קורי עכביש. העכביש טוען שהם מלפני הפסח שעבר, אז זה כבר בעיה של אשתקד.');
        },
        take: async function (g) {
          await g.playerSay('העכביש עובד על הרשת הזאת שנה. אני לא אהיה ההורס.');
        },
        use: async function (g, itemId) {
          if (itemId === 'nerlit') {
            await g.playerSay('לשרוף את הקורים? העכביש שכן, לא נאשם. הבדיקה היא על חמץ.');
            return;
          }
          await g.playerSay('הקורים נצמדים ליד. העכביש רושם תלונה.');
        }
      },

      /* -------- mouse hole (progressive gag + easter egg) -------------------- */
      {
        id: 'mousehole', name: 'חוֹר הָעַכְבָּר', type: 'object',
        x: 26, y: 108, w: 22, h: 18,
        walkTo: { x: 50, y: 138 },
        look: async function (g) {
          var f = flagsOf(GAME.state);
          var n = (f.mouseLooks || 0) + 1;
          g.flag('mouseLooks', n);
          if (n === 1) {
            await g.playerSay('שתי עיניים נוצצות.');
            return;
          }
          if (n === 2) {
            await g.playerSay('העיניים זזות לפי הסמן שלך. הוא לומד.');
            return;
          }
          if (n === 3) {
            await g.say('צָרִיךְ בְּדִיקָה.', { x: 37, y: 104, color: '#c8c8d8' });
            if (isLit(GAME.state) || f.freidaRevealed) {
              await fSay(g, 'אל תעודד אותו.');
            } else {
              await g.playerSay('הקול הדק הזה הגיע מהקיר. אני מקבל את זה בהבנה.');
              if (!f.freidaMet) {
                // third discovery path for Freida (see barrels dark look)
                await g.say('אל תעודד אותו. הוא כבר חושב שהוא רב.', { x: 224, y: 116, color: FREIDA_C });
                g.flag('freidaRevealed', true);
                await g.playerSay('ועוד קול. הפעם עם נוצה. אני רואה רק את הנוצה.');
              }
            }
            return;
          }
          if (hasSealSafe('bedikah')) {
            if (talkedToCat()) {
              await g.playerSay('העיניים מציצות למעלה, לכיוון רצפת הפונדק. בעצבנות. בֵּיצָה יודעת שהוא כאן.');
            } else {
              await g.playerSay('יש נצנוץ קטן וחם בפנים. העכבר עושה בדיקת חמץ משלו. עם הנוצה הקטנה שלו.');
            }
            return;
          }
          await g.playerSay(pick([
            'העיניים מצמצות. נדמה לי שהוא משנן משניות.',
            'ליד החור נשענת נוצה זעירה. לעכבר יש ערכת בדיקה משלו. אני לא שופט.'
          ]));
        },
        take: async function (g) {
          await g.playerSay('לקחת עכבר הביתה זה איך שמתחילות בעיות שדף ט׳ רק חולם עליהן.');
        },
        use: async function (g, itemId) {
          if (itemId === 'ner' && !g.has('nerlit')) {
            // easter egg: the mouse is unimpressed by an unlit candle
            mouseWinkAt = lastT;
            g.flag('egg_mouseNer', true);
            await g.playerSay('נר בלי אש. העכבר לא התרשם.');
            var f = flagsOf(GAME.state);
            if (isLit(GAME.state) || f.freidaRevealed) {
              await fSay(g, 'אפילו הוא יודע: «בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר». לְאוֹר. לא לְנֵר.');
            }
            return;
          }
          if (itemId === 'nerlit') {
            await g.playerSay('אני לא שורף בית של אף אחד. גם לא של חשוד בהחזקת פירורים.');
            return;
          }
          if (itemId === 'pita') {
            await g.playerSay('לתת לעכבר פיתה בליל בדיקה? זה לא חסד, זה תיק לדף ט׳.');
            return;
          }
          await g.playerSay('להכניס יד לחור עכבר בליל בדיקה? יש גבולות גם לחוקרי חמץ.');
        }
      },

      /* -------- Freida ------------------------------------------------------- */
      {
        id: 'freida', name: 'פְּרֵידָא הַמַּרְתְּפָנִית', type: 'char',
        x: 212, y: 110, w: 24, h: 34,
        walkTo: { x: 206, y: 144 },
        visible: function (S) {
          var f = flagsOf(S);
          return !!(f.freidaRevealed || f.cellarLit);
        },
        draw: function (ctx, t, S) { drawFreida(ctx, t, S); },
        look: async function (g) {
          if (!isLit(GAME.state)) {
            await g.playerSay('צללית עם נוצה. הנוצה איכשהו מוארת. אין לי הסבר פיזיקלי.');
            return;
          }
          await g.playerSay('פרידא. גיל: לא בודקים גברת. הנוצה שלה ותיקה ממני בשלושה גלגולים.');
        },
        talk: function (g) { return freidaTalk(g); },
        take: async function (g) {
          await g.playerSay('לקחת את פרידא? היא לא מיטלטלת. היא מוסד.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            if (!isLit(GAME.state)) {
              await fSay(g, '«אוֹר לְאַרְבָּעָה עָשָׂר בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר». זה כל הסיפור: לילה, נר, בדיקה. חסר לך רק הנר הדולק.');
            } else if (!hasSealSafe('bedikah')) {
              await fSay(g, 'הדף כבר אמר לך הכול: מקום שמכניסים בו חמץ — בודקים. ובמרתף — שתי שורות. של בית הלל.');
            } else {
              await fSay(g, 'הדף שלך והנוצה שלי — אותו מקצוע, כלים אחרים.');
            }
            return;
          }
          if (itemId === 'pita') {
            saluteAt = lastT; saluteBig = false;
            await fSay(g, 'שרדת יותר בדיקות ממני. כבוד.');
            await g.playerSay('היא הצדיעה לפיתה. אני עד ראייה.');
            return;
          }
          if (itemId === 'ner') {
            await fSay(g, 'נר יפה. חסר לו רק הפרט הקטן של אש. בועז, פסגה, לך.');
            return;
          }
          if (itemId === 'nerlit') {
            await fSay(g, 'תחזיק אותו גבוה. ככה בודקים — האור עובד, אתה רק מכוון.');
            return;
          }
          await g.playerSay('להשתמש בפרידא? היא לא כלי. היא מוסד.');
        }
      },

      /* -------- exit: stairway back to the inn ------------------------------- */
      {
        id: 'stairs', name: 'אֶל הַפּוּנְדָּק', type: 'exit',
        x: 252, y: 30, w: 68, h: 104,
        walkTo: { x: 272, y: 142 },
        target: 'inn',
        spawn: { x: 232, y: 148 },
        look: async function (g) {
          var f = flagsOf(GAME.state);
          if (!isLit(GAME.state) && (f.freidaRevealed || f.freidaMet)) {
            await g.playerSay('פס אור אפור מהמדרגות.');
            await fSay(g, 'זה לא אור. זה שמועה על אור. «לְאוֹר הַנֵּר» כתוב.');
            return;
          }
          await g.playerSay('המדרגות חזרה לפונדק. למעלה מחכים שמיים קרועים וגד עם קרעפלעך.');
        }
      }
    ]
  });
})();
