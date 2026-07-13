'use strict';
/*
 * Scene: roof — "עֲלִיַּת הַגַּג / גַּג הַכְּפָר" (The Village Roof)
 * DAF QUEST — Shabbat 2a-2b. Item scene (no formal seal).
 * Click-to-classify puzzle: one correct מקום פטור ledge (tiny, raised/set
 * apart from any surrounding domain) among 2-3 decoy ledges (each failing a
 * different, specific rule from the four-domains content sheet). The cat
 * עוקצין sits on the correct ledge and approves on success -> g.give('paturseal').
 * Owns ONLY this file. Registers via GAME.registerScene('roof', {...}).
 */
(function () {
  if (!window.GAME || typeof window.GAME.registerScene !== 'function') {
    if (window.console && console.warn) console.warn('roof.js: GAME.registerScene unavailable, scene not registered');
    return;
  }

  // ---------------------------------------------------------------------
  // Palette (dusk / erev Shabbat — warm gold-rose sky, violet only at edges)
  // ---------------------------------------------------------------------
  var SKY_TOP = '#2a1740';    // deepest violet, zenith
  var SKY_VIOLET = '#3a2050';
  var SKY_ROSE = '#7a3d5c';
  var SKY_GOLD = '#d97a4a';
  var SKY_HORIZON = '#ffb347';
  var STONE_D = '#4a4a68', STONE_M = '#6b6b8f', STONE_L = '#8f8fb0';
  var WOOD_D = '#5a3a24', WOOD_L = '#7a512f';
  var AMBER = '#ffd166', AMBER2 = '#ffb347', AMBER3 = '#ff8c42';
  var PARCH = '#e8d8a8';
  var VILLAGE_SIL = '#241432';

  // ---------------------------------------------------------------------
  // Small defensive drawing helpers (SPRITES used when present, else fallback)
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
      ctx.globalAlpha = alpha * (0.4 - i * 0.1 + 0.15);
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

  function flags(S) { return (S && S.flags) || {}; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function hasSealSafe(g, id) {
    try { return !!(g && typeof g.hasSeal === 'function' && g.hasSeal(id)); }
    catch (e) { return false; }
  }

  function catchGive(g) {
    try { g.give('paturseal'); } catch (e) { /* fail silent */ }
  }

  // Defensive read of the puzzle-completion flag — never throws even if the
  // engine global isn't ready yet (e.g. called from a stray draw call).
  function paturDone() {
    try { return !!(window.GAME && window.GAME.state && window.GAME.state.flags && window.GAME.state.flags.roofPaturDone); }
    catch (e) { return false; }
  }

  // ---------------------------------------------------------------------
  // STATIC-ISH LAYERS (drawn every frame, but content barely changes)
  // ---------------------------------------------------------------------

  function paintSky(ctx, t) {
    px(ctx, 0, 0, 320, 14, SKY_TOP);
    dither(ctx, 0, 14, 320, 4, SKY_TOP, SKY_VIOLET);
    px(ctx, 0, 18, 320, 20, SKY_VIOLET);
    dither(ctx, 0, 38, 320, 4, SKY_VIOLET, SKY_ROSE);
    px(ctx, 0, 42, 320, 18, SKY_ROSE);
    dither(ctx, 0, 60, 320, 4, SKY_ROSE, SKY_GOLD);
    px(ctx, 0, 64, 320, 14, SKY_GOLD);
    dither(ctx, 0, 78, 320, 4, SKY_GOLD, SKY_HORIZON);
    px(ctx, 0, 82, 320, 10, SKY_HORIZON);

    // slow "sun still sinking" pulse along the horizon band — time is running out
    ctx.save();
    ctx.globalAlpha = 0.10 + 0.05 * Math.sin(t * 0.5);
    px(ctx, 0, 78, 320, 16, SKY_HORIZON);
    ctx.restore();

    // a faint early moon rising at the violet edge (dusk, not full night yet)
    ctx.save();
    ctx.globalAlpha = 0.5;
    if (window.SPRITES && typeof SPRITES.moon === 'function') {
      try { SPRITES.moon(ctx, 300, 20, 0.55); } catch (e) { px(ctx, 296, 14, 9, 9, '#cfc3e0'); }
    } else {
      px(ctx, 296, 14, 9, 9, '#cfc3e0');
    }
    ctx.restore();

    // first faint stars, only near the top where violet is deepest
    for (var i = 0; i < 6; i++) {
      var sx = 10 + (i * 53) % 300;
      var sy = 3 + (i * 17) % 12;
      twinkle(ctx, sx, sy, t + i * 1.3, 1, '#e8e0f0');
    }
  }

  function paintVillageSilhouette(ctx, t) {
    px(ctx, 0, 84, 320, 12, VILLAGE_SIL);
    px(ctx, 4, 76, 20, 10, VILLAGE_SIL);
    px(ctx, 40, 80, 34, 8, VILLAGE_SIL);
    px(ctx, 60, 74, 12, 8, VILLAGE_SIL);   // little tower
    px(ctx, 168, 79, 40, 9, VILLAGE_SIL);
    px(ctx, 186, 73, 10, 8, VILLAGE_SIL);
    // distant lit windows, flickering candles — echoes the square's sight gag
    var wins = [[10, 79], [48, 82], [64, 76], [176, 81], [192, 76]];
    for (var i = 0; i < wins.length; i++) {
      var fl = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.9);
      ctx.save();
      ctx.globalAlpha = fl;
      ctx.fillStyle = i % 2 === 0 ? AMBER : AMBER2;
      ctx.fillRect(wins[i][0], wins[i][1], 1, 2);
      ctx.restore();
    }
  }

  function paintParapet(ctx) {
    px(ctx, 0, 94, 320, 3, STONE_L);
    px(ctx, 0, 97, 320, 1, STONE_D);
    px(ctx, 0, 98, 320, 12, STONE_M);
    ctx.fillStyle = STONE_D;
    for (var row = 0; row < 2; row++) {
      var yy = 98 + row * 6 + 5;
      ctx.fillRect(0, yy, 320, 1);
      for (var xx = (row % 2) * 8; xx < 320; xx += 16) ctx.fillRect(xx, 98 + row * 6, 1, 5);
    }
    // stair opening (matches the exit hotspot, left side)
    px(ctx, 0, 92, 26, 18, '#1c1030');
    px(ctx, 24, 92, 2, 18, STONE_L);
  }

  function paintFloor(ctx) {
    px(ctx, 0, 108, 320, 72, STONE_D);
    ctx.fillStyle = '#3d3d58';
    for (var yy = 116; yy < 180; yy += 10) ctx.fillRect(0, yy, 320, 1);
    var r = 0;
    for (var y2 = 108; y2 < 180; y2 += 10) {
      for (var x2 = (r % 2) * 12; x2 < 320; x2 += 24) ctx.fillRect(x2, y2, 1, 10);
      r++;
    }
    px(ctx, 60, 138, 12, 9, '#565678');
    px(ctx, 190, 150, 12, 9, '#565678');
    px(ctx, 150, 162, 12, 9, '#565678');
    glow(ctx, 40, 150, 20, SKY_HORIZON, 0.04);
  }

  function paintStairsExit(ctx, t) {
    px(ctx, 2, 92, 22, 4, STONE_L);
    px(ctx, 4, 96, 20, 4, STONE_M);
    px(ctx, 6, 100, 18, 4, '#5c5c80');
    px(ctx, 8, 104, 16, 4, STONE_D);
    var fl = 0.7 + 0.3 * Math.sin(t * 9 + 1);
    ctx.save();
    ctx.globalAlpha = fl;
    px(ctx, 30, 84, 2, 3, AMBER);
    ctx.restore();
    glow(ctx, 31, 86, 8, AMBER, 0.1 * fl);
  }

  // ---------------------------------------------------------------------
  // Decoy 1: the wide walled platform (רשות היחיד-ish — too big, enclosed)
  // ---------------------------------------------------------------------
  function paintWidePlatform(ctx, t) {
    // low stone rim ("walls" — the enclosure that makes this a real domain)
    px(ctx, 14, 104, 90, 6, STONE_M);
    px(ctx, 14, 104, 90, 2, STONE_L);
    // flat top surface, roomy
    px(ctx, 18, 110, 82, 22, '#5c5c80');
    ctx.fillStyle = '#4d4d70';
    for (var i = 0; i < 6; i++) ctx.fillRect(18 + i * 14, 110, 1, 22);
    // a forgotten prayer stool on it (flavor, purely visual)
    px(ctx, 76, 118, 8, 8, WOOD_D);
    px(ctx, 77, 116, 6, 2, WOOD_L);
    // faint dust motes drifting, sunset-lit
    for (var k = 0; k < 2; k++) {
      var dph = (t * 0.3 + k * 0.5) % 1;
      ctx.save();
      ctx.globalAlpha = 0.2 * (1 - dph);
      px(ctx, 40 + k * 20, 108 - dph * 6, 1, 1, AMBER2);
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------------
  // Decoy 2: the low outer ledge (כרמלית-ish — not raised, not enclosed)
  // ---------------------------------------------------------------------
  function paintLowLedge(ctx, t) {
    px(ctx, 282, 118, 34, 5, STONE_M);
    px(ctx, 282, 118, 34, 1, STONE_L);
    px(ctx, 284, 123, 30, 9, '#5c5c80');
    // it juts out past the parapet line, exposed to the open street below
    px(ctx, 296, 128, 12, 4, '#3d3d58');
    // a stray loose brick teetering at the edge, swaying with the wind
    var wob = Math.round(Math.sin(t * 1.4) * 1);
    px(ctx, 292 + wob, 122, 4, 3, STONE_D);
    // dry weeds growing in the crack — nobody maintains an unwalled ledge
    px(ctx, 306, 120, 1, 3, '#3f6d3f');
    px(ctx, 308, 121, 1, 2, '#2f5a2f');
  }

  // ---------------------------------------------------------------------
  // Decoy 3: the ordinary dormer window sill (flush with the room's wall)
  // ---------------------------------------------------------------------
  function paintWindowSill(ctx, t) {
    // small gabled structure rising from the roof (a room built onto it)
    px(ctx, 100, 66, 50, 38, STONE_M);
    px(ctx, 100, 66, 50, 2, STONE_L);
    // roof peak
    px(ctx, 96, 60, 58, 8, WOOD_D);
    px(ctx, 96, 60, 58, 2, WOOD_L);
    // window frame + sill, ordinary size, flush against the wall
    px(ctx, 112, 76, 26, 22, WOOD_D);
    px(ctx, 114, 78, 22, 18, '#141428');
    dither(ctx, 114, 78, 22, 10, '#141428', '#232345');
    px(ctx, 110, 98, 30, 3, WOOD_L); // sill, projecting only slightly — flush
    // faint warm light seeping from inside the room (still someone's private space)
    ctx.save();
    ctx.globalAlpha = 0.08 + 0.03 * Math.sin(t * 5);
    px(ctx, 114, 78, 22, 18, AMBER3);
    ctx.restore();
    // shutter, half-open, creaking gently
    var creak = Math.sin(t * 0.8) * 1.2;
    px(ctx, 108 + creak, 78, 3, 18, WOOD_L);
  }

  // ---------------------------------------------------------------------
  // The chimney (flavor structure) + the correct מקום פטור ledge on it
  // ---------------------------------------------------------------------
  function paintChimney(ctx, t) {
    px(ctx, 250, 38, 26, 68, STONE_M);
    px(ctx, 250, 38, 26, 2, STONE_L);
    ctx.fillStyle = STONE_D;
    for (var yy = 46; yy < 106; yy += 10) ctx.fillRect(250, yy, 26, 1);
    px(ctx, 248, 96, 30, 10, STONE_D); // base, wider, sits on the roof
    // chimney pot
    px(ctx, 258, 30, 10, 10, WOOD_D);
    px(ctx, 259, 29, 8, 2, '#3a2414');
    // smoke wisps rising — erev Shabbat cooking still finishing up
    for (var s = 0; s < 3; s++) {
      var sph = (t * 0.28 + s * 0.34) % 1;
      var sy = 30 - sph * 26;
      var sx = 263 + Math.sin(t * 1.2 + s * 2) * 3;
      ctx.save();
      ctx.globalAlpha = 0.26 * (1 - sph);
      px(ctx, sx, sy, 3, 2, '#c9c0d0');
      ctx.restore();
    }
  }

  // The small isolated ledge — raised well above the roof floor, tiny,
  // set apart from the chimney body itself (this is the correct answer).
  var LEDGE = { x: 236, y: 74, w: 12, h: 8 };

  function paintPaturLedge(ctx, t, S) {
    var solved = !!flags(S).roofPaturDone;
    // small bracket connecting it to the chimney — visibly thin, not a wall
    px(ctx, 244, 78, 6, 2, STONE_D);
    // the ledge itself — small stone tab, clearly under any domain size
    px(ctx, LEDGE.x, LEDGE.y, LEDGE.w, LEDGE.h, solved ? '#8f8fb0' : STONE_L);
    px(ctx, LEDGE.x, LEDGE.y, LEDGE.w, 2, '#c9c9dc');
    if (solved) {
      // a small parchment tag now tied to it, fluttering — the paturseal
      var flut = Math.sin(t * 3) * 1.2;
      px(ctx, LEDGE.x + LEDGE.w + 1, LEDGE.y + 1 + flut, 5, 4, PARCH);
      px(ctx, LEDGE.x + LEDGE.w, LEDGE.y + 2, 1, 2, WOOD_D);
      glow(ctx, LEDGE.x + 4, LEDGE.y + 3, 8, AMBER, 0.12 + 0.05 * Math.sin(t * 4));
    } else {
      glow(ctx, LEDGE.x + 4, LEDGE.y + 3, 5, '#ffffff', 0.06 + 0.03 * Math.sin(t * 3));
    }
  }

  // ---------------------------------------------------------------------
  // Uktzin the cat — sits on the correct ledge, tail swish, ear twitch, blink
  // ---------------------------------------------------------------------
  function drawCat(ctx, t, S) {
    var solved = !!flags(S).roofPaturDone;
    var cx = LEDGE.x + LEDGE.w / 2, cy = LEDGE.y; // feet anchor, sitting on the ledge
    var bob = Math.sin(t * 1.6) * 0.6;
    var tailSwish = Math.round(Math.sin(t * 2.1) * 3);
    var earTwitch = Math.sin(t * 3.4) > 0.85;
    var blink = (t % 4) < 0.12;

    // tail, curls around the feet, flicks
    px(ctx, cx - 7, cy - 2 + tailSwish * 0.3, 2, 5, '#4a4a5a');
    px(ctx, cx - 9, cy - 4 + tailSwish, 2, 2, '#4a4a5a');

    // body, sitting pose (compact)
    px(ctx, cx - 5, Math.round(cy - 9 + bob), 10, 8, '#5c5c72');
    px(ctx, cx - 5, Math.round(cy - 2 + bob), 10, 2, '#4a4a5a');

    // head
    px(ctx, cx - 4, Math.round(cy - 15 + bob), 8, 7, '#5c5c72');
    // ears (one twitches)
    px(ctx, cx - 4, Math.round(cy - 17 + bob) - (earTwitch ? 1 : 0), 2, 3, '#4a4a5a');
    px(ctx, cx + 2, Math.round(cy - 17 + bob), 2, 3, '#4a4a5a');
    px(ctx, cx - 3, Math.round(cy - 16 + bob) - (earTwitch ? 1 : 0), 1, 1, '#e8a0b0');
    px(ctx, cx + 3, Math.round(cy - 16 + bob), 1, 1, '#e8a0b0');
    // eyes — green, blink occasionally
    if (blink) {
      px(ctx, cx - 3, Math.round(cy - 12 + bob), 2, 1, '#2a2a38');
      px(ctx, cx + 1, Math.round(cy - 12 + bob), 2, 1, '#2a2a38');
    } else {
      px(ctx, cx - 3, Math.round(cy - 13 + bob), 2, 2, solved ? '#c8ffb0' : '#8fd08f');
      px(ctx, cx + 1, Math.round(cy - 13 + bob), 2, 2, solved ? '#c8ffb0' : '#8fd08f');
    }
    // whiskers
    ctx.save();
    ctx.globalAlpha = 0.6;
    px(ctx, cx - 8, Math.round(cy - 11 + bob), 3, 1, '#d8d8e8');
    px(ctx, cx + 5, Math.round(cy - 11 + bob), 3, 1, '#d8d8e8');
    ctx.restore();
    // proud little sparkle once the ledge is solved
    if (solved && Math.sin(t * 3) > 0.7) px(ctx, cx + 6, Math.round(cy - 18 + bob), 1, 1, '#ffffff');
  }

  // ---------------------------------------------------------------------
  // Flavor: laundry line strung between the parapet and the gable
  // ---------------------------------------------------------------------
  function drawLaundryLine(ctx, t) {
    ctx.save();
    ctx.strokeStyle = '#3a3a55';
    ctx.beginPath();
    ctx.moveTo(150, 62);
    ctx.quadraticCurveTo(200, 70, 246, 60);
    ctx.stroke();
    ctx.restore();
    var sway1 = Math.round(Math.sin(t * 2.2) * 1);
    var sway2 = Math.round(Math.sin(t * 2.2 + 1.3) * 1);
    px(ctx, 178 + sway1, 62, 4, 6, '#1f7a8c');  // small towel
    px(ctx, 210 - sway2, 63, 5, 5, PARCH);      // drying cloth
    px(ctx, 210 - sway2, 63, 5, 1, '#c9b48a');
  }

  // ---------------------------------------------------------------------
  // Flavor: sleeping pigeon on the parapet, breathing
  // ---------------------------------------------------------------------
  function drawPigeon(ctx, t) {
    var breathe = Math.sin(t * 2.5) > 0 ? 1 : 0;
    px(ctx, 66, 92 - breathe, 6, 4 + breathe, '#9a9ab8');
    px(ctx, 71, 91, 2, 2, '#8080a0');
    px(ctx, 73, 92, 1, 1, AMBER2);
  }

  // ---------------------------------------------------------------------
  // Puzzle handlers
  // ---------------------------------------------------------------------

  var DECOY_LINES = {
    wide: 'גדול מדי. זו כבר רשות של ממש — יותר מארבעה על ארבעה טפחים, ומוקפת מחיצה. רשות היחיד, לא מקום פטור.',
    low: 'נמוך מדי. הוא לא מוגבה שלושה טפחים מהסביבה, וגם לא מוקף כראוי בקירות. זו כרמלית, לא מקום פטור.',
    window: 'צמוד לגמרי לקיר החדר. הוא לא מובדל שלושה טפחים מהרשות שמאחוריו — עדיין חלק מרשות היחיד של החדר.'
  };

  function decoyLook(kind, extra) {
    return async function (g) {
      try { g.sfx('fail'); } catch (e) { /* fail silent */ }
      await g.playerSay(DECOY_LINES[kind]);
      if (extra) await g.playerSay(extra);
    };
  }

  async function paturSuccess(g) {
    await g.cutscene(async function () {
      try { g.sfx('magic'); } catch (e) { /* fail silent */ }
      g.flag('roofPaturDone', true);
      await g.playerSay('רגע... זה קטן. וגבוה. ומנותק מהכל מסביב. זה בדיוק זה!');
      await g.say('מִיאוּ! מְקוֹם פָּטוּר מושלם: קטן מארבע על ארבע טפחים, ומובדל שלושה טפחים מכל הסביבה.', { who: 'uktzin', color: '#c8ffb0' });
      await g.say('לא רשות היחיד, לא רשות הרבים, לא כרמלית — סתם מקום משלו. תניח, תיקח, תעשה מה שבא לך.', { who: 'uktzin', color: '#c8ffb0' });
      catchGive(g);
      await g.playerSay('אישור מקום פטור. עוקצין חתם עליו באפס מאמץ — ממש בסגנון של חתול.');
    });
  }

  async function paturLook(g) {
    if (paturDone()) {
      await g.playerSay('עוקצין כבר אישר את המקום הזה. האישור בכיס שלי.');
      return;
    }
    await paturSuccess(g);
  }

  // ---------------------------------------------------------------------
  // Cat dialogue
  // ---------------------------------------------------------------------

  async function catTalk(g) {
    if (paturDone()) {
      await g.say(pick([
        'מִיאוּ. עבודה טובה. עכשיו תן לי לישון בשקט על ההישג שלי.',
        'האישור שלך תקף בכל מקום פטור בכפר, דרך אגב. תשמור עליו.',
        'מִיאוּ־רַאוּ. גם החתולים יודעים הלכה — פשוט לא מספרים לאף אחד.'
      ]), { who: 'uktzin', color: '#c8ffb0' });
      return;
    }
    if (!g.flag('roofCatMet')) {
      g.flag('roofCatMet', true);
      await g.say('מִיאוּ. אני עוקצין. כן, כמו המסכת. בכפר הזה קוראים לחתולים על שם מסכתות. אל תשאל למה.', { who: 'uktzin', color: '#c8ffb0' });
      await g.playerSay('נעים מאוד, עוקצין. אתה יושב במקום מוזר במיוחד.');
      await g.say('מוזר? זה המקום היחיד בגג שבאמת שלי. לא של אף רשות. תבין לבד — או תשאל.', { who: 'uktzin', color: '#c8ffb0' });
    }
    var talking = true;
    while (talking) {
      var choice = await g.choose([
        { text: 'מה זה בדיוק מקום פטור?', value: 'define' },
        { text: 'איפה כדאי לי לחפש?', value: 'hint' },
        { text: 'שלום, עוקצין.', value: 'meow' },
        { text: 'אני אמשיך לחפש לבד.', value: 'bye' }
      ]);
      if (choice === 'define') {
        await g.say('מקום פטור: קטן מארבע על ארבע טפחים, ומוגבה או מובדל שלושה טפחים לפחות מהסביבה שלו.', { who: 'uktzin', color: '#c8ffb0' });
        await g.say('קטן מדי בשביל להיות רשות בפני עצמו, ומרוחק מדי כדי להיחשב חלק מהרשות שלידו. פשוט לא שייך לאף אחד.', { who: 'uktzin', color: '#c8ffb0' });
      } else if (choice === 'hint') {
        await g.say('חפש משהו קטן. גבוה. בודד. לא מחובר לשום קיר של ממש, ולא נשען על שום רצפה רגילה.', { who: 'uktzin', color: '#c8ffb0' });
        await g.playerSay('קטן, גבוה, בודד. סומן.');
      } else if (choice === 'meow') {
        await g.say('מִיאוּ.', { who: 'uktzin', color: '#c8ffb0' });
        await g.playerSay('תרגום חופשי: "אני עוסק בהלכה, אל תפריע".');
      } else {
        await g.say('מִיאוּ. בהצלחה. אני לא זז מפה — ממילא אני כבר במקום הכי טוב בגג.', { who: 'uktzin', color: '#c8ffb0' });
        talking = false;
      }
    }
  }

  // ---------------------------------------------------------------------
  // Scene definition
  // ---------------------------------------------------------------------

  window.GAME.registerScene('roof', {
    name: 'עֲלִיַּת הַגַּג',
    floor: { yMin: 128, yMax: 168 },

    paint: function (ctx, t, S) {
      try {
        paintSky(ctx, t);
        paintVillageSilhouette(ctx, t);
        paintParapet(ctx);
        paintStairsExit(ctx, t);
        paintWindowSill(ctx, t);
        drawLaundryLine(ctx, t);
        drawPigeon(ctx, t);
        paintChimney(ctx, t);
        paintPaturLedge(ctx, t, S);
        paintWidePlatform(ctx, t);
        paintLowLedge(ctx, t);
        paintFloor(ctx);
      } catch (e) {
        px(ctx, 0, 0, 320, 180, SKY_VIOLET);
        if (!window.__roofPaintWarned) {
          window.__roofPaintWarned = true;
          if (window.console && console.warn) console.warn('roof paint error:', e);
        }
      }
    },

    onEnter: async function (g) {
      try {
        if (!g.flag('roofIntroDone')) {
          g.flag('roofIntroDone', true);
          await g.playerSay('גג הכפר, ממש לפני השקיעה הגמורה. אוויר קר, ואור זהוב שנעלם דקה אחר דקה.');
          await g.playerSay('אמרו לי שיש כאן מקום פטור אמיתי — מקום שלא שייך לאף רשות. רק צריך למצוא אותו.');
        }
      } catch (e) { /* never crash on entry */ }
    },

    hotspots: [
      // --- Uktzin the cat (char) — sits on the correct ledge, hints on talk ---
      {
        id: 'uktzin',
        name: 'עוקצין',
        type: 'char',
        x: 224, y: 56, w: 26, h: 20,
        walkTo: { x: 238, y: 140 },
        draw: function (ctx, t, S) { drawCat(ctx, t, S); },
        look: async function (g) {
          if (paturDone()) {
            await g.playerSay('עוקצין, מרוצה מעצמו, יושב בדיוק במקום שהוא הוכיח לי שהוא מקום פטור.');
          } else {
            await g.playerSay('חתול יושב על משטח קטנטן וגבוה, מנותק מכל השאר. נראה מרוצה מדי בשביל להיות במקרה.');
          }
        },
        talk: catTalk,
        take: async function (g) {
          await g.playerSay('לקחת את עוקצין? הוא חתול, לא פריט מלאי — גם אם הוא יושב במקום פטור לתפארת.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.say('מִיאוּ. "מקום פטור" לא כתוב מפורש בדף הזה — זה כלל כללי, לא סיפור של המשנה שלנו. אבל תדע להשתמש בו.', { who: 'uktzin', color: '#c8ffb0' });
            return;
          }
          await g.say('מִיאוּ?! אני לא כלי עבודה. אני פוסק הלכה על גגות.', { who: 'uktzin', color: '#c8ffb0' });
        }
      },

      // --- The correct ledge: the true מקום פטור ---
      {
        id: 'ledge_patur',
        name: 'מדף האבן הקטן',
        type: 'object',
        x: LEDGE.x - 4, y: LEDGE.y - 2, w: LEDGE.w + 10, h: LEDGE.h + 6,
        look: paturLook,
        take: async function (g) {
          if (paturDone()) {
            await g.playerSay('כבר לקחתי ממנו את מה שצריך — אישור, לא אבנים.');
            return;
          }
          await g.playerSay('לפני שאני לוקח משהו, כדאי שאבין קודם איפה אני בכלל עומד.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('בדף כתוב על העני ובעל הבית, לא על מדפים קטנים — אבל עוקצין בטח יסביר בשמחה.');
            return;
          }
          if (paturDone()) {
            await g.playerSay('האישור כבר אצלי. אין צורך לחזור על זה.');
          } else {
            await paturSuccess(g);
          }
        }
      },

      // --- Decoy 1: wide walled platform (רשות היחיד-ish) ---
      {
        id: 'ledge_wide',
        name: 'המשטח הרחב',
        type: 'object',
        x: 14, y: 104, w: 90, h: 32,
        walkTo: { x: 55, y: 150 },
        look: decoyLook('wide'),
        take: async function (g) {
          await g.playerSay('זה משטח שלם, לא פריט. גם אם אצליח להרים אותו — לאן בדיוק אני הולך איתו?');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('בדף כתוב על רשות היחיד — מוקפת מחיצות גבוהות עשרה טפחים. זה בדיוק מה שיש כאן. רשות, לא פטור.');
            return;
          }
          await g.playerSay('המשטח לא מגיב. הוא בטוח שהוא רשות היחיד לכל דבר, ובצדק.');
        }
      },

      // --- Decoy 2: low unfenced outer ledge (כרמלית-ish) ---
      {
        id: 'ledge_low',
        name: 'המדף הנמוך',
        type: 'object',
        x: 280, y: 112, w: 38, h: 26,
        walkTo: { x: 296, y: 150 },
        look: decoyLook('low'),
        take: async function (g) {
          await g.playerSay('הבנתי למה אף אחד לא לוקח כלום מפה. הוא גם ככה כמעט נופל לרחוב.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('בדף כתוב על כרמלית — לא מוקפת כראוי, ולא רשות הרבים אמיתית. בול המקום הזה.');
            return;
          }
          await g.playerSay('רוח קלה והמדף הזה יאבד גם את מה שיש עליו כרגע.');
        }
      },

      // --- Decoy 3: the ordinary dormer window sill ---
      {
        id: 'window_sill',
        name: 'אדן החלון',
        type: 'object',
        x: 100, y: 64, w: 52, h: 40,
        walkTo: { x: 126, y: 150 },
        look: decoyLook('window'),
        take: async function (g) {
          await g.playerSay('לקחת אדן חלון של מישהו? זה גם גניבה וגם טיפוס מסוכן.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('אין הבדל בין החלון הזה לחדר שמאחוריו — הוא לא מובדל מספיק. עדיין רשות היחיד.');
            return;
          }
          await g.playerSay('התריס חורק בתשובה. משהו כמו "לא, תודה".');
        }
      },

      // --- Flavor: the chimney ---
      {
        id: 'chimney',
        name: 'הארובה',
        type: 'object',
        x: 248, y: 30, w: 30, h: 68,
        walkTo: { x: 262, y: 150 },
        look: async function (g) {
          await g.playerSay('ארובת אבן גבוהה, עם קצת עשן שנשאר מבישולי ערב שבת. עוקצין בחר לו שכן שקט.');
        },
        take: async function (g) {
          await g.playerSay('ארובה שלמה? אפילו החתול היה מסתכל עליי במבט מוזר.');
        },
        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('אין קשר בין ארובות לדף היום. אבל היא נותנת למדף הקטן שלידה גובה נאה.');
            return;
          }
          await g.playerSay('הארובה חמה מבפנים וקרירה מבחוץ. בדיוק כמו הוויכוח על רשויות.');
        }
      },

      // --- Flavor: laundry line ---
      {
        id: 'laundry',
        name: 'חבל הכביסה',
        type: 'object',
        x: 150, y: 50, w: 96, h: 22,
        walkTo: { x: 195, y: 150 },
        look: async function (g) {
          await g.playerSay('מגבת קטנה ומטלית מתייבשות לפני כניסת השבת. גם הכביסה יודעת שהזמן קצר.');
        },
        take: async function (g) {
          await g.playerSay('לגנוב כביסה טרייה שעה לפני שבת? יש גבול.');
        }
      },

      // --- Exit: stairs back down to the village square ---
      {
        id: 'exit_square',
        name: 'מדרגות לכיכר',
        type: 'exit',
        x: 0, y: 90, w: 26, h: 42,
        walkTo: { x: 14, y: 148 },
        target: 'square',
        spawn: { x: 250, y: 150 },
        look: async function (g) {
          await g.playerSay('מדרגות אבן צרות חזרה לכיכר. השמש לא מחכה — כדאי לרדת בזהירות, אך במהירות.');
        }
      }
    ]
  });

})();
