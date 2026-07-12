'use strict';

/* ==========================================================================
   DAF QUEST — main.js (shell bootstrap)
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
      i: '#3a3050'    // ink lines
    }
  };

  var STARPROOF_ICON = {
    map: [
      '................',
      '.ccccccccccccc..',
      '.opppppppppppo..',
      '.oppsppppppppo..',
      '.opssspppppppo..',
      '.oppsppppppppo..',
      '.opppppspppppo..',
      '.oppppsssppppo..',
      '.opppppspppppo..',
      '.oppppppppsppo..',
      '.opppppppssspo..',
      '.oppppppppsppo..',
      '.oPPPPPPPPPPPo..',
      '.ccccccccccccc..',
      '................',
      '................'
    ],
    pal: {
      c: '#7a512f',   // scroll rollers
      o: '#5a3a24',   // outline
      p: '#e8d8a8',   // parchment
      P: '#cdb987',   // parchment shadow
      s: '#ffd166'    // golden stars
    }
  };

  var ITEMS = [
    {
      id: 'daf',
      name: 'דף גמרא',
      desc: 'דף ב עמוד א, מסכת ברכות. דף העזר הרשמי של ההרפתקה. מריח כמו בית מדרש ישן.',
      icon: DAF_ICON
    },
    {
      id: 'starproof',
      name: 'אישור צאת הכוכבים',
      desc: 'קלף רשמי עם שלושה כוכבים בינוניים מצוירים. חתום על ידי הינשוף מהגג.',
      icon: STARPROOF_ICON
    }
  ];

  // ------------------------------------------------------------------------
  // SEALS — labels for the HUD (and for scenes: g.addSeal(id, SEALS[id]))
  // ------------------------------------------------------------------------

  var SEALS = {
    stars: 'חותם הכוכבים',
    midnight: 'חותם חצות',
    watch: 'חותם המשמרות'
  };

  var SEAL_ORDER = ['stars', 'midnight', 'watch'];
  var SEAL_GLYPHS = { stars: '✦', midnight: '☾', watch: '♌' };

  // ------------------------------------------------------------------------
  // HUD renderer — returns HTML string with the 3 seal slots
  // ------------------------------------------------------------------------

  function hud(state) {
    var seals = (state && state.seals) ? state.seals : [];
    var html = '<div class="seals" dir="rtl"><span class="seals-title">חותמות הארון:</span>';
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
  // INTRO cutscene — night falls on Kfar Berakhot, the gabbai panics,
  // the quest is given. Runs once at boot.
  // ------------------------------------------------------------------------

  // The gabbai is hotspot id 'gabbai' in the square scene; the engine anchors
  // the bubble above his rect (and falls back near the player in other scenes).
  var GABBAI_COLOR = '#ffd166';

  function gabbaiSay(g, text) {
    return g.say(text, { who: 'gabbai', color: GABBAI_COLOR });
  }

  async function intro(g) {
    var stage = getStage();
    var veil = null;

    try {
      safeMusic('night');

      // Night falls: a dark veil lifts to reveal the village square.
      if (stage) {
        veil = makeEl('div', 'night-veil');
        stage.appendChild(veil);
      }

      await showCaption('כְּפַר בְּרָכוֹת · לֵיל חֹרֶף · הַשָּׁעָה — שְׁאֵלָה טוֹבָה', 2600, g);

      if (veil) {
        veil.style.opacity = '0';
        await wait(g, 1600);
        removeEl(veil);
        veil = null;
      }

      await g.playerSay('אח, לילה יפה. שקט. שקט מדי...');
      await g.playerSay('רגע. למה אף אחד לא מתפלל מעריב?');

      safeSfx(g, 'door');
      await gabbaiSay(g, 'זְרַח!!! אסון!! קטסטרופה!! בלגן הלכתי-קוסמי!!');
      await g.playerSay('גרשון הגבאי? נשום עמוק. מה קרה, נשרף הצ\'ולנט?');
      await gabbaiSay(g, 'גרוע מזה! ארון הזמנים בבית המדרש ננעל מעצמו!');
      await gabbaiSay(g, 'כל הכפר שכח מאימתי קורין את שמע בערבין. כולם. אפילו אני. אפילו החתול!');
      await g.playerSay('החתול ידע מתי קוראים שמע?');
      await gabbaiSay(g, 'לא, אבל עכשיו הוא לא יודע בביטחון. זה ההבדל.');
      await gabbaiSay(g, 'בלי הארון — אין מעריב. בלי מעריב — הלילה פשוט לא נגמר. תסתכל על השעון שלי!');
      safeSfx(g, 'fail');
      await gabbaiSay(g, 'סימן שאלה. השעון מראה סימן שאלה. גם הוא איבד את תחושת הזמן. באשמתי, כנראה.');

      // One SCUMM-style choice for flavor; every branch continues the quest.
      if (typeof g.choose === 'function') {
        var pick = await g.choose([
          { text: 'אל דאגה! אציל את מעריב!', value: 'hero' },
          { text: 'רגע... יש אוכל במשימה הזאת?', value: 'food' },
          { text: 'מאימתי בדיוק זה "מאימתי"?', value: 'meta' }
        ]);
        if (pick === 'food') {
          await gabbaiSay(g, 'יש עני עם פת במלח בכיכר. הוא מאוד נדיב. וגם מאוד עני.');
          await g.playerSay('נסגר. אני בפנים.');
        } else if (pick === 'meta') {
          await gabbaiSay(g, 'זו בדיוק השאלה שהארון שואל! אתה מוכן! כמעט! בערך! לא ממש!');
        } else {
          await gabbaiSay(g, 'ידעתי שאפשר לסמוך עליך! אתה התלמיד היחיד שנשאר ער אחרי השיעור!');
        }
      }

      await gabbaiSay(g, 'הארון ייפתח רק למי שיאסוף שלושה חותמות: חותם הכוכבים, חותם חצות וחותם המשמרות!');
      await gabbaiSay(g, 'ואז... הוא ישאל את שאלות הדף. תלמד את הדף, זרח. הדף הוא המפתח!');
      await g.playerSay('שלושה חותמות, דף אחד, לילה אחד. כמה קשה זה כבר יכול להיות?');
      safeSfx(g, 'star');

      await showCaption('הַמְּשִׂימָה: אֱסֹף שְׁלוֹשָׁה חוֹתָמוֹת וּפְתַח אֶת אֲרוֹן הַזְּמַנִּים', 3000, g);

      if (typeof g.flag === 'function') g.flag('introDone', true);
    } catch (e) {
      // Never let the intro kill the game.
      try { console.error('intro cutscene error:', e); } catch (e2) { /* noop */ }
      if (veil) removeEl(veil);
    }
  }

  // ------------------------------------------------------------------------
  // ENDING cutscene — light cascade from the ark, the whole village says
  // Shema, dawn breaks (amud hashachar), closing card + credits.
  // ------------------------------------------------------------------------

  // Draw the finale animation on an overlay canvas.
  // Phases (by seconds): 0-2 light cascade, 2-5.5 shema night sky,
  // 5.5-10 dawn gradient + rising sun + village silhouette.
  function runFinaleCanvas(stage, totalMs) {
    return new Promise(function (resolve) {
      var cv = makeEl('canvas', 'finale-canvas');
      cv.width = 320;
      cv.height = 180;
      stage.appendChild(cv);
      var ctx = cv.getContext('2d');
      if (!ctx) { removeEl(cv); resolve(null); return; }
      ctx.imageSmoothingEnabled = false;

      var NIGHT = [10, 10, 35];
      var DAWN_TOP = [35, 35, 102];
      var DAWN_BOT = [255, 140, 66];

      function lerp(a, b, k) { return a + (b - a) * k; }
      function mix(c1, c2, k) {
        return 'rgb(' + Math.round(lerp(c1[0], c2[0], k)) + ',' +
          Math.round(lerp(c1[1], c2[1], k)) + ',' + Math.round(lerp(c1[2], c2[2], k)) + ')';
      }

      // Fixed pseudo-random star field.
      var stars = [];
      for (var i = 0; i < 60; i++) {
        var sx = (i * 53 + 17) % 320;
        var sy = ((i * 37 + 5) % 110);
        stars.push({ x: sx, y: sy, tw: (i % 7) / 7 });
      }

      // Village silhouette skyline: [x, w, h] house blocks along the bottom.
      var houses = [
        [0, 34, 26], [36, 26, 34], [64, 30, 22], [96, 24, 40], [122, 34, 28],
        [158, 26, 36], [186, 30, 24], [218, 26, 32], [246, 34, 26], [282, 38, 30]
      ];

      var start = performance.now();

      function frame(now) {
        var ms = now - start;
        var s = ms / 1000;
        var p = Math.min(1, ms / totalMs);

        // dawnK: 0 while night, ramps to 1 during the last phase.
        var dawnK = Math.max(0, Math.min(1, (s - 5.5) / 4));

        // Sky bands (hard-banded gradient, retro dither feel).
        var bands = 9;
        for (var b = 0; b < bands; b++) {
          var by = (180 / bands) * b;
          var kTop = b / (bands - 1);
          var nightBand = [
            NIGHT[0] + kTop * 8,
            NIGHT[1] + kTop * 8,
            NIGHT[2] + kTop * 10
          ];
          var dawnBand = [
            lerp(DAWN_TOP[0], DAWN_BOT[0], kTop),
            lerp(DAWN_TOP[1], DAWN_BOT[1], kTop),
            lerp(DAWN_TOP[2], DAWN_BOT[2], kTop)
          ];
          ctx.fillStyle = mix(nightBand, dawnBand, dawnK);
          ctx.fillRect(0, by, 320, 180 / bands + 1);
        }

        // Stars: bloom during shema phase, fade with dawn.
        var starAlpha = Math.min(1, s / 2.5) * (1 - dawnK);
        if (starAlpha > 0.02) {
          for (var j = 0; j < stars.length; j++) {
            var st = stars[j];
            var tw = 0.55 + 0.45 * Math.sin(s * 3 + st.tw * 6.28);
            ctx.globalAlpha = starAlpha * tw;
            ctx.fillStyle = j % 9 === 0 ? '#ffd166' : '#ffffff';
            ctx.fillRect(st.x, st.y, 1, 1);
            if (j % 5 === 0) {
              ctx.fillRect(st.x - 1, st.y, 1, 1);
              ctx.fillRect(st.x + 1, st.y, 1, 1);
              ctx.fillRect(st.x, st.y - 1, 1, 1);
              ctx.fillRect(st.x, st.y + 1, 1, 1);
            }
          }
          ctx.globalAlpha = 1;
        }

        // Phase 1: light cascade — golden rays bursting from the ark (center).
        if (s < 2.6) {
          var burst = s < 2 ? Math.min(1, s / 0.6) : Math.max(0, 1 - (s - 2) / 0.6);
          var cx = 160, cy = 92;
          ctx.globalAlpha = burst * 0.85;
          for (var r = 0; r < 14; r++) {
            var ang = (r / 14) * Math.PI * 2 + s * 0.7;
            var len = 30 + 130 * Math.min(1, s / 1.6);
            ctx.strokeStyle = r % 2 === 0 ? '#ffd166' : '#fff6d8';
            ctx.lineWidth = r % 3 === 0 ? 3 : 1;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
            ctx.stroke();
          }
          // core glow
          for (var gRad = 26; gRad > 4; gRad -= 6) {
            ctx.globalAlpha = burst * (0.14 + (26 - gRad) * 0.012);
            ctx.fillStyle = '#fff6d8';
            ctx.fillRect(cx - gRad, cy - gRad, gRad * 2, gRad * 2);
          }
          ctx.globalAlpha = 1;
        }

        // Rising sun (amud hashachar) during dawn phase.
        if (dawnK > 0) {
          var sunY = 158 - dawnK * 26; // edge peeks over the horizon
          for (var ring = 22; ring >= 10; ring -= 4) {
            ctx.globalAlpha = 0.10;
            ctx.fillStyle = '#ffd166';
            ctx.beginPath();
            ctx.arc(160, sunY, ring, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#fff1b8';
          ctx.beginPath();
          ctx.arc(160, sunY, 9, 0, Math.PI * 2);
          ctx.fill();
        }

        // Village silhouette + tiny villagers standing together.
        ctx.fillStyle = dawnK > 0 ? mix([10, 10, 30], [58, 38, 40], dawnK * 0.6) : '#0a0a1e';
        for (var h = 0; h < houses.length; h++) {
          var ho = houses[h];
          ctx.fillRect(ho[0], 180 - 14 - ho[2], ho[1], ho[2]);
          // domed roof
          ctx.beginPath();
          ctx.arc(ho[0] + ho[1] / 2, 180 - 14 - ho[2], ho[1] / 2, Math.PI, 0);
          ctx.fill();
        }
        ctx.fillRect(0, 166, 320, 14);

        // Amber windows flick on one by one during the shema phase.
        var lit = Math.floor(Math.max(0, s - 1.2) * 4);
        ctx.fillStyle = '#ffb347';
        for (var wI = 0; wI < Math.min(lit, houses.length * 2); wI++) {
          var hh = houses[wI % houses.length];
          var wx = hh[0] + 4 + (wI % 2) * Math.max(4, hh[1] - 12);
          var wy = 180 - 14 - hh[2] + 6 + Math.floor(wI / houses.length) * 8;
          ctx.fillRect(wx, wy, 3, 4);
        }

        // Villagers: little heads bobbing gently (saying Shema together).
        for (var v = 0; v < 12; v++) {
          var vx = 24 + v * 24;
          var bob = Math.sin(s * 2 + v) * 1.2;
          ctx.fillStyle = '#06061a';
          ctx.fillRect(vx, 158 + bob, 4, 8);
          ctx.beginPath();
          ctx.arc(vx + 2, 156 + bob, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        if (p < 1) {
          requestAnimationFrame(frame);
        } else {
          resolve(cv); // caller removes the canvas when done
        }
      }

      requestAnimationFrame(frame);
    });
  }

  async function ending(g) {
    var stage = getStage();
    var finaleCanvas = null;
    var shema = null;

    try {
      safeSfx(g, 'win');
      safeMusic('dawn');

      if (stage) {
        // Kick off the 10s canvas show; overlay text rides on top of it.
        var canvasDone = runFinaleCanvas(stage, 10000);

        await showCaption('הָאָרוֹן נִפְתָּח בְּמַפַּל שֶׁל אוֹר!', 2200, g);
        safeSfx(g, 'magic');

        // The whole village says Shema together.
        shema = makeEl('div', 'shema-overlay',
          '<div class="shema-text">שְׁמַע יִשְׂרָאֵל<br>ה׳ אֱלֹהֵינוּ ה׳ אֶחָד</div>');
        stage.appendChild(shema);
        await wait(g, 3400);
        removeEl(shema);
        shema = null;

        await showCaption('וְהִנֵּה — עַמּוּד הַשַּׁחַר עוֹלֶה!', 2400, g);
        safeSfx(g, 'star');

        finaleCanvas = await canvasDone;
      } else {
        await wait(g, 1000);
      }

      // Closing dialogue beats.
      await g.playerSay('מעריב אחד, שלושה חותמות, ולילה שלם של גמרא. לא רע ללילה אחד.');
      await gabbaiSay(g, 'והשעון שלי... הוא מראה שעה! שעה אמיתית! זרח, אתה גאון הדף!');

      // Closing card + funny credits.
      if (stage) {
        var card = makeEl('div', 'endcard',
          '<h2 class="endcard-title">וזה היה רק הדף הראשון.</h2>' +
          '<p class="endcard-sub">דף ב עמוד א — סיימת אותו באמת. 🎉</p>' +
          '<ul class="credits">' +
          '<li>בימוי: התנא (היכא דקאי? אקרא קאי)</li>' +
          '<li>תאורה: צאת הכוכבים בע״מ — שלושה בינוניים, באחריות</li>' +
          '<li>פסקול: השאגה של מעלה, בביצוע אריה השומר</li>' +
          '<li>קייטרינג: פת במלח (שף: העני של הברייתא)</li>' +
          '<li>בטיחות תרומה: הכהן פנחס. אל תיגעו. באמת.</li>' +
          '<li>ייעוץ הלכתי לשעונים: אין. בגלל זה כולם התקלקלו</li>' +
          '<li>אף חתול לא נלקח במהלך ההרפתקה. רש״י ניסה למנוע גם את זה</li>' +
          '<li>בקרוב: דף ב עמוד ב — «משעה שהעני נכנס לאכול פתו במלח»</li>' +
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

      if (finaleCanvas) {
        // Keep the dawn frame behind the endcard; it is z-indexed below it.
        finaleCanvas.style.opacity = '0.6';
      }
    } catch (e) {
      try { console.error('ending cutscene error:', e); } catch (e2) { /* noop */ }
      removeEl(shema);
    }
  }

  // ------------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------------

  // Expose registries for scenes (e.g. g.addSeal('stars', SEALS.stars)).
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
