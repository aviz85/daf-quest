'use strict';
/*
 * Scene: press — "Beit HaBad HaAtik" (The Ancient Olive Press)
 * DAF QUEST — Pesachim 2a-2b: "The Mystery of the Lost Light". FINALE scene + `daf` item.
 * The Great Searching-Lamp (menorah) stands center-stage, cold, with three
 * seal sockets at her base. Rav Huna & Rav Yehuda argue naghei/leilei by the
 * two windows (night window left, stuck-dawn window right). Player slots the
 * three seals PHYSICALLY into the sockets, then faces the menorah's finale
 * quiz — each correct answer flickers spouts alive — then g.win().
 * Owns ONLY this file. Registers via GAME.registerScene('press', {...}).
 * Relies on GAME / SPRITES / AUDIO contracts (all guarded, fail-silent).
 */
(function () {
  if (!window.GAME || typeof window.GAME.registerScene !== 'function') {
    if (window.console && console.warn) console.warn('press.js: GAME.registerScene unavailable, scene not registered');
    return;
  }

  // ---------------------------------------------------------------------
  // Palette — dim ancient interior; the split sky leaks in through two
  // windows only: night indigo left, stuck amber dawn right.
  // ---------------------------------------------------------------------
  var WALL_D = '#2e2946', WALL_M = '#3a3458', WALL_L = '#464068';
  var FLOOR_D = '#382d24', FLOOR_M = '#463a2c', FLOOR_L = '#564836';
  var WOOD_D = '#5a3a24', WOOD_L = '#7a512f';
  var STONE_D = '#4a4a68', STONE_M = '#6b6b8f', STONE_L = '#8f8fb0';
  var NIGHT_1 = '#12123a', NIGHT_2 = '#1e1e52', NIGHT_3 = '#2a2a70';
  var DAWN_1 = '#d97a4a', DAWN_2 = '#ffb347', DAWN_3 = '#ffd166';
  var AMBER = '#ffd166', AMBER2 = '#ffb347', AMBER3 = '#ff8c42';
  var CLAY_D = '#6a4530', CLAY_M = '#8a5a3a', CLAY_L = '#a8744c';
  var PARCH = '#e8d8a8';
  var OIL = '#c9a83c';
  var SMOKE = '#9a9ab0';

  // Speaker colors
  var C_MENORAH = '#ffd166';
  var C_HUNA = '#ffb08a';
  var C_YEHUDA = '#9ab5ff';

  // ---------------------------------------------------------------------
  // Defensive helpers (SPRITES used when present, else local fallbacks)
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
      ctx.globalAlpha = (alpha || 0.15) * 0.3;
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

  function flame(ctx, x, y, t, size) {
    if (window.SPRITES && typeof SPRITES.flame === 'function') {
      try { SPRITES.flame(ctx, x, y, t, size); return; } catch (e) { /* fall through */ }
    }
    var fl = 0.5 + 0.5 * Math.sin(t * 9 + x);
    px(ctx, x, y - 2, 1, 2, AMBER3);
    if (fl > 0.4) px(ctx, x, y - 3, 1, 1, AMBER);
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

  function flagsOf(S) { return (S && S.flags) || {}; }
  function sealsOf(S) { return (S && S.seals) || []; }

  function hasSealIn(S, id) {
    var s = sealsOf(S);
    for (var i = 0; i < s.length; i++) { if (s[i] === id) return true; }
    return false;
  }

  function hasSealSafe(g, id) {
    try { return !!(g && typeof g.hasSeal === 'function' && g.hasSeal(id)); }
    catch (e) { return false; }
  }

  function safeSfx(g, name) {
    try { if (g && typeof g.sfx === 'function') g.sfx(name); } catch (e) { /* silent */ }
  }

  function safeMusic(mode) {
    try { if (window.AUDIO && typeof AUDIO.music === 'function') AUDIO.music(mode); } catch (e) { /* silent */ }
  }

  function stateFlags() {
    try { return (window.GAME && GAME.state && GAME.state.flags) || {}; }
    catch (e) { return {}; }
  }

  // Speaker helpers — fixed color per recurring speaker
  function menorahSay(g, text) { return g.say(text, { who: 'menorah', color: C_MENORAH }); }
  function hunaSay(g, text) { return g.say(text, { who: 'huna', color: C_HUNA }); }
  function yehudaSay(g, text) { return g.say(text, { who: 'yehuda', color: C_YEHUDA }); }

  // Module-level animation timestamps / guards
  var lastT = 0;            // updated every paint frame, for one-shot beats
  var quizRunning = false;  // guards double-launch of the finale quiz
  var breathAt = -99;       // when the menorah "draws breath" — room dims
  var slotFlashAt = -99;    // sparkle burst when a seal is socketed
  var slotFlashX = 160;

  // Socket geometry (paint + hotspots share these)
  var SOCKETS = [
    { id: 'socketBedikah', seal: 'bedikah', flagName: 'pressSockBedikah', x: 139, y: 112 },
    { id: 'socketLight', seal: 'light', flagName: 'pressSockLight', x: 156, y: 112 },
    { id: 'socketMelakhah', seal: 'melakhah', flagName: 'pressSockMelakhah', x: 173, y: 112 }
  ];

  function socketsFilled(F) {
    var n = 0;
    for (var i = 0; i < SOCKETS.length; i++) { if (F[SOCKETS[i].flagName]) n++; }
    return n;
  }

  // ---------------------------------------------------------------------
  // PAINT — layered interior. Order: walls, windows+beams, ceiling props,
  // midground machines (millstone, screw press, book, vats), menorah,
  // floor, micro-details, global dim beats.
  // ---------------------------------------------------------------------

  function paintWalls(ctx) {
    // back wall
    px(ctx, 0, 0, 320, 122, WALL_M);
    // rough stone courses
    ctx.fillStyle = WALL_D;
    for (var row = 0; row < 12; row++) {
      var yy = 14 + row * 9;
      ctx.fillRect(0, yy, 320, 1);
      for (var xx = (row % 2) * 9; xx < 320; xx += 18) ctx.fillRect(xx, yy - 8, 1, 8);
    }
    // ceiling beam
    px(ctx, 0, 0, 320, 8, WOOD_D);
    px(ctx, 0, 8, 320, 1, '#3a2416');
    // left doorway arch (exit to the inn lane)
    px(ctx, 0, 70, 18, 52, '#1c1830');
    px(ctx, 16, 66, 3, 56, STONE_D);
    px(ctx, 0, 66, 18, 4, STONE_D);
    // faint lane light spilling in
    ctx.save();
    ctx.globalAlpha = 0.12;
    px(ctx, 1, 74, 14, 46, '#8f8fb0');
    ctx.restore();
  }

  function paintWindowNight(ctx, t, S) {
    // LEFT window: proper night — indigo, stars, thin moon
    px(ctx, 24, 24, 30, 36, '#141026');           // recess frame
    px(ctx, 26, 26, 26, 32, NIGHT_1);
    px(ctx, 26, 26, 26, 12, NIGHT_1);
    dither(ctx, 26, 38, 26, 4, NIGHT_1, NIGHT_2);
    px(ctx, 26, 42, 26, 10, NIGHT_2);
    dither(ctx, 26, 52, 26, 3, NIGHT_2, NIGHT_3);
    px(ctx, 26, 55, 26, 3, NIGHT_3);
    // stars
    twinkle(ctx, 31, 30, t, 1, '#fff7d6');
    twinkle(ctx, 40, 34, t + 1.7, 2, '#fff7d6');
    twinkle(ctx, 47, 29, t + 3.1, 1, '#e8e0f0');
    twinkle(ctx, 35, 44, t + 2.2, 1, '#e8e0f0');
    // thin moon sliver
    if (window.SPRITES && typeof SPRITES.moon === 'function') {
      try { SPRITES.moon(ctx, 44, 40, 0.25, 5); } catch (e) { px(ctx, 42, 38, 3, 3, '#cfc3e0'); }
    } else { px(ctx, 42, 38, 3, 3, '#cfc3e0'); }
    // Naftali's RSVP stars — after the `light` seal, extra stars lean INTO
    // the frame edge to watch the finale (callback to the observatory)
    if (hasSealIn(S, 'light')) {
      twinkle(ctx, 51, 31, t + 0.4, 2, '#aef6ff');
      twinkle(ctx, 52, 38, t + 1.2, 1, '#aef6ff');
      twinkle(ctx, 50, 46, t + 2.6, 2, '#fff7d6');
    }
    // stone sill + a stray bedikah feather on the sill (village-wide motif)
    px(ctx, 24, 60, 30, 3, STONE_D);
    px(ctx, 27, 58, 4, 1, '#e8e8f0');
    px(ctx, 30, 57, 2, 1, '#e8e8f0');
    // cool light beam onto the floor + drifting motes
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#7a8ac0';
    ctx.beginPath();
    ctx.moveTo(26, 58); ctx.lineTo(52, 58); ctx.lineTo(84, 140); ctx.lineTo(34, 140);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    for (var i = 0; i < 5; i++) {
      var ph = (t * (2.5 + i * 0.7) + i * 31) % 80;
      var mx = 32 + i * 8 + Math.sin(t * 0.9 + i) * 3;
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 2 + i);
      px(ctx, Math.round(mx + ph * 0.3), Math.round(60 + ph), 1, 1, '#aab6e0');
      ctx.restore();
    }
  }

  function paintWindowDawn(ctx, t) {
    // RIGHT window: the stuck golden dawn — half-risen, confused sun
    px(ctx, 266, 24, 30, 36, '#3a2416');          // recess frame
    px(ctx, 268, 26, 26, 32, DAWN_1);
    dither(ctx, 268, 38, 26, 4, DAWN_1, DAWN_2);
    px(ctx, 268, 42, 26, 10, DAWN_2);
    dither(ctx, 268, 52, 26, 3, DAWN_2, DAWN_3);
    px(ctx, 268, 55, 26, 3, DAWN_3);
    // the half-risen sun, pulsing gently — stuck mid-rise for hours now
    var pulse = 0.75 + 0.25 * Math.sin(t * 0.7);
    ctx.save();
    ctx.globalAlpha = pulse;
    px(ctx, 276, 48, 10, 6, DAWN_3);
    px(ctx, 278, 46, 6, 2, DAWN_3);
    ctx.restore();
    glow(ctx, 281, 50, 7, DAWN_3, 0.10 * pulse);
    // stone sill
    px(ctx, 266, 60, 30, 3, STONE_D);
    // warm light beam onto the floor + drifting motes
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = DAWN_2;
    ctx.beginPath();
    ctx.moveTo(268, 58); ctx.lineTo(294, 58); ctx.lineTo(288, 140); ctx.lineTo(238, 140);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    for (var i = 0; i < 5; i++) {
      var ph = (t * (2.2 + i * 0.6) + i * 47) % 80;
      var mx = 284 - i * 7 + Math.sin(t * 0.8 + i * 2) * 3;
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 2.4 + i);
      px(ctx, Math.round(mx - ph * 0.35), Math.round(60 + ph), 1, 1, '#ffd9a0');
      ctx.restore();
    }
  }

  function paintHangingLamps(ctx, t, F) {
    // three clay oil lamps on chains — all cold ("solidarity with management")
    for (var i = 0; i < 3; i++) {
      var bx = 84 + i * 76;
      var sway = Math.sin(t * 0.8 + i * 2.1) * 2;
      var lx = bx + Math.round(sway);
      px(ctx, bx, 8, 1, 3, '#2a2438');
      px(ctx, Math.round(bx + sway * 0.5), 11, 1, 4, '#2a2438');
      px(ctx, lx, 15, 1, 3, '#2a2438');
      px(ctx, lx - 3, 18, 7, 3, CLAY_D);
      px(ctx, lx - 2, 17, 5, 1, CLAY_M);
      if (F.won) flame(ctx, lx + 3, 18, t + i, 0.7); // relit after the ending
      else px(ctx, lx + 3, 17, 1, 1, '#1c1826');     // cold spout hole
    }
    // one shimmering cobweb strand in the ceiling corner
    ctx.save();
    ctx.globalAlpha = 0.15 + 0.1 * Math.sin(t * 1.3);
    px(ctx, 306, 8, 1, 10, '#cfcfe0');
    px(ctx, 302, 8, 1, 6, '#cfcfe0');
    px(ctx, 298, 12, 9, 1, '#cfcfe0');
    ctx.restore();
  }

  function paintMillstone(ctx, t) {
    // the great round crushing stone in its basin, wooden axle beam
    var cx = 104, cy = 96, r = 19;
    for (var dy = -r; dy <= r; dy++) {
      var hw = Math.floor(Math.sqrt(r * r - dy * dy));
      px(ctx, cx - hw, cy + dy, hw * 2, 1, dy < -4 ? STONE_L : (dy < 8 ? STONE_M : STONE_D));
    }
    // stone grain rings
    ctx.save();
    ctx.globalAlpha = 0.4;
    px(ctx, cx - 12, cy - 6, 24, 1, STONE_D);
    px(ctx, cx - 8, cy + 2, 16, 1, STONE_D);
    ctx.restore();
    // center axle hole + wooden beam sticking up-right
    px(ctx, cx - 2, cy - 3, 5, 6, '#241c33');
    px(ctx, cx, cy - 26, 3, 24, WOOD_D);
    px(ctx, cx - 14, cy - 26, 30, 3, WOOD_L);
    // basin trough at its feet
    px(ctx, cx - 24, cy + r - 2, 48, 6, CLAY_D);
    px(ctx, cx - 22, cy + r - 1, 44, 2, '#241c33');
    // a lone olive that wobbles near the basin — the last olive standing
    var ow = Math.sin(t * 5) > 0.9 ? 1 : 0;
    px(ctx, cx + 26 + ow, cy + r + 1, 2, 2, '#3f5a3a');
  }

  function paintScrewPress(ctx, t) {
    // wooden screw press: two posts, top beam, big screw over a basket
    px(ctx, 224, 56, 4, 62, WOOD_D);
    px(ctx, 250, 56, 4, 62, WOOD_D);
    px(ctx, 222, 52, 34, 5, WOOD_L);
    // the screw (zigzag thread)
    px(ctx, 237, 57, 4, 26, '#8a6a3f');
    ctx.fillStyle = '#5f4527';
    for (var i = 0; i < 6; i++) ctx.fillRect(237 + (i % 2), 59 + i * 4, 3, 1);
    // pressing plate + woven basket of olive pulp
    px(ctx, 230, 83, 18, 3, WOOD_L);
    px(ctx, 229, 86, 20, 10, CLAY_M);
    ctx.fillStyle = CLAY_D;
    for (var yy = 87; yy < 95; yy += 2) ctx.fillRect(229, yy, 20, 1);
    // the feather stuck in the frame — bedikah-kit sight gag, fluttering
    var ff = Math.sin(t * 3.2) > 0.3 ? 1 : 0;
    px(ctx, 252, 62, 4 + ff, 1, '#e8e8f0');
    px(ctx, 255 + ff, 61, 2, 1, '#e8e8f0');
    // oil dribble from the basket into a ground bowl
    px(ctx, 238, 96, 1, 4, OIL);
    px(ctx, 234, 100, 9, 3, CLAY_D);
    px(ctx, 236, 100, 5, 1, OIL);
  }

  function paintBookStand(ctx, t) {
    // the giant Gemara on a wooden lectern — door-sized, studied standing
    px(ctx, 200, 100, 3, 20, WOOD_D);
    px(ctx, 194, 96, 15, 5, WOOD_L);
    // open book (parchment) with tiny text squiggles
    px(ctx, 190, 86, 24, 11, PARCH);
    px(ctx, 201, 86, 1, 11, '#c9b68a');
    ctx.fillStyle = '#7a6a4a';
    for (var r2 = 0; r2 < 4; r2++) {
      ctx.fillRect(192, 88 + r2 * 2, 8, 1);
      ctx.fillRect(203, 88 + r2 * 2, 9, 1);
    }
    // bookmark ribbon swaying
    var rb = Math.round(Math.sin(t * 1.1) * 1.5);
    px(ctx, 208 + rb, 97, 1, 6, '#a03030');
    px(ctx, 208 + rb, 103, 2, 2, '#a03030');
  }

  function paintVats(ctx, t, F) {
    // clay oil vats along the back-right wall; one drips eternally
    var vats = [[290, 98, 12, 24], [303, 102, 14, 20], [279, 106, 10, 16]];
    for (var i = 0; i < vats.length; i++) {
      var v = vats[i];
      px(ctx, v[0], v[1], v[2], v[3], CLAY_M);
      px(ctx, v[0] + 1, v[1], v[2] - 2, 2, CLAY_L);
      px(ctx, v[0] - 1, v[1] + 2, 1, v[3] - 4, CLAY_D);
      px(ctx, v[0] + v[2], v[1] + 2, 1, v[3] - 4, CLAY_D);
      px(ctx, v[0] + 2, v[1] + 4, 2, v[3] - 8, CLAY_L); // highlight
    }
    // the wooden spoon in a vat like a tiny oar (bedikah-kit motif)
    px(ctx, 306, 94, 2, 9, WOOD_L);
    px(ctx, 305, 92, 4, 3, WOOD_L);
    // THE DRIP — 2.2s loop: bead forms, falls, splashes into a shine puddle
    var ph = (t % 2.2) / 2.2;
    var dx2 = 285, topY = 108, botY = 124;
    if (ph < 0.35) {
      px(ctx, dx2, topY, 1, 1 + Math.round(ph * 3), OIL); // bead swelling
    } else if (ph < 0.8) {
      var fy = topY + Math.round((ph - 0.35) / 0.45 * (botY - topY));
      px(ctx, dx2, fy, 1, 2, OIL);
    } else {
      px(ctx, dx2 - 1, botY, 3, 1, OIL); // splash frame
    }
    px(ctx, dx2 - 2, botY + 1, 5, 1, '#8a7428'); // permanent shine puddle
  }

  function paintMenorah(ctx, t, S, F) {
    // THE GREAT SEARCHING-LAMP — carved stone, seven small spouts around one
    // great spout, three seal sockets at the base. She talks. She judges.
    // pedestal
    px(ctx, 144, 114, 36, 8, STONE_D);
    px(ctx, 146, 108, 32, 6, STONE_M);
    // column with geometric carvings
    px(ctx, 152, 78, 20, 30, STONE_M);
    px(ctx, 152, 78, 2, 30, STONE_L);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = STONE_D;
    for (var i = 0; i < 3; i++) {
      ctx.fillRect(155, 82 + i * 8, 14, 1);
      ctx.fillRect(157 + (i % 2) * 6, 84 + i * 8, 4, 2);
    }
    ctx.restore();
    // bowl
    px(ctx, 142, 66, 40, 12, STONE_M);
    px(ctx, 140, 70, 44, 5, STONE_M);
    px(ctx, 142, 66, 40, 2, STONE_L);
    // great central spout + the great cold wick
    px(ctx, 158, 58, 8, 8, STONE_L);
    px(ctx, 161, 54, 2, 5, '#241c33'); // cold wick
    // seven small spouts along the rim
    var spouts = [[143, 70], [148, 66], [154, 63], [161, 62], [168, 63], [174, 66], [179, 70]];
    var lit = Math.max(0, Math.min(7, Number(F.pressSpoutsLit) || 0));
    // lighting order fans out from the center — feels like ignition
    var order = [3, 2, 4, 1, 5, 0, 6];
    var isLit = [false, false, false, false, false, false, false];
    for (var k = 0; k < lit && k < 7; k++) isLit[order[k]] = true;
    for (var sp = 0; sp < 7; sp++) {
      var s = spouts[sp];
      px(ctx, s[0], s[1], 2, 2, STONE_L);
      if (isLit[sp]) {
        flame(ctx, s[0] + 1, s[1], t + sp * 0.7, 0.6);
        glow(ctx, s[0] + 1, s[1] - 2, 4, AMBER, 0.10);
      } else {
        px(ctx, s[0], s[1] - 1, 1, 1, '#241c33');
      }
    }
    // after the win: the great wick burns too
    if (F.won) {
      flame(ctx, 162, 54, t, 1.2);
      glow(ctx, 162, 50, 12, AMBER, 0.14);
    }
    // her "eyes" — two amber slits on the column; she blinks. Deadpan.
    var blink = ((t + 1.3) % 4.2) < 0.14;
    if (!blink) {
      var eyeC = (lit > 0 || F.won) ? AMBER : '#b08a50';
      px(ctx, 156, 88, 3, 1, eyeC);
      px(ctx, 165, 88, 3, 1, eyeC);
    }
    // sad smoke puff from the cold wick, every ~8s, shaped like a tiny "?"
    // (after the win it becomes a "!")
    if (!F.won) {
      var pph = t % 8;
      if (pph < 2) {
        var rise = pph * 7;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 0.55 - pph * 0.28);
        if (pph < 0.8) {
          px(ctx, 161, Math.round(52 - rise), 2, 2, SMOKE);
        } else {
          // "?" shape: hook + dot
          var qy = Math.round(50 - rise);
          px(ctx, 161, qy, 2, 1, SMOKE);
          px(ctx, 162, qy - 2, 1, 2, SMOKE);
          px(ctx, 160, qy - 2, 1, 1, SMOKE);
          px(ctx, 161, qy + 2, 1, 1, SMOKE);
        }
        ctx.restore();
      }
    } else {
      var wph = t % 6;
      if (wph < 1.4) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 0.5 - wph * 0.3);
        var ey = Math.round(46 - wph * 6);
        px(ctx, 161, ey - 3, 1, 3, '#fff7d6'); // "!" bar
        px(ctx, 161, ey + 1, 1, 1, '#fff7d6'); // "!" dot
        ctx.restore();
      }
    }
    // the three seal sockets at the base
    for (var si = 0; si < SOCKETS.length; si++) {
      var sk = SOCKETS[si];
      var filled = !!F[sk.flagName];
      px(ctx, sk.x, sk.y, 10, 8, '#1e1a2e');
      px(ctx, sk.x + 1, sk.y + 1, 8, 6, filled ? AMBER2 : '#2c2640');
      if (filled) {
        px(ctx, sk.x + 3, sk.y + 2, 4, 4, AMBER);
        var gp = 0.10 + 0.05 * Math.sin(t * 2.4 + si * 2);
        glow(ctx, sk.x + 5, sk.y + 4, 5, AMBER, gp);
      } else {
        // faint empty-socket glimmer inviting a click
        ctx.save();
        ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 1.7 + si * 2.2);
        px(ctx, sk.x + 4, sk.y + 3, 2, 2, '#5a5480');
        ctx.restore();
      }
    }
    // one-shot sparkle burst when a seal is socketed
    var dt = lastT - slotFlashAt;
    if (dt >= 0 && dt < 1.2) {
      for (var b = 0; b < 5; b++) {
        var ang = b * 1.25 + dt * 2;
        var rr = 3 + dt * 9;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 0.8 - dt * 0.7);
        px(ctx, Math.round(slotFlashX + Math.cos(ang) * rr),
           Math.round(116 + Math.sin(ang) * rr * 0.5), 1, 1, '#aef6ff');
        ctx.restore();
      }
    }
  }

  function paintFloor(ctx) {
    px(ctx, 0, 122, 320, 58, FLOOR_M);
    dither(ctx, 0, 122, 320, 3, WALL_D, FLOOR_M);
    // worn flagstones
    ctx.fillStyle = FLOOR_D;
    for (var row = 0; row < 4; row++) {
      var yy = 132 + row * 12;
      ctx.fillRect(0, yy, 320, 1);
      for (var xx = (row % 2) * 14; xx < 320; xx += 28) ctx.fillRect(xx, yy - 11, 1, 11);
    }
    // subtle old oil stains
    ctx.save();
    ctx.globalAlpha = 0.25;
    px(ctx, 120, 150, 14, 4, '#5a4a20');
    px(ctx, 230, 160, 10, 3, '#5a4a20');
    ctx.restore();
  }

  function paintWrongShadows(ctx, t) {
    // sight gag: each rabbi is lit by the WRONG window — Huna (team dawn)
    // stands in the night beam and casts an AMBER shadow; Yehuda (team
    // night) stands in the dawn beam and casts a BLUE shadow. 2-frame loop.
    var fr = Math.floor(t * 2) % 2;
    ctx.save();
    ctx.globalAlpha = 0.16;
    // Huna's amber shadow, stretching right
    ctx.fillStyle = DAWN_2;
    ctx.fillRect(66, 147, 16 + fr * 3, 3);
    ctx.fillRect(78 + fr * 3, 146, 5, 2);
    // Yehuda's blue shadow, stretching left
    ctx.fillStyle = '#5a6ac0';
    ctx.fillRect(232 - fr * 3, 147, 16 + fr * 3, 3);
    ctx.fillRect(228 - fr * 3, 146, 5, 2);
    ctx.restore();
  }

  function paint(ctx, t, S) {
    try {
      lastT = t;
      var F = flagsOf(S);
      paintWalls(ctx);
      // floor goes right after walls: everything else (vats' drip splash,
      // seal sparkle burst, window beams) must be able to draw over it
      paintFloor(ctx);
      paintWindowNight(ctx, t, S);
      paintWindowDawn(ctx, t);
      paintHangingLamps(ctx, t, F);
      paintMillstone(ctx, t);
      paintScrewPress(ctx, t);
      paintBookStand(ctx, t);
      paintVats(ctx, t, F);
      paintMenorah(ctx, t, S, F);
      paintWrongShadows(ctx, t);
      // "she draws breath" — the whole room dims for a beat before the win
      var bdt = t - breathAt;
      if (bdt >= 0 && bdt < 1.8) {
        var dim = bdt < 0.5 ? bdt / 0.5 : (1.8 - bdt) / 1.3;
        ctx.save();
        ctx.globalAlpha = 0.55 * Math.max(0, Math.min(1, dim));
        px(ctx, 0, 0, 320, 180, '#080614');
        ctx.restore();
      }
    } catch (e) {
      px(ctx, 0, 0, 320, 180, '#241c33');
      if (!window.__pressPaintWarned) {
        window.__pressPaintWarned = true;
        if (window.console && console.warn) console.warn('press.js paint error:', e);
      }
    }
  }

  // ---------------------------------------------------------------------
  // CHARACTER DRAWING — parameterized elderly sage, feet-anchored
  // ---------------------------------------------------------------------
  function drawSage(ctx, x, y, t, o) {
    // o: { robe, trim, beard, hat, pointDir(1=right,-1=left), ph }
    try {
      var bob = Math.round(Math.sin(t * 1.7 + o.ph) * 1);
      var fy = y + bob;
      // robe
      px(ctx, x - 5, fy - 20, 10, 18, o.robe);
      px(ctx, x - 5, fy - 20, 2, 18, o.trim);
      px(ctx, x - 6, fy - 4, 12, 2, o.robe);
      // feet
      px(ctx, x - 4, fy - 2, 3, 2, '#2a2030');
      px(ctx, x + 1, fy - 2, 3, 2, '#2a2030');
      // head
      px(ctx, x - 3, fy - 27, 7, 6, '#e0b490');
      // beard — long, opinionated
      px(ctx, x - 3, fy - 22, 7, 4, o.beard);
      px(ctx, x - 2, fy - 18, 5, 2, o.beard);
      // hat
      px(ctx, x - 4, fy - 30, 9, 3, o.hat);
      px(ctx, x - 2, fy - 32, 5, 2, o.hat);
      // eyes (blink, per-character phase)
      var blink = ((t + o.ph) % 3.9) < 0.13;
      if (!blink) {
        px(ctx, x - 2, fy - 26, 1, 1, '#241c33');
        px(ctx, x + 2, fy - 26, 1, 1, '#241c33');
      }
      // mouth — arguing loop, opposite phases so they truly talk over each
      // other in stereo
      var mouth = (Math.sin(t * 2.6 + o.ph) + 1) / 2;
      if (mouth > 0.55) px(ctx, x, fy - 23, 1, 1, '#7a3030');
      // pointing arm — the eternal gesture at the (other one's) window
      var raise = (Math.sin(t * 2.2 + o.ph) + 1) / 2;
      var ay = fy - 16 - Math.round(raise * 4);
      var reach = 6 + Math.round(raise * 3);
      px(ctx, x + (o.pointDir > 0 ? 4 : -4 - reach), ay, reach + 1, 2, o.robe);
      px(ctx, x + (o.pointDir > 0 ? 5 + reach : -6 - reach), ay, 2, 2, '#e0b490');
      // other arm folded
      px(ctx, x + (o.pointDir > 0 ? -6 : 4), fy - 14, 2, 6, o.robe);
    } catch (e) { /* never crash a frame */ }
  }

  function drawHuna(ctx, t) {
    // Rav Huna — team "naghei". Warm robe, points RIGHT at the dawn window.
    drawSage(ctx, 64, 146, t, {
      robe: '#8c5136', trim: '#a86a48', beard: '#d8d0c0',
      hat: '#4a2e1c', pointDir: 1, ph: 0
    });
  }

  function drawYehuda(ctx, t) {
    // Rav Yehuda — team "leilei". Indigo robe, points LEFT at the night window.
    drawSage(ctx, 258, 146, t, {
      robe: '#2f4a7c', trim: '#4a66a0', beard: '#e8e0d0',
      hat: '#1c2a4a', pointDir: -1, ph: Math.PI
    });
  }

  // ---------------------------------------------------------------------
  // FINALE QUIZ DATA — the menorah's questions. Quoted lines are verbatim
  // from the daf; feedback teaches, never punishes. Each wrong pick gets a
  // one-time plain-Hebrew restatement micro-check before the retry, so the
  // retry tests the rule, not button memory.
  // ---------------------------------------------------------------------
  var FINALE_QUIZ = [
    {
      q: '«אוֹר לְאַרְבָּעָה עָשָׂר בּוֹדְקִין אֶת הֶחָמֵץ...» — בְּמָה בּוֹדְקִים?',
      correct: 'לְאוֹר הַנֵּר',
      praise: '«בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר». פייה אחת שלי נדלקת ברעד. אל תספר לה שהתרגשתי.',
      wrong: [
        { text: 'לְאוֹר הַלְּבָנָה', line: 'לבנה? חביבי, במרתף אין לבנה. יש עכביש. «בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר» — נר. קטן, נאמן, נכנס לחורים.' },
        { text: 'לְאוֹר הַמַּשּׂוּאָה', line: 'מחמיא לבועז, אבל לא. משואה מודיעה על החודש — נר בודק את הפינות. נסה להכניס משואה מתחת למיטה.' }
      ],
      restateQ: 'אז תגיד לי במילים שלך: במה בודקים חמץ?',
      restateGood: 'בנר. אור קטן ונאמן, צמוד ליד.',
      restateBad: 'בכל אור שבמקרה יש בסביבה.',
      restateBadLine: 'לא-לא. המשנה אמרה נר. «לְאוֹר הַנֵּר». דיוק, חביבי. דיוק.',
      spouts: 1
    },
    {
      q: 'וּמָה אינו צריך בדיקה כלל?',
      correct: 'כׇּל מָקוֹם שֶׁאֵין מַכְנִיסִין בּוֹ חָמֵץ',
      praise: '«כׇּל מָקוֹם שֶׁאֵין מַכְנִיסִין בּוֹ חָמֵץ, אֵין צָרִיךְ בְּדִיקָה». עוד פייה נדלקת. אני שומרת על קור רוח. של אבן.',
      wrong: [
        { text: 'כל מקום שאין בו חלונות', line: 'חושך? חושך זה לא פטור — חושך זה בדיוק למה המציאו נר. הכלל אחר: «כׇּל מָקוֹם שֶׁאֵין מַכְנִיסִין בּוֹ חָמֵץ, אֵין צָרִיךְ בְּדִיקָה». אין חמץ נכנס — אין בדיקה.' },
        { text: 'כל מקום שבדקו בו אשתקד', line: 'אשתקד?! גם אותי הדליקו אשתקד, ותראה אותי עכשיו. השאלה אם מכניסים לשם חמץ — לא מה היה פעם.' }
      ],
      restateQ: 'בקיצור, הכלל הוא:',
      restateGood: 'בודקים רק במקום שחמץ באמת נכנס אליו.',
      restateBad: 'בודקים בכל מקום, ליתר ביטחון.',
      restateBadLine: 'ליתר ביטחון בודקים את הכיסים של גד. מקום שחמץ לא נכנס אליו — פטור. זה כל הכלל.',
      spouts: 2
    },
    {
      q: 'שתי השורות במרתף, לדעת בית הלל?',
      correct: 'הַחִיצוֹנוֹת שֶׁהֵן הָעֶלְיוֹנוֹת',
      praise: '«שְׁתֵּי שׁוּרוֹת הַחִיצוֹנוֹת שֶׁהֵן הָעֶלְיוֹנוֹת». איך סופרים בדיוק? יש על זה דיון. בדף אחר. עוד פיות נדלקות אצלי בינתיים.',
      wrong: [
        { text: 'עַל פְּנֵי כׇּל הַמַּרְתֵּף', line: 'זו שיטת בית שמאי — מחמירים יפה, מסודרים להפליא. אבל בית הלל אמרו: «הַחִיצוֹנוֹת שֶׁהֵן הָעֶלְיוֹנוֹת». שתי שורות, חביבי, לא ספירת מלאי.' },
        { text: 'הַתַּחְתּוֹנוֹת שֶׁהֵן הַפְּנִימִיּוֹת', line: 'התחתונות הפנימיות? לשם יד עם פיתה לא מגיעה — לשם מגיעים רק עם מנוף. «הַחִיצוֹנוֹת שֶׁהֵן הָעֶלְיוֹנוֹת» — איפה שיד מהסעודה באמת נכנסת.' }
      ],
      restateQ: 'ולמה בכלל בודקים מרתף יין?',
      restateGood: 'כי מכניסים אליו חמץ — נכנסים לקחת יין בתוך הסעודה.',
      restateBad: 'כי חמץ אוהב חושך.',
      restateBadLine: 'חמץ לא אוהב כלום, הוא מאפה. המשנה אמרה: «מָקוֹם שֶׁמַּכְנִיסִין בּוֹ חָמֵץ» — נכנסים לשם עם הידיים מהשולחן.',
      spouts: 4
    },
    {
      q: '«מַאי ״אוֹר״?» — רב הונא אמר ___, ורב יהודה אמר ___',
      correct: 'נַגְהֵי / לֵילֵי',
      praise: '«רַב הוּנָא אָמַר: נַגְהֵי, וְרַב יְהוּדָה אָמַר: לֵילֵי». והם עוד כאן, אם לא שמת לב.',
      wrong: [
        { text: 'לֵילֵי / נַגְהֵי', line: 'הפוך, חביבי. תיזהר — אם הם ישמעו אותך מחליף להם, יהיו פה ארבע שיטות. רב הונא: נַגְהֵי. רב יהודה: לֵילֵי.' },
        { text: 'בּוֹקֶר / טוֹב', line: "'בוקר טוב' זו ברכה, לא מחלוקת. רב הונא אמר נַגְהֵי, רב יהודה אמר לֵילֵי — ואצלם, תאמין לי, גם 'בוקר טוב' היה נגמר בשתי שיטות." }
      ],
      restateQ: 'ואיך המחלוקת הזאת נגמרת?',
      restateGood: 'בדף שלנו — היא לא נגמרת. ההשלמה מחכה בדף הבא.',
      restateBad: 'רב הונא ניצח בנוק-אאוט.',
      restateBadLine: 'נוק-אאוט? הם לומדים, לא מתאגרפים. הדף שלנו לא הכריע ביניהם — זה הכבוד של הדף הבא.',
      spouts: 5,
      exactlyBeat: true
    },
    {
      q: 'שאלה אחרונה, גיבור. מה למדנו הלילה?',
      correct: 'שכל ראיה שהגיעה בדף למסקנה אמרה: אוֹר הוא ערב — והבדיקה בלילה, לאור הנר',
      praise: '«אַלְמָא ״אוֹר״ אוּרְתָּא הוּא. שְׁמַע מִינַּהּ». פעמיים אמר הדף. ואני — שומעת.',
      wrong: [
        { text: 'שאסור לריב ליד חלונות — כל המחלוקת התחילה מזה שכל אחד בחר חלון', line: 'זה נכון אגב, אבל לא זה. פעמיים עצר הדף ואמר «שְׁמַע מִינַּהּ» — ומה שמענו ממנה? תקשיב לפעם שבה דף מסכים עם עצמו. זה נדיר.' },
        { text: 'שאוֹר של המשנה יכול להיות גם בוקר — הדף השאיר את זה פתוח', line: 'פתוח?! הדף עצר פעמיים ואמר «שְׁמַע מִינַּהּ» — אוֹר של המשנה הוא הערב. סגור, חתום, ומחכה לנר.' }
      ],
      restateQ: null, // this IS the synthesis — no extra micro-check
      spouts: 7
    }
  ];

  // The menorah inflates her tenure a little more every locked visit
  var YEARS_GAG = [
    'אלפיים שנה אני נדלקת בזמן. פעם אחת ביקשתי הבהרה אחת קטנה — וכל הכפר קרס.',
    'אלפיים ושלוש שנים, מי סופר. אני סופרת. יש לי זמן.',
    'מאתיים אלף שבתות, פחות אחת — הייתי בניקיון. וזה מה שאני מקבלת בחזרה?'
  ];

  var SEAL_LABELS = { bedikah: 'חותם הבדיקה', light: 'חותם האוֹר', melakhah: 'חותם המלאכה' };

  function missingSealsText(g) {
    var missing = [];
    if (!hasSealSafe(g, 'bedikah')) missing.push(SEAL_LABELS.bedikah);
    if (!hasSealSafe(g, 'light')) missing.push(SEAL_LABELS.light);
    if (!hasSealSafe(g, 'melakhah')) missing.push(SEAL_LABELS.melakhah);
    return missing;
  }

  function sealsHeldCount(g) {
    var n = 0;
    if (hasSealSafe(g, 'bedikah')) n++;
    if (hasSealSafe(g, 'light')) n++;
    if (hasSealSafe(g, 'melakhah')) n++;
    return n;
  }

  // ---------------------------------------------------------------------
  // SEAL SOCKETING — the physical finale ritual (one click per seal)
  // ---------------------------------------------------------------------
  var SLOT_QUIPS = {
    bedikah: 'חותם הבדיקה. ריח של מרתף וקצה נוצה של פרידא. ננעל.',
    light: 'חותם האוֹר. יש בתוכו כוכבים של נפתלי. הם באו לצפות? כמובן שבאו.',
    melakhah: 'חותם המלאכה. עוד חם מהמשואה של בועז. זהירות — אש חיה.'
  };

  var SOCKET_HINTS = {
    bedikah: 'חרץ מגולף בצורת שורות חביות. חותם הבדיקה — אצל פרידא, במרתף היין.',
    light: 'חרץ מגולף בצורת כוכב. חותם האוֹר — אצל נפתלי, במצפה הכוכבים.',
    melakhah: 'חרץ מגולף בצורת להבה. חותם המלאכה — אצל בועז, בפסגת המשואות.'
  };

  function trySlotSeal(g, sock) {
    return g.cutscene(async function () {
      try {
        if (g.flag(sock.flagName)) {
          await menorahSay(g, 'החרץ הזה כבר מלא. סימטריה, חביבי. אל תיגע.');
          return;
        }
        if (!hasSealSafe(g, sock.seal)) {
          await g.playerSay('חרץ ריק. חסר לי ' + SEAL_LABELS[sock.seal] + '.');
          await menorahSay(g, SOCKET_HINTS[sock.seal]);
          return;
        }
        // walk to the base and slot it in — physical, ceremonial
        await g.walkTo(sock.x + 5, 140);
        safeSfx(g, 'seal');
        g.flag(sock.flagName, true);
        slotFlashAt = lastT;
        slotFlashX = sock.x + 5;
        await menorahSay(g, SLOT_QUIPS[sock.seal]);
        var F = stateFlags();
        if (socketsFilled(F) >= 3) {
          safeSfx(g, 'magic');
          await menorahSay(g, 'שלושה חרצים מלאים. אלפיים שנה חיכיתי לשיחה הזאת.');
          await menorahSay(g, 'עכשיו — דבר איתי. יש לי שאלות. ישנות. טובות.');
        } else {
          var left = 3 - socketsFilled(stateFlags());
          await g.playerSay(left === 2 ? 'אחד בפנים. שניים בדרך. היא אומרת שהיא לא סופרת. היא סופרת.' : 'עוד אחד ונגמר. כלומר — מתחיל.');
        }
      } catch (e) {
        if (window.console && console.warn) console.warn('press.js trySlotSeal error:', e);
      }
    });
  }

  // ---------------------------------------------------------------------
  // THE FINALE QUIZ — interleaved with lamp ignition (a spout per answer)
  // ---------------------------------------------------------------------
  async function runFinaleQuiz(g) {
    if (quizRunning) return;
    quizRunning = true;
    try {
      await g.cutscene(async function () {
        safeMusic('tense');
        safeSfx(g, 'quiz');
        await menorahSay(g, 'שלושה חותמות הבאת. יפה. אבל חותם אפשר לגנוב. הבנה — אי אפשר.');
        await menorahSay(g, 'אז לפני שאני נדלקת — אני שואלת. כמו שהדף שאל. תענה, ואני מאמינה לך.');
        for (var qi = 0; qi < FINALE_QUIZ.length; qi++) {
          var Q = FINALE_QUIZ[qi];
          var solved = false;
          var restated = false;
          await menorahSay(g, Q.q);
          while (!solved) {
            var opts = shuffled([
              { text: Q.correct, value: 'ok' },
              { text: Q.wrong[0].text, value: 'w0' },
              { text: Q.wrong[1].text, value: 'w1' }
            ]);
            var ans = await g.choose(opts);
            if (ans === 'ok') {
              solved = true;
              safeSfx(g, 'seal');
              g.flag('pressSpoutsLit', Q.spouts);
              await menorahSay(g, Q.praise);
              if (Q.exactlyBeat) {
                // the stereo running gag lands INSIDE the exam
                await hunaSay(g, 'בדיוק!');
                await yehudaSay(g, 'בדיוק!');
                await g.playerSay('לפחות על זה הם מסכימים.');
              }
            } else {
              safeSfx(g, 'fail');
              var W = ans === 'w0' ? Q.wrong[0] : Q.wrong[1];
              await menorahSay(g, W.line);
              // one-time forced restatement — the retry must test the RULE
              if (!restated && Q.restateQ) {
                restated = true;
                await menorahSay(g, Q.restateQ);
                var rOpts = shuffled([
                  { text: Q.restateGood, value: 'good' },
                  { text: Q.restateBad, value: 'bad' }
                ]);
                var r = await g.choose(rOpts);
                while (r !== 'good') {
                  safeSfx(g, 'fail');
                  await menorahSay(g, Q.restateBadLine);
                  r = await g.choose(shuffled([
                    { text: Q.restateGood, value: 'good' },
                    { text: Q.restateBad, value: 'bad' }
                  ]));
                }
                safeSfx(g, 'click');
                await menorahSay(g, 'בדיוק. ...אם תספר להם שאמרתי את המילה הזאת, אני מכבה אותך. ועכשיו — עוד פעם, ובלי לרעוד:');
                await menorahSay(g, Q.q);
              }
            }
          }
        }
        // all seven spouts alive — she draws breath; the room dims a beat
        await menorahSay(g, 'שבע פיות דולקות. נשאר רק הלב. עכשיו... נשימה.');
        breathAt = lastT;
        await g.wait(1600);
        safeSfx(g, 'magic');
        try { g.win(); } catch (e) {
          if (window.console && console.warn) console.warn('press.js g.win error:', e);
        }
      });
    } catch (e) {
      if (window.console && console.warn) console.warn('press.js finale quiz error:', e);
    } finally {
      quizRunning = false;
    }
  }

  // ---------------------------------------------------------------------
  // MENORAH TALK — locked flavor / socket instructions / finale launch
  // ---------------------------------------------------------------------
  async function menorahTalk(g) {
    try {
      var F = stateFlags();
      if (F.won) {
        await menorahSay(g, pick([
          'דולקת. סוף סוף. אל תיגע בפתילה, היא בפגישה חשובה עם כל נרות הכפר.',
          'אלפיים שנה ועוד לילה אחד. הלילה הזה היה שווה את כולם. כמעט.',
          'לך תבדוק חמץ, גיבור. «לְאוֹר הַנֵּר». עכשיו יש נר.'
        ]));
        return;
      }
      if (socketsFilled(F) >= 3) { await runFinaleQuiz(g); return; }
      var held = sealsHeldCount(g);
      if (held >= 3) {
        var filledNow = socketsFilled(F);
        await g.cutscene(async function () {
          if (filledNow === 2) {
            await menorahSay(g, 'חרץ אחד ריק נשאר. אחד. תסיים את הטקס, גיבור.');
          } else if (filledNow === 1) {
            await menorahSay(g, 'שני חרצים ריקים נשארו. שבץ, שבץ — אני לא נהיית צעירה.');
          } else {
            await menorahSay(g, 'שלושה חותמות עליך. אני מריחה אותם. הבנה מריחים, שתדע.');
            await menorahSay(g, 'שלושה חרצים לי בבסיס — שבץ אותם, אחד-אחד. אני אוהבת טקסים.');
          }
        });
        return;
      }
      // locked — count the missing, inflate the tenure, stay deadpan
      await g.cutscene(async function () {
        var yn = Number(g.flag('pressYearsN')) || 0;
        await menorahSay(g, YEARS_GAG[yn % YEARS_GAG.length]);
        g.flag('pressYearsN', yn + 1);
        await menorahSay(g, 'הבהרה אחת ביקשתי. שאלה של מילה אחת. שלוש אותיות. אָלֶף, וָאו, רֵישׁ. כמה קשה זה?');
        var missing = missingSealsText(g);
        if (missing.length === 3) {
          await menorahSay(g, 'שלושה חותמות, גיבור: הבדיקה במרתף, האוֹר במצפה, המלאכה בפסגה. אני אחכה. אני טובה בזה.');
        } else {
          await menorahSay(g, 'חסרים לי עוד: ' + missing.join(', ') + '. בלעדיהם אני אבן עם דעות.');
        }
        if (!g.has('daf') && !g.flag('pressDafHinted')) {
          g.flag('pressDafHinted', true);
          await menorahSay(g, 'ובדרך החוצה — קח דף מהספר הענק שם. אני לא צריכה אותו. אני זוכרת בעל פה.');
        }
      });
    } catch (e) {
      if (window.console && console.warn) console.warn('press.js menorahTalk error:', e);
    }
  }

  // ---------------------------------------------------------------------
  // RABBIS TALK — the live machloket + the escalating "exactly!" running gag
  // ---------------------------------------------------------------------
  async function rabbisTalk(g, who) {
    try {
      await g.cutscene(async function () {
        if (!g.flag('pressRabbisMet')) {
          g.flag('pressRabbisMet', true);
          await hunaSay(g, '«מַאי ״אוֹר״?» נַגְהֵי! תגיד לו אתה, בחור!');
          await yehudaSay(g, 'לֵילֵי! לילה! החלון שלי מסכים איתי. תסתכל עליו!');
          await hunaSay(g, 'החלון שלך זה קיר עם חור. החלון שלי — עדות.');
          var pickv = await g.choose([
            { text: 'נַגְהֵי?', value: 'a' },
            { text: 'לֵילֵי?', value: 'b' },
            { text: 'אולי שניכם מתכוונים לאותו דבר?', value: 'c' }
          ]);
          // beat 1 of the stereo gag: ANY answer — both hear what they want
          safeSfx(g, 'quiz');
          await hunaSay(g, 'בדיוק!');
          await yehudaSay(g, 'בדיוק!');
          if (pickv === 'c') await g.playerSay('אמרתי "שניכם". הם שמעו "אני צודק". פעמיים.');
          else await g.playerSay('הם שומעים רק את מה שהם רוצים. זה כישרון, בעצם.');
          await yehudaSay(g, 'בדף הבא נשלים. אולי. אם הוא יודה שאני צודק.');
          await hunaSay(g, 'גם אני בטוח. שהוא יטעה.');
          g.flag('pressExactlyN', 1);
          return;
        }
        var n = Number(g.flag('pressExactlyN')) || 1;
        if (n === 1) {
          // beat 2: even "hello" gets the stereo treatment
          await g.playerSay('שלום?');
          await hunaSay(g, 'בדיוק!!');
          await yehudaSay(g, 'בדיוק!!');
          await g.playerSay('רק אמרתי שלום.');
          g.flag('pressExactlyN', 2);
          return;
        }
        if (n === 2 && hasSealSafe(g, 'light')) {
          // beat 3: the player says NOTHING. long pause. it still lands.
          await g.wait(1500);
          await hunaSay(g, '...בדיוק.');
          await yehudaSay(g, '...בדיוק.');
          await g.playerSay('לא אמרתי כלום. אני שקט מנצח.');
          g.flag('pressExactlyN', 3);
          return;
        }
        // steady-state stereo flavor
        var beat = pick([
          ['נַגְהֵי!', 'לֵילֵי!', 'אמרנו את זה כבר?', 'מהבוקר.', 'איזה בוקר?!'],
          ['נַגְהֵי!', 'לֵילֵי!', 'אתה חוזר על עצמך.', 'אתה חוזר על עצמך קודם.', null]
        ]);
        await hunaSay(g, beat[0]);
        await yehudaSay(g, beat[1]);
        if (beat[2]) await (who === 'huna' ? hunaSay(g, beat[2]) : yehudaSay(g, beat[2]));
        if (beat[3]) await (who === 'huna' ? yehudaSay(g, beat[3]) : hunaSay(g, beat[3]));
        if (beat[4]) await (who === 'huna' ? hunaSay(g, beat[4]) : yehudaSay(g, beat[4]));
      });
    } catch (e) {
      if (window.console && console.warn) console.warn('press.js rabbisTalk error:', e);
    }
  }

  // ---------------------------------------------------------------------
  // ON ENTER
  // ---------------------------------------------------------------------
  async function onEnter(g) {
    try {
      safeMusic('night');
      var F = stateFlags();
      if (F.won) return;
      if (!g.flag('pressIntro')) {
        g.flag('pressIntro', true);
        var heldOnIntro = sealsHeldCount(g);
        await g.cutscene(async function () {
          await g.playerSay('בית הבד העתיק. ריח של שמן, אבן, ואלפיים שנה של דיוק.');
          await hunaSay(g, 'נַגְהֵי!');
          await yehudaSay(g, 'לֵילֵי!');
          await hunaSay(g, 'נַגְהֵי!!');
          await yehudaSay(g, 'לֵילֵי!!');
          await menorahSay(g, 'הם ככה מהצהריים. או מהערב. תלוי את מי שואלים.');
          await g.playerSay('המנורה מדברת. כמובן שהמנורה מדברת.');
          if (heldOnIntro >= 3) {
            await menorahSay(g, 'ושלושה חותמות כבר עליך. מוכן ומסודר. אני מתרגשת. עמוק בפנים. אל תחפש.');
          } else {
            await menorahSay(g, 'שלושה חותמות, גיבור. עד אז — אני דוממת. יחסית.');
          }
        });
        // no early return — the sockets nudge below may apply on this same visit
      }
      // returning with all three seals but sockets still empty — nudge once
      if (sealsHeldCount(g) >= 3 && socketsFilled(stateFlags()) < 3 && !g.flag('pressSockNudge')) {
        g.flag('pressSockNudge', true);
        await g.cutscene(async function () {
          await menorahSay(g, 'שלושה חותמות עליך. החרצים — למטה, בבסיס שלי. אחד-אחד, בכבוד.');
        });
      }
    } catch (e) {
      if (window.console && console.warn) console.warn('press.js onEnter error:', e);
    }
  }

  // ---------------------------------------------------------------------
  // SCENE REGISTRATION
  // ---------------------------------------------------------------------
  GAME.registerScene('press', {
    name: 'בֵּית הַבַּד הָעַתִּיק',
    floor: { yMin: 124, yMax: 168 },
    paint: paint,
    onEnter: onEnter,
    hotspots: [

      // ---- exit back to the inn lane -----------------------------------
      {
        id: 'exitInn', name: 'אֶל הַפּוּנְדָּק', type: 'exit',
        x: 0, y: 78, w: 19, h: 62,
        walkTo: { x: 16, y: 146 },
        target: 'inn', spawn: { x: 200, y: 150 },
        look: async function (g) {
          await g.playerSay('הסמטה חזרה אל הפונדק. הלילה — או הבוקר — עוד צעיר. תלוי בחלון.');
        }
      },

      // ---- night window (left) ------------------------------------------
      {
        id: 'windowNight', name: 'חַלּוֹן הַלַּיְלָה', type: 'object',
        x: 24, y: 24, w: 30, h: 39,
        walkTo: { x: 44, y: 140 },
        look: async function (g) {
          if (hasSealSafe(g, 'light')) {
            await g.playerSay('הכוכבים של נפתלי. הוא שלח אותם לצפות בגמר. הם הביאו חטיפים. כשרים לפסח, הם נשבעים.');
            return;
          }
          await g.playerSay('חלון הלילה. כוכבים, ירח, שקט. רב יהודה מנקה אותו כל בוקר. כלומר ערב. כלומר — אתם מבינים את הבעיה.');
        },
        take: async function (g) {
          await g.playerSay('לקחת חלון? ואז מה, להסתכל דרך קיר?');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('«רַב יְהוּדָה אָמַר: לֵילֵי». החלון הזה — הראיה הכי שקטה שלו.');
            return;
          }
          await g.playerSay('החלון עסוק בלהיות לילה. לא מפריעים.');
        }
      },

      // ---- dawn window (right) ------------------------------------------
      {
        id: 'windowDawn', name: 'חַלּוֹן הַשַּׁחַר', type: 'object',
        x: 266, y: 24, w: 30, h: 39,
        walkTo: { x: 276, y: 140 },
        look: async function (g) {
          await g.playerSay('חלון הזריחה. שמש חצי-זרוחה, תקועה, נבוכה. גם היא מחכה לפסק דין.');
        },
        take: async function (g) {
          await g.playerSay('השמש הזאת תקועה כבר חצי יממה. היא לא צריכה שגם אני אמשוך אותה.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('«רַב הוּנָא אָמַר: נַגְהֵי». השמש התקועה הזאת בטוחה שהוא דיבר עליה.');
            return;
          }
          await g.playerSay('לא נוגעים בשחר תקוע. זה עניין לשמיים.');
        }
      },

      // ---- Rav Huna (left, team naghei) ---------------------------------
      {
        id: 'huna', name: 'רַב הוּנָא', type: 'char',
        x: 52, y: 112, w: 26, h: 36,
        walkTo: { x: 86, y: 150 },
        draw: function (ctx, t, S) { drawHuna(ctx, t); },
        look: async function (g) {
          await g.playerSay('רב הונא מצביע על חלון הזריחה כאילו הוא עד ראייה בתיק.');
        },
        talk: function (g) { return rabbisTalk(g, 'huna'); },
        take: async function (g) {
          await g.playerSay('לקחת אמורא? יש דברים שגם אני לא מעז.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('«מַאי ״אוֹר״? רַב הוּנָא אָמַר: נַגְהֵי, וְרַב יְהוּדָה אָמַר: לֵילֵי». כתוב עליכם בדף. אתם מפורסמים.');
            await hunaSay(g, 'בדיוק!');
            return;
          }
          if (itemId === 'pita') {
            await hunaSay(g, 'חמץ?! מחר — «שֶׁמִּקְצָתוֹ מוּתָּר בַּאֲכִילַת חָמֵץ וּמִקְצָתוֹ אָסוּר בַּאֲכִילַת חָמֵץ», חצי יום כן, חצי יום לא. אבל לידי? אף חצי. יש לי מוניטין.');
            return;
          }
          await hunaSay(g, 'נַגְהֵי. מה שזה לא יהיה — נַגְהֵי.');
        }
      },

      // ---- Rav Yehuda (right, team leilei) -------------------------------
      {
        id: 'yehuda', name: 'רַב יְהוּדָה', type: 'char',
        x: 246, y: 112, w: 26, h: 36,
        walkTo: { x: 232, y: 150 },
        draw: function (ctx, t, S) { drawYehuda(ctx, t); },
        look: async function (g) {
          await g.playerSay('רב יהודה מצביע על חלון הלילה. החלון, לתחושתי, מסכים איתו. אבל הוא חלון.');
        },
        talk: function (g) { return rabbisTalk(g, 'yehuda'); },
        take: async function (g) {
          await g.playerSay('אי אפשר לקחת את רב יהודה. אפשר לכל היותר להסכים איתו.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('«מַאי ״אוֹר״? רַב הוּנָא אָמַר: נַגְהֵי, וְרַב יְהוּדָה אָמַר: לֵילֵי». שניכם בדף. באותה שורה. תחשבו על זה.');
            await yehudaSay(g, 'בדיוק!');
            return;
          }
          if (itemId === 'pita') {
            await yehudaSay(g, 'פיתה עתיקה? שמור אותה לביעור. מחר. אחרי הבדיקה. שבלילה. לֵילֵי!');
            return;
          }
          await yehudaSay(g, 'לֵילֵי. השאלה לא משנה — התשובה לֵילֵי.');
        }
      },

      // ---- the Great Searching-Lamp (the finale) -------------------------
      {
        id: 'menorah', name: 'מְנוֹרַת הַבְּדִיקָה', type: 'char',
        x: 138, y: 52, w: 48, h: 58,
        walkTo: { x: 161, y: 140 },
        look: async function (g) {
          var F = stateFlags();
          if (F.won) {
            await g.playerSay('מנורת הבדיקה, דולקת בכל שבע הפיות. שווה כל פיקסל.');
            return;
          }
          var held = sealsHeldCount(g);
          if (held === 0) {
            await menorahSay(g, 'אלפיים שנה של שירות מסור. יום מחלה אחד. אחד! ותראה מה קורה לשמיים.');
          } else if (held < 3) {
            await menorahSay(g, 'יפה, חותם. תביא את השאר. אני מנורה עתיקה, לא מנורת לילה — אני לא נדלקת חצי.');
          } else if (socketsFilled(F) < 3) {
            await menorahSay(g, 'שלושה חותמות ביד, שלושה חרצים בבסיס. המתמטיקה פשוטה. הידיים — עליך.');
          } else {
            await menorahSay(g, 'החרצים מלאים. נשארו השאלות. דבר איתי כשאתה מוכן.');
          }
        },
        talk: function (g) { return menorahTalk(g); },
        take: async function (g) {
          await g.playerSay('היא אבן בגובה שלי, עם דעות חזקות משלי. היא נשארת.');
        },
        use: async function (g, itemId) {
          var F = stateFlags();
          if (itemId === 'pita') {
            await menorahSay(g, 'בִּיעוּר מחר בבוקר, חביבי. אני מנורה, לא מדורה.');
            return;
          }
          if (itemId === 'nerlit') {
            if (socketsFilled(F) < 3 && !F.won) {
              if (!g.flag('egg_menorahNer')) {
                g.flag('egg_menorahNer', true);
                await menorahSay(g, 'אתה מציע לי אש? חמוד. אלפיים שנה כל נר בכפר נדלק ממני, ועכשיו הצוציק עם השעווה בא להדליק אותי. חותמות, חביבי. שלושה.');
              } else {
                await menorahSay(g, 'רגע רגע — אתה מדליק אותי?! חצוף. אני המקור. אתה הצילום.');
              }
            } else if (!F.won) {
              await menorahSay(g, 'קודם שאלות. אחר כך אש. סדר זה קדושה.');
            } else {
              await menorahSay(g, 'כבר דולקת, חביבי. אבל תודה שחשבת עליי.');
            }
            return;
          }
          if (itemId === 'ner') {
            await menorahSay(g, 'נר כבוי? אני כבויה. נקים קבוצת תמיכה, ניפגש בערבים. אם נדע מתי ערב.');
            return;
          }
          if (itemId === 'daf') {
            await menorahSay(g, '«אוֹר לְאַרְבָּעָה עָשָׂר בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר». השורה הראשונה שלי. אני יודעת אותה מלפני שהדיו התייבש.');
            return;
          }
          await menorahTalk(g);
        }
      },

      // ---- the three seal sockets (declared AFTER the menorah so they win
      //      the overlap hit-test at her base) ------------------------------
      {
        id: 'socketBedikah', name: 'חֶרֶץ חוֹתַם הַבְּדִיקָה', type: 'object',
        x: 138, y: 110, w: 12, h: 12,
        walkTo: { x: 144, y: 140 },
        look: function (g) { return trySlotSeal(g, SOCKETS[0]); },
        take: async function (g) { await g.playerSay('החרץ מגולף באבן. הוא לא בא איתי.'); },
        use: function (g, itemId) {
          if (itemId === 'daf') return g.playerSay('«בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר» — החותם הזה נולד במרתף.');
          return trySlotSeal(g, SOCKETS[0]);
        }
      },
      {
        id: 'socketLight', name: 'חֶרֶץ חוֹתַם הָאוֹר', type: 'object',
        x: 154, y: 110, w: 12, h: 12,
        walkTo: { x: 161, y: 140 },
        look: function (g) { return trySlotSeal(g, SOCKETS[1]); },
        take: async function (g) { await g.playerSay('אי אפשר לקחת חור. פילוסופית, כן. פיזית — לא.'); },
        use: function (g, itemId) {
          if (itemId === 'daf') return g.playerSay('«אַלְמָא ״אוֹר״ אוּרְתָּא הוּא» — החותם הזה נולד בין הכוכבים.');
          return trySlotSeal(g, SOCKETS[1]);
        }
      },
      {
        id: 'socketMelakhah', name: 'חֶרֶץ חוֹתַם הַמְּלָאכָה', type: 'object',
        x: 170, y: 110, w: 12, h: 12,
        walkTo: { x: 178, y: 140 },
        look: function (g) { return trySlotSeal(g, SOCKETS[2]); },
        take: async function (g) { await g.playerSay('לקחת שקע? ניסיתי פעם לשים חור בכיס. מאז יש לי כיס עם חור.'); },
        use: function (g, itemId) {
          if (itemId === 'daf') return g.playerSay('«מִשְּׁעַת הָאוֹר» מול «מִשְּׁעַת הָנֵץ הַחַמָּה» — החותם הזה נולד ליד משואה.');
          return trySlotSeal(g, SOCKETS[2]);
        }
      },

      // ---- the giant Gemara book (source of the `daf` hint item) ---------
      {
        id: 'gemara', name: 'סֵפֶר הַגְּמָרָא הָעֲנָק', type: 'object',
        x: 188, y: 84, w: 28, h: 38,
        walkTo: { x: 202, y: 142 },
        look: async function (g) {
          await g.cutscene(async function () {
            await g.playerSay('ספר גמרא בגודל של דלת. מי שלומד ממנו — לומד בעמידה. מיראה.');
            await g.playerSay('«אוֹר לְאַרְבָּעָה עָשָׂר בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר. כׇּל מָקוֹם שֶׁאֵין מַכְנִיסִין בּוֹ חָמֵץ, אֵין צָרִיךְ בְּדִיקָה.»');
            await g.playerSay('«וּבַמָּה אָמְרוּ ״שְׁתֵּי שׁוּרוֹת בַּמַּרְתֵּף״ — מָקוֹם שֶׁמַּכְנִיסִין בּוֹ חָמֵץ. בֵּית שַׁמַּאי אוֹמְרִים: שְׁתֵּי שׁוּרוֹת עַל פְּנֵי כׇּל הַמַּרְתֵּף, וּבֵית הִלֵּל אוֹמְרִים: שְׁתֵּי שׁוּרוֹת הַחִיצוֹנוֹת שֶׁהֵן הָעֶלְיוֹנוֹת.»');
            if (!g.has('daf')) await g.playerSay('דף אחד רופף בקצה. נראה לי שהוא רוצה לבוא איתי.');
          });
        },
        take: async function (g) {
          if (!g.has('daf')) {
            try { g.give('daf'); } catch (e) { /* silent */ }
            await g.playerSay('דף גמרא. רופף, סבלני, יודע הכול. חבר טוב למסע.');
            await menorahSay(g, 'שמור עליו. הוא היחיד פה שלא צועק.');
          } else {
            await g.playerSay('דף אחד לקחתי. השאר שמורים ללומדים הבאים. ולמחזור הדפים של הכפר.');
          }
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('להצמיד דף לספר שהוא בא ממנו? זה או איחוד משפחות או לולאה אינסופית.');
            return;
          }
          if (itemId === 'pita') {
            await g.playerSay('פיתה בתוך גמרא זה סימנייה של חובבנים. וגם חמץ. לא.');
            return;
          }
          await g.playerSay('הספר כבר פתוח בדיוק בעמוד הנכון. דף ב. תמיד דף ב.');
        }
      },

      // ---- the millstone (with the echo-callback gag chain) ---------------
      {
        id: 'millstone', name: 'אֶבֶן הָרֵחַיִם', type: 'object',
        x: 78, y: 76, w: 52, h: 46,
        walkTo: { x: 104, y: 142 },
        look: async function (g) {
          var n = Number(g.flag('pressMillN')) || 0;
          g.flag('pressMillN', n + 1);
          if (n % 2 === 0) {
            await g.cutscene(async function () {
              await g.playerSay('אבן הרחיים. אלפי זיתים מסרו את נפשם למען השמן הזה. נעמוד רגע דקת דומייה.');
              await g.wait(900);
              await g.playerSay('...טוב, מספיק. הם היו זיתים.');
            });
          } else {
            await g.cutscene(async function () {
              await g.playerSay('שלום, אבן.');
              await g.say('«מַאי?»', { x: 300, y: 92 }); // the empty vat echoes back
              await g.playerSay('הכד הריק ענה לי. בארמית.');
              await menorahSay(g, 'גם השוקת בפונדק עושה את זה. אנחנו לא קרובות משפחה.');
            });
          }
        },
        take: async function (g) {
          await g.playerSay('היא שוקלת יותר מהבית שגרתי בו. נוותר.');
        },
        use: async function (g, itemId) {
          if (itemId === 'pita') {
            await g.playerSay('לטחון את הפיתה? היא קשה מהאבן. חבל על הרחיים.');
            return;
          }
          if (itemId === 'daf') {
            await g.playerSay('הדף אומר שבית הבד עובד בשמן, לא בחמץ. האבן הזאת כשרה לפסח מאז ומעולם.');
            return;
          }
          await g.playerSay('אין זיתים הלילה. האבן בחופשת מחלוקת.');
        }
      },

      // ---- the screw press (feather-and-spoon cameo) ----------------------
      {
        id: 'screwpress', name: 'מַכְבֵּשׁ הַבּוֹרֵג', type: 'object',
        x: 222, y: 52, w: 34, h: 52,
        walkTo: { x: 238, y: 142 },
        look: async function (g) {
          await g.cutscene(async function () {
            await g.playerSay('מכבש הבורג. ובתוכו — נוצה תקועה. ובכד שם — כף עץ, כמו משוט קטן.');
            await g.playerSay('מישהו ניסה לבדוק חמץ בבית בד. «מָקוֹם שֶׁאֵין מַכְנִיסִין בּוֹ חָמֵץ» — פטור מבדיקה. אבל לך תסביר פטור למסירות.');
          });
        },
        take: async function (g) {
          await g.playerSay('הנוצה תקועה, הכף שוחה, ואני עם נר. לכל אחד תפקיד הלילה.');
        },
        use: async function (g, itemId) {
          if (itemId === 'pita') {
            await g.playerSay('לסחוט פיתה במכבש? מקסימום יצא ממנה עוד פיתה. דחוסה יותר.');
            return;
          }
          await g.playerSay('הבורג חלוד מרוב געגוע לזיתים. לא נוגעים.');
        }
      },

      // ---- the oil vats -----------------------------------------------------
      {
        id: 'vats', name: 'כַּדֵּי הַשֶּׁמֶן', type: 'object',
        x: 277, y: 92, w: 42, h: 32,
        walkTo: { x: 282, y: 142 },
        look: async function (g) {
          await g.playerSay(pick([
            'כדי שמן עתיקים. כשר לפסח מזמן שעוד לא היה "לפסח".',
            'שמן זית זך. המנורה שותה רק את זה. יש לה סטנדרטים של אלפיים שנה.',
            'כד אחד ריק לגמרי. מדי פעם הוא עונה להדים. אל תעודד אותו.'
          ]));
        },
        take: async function (g) {
          await g.playerSay('כד בגובה ברך ובמשקל של חמור. השמן יישאר איפה שהוא.');
        },
        use: async function (g, itemId) {
          if (itemId === 'pita') {
            await g.playerSay('פיתה בשמן זה מתכון. חמץ בפסח זו בעיה. הפיתה נשארת בכיס.');
            return;
          }
          await g.playerSay('השמן שמור למנורה. היא בודקת חשבוניות.');
        }
      },

      // ---- the eternal oil drip (three-beat look gag) ----------------------
      {
        id: 'drip', name: 'טִפְטוּף הַשֶּׁמֶן', type: 'object',
        x: 282, y: 106, w: 8, h: 20,
        walkTo: { x: 282, y: 142 },
        look: async function (g) {
          var n = Number(g.flag('pressDripN')) || 0;
          g.flag('pressDripN', n + 1);
          var beat = n % 3;
          if (beat === 0) {
            await g.playerSay('טיפ. טיפ. טיפ.');
          } else if (beat === 1) {
            await g.playerSay('היא מטפטפת ככה אלפיים שנה. רב הונא בטוח שזה שעון חול. רב יהודה בטוח שזה שעון לילה.');
          } else {
            await g.cutscene(async function () {
              await g.playerSay('...תפסתי טיפה באוויר.');
              safeSfx(g, 'magic');
              await hunaSay(g, '!');
              await yehudaSay(g, '!');
              await g.playerSay('שניהם השתנקו. סוף סוף — תגובה מאוחדת.');
            });
          }
        },
        take: async function (g) {
          await g.playerSay('לקחת טפטוף? אני אצטרך דלי וסבלנות של אלפיים שנה.');
        },
        use: async function (g) {
          await g.playerSay('הטפטוף לא צריך עזרה. הוא הדבר הכי עקבי בכפר הזה.');
        }
      },

      // ---- the hanging oil lamps (solidarity strike) ------------------------
      {
        id: 'hanginglamps', name: 'מְנוֹרוֹת הַשֶּׁמֶן הַתְּלוּיוֹת', type: 'object',
        x: 70, y: 6, w: 186, h: 18,
        walkTo: { x: 160, y: 140 },
        look: async function (g) {
          var F = stateFlags();
          if (F.won) {
            await g.playerSay('כולן דולקות. השביתה נגמרה — ההנהלה חזרה לעבודה.');
            return;
          }
          await g.playerSay('שורת מנורות תלויות, כולן כבויות. הן לא שובתות — הן מזדהות עם ההנהלה.');
        },
        take: async function (g) {
          await g.playerSay('הן תלויות גבוה בכוונה. כנראה בגללי.');
        },
        use: async function (g, itemId) {
          if (itemId === 'nerlit') {
            await menorahSay(g, 'הן נדלקות ממני, חביבי. תמיד ממני. עקרונות זה לא דבר שמדליקים מהצד.');
            return;
          }
          await g.playerSay('גבוה מדי. וגם — יש להן עמדה מוצקה בנושא.');
        }
      }
    ]
  });
})();
