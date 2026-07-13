'use strict';

/* ==========================================================================
   DAF QUEST — שבת דף ב — main.js (shell bootstrap)
   Owns: item registry, seal labels, HUD renderer, intro & ending cutscenes,
   and the GAME.boot(...) call on DOMContentLoaded.
   All code/comments in English; all player-facing strings in Hebrew.
   ========================================================================== */

(function () {

  // ------------------------------------------------------------------------
  // Small DOM helpers (defensive: never throw if the stage is missing)
  // ------------------------------------------------------------------------

  function getStage() {
    return document.getElementById('stage');
  }

  function makeEl(tag, className, html) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (html != null) el.innerHTML = html;
    return el;
  }

  function removeEl(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function wait(g, ms) {
    if (g && typeof g.wait === 'function') return g.wait(ms);
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function safeSfx(g, name) {
    try {
      if (g && typeof g.sfx === 'function') g.sfx(name);
      else if (window.AUDIO && typeof window.AUDIO.sfx === 'function') window.AUDIO.sfx(name);
    } catch (e) { /* fail silent */ }
  }

  function safeMusic(mode) {
    try {
      if (window.AUDIO && typeof window.AUDIO.music === 'function') window.AUDIO.music(mode);
    } catch (e) { /* fail silent */ }
  }

  // Show a SCUMM-style location/narrator caption over the stage for `ms`.
  function showCaption(text, ms, g) {
    var stage = getStage();
    if (!stage) return wait(g, ms);
    var cap = makeEl('div', 'caption', text);
    stage.appendChild(cap);
    return wait(g, ms).then(function () { removeEl(cap); });
  }

  // ------------------------------------------------------------------------
  // ITEMS registry — icons are 16x16 sprite maps ('.'/' ' = transparent)
  // consumed via SPRITES.draw(ctx, icon.map, icon.pal, x, y, scale)
  // ------------------------------------------------------------------------

  var DAF_ICON = {
    map: [
      '................',
      '.ooooooooooooo..',
      '.opppppppppppo..',
      '.oiippiippippo..',
      '.opppppppppppo..',
      '.opiiippiiippo..',
      '.opppppppppppo..',
      '.oiipiiippiipo..',
      '.opppppppppppo..',
      '.opiippiiipppo..',
      '.opppppppppppo..',
      '.oiiippiipiipo..',
      '.opppppppppppo..',
      '.oPPPPPPPPPPPo..',
      '.ooooooooooooo..',
      '................'
    ],
    pal: {
      o: '#5a3a24',   // wood-brown outline
      p: '#e8d8a8',   // parchment
      P: '#cdb987',   // parchment shadow
      i: '#3a2a44'    // ink lines (dusk-tinted)
    }
  };

  // A small parchment tag with a round wax seal in its center — this game's
  // "proof of exempt place" (מקום פטור) token, separate item/id from the
  // Berakhot game's starproof, no shared state.
  var PATURSEAL_ICON = {
    map: [
      '................',
      '.ooooooooooooo..',
      '.ppppppppppppp..',
      '.ppppppwpppppp..',
      '.ppppwwwwwpppp..',
      '.pppwwwwwwwppp..',
      '.pppwwwwwwwppp..',
      '.ppwwwwwwwwwpp..',
      '.pppwwwwwwwppp..',
      '.pppwwwwwwwppp..',
      '.ppppwwwwwpppp..',
      '.ppppppwpppppp..',
      '.ppppppppppppp..',
      '.PPPPPPPPPPPPP..',
      '.ooooooooooooo..',
      '................'
    ],
    pal: {
      o: '#5a3a24',   // wood-brown outline
      p: '#e8d8a8',   // parchment
      P: '#cdb987',   // parchment shadow
      w: '#e63946'    // wax seal red
    }
  };

  var ITEMS = [
    {
      id: 'daf',
      name: 'דף גמרא',
      desc: 'דף ב, מסכת שבת. "יציאות השבת שתים שהן ארבע". דף העזר הרשמי של ההרפתקה הערבשבתית.',
      icon: DAF_ICON
    },
    {
      id: 'paturseal',
      name: 'אישור מקום פטור',
      desc: 'קלף קטן עם חותם שעווה. מוכיח שהמקום קטן מ-4x4 טפחים ומובדל 3 טפחים מסביבתו — לא רשות בכלל.',
      icon: PATURSEAL_ICON
    }
  ];

  // ------------------------------------------------------------------------
  // SEALS — labels for the HUD (and for scenes: g.addSeal(id, SEALS[id]))
  // ------------------------------------------------------------------------

  var SEALS = {
    handoff: 'חותם המשא ומתן',
    domains: 'חותם הרשויות',
    count: 'חותם המניין'
  };

  var SEAL_ORDER = ['handoff', 'domains', 'count'];
  var SEAL_GLYPHS = { handoff: '✧', domains: '▦', count: '#' };

  // ------------------------------------------------------------------------
  // HUD renderer — returns HTML string with the 3 seal slots
  // ------------------------------------------------------------------------

  function hud(state) {
    var seals = (state && state.seals) ? state.seals : [];
    var html = '<div class="seals" dir="rtl"><span class="seals-title">חותמות השער:</span>';
    for (var i = 0; i < SEAL_ORDER.length; i++) {
      var id = SEAL_ORDER[i];
      var filled = seals.indexOf(id) !== -1;
      html += '<span class="seal' + (filled ? ' filled' : '') + '" title="' + SEALS[id] + '">' +
        '<span class="seal-gem">' + (filled ? SEAL_GLYPHS[id] : '?') + '</span>' +
        '<span class="seal-label">' + SEALS[id] + '</span>' +
        '</span>';
    }
    html += '</div>';
    return html;
  }

  // ------------------------------------------------------------------------
  // INTRO cutscene — the sun is dipping over כפר שבתא, the crier panics,
  // the quest is given. Runs once at boot.
  // ------------------------------------------------------------------------

  // The crier is hotspot id 'crier' in the square scene; the engine anchors
  // the bubble above his rect (and falls back near the player in other scenes).
  var CRIER_COLOR = '#ffb347';

  function crierSay(g, text) {
    return g.say(text, { who: 'crier', color: CRIER_COLOR });
  }

  async function intro(g) {
    var stage = getStage();
    var veil = null;

    try {
      safeMusic('night');

      // Dusk settles: a warm veil lifts to reveal the village square.
      if (stage) {
        veil = makeEl('div', 'dusk-veil');
        stage.appendChild(veil);
      }

      await showCaption('כְּפַר שַׁבְתָּא · עֶרֶב שַׁבָּת · הַשֶּׁמֶשׁ נוֹטָה לִשְׁקֹעַ', 2600, g);

      if (veil) {
        veil.style.opacity = '0';
        await wait(g, 1600);
        removeEl(veil);
        veil = null;
      }

      await g.playerSay('שקיעה כתומה, ריח של חלה טרייה... ערב שבת בכפר חדש. נעים.');
      await g.playerSay('רגע. למה כולם קפואים באמצע הרחוב עם ידיים באוויר?');

      safeSfx(g, 'door');
      await crierSay(g, 'זְרַח!!! תודה לשמיים, פנים מוכרות! אסון! אסון רשותי!');
      await g.playerSay('אתה בטח הכרוז. תנשום. מה קרה?');
      await crierSay(g, 'זבדיה שמי! ותקשיב — מְחִיצַת הָרְשֻׁיּוֹת קרסה. הַמְּחִיצָה! הָרְשֻׁיּוֹת!');
      await crierSay(g, 'אלפי שנים היא שמרה בשקט על הגבול בין רשות היחיד לרשות הרבים. הלילה — קצר!');
      await g.playerSay('קצר? זה... חשמל?');
      await crierSay(g, 'קצר הלכתי-קוסמי! ועכשיו אף אחד לא יודע איפה נגמר "פנים" ואיפה מתחיל "חוץ"!');
      safeSfx(g, 'fail');
      await crierSay(g, 'תראה במבוי! שני אנשים תקועים באמצע הושטת יד — קפואים! המציאות עצמה "תקעה"!');
      await g.playerSay('כי אף אחד לא יכול להחליט אם החפץ עבר רשות?');
      await crierSay(g, 'בדיוק!! ואם אנחנו לא יודעים תוך כמה דקות — זה יישאר ככה עד אחרי שבת! זְרַח!! זְרַח!!');
      await crierSay(g, 'רגע, אני מדבר בקול רם מדי... אני עכשיו בפנים או בחוץ?! זה נחשב הוצאה?! זה סופר?!');
      await g.playerSay('...אתה בסדר?');
      await crierSay(g, 'לא. אבל אין זמן לזה. השמש שוקעת, זְרַח. ממש שוקעת. תראה אותה!');

      // One SCUMM-style choice for flavor; every branch continues the quest.
      if (typeof g.choose === 'function') {
        var pick = await g.choose([
          { text: 'אל דאגה! אני אתקן רשויות בשביל ארוחת שישי!', value: 'hero' },
          { text: 'רגע... יש דגה טרייה בשוק?', value: 'fish' },
          { text: 'מהי בכלל "רשות", טכנית?', value: 'meta' }
        ]);
        if (pick === 'fish') {
          await crierSay(g, 'יש דגה, יש דג שכמעט קופץ מהרשות שלו לרשות של כולם. תבדוק בשוק.');
          await g.playerSay('נשמע מוכר. אני בפנים. או בחוץ. עוד לא ברור.');
        } else if (pick === 'meta') {
          await crierSay(g, 'זו בדיוק השאלה של כל הדף! אתה כבר חושב כמו תלמיד! כמעט! תתחיל ללמוד!');
        } else {
          await crierSay(g, 'ידעתי שאפשר לסמוך על תלמיד שנשאר ער! גם אחרי שיעור, גם אחרי שקיעה!');
        }
      }

      await crierSay(g, 'שַׁעַר הָרְשֻׁיּוֹת בבית המדרש ייפתח רק למי שיביא שלושה חותמות:');
      await crierSay(g, 'חותם המשא ומתן, חותם הרשויות, וחותם המניין. שלושה. לא שניים. לא ארבעה.');
      await crierSay(g, 'ואז השער ישאל את שאלות הדף בעצמו. תלמד את הדף, זְרַח — הדף הוא המפתח!');
      await g.playerSay('שלושה חותמות, דף אחד, שקיעה אחת. כמה קשה זה כבר יכול להיות?');
      safeSfx(g, 'star');

      await showCaption('הַמְּשִׂימָה: אֱסֹף שְׁלוֹשָׁה חוֹתָמוֹת לִפְנֵי שֶׁתִּשְׁקַע הַשֶּׁמֶשׁ', 3000, g);

      if (typeof g.flag === 'function') g.flag('introDone', true);
    } catch (e) {
      // Never let the intro kill the game.
      try { console.error('intro cutscene error:', e); } catch (e2) { /* noop */ }
      if (veil) removeEl(veil);
    }
  }

  // ------------------------------------------------------------------------
  // ENDING cutscene — the Gate of Domains opens, domains snap back into
  // place, the two frozen villagers are freed, Shabbat candles light up
  // across the village, closing card + credits. Simpler CSS/HTML-driven
  // finale (gate panels + candle row) rather than a bespoke canvas show.
  // ------------------------------------------------------------------------

  function buildCandleRow(count) {
    var row = makeEl('div', 'candle-row');
    for (var i = 0; i < count; i++) {
      row.appendChild(makeEl('div', 'candle'));
    }
    return row;
  }

  function lightCandles(row, g) {
    if (!row) return wait(g, 0);
    var candles = row.children;
    var i = 0;
    function step() {
      if (i >= candles.length) return Promise.resolve();
      candles[i].classList.add('lit');
      safeSfx(g, 'click');
      i++;
      return wait(g, 140).then(step);
    }
    return step();
  }

  async function ending(g) {
    var stage = getStage();
    var gateOverlay = null;
    var candleRow = null;
    var glow = null;

    try {
      safeSfx(g, 'win');
      safeMusic('dawn');

      if (stage) {
        gateOverlay = makeEl('div', 'gate-overlay', '');
        var gateGlow = makeEl('div', 'gate-glow');
        var panelL = makeEl('div', 'gate-panel left');
        var panelR = makeEl('div', 'gate-panel right');
        gateOverlay.appendChild(gateGlow);
        gateOverlay.appendChild(panelL);
        gateOverlay.appendChild(panelR);
        stage.appendChild(gateOverlay);

        await showCaption('שַׁעַר הָרְשֻׁיּוֹת נִפְתָּח!', 2000, g);
        safeSfx(g, 'magic');
        // trigger the open transition
        void gateOverlay.offsetWidth;
        gateOverlay.classList.add('open');
        await wait(g, 2400);

        glow = makeEl('div', 'glow-overlay',
          '<div class="glow-text">הָרְשֻׁיּוֹת שָׁבוֹת לִמְקוֹמָן<br>רְשׁוּת הַיָּחִיד. רְשׁוּת הָרַבִּים. שָׁלוֹם עֲלֵיהֶם.</div>');
        stage.appendChild(glow);
        await wait(g, 2600);
        removeEl(glow);
        glow = null;

        await showCaption('וּבַמָּבוֹי — שְׁנֵי הַתְּקוּעִים סוֹף סוֹף נָעִים!', 2400, g);
        safeSfx(g, 'star');
      } else {
        await wait(g, 1000);
      }

      // Callback beat: the two frozen villagers from the courtyard scene,
      // freed now that the domains make sense again.
      await g.playerSay('זוסמן! תודרוס! תראו אתכם — סוף סוף גמרתם את ההעברה הזאת!');
      if (typeof g.say === 'function') {
        await g.say('אח... היד שלי!! היא בחיים!! אני חייב לזוז שוב!', { who: 'zussman', color: '#ffd166' });
        await g.say('ואני פטור מלדאוג יותר. תודה, זְרַח. תגיד לרב שלמדתי משהו הערב.', { who: 'todros', color: '#e63946' });
      }

      // Village candles light up across the square, one window at a time.
      if (stage) {
        candleRow = buildCandleRow(9);
        stage.appendChild(candleRow);
        await showCaption('וְנֵרוֹת שַׁבָּת דּוֹלְקִים בְּכָל הַכְּפָר, אֶחָד אֶחָד...', 2400, g);
        await lightCandles(candleRow, g);
        await wait(g, 600);
      }

      await g.playerSay('שלושה חותמות, שער פתוח, ושבת שנכנסת בזמן. לא רע לערב אחד.');
      await crierSay(g, 'זְרַח! תשמע — אני עדיין לא בטוח אם אני בפנים או בחוץ. אבל הנרות דולקים. זה מה שחשוב!');
      await g.playerSay('שבת שלום, זבדיה. תנוח קצת מהרשויות שלך.');

      // Closing card + funny credits.
      if (stage) {
        var card = makeEl('div', 'endcard',
          '<h2 class="endcard-title">וְזֶה הָיָה רַק הַדַּף הַשֵּׁנִי.</h2>' +
          '<p class="endcard-sub">שבת דף ב — שתיים שהן ארבע, וניצחת את שתיהן. 🕯️</p>' +
          '<ul class="credits">' +
          '<li>בימוי: התנא (בפנים או בחוץ — לא ברור, לא משנה)</li>' +
          '<li>הנדסת רשויות: המחיצה בע״מ — עכשיו עם אחריות מוארכת</li>' +
          '<li>פסקול: הוויכוח של רב מתנה ואביי, גרסת לייב, ללא סוף</li>' +
          '<li>קייטרינג: הדגה של חנה — עדיין לא ברור לה איפה הרשות שלה נגמרת</li>' +
          '<li>ייעוץ משפטי לחתולים: עוקצין, מומחה במסכת הנושאת את שמו</li>' +
          '<li>תפאורת גג: שלוש טפחים בדיוק, לא פחות, לא יותר</li>' +
          '<li>שני ניצולי המבוי מודים לצוות ההפקה על השחרור</li>' +
          '<li>אף חתול לא נלקח במהלך ההרפתקה. עוקצין דאג לזה בעצמו</li>' +
          '<li>בקרוב: הדף הבא — ואביי עדיין לא ויתר על הוויכוח</li>' +
          '</ul>' +
          '<button type="button" class="replay">עוד פעם מהתחלה? נו, מאימתי!</button>');
        stage.appendChild(card);

        var replayBtn = card.querySelector('.replay');
        if (replayBtn) {
          replayBtn.addEventListener('click', function () {
            try { window.location.reload(); } catch (e) { /* noop */ }
          });
        }
      }
    } catch (e) {
      try { console.error('ending cutscene error:', e); } catch (e2) { /* noop */ }
      removeEl(glow);
      removeEl(gateOverlay);
      removeEl(candleRow);
    }
  }

  // ------------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------------

  // Expose registries for scenes (e.g. g.addSeal('handoff', SEALS.handoff)).
  window.SEALS = SEALS;
  window.ITEMS = ITEMS;

  document.addEventListener('DOMContentLoaded', function () {
    var canvas = document.getElementById('game');
    if (!canvas) {
      console.error('boot failed: #game canvas not found');
      return;
    }
    if (!window.GAME || typeof window.GAME.boot !== 'function') {
      console.error('boot failed: GAME engine not loaded');
      var status = document.getElementById('status');
      if (status) status.textContent = 'שגיאה בטעינת המשחק. נסו לרענן את הדף.';
      return;
    }
    try {
      window.GAME.boot({
        canvas: canvas,
        startScene: 'square',
        items: ITEMS,
        intro: intro,
        ending: ending,
        hud: hud
      });
    } catch (e) {
      console.error('GAME.boot threw:', e);
    }
  });

})();
