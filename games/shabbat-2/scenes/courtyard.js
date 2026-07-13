'use strict';
/*
 * Scene: courtyard — "הַמָּבוֹי הַקָּפוּא" (The Frozen Alley)
 * DAF QUEST (Shabbat game) — Shabbat 2a. Teaches the Mishnah's six transfer
 * cases: liability follows whoever performed the WHOLE prohibited act
 * (reaching AND placing/taking) alone; when the act is split between two
 * people, both are exempt. Awards seal `handoff` (חותם המשא ומתן).
 * Owns ONLY this file. Registers via GAME.registerScene('courtyard', {...}).
 */
(function () {

  if (!window.GAME || typeof window.GAME.registerScene !== 'function') {
    if (window.console && console.warn) console.warn('courtyard.js: GAME.registerScene missing, scene not registered');
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
    if (SP && typeof SP.dither === 'function') { try { SP.dither(ctx, x, y, w, h, c1, c2); return; } catch (e) { /* fall through */ } }
    px(ctx, x, y, w, h, c1);
    ctx.fillStyle = c2;
    for (var yy = 0; yy < h; yy++) {
      for (var xx = (yy % 2); xx < w; xx += 2) ctx.fillRect(x + xx, y + yy, 1, 1);
    }
  }

  function glow(ctx, x, y, r, color, alpha) {
    var SP = window.SPRITES;
    if (SP && typeof SP.glow === 'function') { try { SP.glow(ctx, x, y, r, color, alpha); return; } catch (e) { /* fall through */ } }
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
    if (SP && typeof SP.star === 'function') { try { SP.star(ctx, x, y, t, size, color); return; } catch (e) { /* fall through */ } }
    var a = 0.5 + 0.5 * Math.sin(t * 3 + x * 7 + y * 3);
    ctx.globalAlpha = 0.4 + 0.6 * a;
    px(ctx, x, y, 1, 1, color || '#ffffff');
    ctx.globalAlpha = 1;
  }

  function tintIcy(ctx, x, y, w, h) {
    ctx.save();
    ctx.globalAlpha = 0.40;
    ctx.fillStyle = '#aee3f5';
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  function drawFreezeShimmer(ctx, t, x, y, seed) {
    seed = seed || 0;
    var s = Math.sin(t * 5 + seed);
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.35 * Math.max(0, s);
    px(ctx, x - 1, y, 1, 1, '#eaffff');
    px(ctx, x + 2, y - 2, 1, 1, '#eaffff');
    // frozen comic motion-lines: short static dashes, alpha pulses only
    ctx.globalAlpha = 0.20 + 0.20 * Math.max(0, Math.sin(t * 3 + seed + 1.4));
    px(ctx, x - 5, y - 1, 3, 1, '#eaffff');
    px(ctx, x - 8, y + 2, 4, 1, '#eaffff');
    ctx.restore();
  }

  function safeSfx(name) {
    try { if (window.AUDIO && typeof AUDIO.sfx === 'function') AUDIO.sfx(name); }
    catch (e) { /* audio must never crash the game */ }
  }

  function hasSealSafe(g, id) {
    try { return !!(g && typeof g.hasSeal === 'function' && g.hasSeal(id)); }
    catch (e) { return false; }
  }

  function sealInState(S, id) {
    return !!(S && S.seals && S.seals.indexOf && S.seals.indexOf(id) >= 0);
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function shuffled(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  /* ------------------------------------------------------------------ */
  /* Module-local quiz progress (persists across talk() calls, resets   */
  /* on page load — matches the fact that GAME.state itself is fresh    */
  /* per session). thawCount 0..6 drives the visual "thaw" progress.    */
  /* ------------------------------------------------------------------ */

  var quizOrder = null;   // shuffled copy of MISHNAH_CASES, built on first start
  var quizIndex = 0;      // index of the next unanswered case
  var thawCount = 0;      // 0..6 correctly-answered cases (drives visuals)

  var MISHNAH_CASES = [
    {
      id: 'case1',
      setup: 'העני פשט את ידו פנימה, לתוך רשות היחיד, ונתן חפץ לתוך ידו של בעל הבית.',
      correct: 'poor',
      explain: 'העני עשה את כל הפעולה בעצמו — הושיט והניח. לכן העני חייב, ובעל הבית פטור.'
    },
    {
      id: 'case2',
      setup: 'העני פשט את ידו פנימה, נטל חפץ מתוך ידו של בעל הבית, והוציא אותו החוצה.',
      correct: 'poor',
      explain: 'שוב העני לבדו: הושיט, נטל והוציא. כל הפעולה שלו — העני חייב, בעל הבית פטור.'
    },
    {
      id: 'case3',
      setup: 'בעל הבית פשט את ידו החוצה, ונתן חפץ לתוך ידו של העני.',
      correct: 'owner',
      explain: 'הפעם בעל הבית עשה הכול — הושיט והניח. בעל הבית חייב, העני פטור.'
    },
    {
      id: 'case4',
      setup: 'בעל הבית פשט את ידו החוצה, נטל חפץ מתוך ידו של העני, והכניס אותו פנימה.',
      correct: 'owner',
      explain: 'שוב בעל הבית לבדו: הושיט, נטל והכניס. בעל הבית חייב, העני פטור.'
    },
    {
      id: 'case5',
      setup: 'העני פשט את ידו הריקה פנימה, ובעל הבית נטל ממנה חפץ — או שנתן בעל הבית לתוכה חפץ והעני הוציא.',
      correct: 'both',
      explain: 'הפעולה התחלקה בין השניים — אחד הושיט, השני נטל או הניח. אף אחד לא עשה הכול לבד, לכן שניהם פטורים.'
    },
    {
      id: 'case6',
      setup: 'בעל הבית פשט את ידו הריקה החוצה, והעני נטל ממנה חפץ — או שנתן העני לתוכה חפץ ובעל הבית הכניס.',
      correct: 'both',
      explain: 'תמונת ראי של המקרה הקודם — שוב חלוקה בין שניים, ושוב שניהם פטורים.'
    }
  ];

  var QUIZ_OPTIONS = [
    { text: 'העני חייב', value: 'poor' },
    { text: 'בעל הבית חייב', value: 'owner' },
    { text: 'שניהם פטורים', value: 'both' }
  ];

  var WRONG_LINES = [
    'קר... לי... עוד... בַּיָּד... זו לא התשובה.',
    'עדיין תקוע. קפוא כמו מי המקווה בחורף. נסה שוב.',
    'לא זה. אני מרגיש את זה בעצמות — טעות.',
    'עוד לא. תחשוב שוב מי בדיוק עשה כאן את כל המלאכה.'
  ];

  var RIGHT_INTROS = [
    'נכון! משהו זז!',
    'קול חריקה קטן... זה עובד!',
    'בדיוק! משהו נמס.',
    'זהו זה!'
  ];

  var ZUSMAN_EPILOGUE = [
    'היד שלי חופשית! ולמדתי כלל: מי שעשה הכול לבד — הוא חייב. אם רק הושטתי יד ריקה וחברי לקח ממנה — שנינו פטורים.',
    'תודה לך, זרח. עוד רגע והייתי הופך לפסל קבע בכיכר הכפר.',
    'עכשיו אני יודע להסביר את זה גם לילדים שלי: מי שהוציא — או שהכניס — לבדו, הוא האחראי.'
  ];

  var TODROS_EPILOGUE = [
    'מי שעשה את המלאכה בשלמות — הוא חייב. אני או הוא. לא שנינו יחד.',
    'תודרוס תמיד אומר: תן ליד אחת לעשות את כל העבודה, ותדע למי להודות.',
    'הכד עבר בשלום. ואני עדיין לא מאמין שזה היה תלוי בשאלה של רשות.'
  ];

  /* ------------------------------------------------------------------ */
  /* Background painters                                                */
  /* ------------------------------------------------------------------ */

  function paintSky(ctx) {
    px(ctx, 0, 0, 320, 8, '#2c1840');
    dither(ctx, 0, 8, 320, 4, '#2c1840', '#3a2050');
    px(ctx, 0, 12, 320, 10, '#3a2050');
    dither(ctx, 0, 22, 320, 4, '#3a2050', '#7a3d5c');
    px(ctx, 0, 26, 320, 10, '#7a3d5c');
    dither(ctx, 0, 36, 320, 4, '#7a3d5c', '#d97a4a');
    px(ctx, 0, 40, 320, 6, '#d97a4a');
    dither(ctx, 0, 46, 320, 4, '#d97a4a', '#ffb347');
    px(ctx, 0, 50, 320, 4, '#ffb347');
  }

  function paintStreetSide(ctx) {
    // Open public street (רשות הרבים): low, gapped rooftops — no enclosing wall.
    px(ctx, 0, 54, 60, 18, '#3f3f5c');
    px(ctx, 0, 54, 60, 3, '#4a4a68');
    px(ctx, 70, 60, 48, 12, '#3f3f5c');
    px(ctx, 70, 60, 48, 2, '#4a4a68');
    px(ctx, 122, 50, 30, 22, '#3f3f5c');
    px(ctx, 122, 50, 30, 3, '#4a4a68');
    // a low unwalled curb only, well under 10 tefachim — public domain
    px(ctx, 0, 128, 150, 3, '#5a4a5c');
    // cobblestone ground
    px(ctx, 0, 131, 150, 49, '#4a3a58');
    var cx;
    for (cx = 4; cx < 150; cx += 9) {
      px(ctx, cx, 134 + ((cx % 18) ? 0 : 3), 5, 3, '#40314c');
    }
    for (cx = 8; cx < 150; cx += 11) {
      px(ctx, cx, 150 + ((cx % 22) ? 0 : 4), 4, 3, '#40314c');
    }
  }

  function paintHouseSide(ctx) {
    // Walled house (רשות היחיד): tall solid wall, well over 10 tefachim.
    px(ctx, 190, 40, 130, 90, '#4a4a68');
    var gy;
    for (gy = 46; gy < 128; gy += 9) px(ctx, 190, gy, 130, 1, '#3f3f5c');
    px(ctx, 195, 50, 5, 3, '#565676');
    px(ctx, 260, 76, 5, 3, '#565676');
    px(ctx, 296, 98, 5, 3, '#565676');
    // doorway opening (the threshold) cut into the wall
    px(ctx, 150, 70, 42, 60, '#241a30');
    px(ctx, 150, 66, 42, 6, '#3a2a1e');
    px(ctx, 148, 40, 6, 90, '#3a2a1e');
    px(ctx, 190, 40, 6, 90, '#3a2a1e');
    // lit window (Shabbat candle glow inside the home)
    px(ctx, 226, 56, 22, 26, '#3a2a1e');
    px(ctx, 229, 59, 16, 20, '#2a2035');
    // indoor floor (wood) visible through doorway + rest of the house side
    px(ctx, 150, 130, 170, 50, '#5a3a24');
    var fy;
    for (fy = 132; fy < 180; fy += 6) px(ctx, 150, fy, 170, 1, '#4a2f1c');
    px(ctx, 150, 131, 170, 1, '#7a512f');
  }

  function paintThresholdStatic(ctx) {
    // Raised doorstep slab spanning the boundary.
    px(ctx, 148, 126, 44, 8, '#6b6b8f');
    px(ctx, 148, 126, 44, 2, '#8f8fb0');
    px(ctx, 148, 132, 44, 4, '#565678');
    // doorframe posts
    px(ctx, 148, 66, 5, 66, '#5a3a24');
    px(ctx, 187, 66, 5, 66, '#5a3a24');
    px(ctx, 146, 62, 46, 6, '#5a3a24');
    px(ctx, 146, 62, 46, 2, '#7a512f');
  }

  function paintDecor(ctx) {
    // distant hanging banner + a lone chimney for texture
    px(ctx, 34, 58, 2, 12, '#5a3a24');
    px(ctx, 26, 58, 18, 6, '#e63946');
    px(ctx, 26, 58, 18, 2, '#8a2f3a');
  }

  /* ------------------------------------------------------------------ */
  /* Dynamic layers                                                     */
  /* ------------------------------------------------------------------ */

  function drawStars(ctx, t) {
    twinkle(ctx, 40, 12, t, 1, '#f4eecb');
    twinkle(ctx, 272, 8, t + 1.6, 1, '#f4eecb');
    twinkle(ctx, 300, 18, t + 3.1, 1, '#e8d8a8');
  }

  function drawLantern(ctx, t) {
    var x = 168, y = 66;
    px(ctx, x - 1, y - 6, 2, 6, '#3a2a1e');
    px(ctx, x - 3, y - 9, 6, 4, '#3a2a1e');
    px(ctx, x - 2, y - 8, 4, 3, '#241a14');
    var fl = Math.sin(t * 9 + 1) * 1.1;
    px(ctx, x - 1 + fl * 0.3, y - 3, 2, 3, '#ff8c42');
    px(ctx, x - 0.5 + fl * 0.4, y - 2, 1, 2, '#ffd166');
    glow(ctx, x, y - 2, 12, '#ffb347', 0.10 + 0.04 * Math.sin(t * 9));
  }

  function drawWindowCandle(ctx, t) {
    var x = 237, y = 78;
    var fl = Math.sin(t * 8.4) * 0.8;
    px(ctx, x - 1, y - 6, 2, 6, '#f0e6c8');
    px(ctx, x - 0.5 + fl * 0.3, y - 8, 1, 2, '#ffd166');
    ctx.globalAlpha = 0.18 + 0.05 * Math.sin(t * 8.4);
    px(ctx, 229, 59, 16, 20, '#ffb347');
    ctx.globalAlpha = 1;
  }

  function drawBird(ctx, t) {
    var flap = ((t * 0.6) % 6) < 0.25;
    var x = 274, y = 46;
    px(ctx, x, y, 3, 2, '#241a30');
    if (flap) {
      px(ctx, x - 2, y - 1, 2, 1, '#241a30');
      px(ctx, x + 3, y - 1, 2, 1, '#241a30');
    } else {
      px(ctx, x - 1, y + 1, 2, 1, '#241a30');
      px(ctx, x + 2, y + 1, 2, 1, '#241a30');
    }
  }

  function drawDustMotes(ctx, t) {
    for (var k = 0; k < 4; k++) {
      var rise = (t * 6 + k * 9) % 40;
      var sx = 100 + k * 30 + Math.sin(t * 1.1 + k) * 10;
      ctx.globalAlpha = Math.max(0, 0.30 - rise * 0.008);
      px(ctx, Math.round(sx), Math.round(160 - rise), 1, 1, '#e8d8a8');
      ctx.globalAlpha = 1;
    }
  }

  function drawDivider(ctx, t) {
    var pulse = 0.5 + 0.5 * Math.sin(t * 2);
    ctx.globalAlpha = 0.20 + 0.15 * pulse;
    px(ctx, 168, 128, 2, 46, '#a26bd4');
    ctx.globalAlpha = 1;
  }

  function drawTimeShimmer(ctx, t, S) {
    if (sealInState(S, 'handoff')) return;
    var sweepX = ((t * 46) % 420) - 60;
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#eaffff';
    ctx.fillRect(sweepX, 30, 26, 150);
    ctx.restore();
  }

  function drawProgressPips(ctx, t, S) {
    var sealed = sealInState(S, 'handoff');
    var count = sealed ? 6 : Math.min(6, thawCount);
    var startX = 160 - (6 * 10) / 2;
    for (var i = 0; i < 6; i++) {
      var px_ = startX + i * 10;
      var filled = i < count;
      if (filled) {
        ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 4 + i);
        px(ctx, px_, 3, 6, 6, '#ffd166');
        ctx.globalAlpha = 1;
      } else {
        px(ctx, px_, 3, 6, 6, '#2a3a4c');
      }
      px(ctx, px_, 3, 6, 1, '#8fb0c9');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Characters                                                         */
  /* ------------------------------------------------------------------ */

  function drawZusman(ctx, t, S) {
    var sealed = sealInState(S, 'handoff');
    var x = 100, yFeet = 156;
    var legsWarm = sealed || thawCount >= 1;
    var torsoWarm = sealed || thawCount >= 2;
    var armWarm = sealed || thawCount >= 3;

    ctx.globalAlpha = 0.22;
    px(ctx, x - 7, yFeet - 1, 14, 2, '#000000');
    ctx.globalAlpha = 1;

    // legs
    px(ctx, x - 5, yFeet - 14, 4, 14, '#5a4a3a');
    px(ctx, x + 2, yFeet - 14, 4, 14, '#5a4a3a');
    if (!legsWarm) tintIcy(ctx, x - 6, yFeet - 14, 13, 14);

    // torso: worn patched robe
    px(ctx, x - 7, yFeet - 32, 15, 20, '#7a6a52');
    px(ctx, x - 7, yFeet - 32, 15, 3, '#8a7a62');
    px(ctx, x - 3, yFeet - 24, 4, 6, '#5a4a3a');
    if (!torsoWarm) tintIcy(ctx, x - 7, yFeet - 32, 15, 20);

    // head + kerchief
    px(ctx, x - 4, yFeet - 40, 9, 8, '#d9a878');
    px(ctx, x - 4, yFeet - 42, 9, 3, '#4a3a2a');
    if (sealed || armWarm) {
      px(ctx, x - 1, yFeet - 36, 1, 1, '#2a1a10');
      px(ctx, x + 3, yFeet - 36, 1, 1, '#2a1a10');
      px(ctx, x, yFeet - 34, 3, 1, '#8a4a4a'); // relaxed smile
    } else {
      px(ctx, x - 1, yFeet - 36, 2, 1, '#2a1a10'); // stiff, wide frozen eyes
      px(ctx, x + 3, yFeet - 36, 2, 1, '#2a1a10');
    }
    if (!armWarm) tintIcy(ctx, x - 4, yFeet - 42, 9, 10);

    if (sealed) {
      // relaxed pose: arm resting at the side, jug handed over.
      px(ctx, x + 6, yFeet - 28, 4, 12, '#7a6a52');
    } else {
      // reaching arm frozen mid-motion toward the threshold
      var reachLen = 42;
      px(ctx, x + 7, yFeet - 30, reachLen, 4, '#7a6a52');
      px(ctx, x + 7 + reachLen - 4, yFeet - 31, 5, 6, '#d9a878');
      if (!armWarm) {
        tintIcy(ctx, x + 6, yFeet - 31, reachLen + 5, 6);
        drawFreezeShimmer(ctx, t, x + 8 + reachLen, yFeet - 28, 0.4);
      }
    }
  }

  function drawTodros(ctx, t, S) {
    var sealed = sealInState(S, 'handoff');
    var x = 224, yFeet = 150;
    var legsWarm = sealed || thawCount >= 4;
    var torsoWarm = sealed || thawCount >= 5;
    var armWarm = sealed || thawCount >= 6;

    ctx.globalAlpha = 0.22;
    px(ctx, x - 7, yFeet - 1, 14, 2, '#000000');
    ctx.globalAlpha = 1;

    // legs
    px(ctx, x - 5, yFeet - 14, 4, 14, '#1f5f70');
    px(ctx, x + 2, yFeet - 14, 4, 14, '#1f5f70');
    if (!legsWarm) tintIcy(ctx, x - 6, yFeet - 14, 13, 14);

    // torso: fine homeowner robe with gold trim
    px(ctx, x - 8, yFeet - 33, 16, 21, '#2e7a8c');
    px(ctx, x - 8, yFeet - 33, 16, 3, '#3f9cb0');
    px(ctx, x - 8, yFeet - 15, 16, 2, '#d4a017');
    if (!torsoWarm) tintIcy(ctx, x - 8, yFeet - 33, 16, 21);

    // head
    px(ctx, x - 4, yFeet - 41, 9, 8, '#e8c8a0');
    px(ctx, x - 4, yFeet - 43, 9, 3, '#2a1a14');
    if (sealed || armWarm) {
      px(ctx, x - 1, yFeet - 37, 1, 1, '#241a14');
      px(ctx, x + 3, yFeet - 37, 1, 1, '#241a14');
      px(ctx, x, yFeet - 35, 3, 1, '#8a4a4a');
    } else {
      px(ctx, x - 1, yFeet - 37, 2, 1, '#241a14');
      px(ctx, x + 3, yFeet - 37, 2, 1, '#241a14');
    }
    if (!armWarm) tintIcy(ctx, x - 4, yFeet - 43, 9, 10);

    if (sealed) {
      px(ctx, x - 10, yFeet - 29, 4, 12, '#2e7a8c');
    } else {
      // reaching arm frozen toward the threshold (mirrored, points left)
      var reachLen = 46;
      px(ctx, x - 7 - reachLen, yFeet - 31, reachLen, 4, '#2e7a8c');
      px(ctx, x - 7 - reachLen, yFeet - 32, 5, 6, '#e8c8a0');
      if (!armWarm) {
        tintIcy(ctx, x - 12 - reachLen, yFeet - 32, reachLen + 6, 6);
        drawFreezeShimmer(ctx, t, x - 9 - reachLen, yFeet - 29, 2.1);
      }
    }
  }

  function drawJugAndThreshold(ctx, t, S) {
    drawDivider(ctx, t);
    var sealed = sealInState(S, 'handoff');
    var x = 165, y = 140;
    if (sealed) {
      // resting safely on the doorstep, transfer complete
      px(ctx, x - 3, y - 8, 6, 8, '#8a6a4a');
      px(ctx, x - 2, y - 10, 4, 2, '#6a4a34');
      glow(ctx, x, y - 8, 9, '#ffd166', 0.08 + 0.04 * Math.sin(t * 3));
      return;
    }
    px(ctx, x - 3, y - 8, 6, 8, '#8a6a4a');
    px(ctx, x - 2, y - 10, 4, 2, '#6a4a34');
    px(ctx, x + 3, y - 9, 2, 3, '#6a4a34');
    tintIcy(ctx, x - 4, y - 11, 10, 11);
    drawFreezeShimmer(ctx, t, x, y - 9, 1.1);
    for (var i = 0; i < 3; i++) {
      var ang = t * 1.6 + i * (Math.PI * 2 / 3);
      var ox = x + Math.cos(ang) * 8;
      var oy = (y - 9) + Math.sin(ang) * 4;
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 5 + i);
      px(ctx, Math.round(ox), Math.round(oy), 1, 1, '#eaffff');
      ctx.globalAlpha = 1;
    }
  }

  /* ------------------------------------------------------------------ */
  /* The quiz — six rounds, shuffled, resumable, guarded against        */
  /* double-start since two hotspots (zusman + todros) can both open it.*/
  /* ------------------------------------------------------------------ */

  function ensureQuizOrder() {
    if (!quizOrder) {
      quizOrder = shuffled(MISHNAH_CASES);
      quizIndex = 0;
    }
  }

  async function finalizeHandoff(g) {
    g.sfx('magic');
    await g.say('רגע... אני... אני מרגיש את כל היד!', { who: 'zusman', color: '#e8d8a8' });
    await g.say('גם אני! מְחִיצַת הָרְשֻׁיּוֹת זזה!', { who: 'todros', color: '#c9c9ee' });
    await g.wait(300);
    await g.say('(שתי הידיים משלימות את התנועה שנתקעה מזמן — הכד עובר, סוף־סוף, מיד ליד.)', { x: 165, y: 118, color: '#ffe9a8' });
    g.sfx('click');
    await g.say('קיבלת! עברתי לך את הכד. עכשיו זה שלך — ואני חייב על זה, כי עשיתי את כל הפעולה לבד.', { who: 'zusman', color: '#e8d8a8' });
    await g.say('מי שעשה את המלאכה בשלמות — הוא חייב. אני או הוא. לא שנינו יחד.', { who: 'todros', color: '#c9c9ee' });
    await g.say('חחח... קפאתי שלוש שעות בגלל שאלה של רשות. סיפור טוב לחתונה.', { who: 'zusman', color: '#e8d8a8' });
    g.sfx('seal');
    g.addSeal('handoff', 'חותם המשא ומתן');
    await g.playerSay('חותם המשא ומתן! עכשיו מובן לי: מי שמבצע את כל הפעולה לבדו — הוא האחראי. וכשמתחלקים באמצע — שניהם פטורים.');
  }

  async function runQuiz(g) {
    ensureQuizOrder();
    g.sfx('quiz');
    if (quizIndex === 0 && thawCount === 0) {
      await g.say('טוב... בואו ננסה להבין מה קפא כאן. שש שאלות, אחת אחרי השנייה.', { who: 'zusman', color: '#e8d8a8' });
      await g.say('כן. תשובה נכונה — ואני מרגיש עוד קצת מהיד שלי.', { who: 'todros', color: '#c9c9ee' });
    } else if (quizIndex < quizOrder.length) {
      await g.say('אז איפה עצרנו... בואו נמשיך.', { who: 'zusman', color: '#e8d8a8' });
    }
    while (quizIndex < quizOrder.length) {
      var item = quizOrder[quizIndex];
      var speaker = (quizIndex % 2 === 0) ? 'zusman' : 'todros';
      var speakerColor = (speaker === 'zusman') ? '#e8d8a8' : '#c9c9ee';
      var solved = false;
      while (!solved) {
        await g.say(item.setup, { who: speaker, color: speakerColor });
        var opts = shuffled(QUIZ_OPTIONS);
        var ans = await g.choose(opts);
        if (ans === item.correct) {
          solved = true;
          thawCount = Math.min(6, thawCount + 1);
          safeSfx(thawCount % 2 === 0 ? 'click' : 'magic');
          await g.say(pick(RIGHT_INTROS) + ' ' + item.explain, { who: speaker, color: speakerColor });
        } else {
          g.sfx('fail');
          await g.say(pick(WRONG_LINES), { who: speaker, color: '#8fb0c9' });
        }
      }
      quizIndex++;
    }
    await finalizeHandoff(g);
  }

  async function startOrResumeQuiz(g) {
    if (hasSealSafe(g, 'handoff')) return;
    if (g.flag('handoffQuizActive')) return; // already mid-run; do not stack a second instance
    g.flag('handoffQuizActive', true);
    try {
      await g.cutscene(function (gg) { return runQuiz(gg); });
    } finally {
      g.flag('handoffQuizActive', false);
    }
  }

  async function useDafHint(g) {
    if (hasSealSafe(g, 'handoff')) {
      await g.playerSay('כבר פתרנו את זה יחד. תודה, דף — אבל כבר לא צריך אותך כאן.');
      return;
    }
    await g.playerSay('«יְצִיאוֹת הַשַּׁבָּת, שְׁתַּיִם שֶׁהֵן אַרְבַּע בִּפְנִים, וּשְׁתַּיִם שֶׁהֵן אַרְבַּע בַּחוּץ.»');
    await g.playerSay('הכלל: מי שעשה את כל הפעולה — גם הושיט וגם הניח או נטל — הוא חייב. אם השניים חילקו את הפעולה ביניהם, שניהם פטורים. זה לא פותר לי את השאלה, אבל זה כיוון.');
  }

  /* ------------------------------------------------------------------ */
  /* Scene definition                                                   */
  /* ------------------------------------------------------------------ */

  window.GAME.registerScene('courtyard', {

    name: 'הַמָּבוֹי הַקָּפוּא',

    floor: { yMin: 132, yMax: 172 },

    paint: function (ctx, t, S) {
      try {
        paintSky(ctx);
        paintStreetSide(ctx);
        paintHouseSide(ctx);
        paintThresholdStatic(ctx);
        paintDecor(ctx);
        drawStars(ctx, t);
        drawLantern(ctx, t);
        drawWindowCandle(ctx, t);
        drawBird(ctx, t);
        drawDustMotes(ctx, t);
        drawTimeShimmer(ctx, t, S);
        drawProgressPips(ctx, t, S);
      } catch (err) {
        px(ctx, 0, 0, 320, 180, '#241a30');
        if (!window.__courtyardPaintWarned) {
          window.__courtyardPaintWarned = true;
          if (window.console && console.warn) console.warn('courtyard paint error:', err);
        }
      }
    },

    onEnter: async function (g) {
      try {
        if (!g.flag('courtyardEntered')) {
          g.flag('courtyardEntered', true);
          await g.playerSay('שני אנשים קפואים באמצע מסירת חפץ. זה... לא נורמלי, גם בערב שבת.');
        }
      } catch (err) { /* never crash on entry */ }
    },

    hotspots: [

      /* ---------------- Zusman the poor person (outside) ---------------- */
      {
        id: 'zusman',
        name: 'העני זוסמן',
        type: 'char',
        x: 82, y: 112, w: 68, h: 46,
        walkTo: { x: 112, y: 162 },

        draw: function (ctx, t, S) {
          try { drawZusman(ctx, t, S); } catch (err) { /* fail silent */ }
        },

        look: async function (g) {
          if (hasSealSafe(g, 'handoff')) {
            await g.playerSay('זוסמן עומד רגוע ברחוב, כאילו לא היה קפוא כאן שעה שלמה.');
            return;
          }
          await g.playerSay('אדם קפוא באמצע תנועה, יד מושטת פנימה, עיניים פעורות. משהו כאן תקוע — ולא רק היד.');
        },

        talk: async function (g) {
          if (hasSealSafe(g, 'handoff')) {
            await g.say(pick(ZUSMAN_EPILOGUE), { who: 'zusman', color: '#e8d8a8' });
            return;
          }
          if (!g.flag('zusmanFrozenIntroDone')) {
            g.flag('zusmanFrozenIntroDone', true);
            await g.say('קר... לי... בַּיָּד...', { who: 'zusman', color: '#e8d8a8' });
            await g.playerSay('אתה... קפוא? באמצע להושיט יד?');
            await g.say('משהו נתקע — מְחִיצַת הָרְשֻׁיּוֹת. תעזור לי להבין מה קרה כאן, ואולי זה ישחרר אותי.', { who: 'zusman', color: '#e8d8a8' });
          }
          await startOrResumeQuiz(g);
        },

        take: async function (g) {
          await g.playerSay('לקחת אדם קפוא? גם בלי מגבלות רשות, זה פשוט לא מנומס.');
        },

        use: async function (g, itemId) {
          if (itemId === 'daf') { await useDafHint(g); return; }
          await g.playerSay('זוסמן קפוא. הוא לא ממש יכול להשתמש בזה כרגע.');
        }
      },

      /* ---------------- Todros the homeowner (inside) ---------------- */
      {
        id: 'todros',
        name: 'בעל הבית תודרוס',
        type: 'char',
        x: 190, y: 108, w: 66, h: 46,
        walkTo: { x: 205, y: 162 },

        draw: function (ctx, t, S) {
          try { drawTodros(ctx, t, S); } catch (err) { /* fail silent */ }
        },

        look: async function (g) {
          if (hasSealSafe(g, 'handoff')) {
            await g.playerSay('תודרוס עומד בפתח ביתו, מרוצה, כאילו תמיד ידע איך זה ייגמר.');
            return;
          }
          await g.playerSay('בעל בית מהודר, קפוא בפתח הבית, יד מושטת החוצה. חליפת שבת, הבעה תקועה.');
        },

        talk: async function (g) {
          if (hasSealSafe(g, 'handoff')) {
            await g.say(pick(TODROS_EPILOGUE), { who: 'todros', color: '#c9c9ee' });
            return;
          }
          if (!g.flag('todrosFrozenIntroDone')) {
            g.flag('todrosFrozenIntroDone', true);
            await g.say('אני... מוכן... לקבל... אבל... הַיָּד... לֹא... זָזָה...', { who: 'todros', color: '#c9c9ee' });
            await g.playerSay('גם אתה קפוא? זה בדיוק כמו זוסמן שם בחוץ.');
            await g.say('שנינו נתקענו באותו הרגע — בדיוק כשהחפץ עבר בין הרשויות. תעזור לנו להבין למי מבינינו יש בכלל אחריות כאן.', { who: 'todros', color: '#c9c9ee' });
          }
          await startOrResumeQuiz(g);
        },

        take: async function (g) {
          await g.playerSay('גם אם הוא קפוא, זה עדיין ביתו. גבולות, זרח. גבולות.');
        },

        use: async function (g, itemId) {
          if (itemId === 'daf') { await useDafHint(g); return; }
          await g.playerSay('תודרוס קפוא. גם הוא לא יכול להשתמש בזה כרגע.');
        }
      },

      /* ---------------- The threshold itself (object; hint + jug) ---------------- */
      {
        id: 'threshold',
        name: 'סף הדלת',
        type: 'object',
        x: 148, y: 62, w: 44, h: 84,
        walkTo: { x: 168, y: 165 },

        draw: function (ctx, t, S) {
          try { drawJugAndThreshold(ctx, t, S); } catch (err) { /* fail silent */ }
        },

        look: async function (g) {
          await g.playerSay('הסף עצמו: מימין — קירות גבוהים מ־10 טפחים, בית סגור וממש — רְשׁוּת הַיָּחִיד.');
          await g.playerSay('משמאל — רחוב פתוח, בלי מחיצות — רְשׁוּת הָרַבִּים. הגבול ביניהם עובר בדיוק כאן, מתחת לכד הקפוא.');
        },

        take: async function (g) {
          await g.playerSay('לקחת סף דלת? אין לי כלים לזה, ואין לי גם רשות.');
        },

        use: async function (g, itemId) {
          if (itemId === 'daf') { await useDafHint(g); return; }
          await g.playerSay('הסף לא זז, ולא צריך שישתמשו בו. הוא כבר עושה עבודה קשה מספיק בתור גבול.');
        }
      },

      /* ---------------- Exit back to the square ---------------- */
      {
        id: 'exit_square',
        name: 'חזרה לכיכר',
        type: 'exit',
        x: 0, y: 100, w: 18, h: 72,
        walkTo: { x: 12, y: 158 },
        target: 'square',
        spawn: { x: 150, y: 150 },

        look: async function (g) {
          await g.playerSay('הדרך חזרה לכיכר הכפר. השמש עוד ממשיכה לשקוע — אין זמן לבזבז.');
        }
      }
    ]
  });

})();
