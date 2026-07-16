'use strict';

/* ==========================================================================
   DAF QUEST — Pesachim 2 — "The Mystery of the Lost Light" — main.js
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

  // Unlit bedikah candle: pale wax body, bare wick, copper holder. NO flame.
  var NER_ICON = {
    map: [
      '................',
      '.......w........',
      '.......w........',
      '......cccd......',
      '......cccd......',
      '......ccdd......',
      '......cccd......',
      '......cccd......',
      '......ccdd......',
      '......cccd......',
      '......cccd......',
      '.....bbbbbb.....',
      '....bBBBBBBb....',
      '.....bbbbbb.....',
      '................',
      '................'
    ],
    pal: {
      w: '#8a7a5a',   // cold wick
      c: '#f5ead0',   // pale wax
      d: '#d8c9a8',   // wax shade
      b: '#b0662f',   // copper holder
      B: '#8f4f22'    // copper shadow
    }
  };

  // Same candle, LIT: flame pixels on top (theme colors #ffd166/#ff8c42).
  var NERLIT_ICON = {
    map: [
      '................',
      '.......y........',
      '......yoy.......',
      '......yoy.......',
      '.......w........',
      '......cccd......',
      '......ccdd......',
      '......cccd......',
      '......cccd......',
      '......ccdd......',
      '......cccd......',
      '.....bbbbbb.....',
      '....bBBBBBBb....',
      '.....bbbbbb.....',
      '................',
      '................'
    ],
    pal: {
      y: '#ffd166',   // flame bright
      o: '#ff8c42',   // flame core
      w: '#5a3a24',   // scorched wick
      c: '#f5ead0',
      d: '#d8c9a8',
      b: '#b0662f',
      B: '#8f4f22'
    }
  };

  // Parchment daf in a wood frame — this game's own hint sheet (no shared state).
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
      o: '#5a3a24',   // wood-brown frame
      p: '#e8d8a8',   // parchment
      P: '#cdb987',   // parchment shadow
      i: '#26264e'    // ink lines (indigo night tint)
    }
  };

  // Ancient round pita, a bite missing at the upper right, crumbs floating off.
  var PITA_ICON = {
    map: [
      '................',
      '................',
      '......tttt...k..',
      '....tttstt..k...',
      '...ttsttts.k....',
      '...ttttstttt....',
      '..tstttttstttt..',
      '..ttttsttttttt..',
      '..tttttttstttT..',
      '...ttsttttttTT..',
      '...tttttsttTT...',
      '....ttttttTT....',
      '......tTTT......',
      '................',
      '................',
      '................'
    ],
    pal: {
      t: '#e8c88a',   // pita tan
      s: '#b0662f',   // toasted spots
      T: '#cfa05f',   // baked shade
      k: '#d8b878'    // escaping crumbs
    }
  };

  var ITEMS = [
    {
      id: 'ner',
      name: 'נר הבדיקה (כבוי)',
      desc: 'נר שעווה חיוור, כבוי לגמרי. «בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר» — לְאוֹר. חסר פה שלב.',
      icon: NER_ICON
    },
    {
      id: 'nerlit',
      name: 'נר הבדיקה (דולק)',
      desc: 'דולק! אש מאש, ישר מהמשואה של בועז. קטן, נאמן, נכנס לחורים. עכשיו בודקים באמת.',
      icon: NERLIT_ICON
    },
    {
      id: 'daf',
      name: 'דף גמרא',
      desc: 'דף ב, מסכת פסחים. «מַאי ״אוֹר״?» — כל הרמזים בפנים. עוזר בכל מקום, לא מחליף לימוד.',
      icon: DAF_ICON
    },
    {
      id: 'pita',
      name: 'פיתה עתיקה',
      desc: 'חמץ שנמצא בבדיקה. קשה כאבן, ביס אחד חסר (היסטורי). לא לאכול! מחכה לביעור של מחר. ביעור זה גם מחזור.',
      icon: PITA_ICON
    }
  ];

  // ------------------------------------------------------------------------
  // SEALS — labels for the HUD (and for scenes: g.addSeal(id, SEALS[id]))
  // ------------------------------------------------------------------------

  var SEALS = {
    bedikah: 'חותם הבדיקה',
    light: 'חותם האוֹר',
    melakhah: 'חותם המלאכה'
  };

  var SEAL_ORDER = ['bedikah', 'light', 'melakhah'];
  var SEAL_GLYPHS = { bedikah: '▤', light: '✶', melakhah: '⚒' };

  // ------------------------------------------------------------------------
  // HUD renderer — returns HTML string with the 3 seal slots
  // ------------------------------------------------------------------------

  function hud(state) {
    var seals = (state && state.seals) ? state.seals : [];
    var html = '<div class="seals" dir="rtl"><span class="seals-title">חותמות המנורה:</span>';
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
  // Speech shorthands — hotspot ids used as bubble anchors:
  // 'gad' exists in the inn scene (intro runs there); 'menorah', 'huna',
  // 'yehuda' exist in the press scene (ending runs there). 'twins' and
  // 'rooster' have no hotspot in the press — engine falls back near the
  // player, which is fine for the ending's callback beats.
  // ------------------------------------------------------------------------

  var C = {
    gad: '#ffb347',
    menorah: '#ffd166',
    huna: '#ffd7a0',
    yehuda: '#aeb8ff',
    twins: '#ffd7e8',
    rooster: '#ff8c6a'
  };

  function gadSay(g, text) {
    return g.say(text, { who: 'gad', color: C.gad });
  }

  // ------------------------------------------------------------------------
  // INTRO cutscene — night of the 14th of Nisan, the torn sky, Gad's panic,
  // the three-seal quest. Runs once at boot, before the inn's onEnter.
  // ------------------------------------------------------------------------

  async function intro(g) {
    var stage = getStage();
    var veil = null;

    try {
      safeMusic('night');

      // A veil lifts to reveal the split sky for the first time.
      if (stage) {
        veil = makeEl('div', 'split-veil');
        stage.appendChild(veil);
      }

      await showCaption('כְּפַר נְהוֹרָא · אוֹר לְאַרְבָּעָה עָשָׂר בְּנִיסָן', 2600, g);

      if (veil) {
        veil.style.opacity = '0';
        await wait(g, 1600);
        removeEl(veil);
        veil = null;
      }

      await g.playerSay('כפר חדש, ליל בדיקת חמץ. נוצה בכיס, כף עץ בתיק. הערב אני בודק בשקט. מקצועי. בלי הרפתקאות.');
      await g.playerSay('רגע. למה חצי שמיים לילה וחצי שמיים בוקר? ולמה יש באמצע תפר, כמו מכנסיים שוויתרו?');

      safeSfx(g, 'door');
      await gadSay(g, 'אורח!!! ברוך הבא לפונדק "בכי טוב"! שב! תאכל! אל תאכל!! זה חמץ!! תאכל מהר!!!');
      await g.playerSay('...אתה בסדר? ומה קרה לשמיים שלכם?');
      await gadSay(g, 'המילה אוֹר נשברה! רב הונא אומר נַגְהֵי, רב יהודה אומר לֵילֵי — והשמיים נקרעו איתה לשניים!');
      await gadSay(g, 'והמנורה העתיקה בבית הבד — זו שמדליקה כל נר בדיקה בכפר אלפיים שנה — כבתה! והודיעה: "עד שלא תגידו לי מה זה אוֹר — אני לא נדלקת."');
      safeSfx(g, 'fail');
      await gadSay(g, 'אין להבה — אין נרות. אין נרות — אין בדיקה. אין בדיקה — חמץ בפסח!! אצלי!! בפונדק!!!');

      // One SCUMM-style flavor choice; every branch continues the quest.
      if (typeof g.choose === 'function') {
        var pick = await g.choose([
          { text: 'תירגע. אני תלמיד עם נר. זה בדיוק התיק בשבילי.', value: 'hero' },
          { text: 'שאלה דחופה קודם: מה יש לאכול שהוא לא חמץ?', value: 'food' },
          { text: 'אולי פשוט כולם ילכו לישון עד שהשמיים יסתדרו?', value: 'sleep' }
        ]);
        if (pick === 'food') {
          await gadSay(g, 'יש ביצים! רגע, לא — ביצה זו החתולה! את הביצים מותר! אותה אסור! היא מוקצה! לדבריה!');
          await g.playerSay('פונדק שבו החתולה פוסקת לעצמה. אני כבר אוהב את המקום.');
        } else if (pick === 'sleep') {
          await gadSay(g, 'לישון?! חצי מהאורחים בטוחים שעכשיו בוקר! הם מזמינים ארוחת בוקר!! של חמץ!!!');
          await g.playerSay('טוב, שכנעת. אף אחד לא ישן עד שנדע מה זה אוֹר.');
        } else {
          await gadSay(g, 'תלמיד עם נר!! בדיוק מה שהכפר צריך! אתן לך חדר חינם! כלומר — חצי חינם! כלומר — נדבר!');
        }
      }

      await gadSay(g, 'המנורה מבקשת שלושה חותמות של הבנה: חותם הבדיקה, חותם האוֹר, וחותם המלאכה.');
      await gadSay(g, 'תביא אותם אליה לבית הבד — והיא תדלק, וכל הכפר ידליק ממנה! אתה נראה אחד שקורא משניות לפני השינה!');
      await g.playerSay('«אוֹר לְאַרְבָּעָה עָשָׂר בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר». קודם נברר מה זה אוֹר — אחר כך נבדוק חמץ.');
      safeSfx(g, 'star');

      await showCaption('הַמְּשִׂימָה: שְׁלוֹשָׁה חוֹתָמוֹת — וְהַמְּנוֹרָה תִּדְלַק', 3000, g);
    } catch (e) {
      // Never let the intro kill the game.
      try { console.error('intro cutscene error:', e); } catch (e2) { /* noop */ }
      if (veil) removeEl(veil);
    }
  }

  // ------------------------------------------------------------------------
  // ENDING cutscene — the menorah relights, the daf's verdict glows, the sky
  // seam heals into proper NIGHT (night won: bedikah is tonight), candles
  // cascade across the village, callbacks land, comic credits roll.
  // Runs in the press scene, so 'menorah'/'huna'/'yehuda' anchors are live.
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
    var lamp = null;
    var seam = null;
    var glow = null;
    var candleRow = null;
    var card = null;

    try {
      safeSfx(g, 'win');
      safeMusic('dawn');

      // The great lamp draws breath and BLOOMS alight.
      if (stage) {
        lamp = makeEl('div', 'lamp-overlay');
        lamp.appendChild(makeEl('div', 'lamp-flame'));
        stage.appendChild(lamp);
        void lamp.offsetWidth;
      }
      safeSfx(g, 'magic');
      await wait(g, 1400);

      if (typeof g.say === 'function') {
        await g.say('אַהּהּה... אלפיים שנה ואחת. אוֹר — ערב. ליל ארבעה עשר. זו כל ההבהרה שביקשתי.', { who: 'menorah', color: C.menorah });
        await g.say('טוב, מספיק רגש. יש כפר שלם שמחכה לאש. תתרחקו מהפתילה.', { who: 'menorah', color: C.menorah });
      }

      await showCaption('וַתְּהִי אוֹרָה!... כלומר, אוֹר. כלומר — לילה. הכול כשורה.', 2800, g);

      // The daf's own verdict, big and glowing.
      if (stage) {
        glow = makeEl('div', 'glow-overlay',
          '<div class="glow-text">אַלְמָא ״אוֹר״ אוּרְתָּא הוּא! שְׁמַע מִינַּהּ.' +
          '<br><span style="font-size:0.72em;opacity:0.82;font-style:italic;">הבדיקה — הלילה, לאור הנר.</span></div>');
        stage.appendChild(glow);
        safeSfx(g, 'seal');
        await wait(g, 3000);
        removeEl(glow);
        glow = null;
      }

      // The torn sky heals — and it heals into NIGHT. Night won.
      if (stage) {
        seam = makeEl('div', 'seam-heal');
        stage.appendChild(seam);
        void seam.offsetWidth;
        await wait(g, 500);
        seam.style.transform = 'scaleX(0)';
        seam.style.opacity = '0';
        safeSfx(g, 'star');
        await showCaption('הַתֶּפֶר נִסְגָּר — וְהַשָּׁמַיִם מַכְרִיעִים: לַיְלָה!', 2600, g);
        removeEl(seam);
        seam = null;
      }

      await g.playerSay('הלילה ניצח. ברור שניצח — כל הוכחה שהוכרעה בדף שלנו אמרה: בודקים בלילה, לאור הנר.');

      // Candle cascade: every window lights a bedikah candle from her flame.
      if (stage) {
        candleRow = buildCandleRow(9);
        stage.appendChild(candleRow);
        await showCaption('וּמִלַּהֶבֶת הַמְּנוֹרָה — נֵר בְּדִיקָה נִדְלָק בְּכָל חַלּוֹן בַּכְּפָר, אֶחָד אֶחָד...', 2600, g);
        await lightCandles(candleRow, g);
        await wait(g, 600);
      }

      // Callback: the twins finally move — both INTO the inn.
      if (typeof g.say === 'function') {
        await g.say('החלטנו!! נכנסים!! שנינו!! פנימה!! נחליט בבוקר — בכי טוב!', { who: 'twins', color: C.twins });
      }
      await showCaption('בַּפּוּנְדָּק: שְׁנֵי הַתְּאוֹמִים נִכְנָסִים סוֹף סוֹף. בְּיַחַד. בְּכִי טוֹב.', 2400, g);

      // Callback: the rooster crows exactly once, correctly, and bows.
      safeSfx(g, 'hic');
      if (typeof g.say === 'function') {
        await g.say('קוּ־קוּ־רִי־קוּוּוּ!', { who: 'rooster', color: C.rooster });
      }
      await showCaption('שֶׂכְוִי קוֹרֵא קְרִיאָה אַחַת. מְדֻיֶּקֶת. בַּזְּמַן. וּמִשְׁתַּחֲוֶה.', 2400, g);

      // Callback: the source machloket shakes hands — each on his own word.
      await showCaption('רַב הוּנָא וְרַב יְהוּדָה לוֹחֲצִים יָדַיִם.', 2000, g);
      if (typeof g.say === 'function') {
        await g.say('נַגְהֵי.', { who: 'huna', color: C.huna });
        await g.say('לֵילֵי.', { who: 'yehuda', color: C.yehuda });
        await g.say('והשלום ביניהם? יש על זה מה להגיד. בדף הבא. אני לא מספיילרת.', { who: 'menorah', color: C.menorah });
      }

      await g.playerSay('שלושה לילות אני סוחב נר בין כפרים — והלילה הוא סוף סוף עושה את העבודה שלו: בדיקה. לאור הנר.');
      await g.playerSay('יאללה. יש פינות בכל הכפר, ולי יש נר, נוצה וכף עץ. פסח כשר — ולילה טוב!');

      // Closing card + comic credits (with the Mar Zutra cliffhanger credit).
      if (stage) {
        card = makeEl('div', 'endcard',
          '<h2 class="endcard-title">וְהַלַּיְלָה — נִצַּח.</h2>' +
          '<p class="endcard-sub">פסחים דף ב — «אוֹר לְאַרְבָּעָה עָשָׂר בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר» 🕯️</p>' +
          '<ul class="credits">' +
          '<li>בימוי: המנורה. אלפיים שנות ותק, יום מחלה אחד. סליחות התקבלו</li>' +
          '<li>תאורה ראשית: הלילה — ניצחון בשתי הכרעות, אפס הארכות</li>' +
          '<li>תפירת שמיים: התפר, שפרש לגמלאות והפך לקו האופק</li>' +
          '<li>ליהוק כוכבים: נפתלי הצופה. הכוכבים הביאו חטיפים. כשרים לפסח, הם נשבעים</li>' +
          '<li>אפקטים מיוחדים: בועז — "אש מאש" בע״מ, הרים עונים להרים</li>' +
          '<li>קייטרינג: גד. הגיש, חטף בחזרה, בכה מגאווה על המצה</li>' +
          '<li>ייעוץ מוקצה: ביצה החתולה, מסכת בפני עצמה, יושבת על מה שבא לה</li>' +
          '<li>פיצוח שורות: פרידא — נוצה ביד ימין, כף עץ ביד שמאל, הלכה כבית הלל</li>' +
          '<li>שעון מדבר: שֶׂכְוִי התרנגול — קריאה אחת, דיוק מלא, אפס חרטות</li>' +
          '<li>אף פירור לא נאכל בהפקה. הפיתה שמורה לביעור של מחר. בכבוד</li>' +
          '<li>«מֵיתִיבִי מָר זוּטְרָא:» — מר זוטרא עדיין באמצע נשימה. ההמשך בדף הבא</li>' +
          '</ul>' +
          '<button type="button" class="replay">עוד פעם? נַגְהֵי! כלומר — לֵילֵי! כלומר — כן!</button>');
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
      removeEl(seam);
      removeEl(lamp);
      removeEl(candleRow);
      removeEl(card);
    }
  }

  // ------------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------------

  // Expose registries for scenes (e.g. g.addSeal('bedikah', SEALS.bedikah)).
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
      if (status) status.textContent = 'שגיאה בטעינת המשחק. נסו לרענן את הדף. המנורה מחכה.';
      return;
    }
    try {
      window.GAME.boot({
        canvas: canvas,
        startScene: 'inn',
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
