'use strict';
/*
 * Scene: market — "שׁוּק עֶרֶב שַׁבָּת" (Erev Shabbat Market)
 * DAF QUEST (Shabbat game) — Shabbat 2a-2b. Teaches the four domains (רשויות):
 * רשות היחיד / רשות הרבים / כרמלית / מקום פטור, via a classification quiz
 * with the peddler Shimon over four depicted micro-locations. Awards seal
 * 'domains'. Also hosts the windowsill-coin side beat gated on item
 * 'paturseal' (earned in the roof scene). Owns ONLY this file.
 */
(function () {

  if (!window.GAME || typeof window.GAME.registerScene !== 'function') {
    if (window.console && console.warn) console.warn('market.js: GAME.registerScene missing, scene not registered');
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
    if (SP && typeof SP.dither === 'function') { SP.dither(ctx, x, y, w, h, c1, c2); return; }
    px(ctx, x, y, w, h, c1);
    ctx.fillStyle = c2;
    for (var yy = 0; yy < h; yy++) {
      for (var xx = (yy % 2); xx < w; xx += 2) ctx.fillRect(x + xx, y + yy, 1, 1);
    }
  }

  function glow(ctx, x, y, r, color, alpha) {
    var SP = window.SPRITES;
    if (SP && typeof SP.glow === 'function') { SP.glow(ctx, x, y, r, color, alpha); return; }
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
    if (SP && typeof SP.star === 'function') { SP.star(ctx, x, y, t, size, color); return; }
    var a = 0.5 + 0.5 * Math.sin(t * 3 + x * 7 + y * 3);
    ctx.globalAlpha = 0.4 + 0.6 * a;
    px(ctx, x, y, 1, 1, color || '#ffffff');
    ctx.globalAlpha = 1;
  }

  function safeSfx(g, name) {
    try { if (g && typeof g.sfx === 'function') g.sfx(name); } catch (e) { /* fail silent */ }
  }

  function hasSealSafe(g, id) {
    try { return !!(g && typeof g.hasSeal === 'function' && g.hasSeal(id)); }
    catch (e) { return false; }
  }

  function hasItemSafe(g, id) {
    try { return !!(g && typeof g.has === 'function' && g.has(id)); }
    catch (e) { return false; }
  }

  function flagOf(S, name) {
    return (S && S.flags) ? S.flags[name] : undefined;
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

  function domainSolved(S, id) {
    return !!flagOf(S, 'domainSolved_' + id);
  }

  /* ------------------------------------------------------------------ */
  /* THE FOUR DOMAINS — quiz content (Shabbat 2a-2b content sheet)      */
  /* ------------------------------------------------------------------ */

  var DOMAIN_OPTIONS = [
    { value: 'reshut_hayachid', text: 'רשות היחיד' },
    { value: 'reshut_harabim', text: 'רשות הרבים' },
    { value: 'karmelit', text: 'כרמלית' },
    { value: 'makom_patur', text: 'מקום פטור' }
  ];

  var DOMAIN_EXPLAIN = {
    reshut_hayachid: 'רשות היחיד: שטח של 4 על 4 טפחים לפחות, מוקף מחיצות בגובה 10 טפחים לפחות.',
    reshut_harabim: 'רשות הרבים: דרך פתוחה שרוחבה 16 אמה לפחות, שהמון עוברים בה.',
    karmelit: 'כרמלית: לא מוקפת כראוי (מחיצות נמוכות מ־10 טפחים) ולא דרך שהרבים עוברים בה — כמו שדה או מגרש פרוץ.',
    makom_patur: 'מקום פטור: קטן מ־4 על 4 טפחים, ומופרש לפחות 3 טפחים מהסביבה — קטן מכדי להיחשב רשות בכלל.'
  };

  var DOMAIN_ROUNDS = [
    {
      id: 'road',
      label: 'דרך השוק הרחבה',
      ask: 'תראה את דרך השוק — פתוחה, בלי גדר, וההמון עובר בה מהבוקר עד הערב. איזו רשות זו?',
      answer: 'reshut_harabim',
      right: 'בדיוק! רוחב מספיק, המון עובר — זו רשות הרבים לכל דבר.',
      wrong: {
        reshut_hayachid: 'רשות היחיד?! איפה המחיצות שלה, לדעתך? זו דרך פתוחה, לא מבצר.',
        karmelit: 'קרוב, אבל לא — כרמלית זו שממה שאין בה תנועה. פה עובר כל הכפר. זה כבר רשות הרבים.',
        makom_patur: 'מקום פטור זעיר?! תסתכל כמה זה רחב. זה הפוך לגמרי.'
      }
    },
    {
      id: 'yard',
      label: 'חצר האחסון שמאחורי הדוכן',
      ask: 'עכשיו חצר האחסון מאחורי הדוכן שלי — מוקפת קירות גבוהים מכל צד, בלי פתח פתוח. מה זו?',
      answer: 'reshut_hayachid',
      right: 'נכון מאוד! קירות גבוהים, שטח מוגדר — רשות היחיד קלאסית.',
      wrong: {
        reshut_harabim: 'רשות הרבים?! מי בדיוק עובר כאן, מלבד העכברים שלי?',
        karmelit: 'זו לא כרמלית — יש כאן מחיצות גבוהות וברורות, לא סתם שטח פרוץ.',
        makom_patur: 'זה בקושי "פטור" — זו חצר שלמה, מוקפת קירות. גדולה מדי בשביל מקום פטור.'
      }
    },
    {
      id: 'lot',
      label: 'המגרש הפרוץ ליד הבאר',
      ask: 'המגרש הפרוץ ליד הבאר — לא מגודר בכלל, אבל גם לא ממש דרך שההמון עובר בה. מה זה נחשב?',
      answer: 'karmelit',
      right: 'יפה! לא מוקף כראוי ולא רשות הרבים אמיתית — זו בדיוק ההגדרה של כרמלית.',
      wrong: {
        reshut_hayachid: 'רשות היחיד צריכה מחיצות של ממש. פה יש... כלום. שטח פתוח לגמרי.',
        reshut_harabim: 'רשות הרבים צריכה תנועה המונית קבועה. פה עובר בעל חמור, פעם ביום, אם בכלל.',
        makom_patur: 'זה לא קטן מספיק בשביל מקום פטור — זה מגרש שלם, לא פינה זעירה.'
      }
    },
    {
      id: 'sill',
      label: 'אדן החלון הגבוה מעל הדוכן',
      ask: 'ולבסוף — האדן הקטן והגבוה שם, מעל הדוכן. קטן מדי, גבוה מדי, מובדל מכל דבר סביבו. מה הוא?',
      answer: 'makom_patur',
      right: 'מדויק! קטן מ־4 על 4 טפחים, ומופרש לפחות 3 טפחים — קטן מכדי להיות רשות בכלל. אפשר להניח ולקחת ממנו חופשי, לא משנה מה יש משני צדדיו.',
      wrong: {
        reshut_hayachid: 'רשות היחיד? זה אדן קטן, לא חדר. אין לו את הממדים בכלל.',
        reshut_harabim: 'רשות הרבים על אדן חלון?! מי בדיוק עובר שם, ציפורים?',
        karmelit: 'כרמלית זה שטח, ולו קטן. האדן הזה קטן וגם מובדל למעלה — זה משהו אחר.'
      }
    }
  ];

  /* ------------------------------------------------------------------ */
  /* DIALOGUE — Shimon the peddler drives the whole classification quiz */
  /* ------------------------------------------------------------------ */

  var SHIMON_COLOR = '#ffb347';

  function sSay(g, text) {
    return g.say(text, { who: 'shimon', color: SHIMON_COLOR });
  }

  async function shimonIntro(g) {
    await sSay(g, 'זְרַח! תודה לשמים, בן אדם עם ראש על הכתפיים!');
    await sSay(g, 'מְחִיצַת הָרְשֻׁיּוֹת השתגעה הערב — ואני כבר לא יודע מה מותר להעביר מהדוכן שלי לאן.');
    await sSay(g, 'ארבע פינות בשוק שלי, ואני חייב לדעת בדיוק מה כל אחת מהן — לפני שהשמש שוקעת.');
    await sSay(g, 'תעזור לי לסווג אותן? רשות היחיד, רשות הרבים, כרמלית, או מקום פטור?');
  }

  async function runDomainQuiz(g) {
    var remaining = DOMAIN_ROUNDS.filter(function (r) { return !g.flag('domainSolved_' + r.id); });
    if (!remaining.length) {
      // all already solved somehow — make sure the seal exists and bail out
      if (!hasSealSafe(g, 'domains')) {
        safeSfx(g, 'seal');
        g.addSeal('domains', 'חותם הרשויות');
      }
      return;
    }
    remaining = shuffled(remaining);
    safeSfx(g, 'quiz');
    for (var q = 0; q < remaining.length; q++) {
      var round = remaining[q];
      var solved = false;
      var misses = 0;
      while (!solved) {
        await sSay(g, round.ask);
        var opts = shuffled(DOMAIN_OPTIONS);
        var ans = await g.choose(opts.map(function (o) { return { text: o.text, value: o.value }; }));
        if (ans === round.answer) {
          solved = true;
          g.flag('domainSolved_' + round.id, true);
          safeSfx(g, 'click');
          await sSay(g, round.right);
          await sSay(g, DOMAIN_EXPLAIN[round.answer]);
        } else {
          misses++;
          safeSfx(g, 'fail');
          var line = (round.wrong && round.wrong[ans]) ? round.wrong[ans] : 'לא בדיוק. תחשוב שוב — לא נורא, יש זמן. כמעט.';
          await sSay(g, line);
          if (misses >= 2 && hasItemSafe(g, 'daf')) {
            await g.playerSay('רגע, יש לי דף גמרא. ' + DOMAIN_EXPLAIN[round.answer]);
          }
        }
      }
    }
    // all four locations classified
    await g.cutscene(async function (gg) {
      safeSfx(gg, 'magic');
      await sSay(gg, 'ארבע פינות, ארבע רשויות, אף טעות שנשארה. המחיצה הזאת כבר לא מבולבלת!');
      await sSay(gg, 'קח, זרח — חותם הרשויות. לך תראה אותו לחכמים, לפני שהשמש נעלמת לגמרי.');
      safeSfx(gg, 'seal');
      gg.addSeal('domains', 'חותם הרשויות');
      await gg.playerSay('רשות היחיד, רשות הרבים, כרמלית, מקום פטור. עכשיו זה כבר לא יימחק לי מהראש.');
    });
  }

  async function shimonTalk(g) {
    if (hasSealSafe(g, 'domains')) {
      await sSay(g, pick([
        'ארבע הפינות שלי מסודרות. אתה יכול לישון הערב בלי לדאוג לי.',
        'רשות היחיד מימין, רשות הרבים משמאל, כרמלית באמצע, ומקום פטור למעלה. שיננתי את זה בעל פה.',
        'תודה שוב על העזרה. עכשיו אני יכול למכור בלי לדאוג שאני עובר עבירה בלי לדעת.'
      ]));
      return;
    }
    if (!g.flag('shimonMet')) {
      g.flag('shimonMet', true);
      await shimonIntro(g);
    } else {
      await sSay(g, 'עוד לא סיימנו. בוא נמשיך לסווג את הפינות שנשארו.');
    }
    await runDomainQuiz(g);
  }

  /* ------------------------------------------------------------------ */
  /* Windowsill coin side beat — gated on item 'paturseal' from roof    */
  /* ------------------------------------------------------------------ */

  function sillGatedHint(g) {
    return g.playerSay('המטבע תקוע שם למעלה, גבוה מדי בשביל להגיע אליו בבטחה. קודם כדאי שאבין טוב יותר מהו באמת מקום פטור — אולי בגג?');
  }

  async function sillLook(g) {
    if (g.flag('marketCoinTaken')) {
      await g.playerSay('אדן ריק עכשיו. המטבע כבר בכיס שלי.');
      return;
    }
    await g.playerSay('אדן חלון קטן וגבוה מעל הדוכן, ועליו מבריק מטבע נשכח.');
    if (!hasItemSafe(g, 'paturseal')) {
      await sillGatedHint(g);
    } else {
      await g.playerSay('עכשיו, עם ההבנה מהגג, אני יודע בדיוק למה מותר לי לקחת אותו משם בלי לחשוש.');
    }
  }

  async function sillUse(g) {
    if (g.flag('marketCoinTaken')) {
      await g.playerSay('כבר לקחתי את המטבע מכאן. האדן ריק לגמרי.');
      return;
    }
    if (!hasItemSafe(g, 'paturseal')) {
      await sillGatedHint(g);
      return;
    }
    safeSfx(g, 'click');
    g.flag('marketCoinTaken', true);
    await g.playerSay('מקום פטור — קטן מדי וגבוה מדי בשביל להיות רשות של ממש, אז אפשר להניח ולקחת ממנו בלי חשש, לא משנה מה יש בכל צד. המטבע שלי!');
  }

  /* ------------------------------------------------------------------ */
  /* Background painters                                                */
  /* ------------------------------------------------------------------ */

  function paintSky(ctx, t) {
    // dusk gradient: violet top -> rose -> gold horizon (signature market look)
    px(ctx, 0, 0, 320, 12, '#3a2050');
    dither(ctx, 0, 12, 320, 4, '#3a2050', '#7a3d5c');
    px(ctx, 0, 16, 320, 12, '#7a3d5c');
    dither(ctx, 0, 28, 320, 4, '#7a3d5c', '#d97a4a');
    px(ctx, 0, 32, 320, 10, '#d97a4a');
    dither(ctx, 0, 42, 320, 4, '#d97a4a', '#ffb347');
    px(ctx, 0, 46, 320, 6, '#ffb347');
    // faint drifting cloud bands
    var cx = (t * 4) % 380 - 40;
    ctx.globalAlpha = 0.10;
    px(ctx, cx, 18, 60, 2, '#e8d8a8');
    px(ctx, cx + 140, 30, 46, 2, '#e8d8a8');
    ctx.globalAlpha = 1;
  }

  function paintBuildings(ctx, t, S) {
    // low market-street building silhouettes, behind the stalls
    px(ctx, 0, 46, 320, 32, '#4a3a4a');
    px(ctx, 0, 50, 90, 26, '#3f3348');
    px(ctx, 110, 44, 90, 30, '#453750');
    px(ctx, 220, 48, 100, 28, '#3f3348');
    // roofline crenellation
    px(ctx, 0, 46, 320, 3, '#2e2438');
    px(ctx, 108, 42, 4, 4, '#2e2438');
    px(ctx, 200, 44, 4, 4, '#2e2438');

    // three Shabbat-candle windows — light up progressively with seal count
    var seals = (S && S.seals && S.seals.length) ? S.seals.length : 0;
    var windows = [
      { x: 30, y: 58, need: 0 },
      { x: 150, y: 54, need: 1 },
      { x: 258, y: 58, need: 2 }
    ];
    for (var i = 0; i < windows.length; i++) {
      var w = windows[i];
      var lit = seals > w.need;
      px(ctx, w.x, w.y, 10, 12, '#241a30');
      if (lit) {
        var flick = 0.75 + 0.25 * Math.sin(t * 6 + i * 2);
        ctx.globalAlpha = flick;
        px(ctx, w.x + 1, w.y + 1, 8, 10, '#ffd166');
        ctx.globalAlpha = 1;
        glow(ctx, w.x + 5, w.y + 6, 8, '#ffb347', 0.10 + 0.04 * Math.sin(t * 6 + i));
      } else {
        px(ctx, w.x + 1, w.y + 1, 8, 10, '#14101c');
      }
      px(ctx, w.x + 4, w.y, 2, 12, '#1a1224'); // window cross bar
    }
  }

  function paintGround(ctx) {
    px(ctx, 0, 74, 320, 106, '#4a3a2a');
    dither(ctx, 0, 74, 320, 6, '#4a3a2a', '#5a4632');
  }

  function paintOpenLot(ctx, t, S) {
    // karmelit: unfenced dusty patch left of the market, beside the well
    px(ctx, 4, 106, 92, 68, '#5c4a34');
    dither(ctx, 4, 106, 92, 8, '#5c4a34', '#4a3a28');
    // scrubby grass tufts
    px(ctx, 18, 150, 1, 3, '#3f5a34');
    px(ctx, 20, 151, 1, 2, '#3f5a34');
    px(ctx, 60, 156, 1, 3, '#3f5a34');
    px(ctx, 78, 148, 1, 3, '#3f5a34');
    // small well silhouette (echo of the square's well, this one is dry/unused)
    px(ctx, 30, 118, 16, 10, '#6b6b8f');
    px(ctx, 32, 120, 12, 6, '#33334e');
    px(ctx, 28, 112, 20, 3, '#5a3a24');
    px(ctx, 36, 106, 2, 8, '#5a3a24');
    px(ctx, 42, 106, 2, 8, '#5a3a24');
    // hitching post with a loose swinging rope
    var sway = Math.sin(t * 1.3) * 1.4;
    px(ctx, 70, 128, 2, 24, '#5a3a24');
    px(ctx, 66 + sway, 132, 8, 1, '#7a512f');
    // solved marker
    if (domainSolved(S, 'lot')) {
      drawSolvedMark(ctx, 50, 108, t);
    }
  }

  function paintMarketRoad(ctx, t, S) {
    // reshut harabim: wide open thoroughfare, dead center, no walls anywhere
    px(ctx, 96, 100, 136, 74, '#6b5842');
    dither(ctx, 96, 100, 136, 8, '#6b5842', '#7a6650');
    // worn wheel ruts
    px(ctx, 130, 108, 2, 66, '#5a4632');
    px(ctx, 190, 108, 2, 66, '#5a4632');
    // scattered footprints
    for (var i = 0; i < 5; i++) {
      px(ctx, 108 + i * 20, 150 + ((i % 2) ? 3 : 0), 2, 1, '#4a3a28');
    }
    // drifting dust motes (foot traffic never stops)
    for (var k = 0; k < 4; k++) {
      var dph = (t * 0.6 + k * 0.9) % 4;
      var dx = 100 + ((k * 61 + t * 14) % 128);
      var dy = 112 + k * 12 + Math.sin(t * 1.4 + k) * 3;
      ctx.globalAlpha = Math.max(0, 0.20 - dph * 0.04);
      px(ctx, dx, dy, 1, 1, '#c9b89a');
      ctx.globalAlpha = 1;
    }
    if (domainSolved(S, 'road')) {
      drawSolvedMark(ctx, 160, 104, t);
    }
  }

  function paintStorageYard(ctx, t, S) {
    // reshut hayachid: fully walled yard, right side of the market
    px(ctx, 232, 84, 84, 88, '#4a4a68');            // back wall
    px(ctx, 236, 88, 76, 80, '#39395a');            // interior fill
    // stone courses
    for (var gy = 92; gy < 168; gy += 8) {
      px(ctx, 232, gy, 84, 1, '#3a3a56');
    }
    // side walls (tall — the point of the puzzle)
    px(ctx, 232, 84, 6, 88, '#565678');
    px(ctx, 310, 84, 6, 88, '#565678');
    // narrow gate, closed
    px(ctx, 264, 132, 20, 40, '#5a3a24');
    px(ctx, 266, 134, 16, 36, '#4a2f1c');
    px(ctx, 273, 150, 2, 4, '#8a6238'); // handle
    // crates stacked inside
    px(ctx, 244, 148, 14, 12, '#7a512f');
    px(ctx, 244, 148, 14, 2, '#8a6238');
    px(ctx, 290, 144, 14, 16, '#7a512f');
    px(ctx, 290, 144, 14, 2, '#8a6238');
    if (domainSolved(S, 'yard')) {
      drawSolvedMark(ctx, 272, 96, t);
    }
  }

  function paintWindowsill(ctx, t, S) {
    // makom patur: tiny, high, separated ledge above the storage-yard stall
    px(ctx, 250, 56, 20, 6, '#7a512f');
    px(ctx, 250, 56, 20, 2, '#8a6238');
    px(ctx, 252, 50, 16, 8, '#3f3348'); // little window recess above it
    px(ctx, 254, 52, 12, 5, '#1a1224');
    if (!flagOf(S, 'marketCoinTaken')) {
      var glint = 0.5 + 0.5 * Math.sin(t * 3.2);
      twinkle(ctx, 262, 59, t, 2, '#ffd166');
      ctx.globalAlpha = 0.5 + glint * 0.4;
      px(ctx, 261, 58, 2, 2, '#ffd166');
      ctx.globalAlpha = 1;
    }
    if (domainSolved(S, 'sill')) {
      drawSolvedMark(ctx, 260, 48, t);
    }
  }

  function drawSolvedMark(ctx, x, y, t) {
    var pulse = 0.6 + 0.4 * Math.sin(t * 4);
    ctx.globalAlpha = pulse;
    px(ctx, x, y, 1, 3, '#a26bd4');
    px(ctx, x - 1, y + 2, 1, 1, '#a26bd4');
    px(ctx, x + 1, y + 2, 3, 1, '#a26bd4');
    ctx.globalAlpha = 1;
    glow(ctx, x + 1, y + 1, 6, '#a26bd4', 0.08 + 0.04 * pulse);
  }

  function paintBanners(ctx, t) {
    var wob = Math.sin(t * 3.5) * 2;
    px(ctx, 96, 90, 1, 10, '#5a3a24');
    px(ctx, 97, 90, 8 + wob, 5, '#e63946');
    px(ctx, 226, 88, 1, 10, '#5a3a24');
    px(ctx, 227, 88, 7 - wob, 5, '#a26bd4');
    px(ctx, 314, 86, 1, 10, '#5a3a24');
    px(ctx, 308 + wob * 0.5, 86, 6, 5, '#ffd166');
  }

  function paintVeggieCart(ctx, t, S) {
    px(ctx, 100, 152, 22, 12, '#7a512f');
    px(ctx, 100, 152, 22, 2, '#8a6238');
    px(ctx, 98, 164, 3, 6, '#3a2a1c');
    px(ctx, 119, 164, 3, 6, '#3a2a1c');
    // wheel
    var rot = (t * 40) % 8;
    px(ctx, 118, 168, 4, 4, '#2a1a12');
    px(ctx, 118 + (rot > 4 ? 1 : 0), 169, 2, 2, '#5a3a24');
    // veggie pile, gentle jiggle
    var jig = Math.sin(t * 2.6) * 0.6;
    px(ctx, 102, 144 + jig, 5, 8, '#a22832');   // radish-ish
    px(ctx, 108, 142 + jig, 6, 10, '#3f7a3f');  // cabbage-ish
    px(ctx, 115, 145 - jig, 5, 7, '#ff8c42');   // carrot-ish
    px(ctx, 105, 141, 1, 3, '#2f5a2f');
  }

  function paintMarketSign(ctx, t) {
    px(ctx, 36, 96, 3, 24, '#5a3a24');
    var sway = Math.sin(t * 1.1) * 1;
    px(ctx, 28 + sway, 90, 22, 14, '#e8d8a8');
    px(ctx, 28 + sway, 90, 22, 2, '#c9b98a');
    ctx.fillStyle = '#3a2a1c';
    ctx.fillRect(31 + sway, 95, 16, 1);
    ctx.fillRect(31 + sway, 98, 12, 1);
    ctx.fillRect(31 + sway, 101, 14, 1);
  }

  function paintShimonStall(ctx, t) {
    // Shimon's own stall, parked right in the middle of the road (the irony
    // being entirely the point: it sits in reshut harabim)
    px(ctx, 130, 128, 46, 6, '#7a512f');
    px(ctx, 130, 128, 46, 2, '#8a6238');
    px(ctx, 132, 108, 4, 20, '#5a3a24');
    px(ctx, 168, 108, 4, 20, '#5a3a24');
    // striped awning
    for (var i = 0; i < 8; i++) {
      px(ctx, 128 + i * 6, 100, 6, 8, (i % 2 === 0) ? '#e63946' : '#e8d8a8');
    }
    // goods on the stall
    px(ctx, 136, 120, 6, 8, '#a26bd4');
    px(ctx, 144, 118, 8, 10, '#ffd166');
    px(ctx, 155, 121, 6, 7, '#1f7a8c');
    // small cooking pot with rising steam (micro-detail)
    px(ctx, 165, 122, 6, 5, '#3a3a52');
    for (var s = 0; s < 2; s++) {
      var sph = (t * 0.5 + s * 0.4) % 1;
      ctx.globalAlpha = 0.28 * (1 - sph);
      px(ctx, 167 + Math.sin(t * 2 + s) * 2, 120 - sph * 14, 2, 2, '#cfd8e8');
      ctx.globalAlpha = 1;
    }
    // hanging lantern swinging beside the awning
    var swing = Math.sin(t * 2.1) * 2;
    px(ctx, 176 + swing, 100, 1, 6, '#3a2a1c');
    px(ctx, 174 + swing, 106, 5, 5, '#3a2a1c');
    px(ctx, 175 + swing, 107, 3, 3, '#ffb347');
    glow(ctx, 176 + swing, 109, 8, '#ffb347', 0.10 + 0.04 * Math.sin(t * 8));
  }

  /* ------------------------------------------------------------------ */
  /* Shimon the peddler — character sprite (procedural rects)           */
  /* ------------------------------------------------------------------ */

  function drawShimon(ctx, t, S) {
    var x = 148, y = 150;
    var bob = Math.sin(t * 1.6) * 0.6;
    var gesture = Math.sin(t * 2.4);
    // shadow
    ctx.globalAlpha = 0.20;
    px(ctx, x - 7, y - 1, 14, 2, '#141428');
    ctx.globalAlpha = 1;
    // legs
    px(ctx, x - 4, y - 12, 3, 12, '#4a3a28');
    px(ctx, x + 1, y - 12, 3, 12, '#4a3a28');
    // robe/vest
    px(ctx, x - 6, y - 30 + bob, 12, 20, '#8c5a2f');
    px(ctx, x - 6, y - 20 + bob, 12, 3, '#5a3a24'); // sash
    px(ctx, x - 6, y - 30 + bob, 12, 3, '#a26bd4'); // trim
    // near arm (gesturing while explaining domains)
    var armY = y - 26 + bob - (gesture > 0 ? Math.abs(gesture) * 4 : 0);
    px(ctx, x + 5, armY, 3, 10, '#8c5a2f');
    px(ctx, x + 5, armY - 2, 3, 3, '#e0ab7a');
    // far arm resting on the stall
    px(ctx, x - 9, y - 20 + bob, 3, 8, '#8c5a2f');
    // head + turban
    px(ctx, x - 4, y - 40 + bob, 8, 8, '#e0ab7a');
    px(ctx, x - 5, y - 44 + bob, 10, 5, '#1f7a8c');
    px(ctx, x - 5, y - 44 + bob, 10, 1, '#2f9cb0');
    // beard
    px(ctx, x - 3, y - 34 + bob, 6, 3, '#6b5a45');
    // eyes with an occasional wink while bargaining
    var wink = (t % 4.2) < 0.14;
    if (wink) {
      px(ctx, x - 2, y - 38 + bob, 2, 1, '#241a14');
      px(ctx, x + 2, y - 38 + bob, 2, 1, '#e0ab7a');
    } else {
      px(ctx, x - 2, y - 38 + bob, 1, 2, '#241a14');
      px(ctx, x + 2, y - 38 + bob, 1, 2, '#241a14');
    }
    // nose + mustache
    px(ctx, x, y - 36 + bob, 2, 2, '#c98a5a');
    px(ctx, x - 2, y - 35 + bob, 6, 1, '#3a2a1c');
  }

  /* ------------------------------------------------------------------ */
  /* Scene definition                                                   */
  /* ------------------------------------------------------------------ */

  window.GAME.registerScene('market', {

    name: 'שוק ערב שבת',

    floor: { yMin: 118, yMax: 172 },

    paint: function (ctx, t, S) {
      try {
        paintSky(ctx, t);
        paintBuildings(ctx, t, S);
        paintGround(ctx);
        paintOpenLot(ctx, t, S);
        paintMarketRoad(ctx, t, S);
        paintStorageYard(ctx, t, S);
        paintWindowsill(ctx, t, S);
        paintBanners(ctx, t);
        paintVeggieCart(ctx, t, S);
        paintMarketSign(ctx, t);
        paintShimonStall(ctx, t);
      } catch (err) {
        px(ctx, 0, 0, 320, 180, '#3a2050');
        if (!window.__marketPaintWarned) {
          window.__marketPaintWarned = true;
          if (window.console && console.warn) console.warn('market paint error:', err);
        }
      }
    },

    onEnter: async function (g) {
      try {
        if (!g.flag('marketEntered')) {
          g.flag('marketEntered', true);
          await g.playerSay('שוק ערב שבת. תזזית של רגע לפני שהכל נסגר — וגם כאן, משהו לא ברור לגמרי.');
        }
      } catch (err) { /* fail silent */ }
    },

    hotspots: [

      /* ---------------- Shimon the peddler ---------------- */
      {
        id: 'shimon',
        name: 'הרוכל שמעון',
        type: 'char',
        x: 122, y: 108, w: 60, h: 42,
        walkTo: { x: 148, y: 160 },

        draw: function (ctx, t, S) {
          try { drawShimon(ctx, t, S); } catch (err) { /* fail silent */ }
        },

        look: async function (g) {
          if (hasSealSafe(g, 'domains')) {
            await g.playerSay('שמעון עומד רגוע ליד הדוכן. סוף סוף הוא יודע מה מותר להעביר לאן.');
          } else {
            await g.playerSay('רוכל בכובע עקום, מדבר מהר ומצביע על כל פינה בשוק כאילו היא עומדת להתפוצץ.');
          }
        },

        talk: shimonTalk,

        take: async function (g) {
          await g.playerSay('לקחת רוכל? יש לו סחורה, משפחה, וכנראה גם דעה נחרצת על זה.');
        },

        use: async function (g, itemId) {
          if (itemId === 'daf') {
            await g.playerSay('כתוב פה ההגדרות המדויקות של ארבע הרשויות. יכול לעזור לי לזכור.');
            await sSay(g, 'תלמיד חכם עם דף גמרא. בדיוק מה שהייתי צריך הערב.');
            return;
          }
          await g.playerSay('שמעון לא כלי עבודה. הוא רוכל. יש הבדל, בערך.');
        }
      },

      /* ---------------- The open market road (reshut harabim) ---------------- */
      {
        id: 'loc_road',
        name: 'דרך השוק',
        type: 'object',
        x: 96, y: 100, w: 136, h: 30,
        walkTo: { x: 160, y: 160 },

        look: async function (g) {
          await g.playerSay('דרך רחבה, פתוחה, בלי גדר בשום מקום. כל הכפר עובר כאן היום, כמו בכל יום.');
          if (!g.hasSeal || !g.hasSeal('domains')) {
            await g.playerSay('שמעון בטח ישאל אותי על זה. כדאי לדבר איתו.');
          }
        }
      },

      /* ---------------- The storage yard (reshut hayachid) ---------------- */
      {
        id: 'loc_yard',
        name: 'חצר האחסון',
        type: 'object',
        x: 232, y: 84, w: 84, h: 88,
        walkTo: { x: 264, y: 164 },

        look: async function (g) {
          await g.playerSay('חצר קטנה מאחורי הדוכן, מוקפת קירות גבוהים מכל צד ושער סגור. סגורה ומוגנת.');
        },

        take: async function (g) {
          await g.playerSay('לקחת חצר שלמה? גם התיק הכי גדול שלי לא כזה גדול.');
        }
      },

      /* ---------------- The open lot near the well (karmelit) ---------------- */
      {
        id: 'loc_lot',
        name: 'המגרש הפרוץ',
        type: 'object',
        x: 4, y: 106, w: 92, h: 68,
        walkTo: { x: 50, y: 160 },

        look: async function (g) {
          await g.playerSay('מגרש פרוץ ליד באר ישנה — לא מגודר, אבל גם לא באמת דרך שהכל עוברים בה.');
        }
      },

      /* ---------------- The windowsill (makom patur) + coin side beat ---------------- */
      {
        id: 'windowsill',
        name: 'אדן החלון',
        type: 'object',
        x: 248, y: 46, w: 24, h: 20,
        walkTo: { x: 260, y: 150 },

        look: sillLook,
        use: function (g) { return sillUse(g); }
      },

      /* ---------------- Vegetable cart (flavor) ---------------- */
      {
        id: 'veggie_cart',
        name: 'עגלת ירקות',
        type: 'object',
        x: 98, y: 140, w: 26, h: 32,
        walkTo: { x: 110, y: 162 },

        look: async function (g) {
          await g.playerSay('עגלת ירקות: צנוניות, כרוב, וגזר שמישהו סידר לפי צבעים ואז התחרט.');
        },

        take: async function (g) {
          await g.playerSay('לקחת ירק אחד? שמעון יבחין. שמעון תמיד מבחין.');
        }
      },

      /* ---------------- Market sign (flavor) ---------------- */
      {
        id: 'market_sign',
        name: 'שלט השוק',
        type: 'object',
        x: 26, y: 88, w: 26, h: 32,
        walkTo: { x: 40, y: 158 },

        look: async function (g) {
          await g.playerSay('שלט השוק: "אין להעביר חפצים בין רשויות בשבת. גם לא ירקות. במיוחד לא ירקות."');
          await g.playerSay('מתחת, בכתב יד קטן יותר: "מי שלא בטוח מהי הרשות — שישאל את שמעון. שמעון תמיד ער."');
        }
      },

      /* ---------------- Exit back to the village square ---------------- */
      {
        id: 'exit_square',
        name: 'חזרה לכיכר הכפר',
        type: 'exit',
        x: 0, y: 90, w: 20, h: 82,
        walkTo: { x: 12, y: 152 },
        target: 'square',
        spawn: { x: 160, y: 150 },

        look: async function (g) {
          await g.playerSay('הדרך חזרה לכיכר הכפר. השמש ממשיכה לשקוע, ואין הרבה זמן.');
        }
      }
    ]
  });

})();
