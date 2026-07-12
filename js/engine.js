'use strict';
/* ============================================================
 * DAF QUEST — engine.js
 * SCUMM-style point-and-click engine. Exposes window.GAME.
 * Vanilla JS, no deps. Logical resolution 320x180.
 * May use window.SPRITES and window.AUDIO (both optional-safe).
 * ============================================================ */
(function () {

  // ---------- constants ----------
  var WALK_SPEED = 55;        // logical px / second
  var STEP_SFX_INTERVAL = 0.32;
  var FADE_MS = 340;

  var VERB_LABEL = { look: 'הבט על', talk: 'דבר עם', take: 'קח את', use: 'השתמש ב־' };
  var TYPE_LABEL = { char: 'דבר עם', object: 'הבט על', exit: 'לך אל' };

  // Hebrew fallback lines for missing handlers ({name} is substituted)
  var DEFAULT_LINES = {
    look: [
      'סתם {name}. או שלא?',
      'זה {name}. נראה בדיוק כמו שזה נשמע.',
      'המ... {name}. מעניין, אבל לא לענייננו.'
    ],
    talk: [
      'זה לא ממש מדבר. מביך.',
      'שלום? ...כלום. אפילו לא הד.',
      'דיברתי עם {name}. אמא הייתה גאה.'
    ],
    take: [
      'זה לא זז. כמו חמור עקשן.',
      'לא בא בחשבון. כבד מדי, וגם לא שלי.',
      'ניסיתי לקחת. {name} ניסה חזק יותר.'
    ],
    use: [
      'זה לא עובד. אולי חסר לי משהו מהדף?',
      'שום דבר לא קורה. אפילו לא נס קטן.',
      'לא ככה משתמשים בזה, כנראה.'
    ]
  };

  // ---------- module state ----------
  var scenes = {};
  var cfg = null;
  var canvas = null, ctx = null;
  var stageEl = null, statusEl = null, invEl = null, hudEl = null, fadeEl = null;
  var verbButtons = [];
  var itemsById = {};

  var currentScene = null;
  var player = { x: 160, y: 150, flip: false, walking: false };
  var walk = null;            // { x, y, resolve }
  var inputLocked = 0;        // counter; >0 means canvas input disabled
  var selectedVerb = null;    // 'look' | 'talk' | 'take' | 'use' | null
  var selectedItem = null;    // item id or null
  var clickSeq = 0;           // stale-action guard
  var hoverHotspot = null;
  var sayChain = Promise.resolve();
  var dismissCurrentBubble = null;
  var toastCount = 0;
  var stepTimer = 0;
  var t0 = 0, lastNow = 0;
  var booted = false;

  // ---------- tiny helpers ----------
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function fmt(line, name) { return line.replace(/\{name\}/g, name || 'זה'); }
  function el(tag, cls) { var d = document.createElement(tag); if (cls) d.className = cls; return d; }
  function wait(ms) { return new Promise(function (res) { setTimeout(res, ms | 0); }); }

  function sfx(name) {
    try { if (window.AUDIO && typeof AUDIO.sfx === 'function') AUDIO.sfx(name); }
    catch (e) { /* audio must never crash the game */ }
  }

  function itemName(id) {
    var it = itemsById[id];
    return it && it.name ? it.name : String(id);
  }

  // Convert a world (logical canvas) point to CSS px inside #stage.
  // Canvas may be CSS-scaled, so derive the factor from its live rect.
  function worldToStage(wx, wy) {
    var cr = canvas.getBoundingClientRect();
    var sr = stageEl.getBoundingClientRect();
    var s = cr.width / (canvas.width || 320);
    return { x: cr.left - sr.left + wx * s, y: cr.top - sr.top + wy * s, s: s };
  }

  function toLogical(e) {
    var r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return { x: 0, y: 0 };
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height)
    };
  }

  function isVisible(h) {
    if (!h) return false;
    if (typeof h.visible === 'function') {
      try { return !!h.visible(GAME.state); } catch (e) { return true; }
    }
    return true;
  }

  function hitTest(pt) {
    if (!currentScene || !currentScene.hotspots) return null;
    var hs = currentScene.hotspots;
    // Later-declared hotspots win (they draw on top).
    for (var i = hs.length - 1; i >= 0; i--) {
      var h = hs[i];
      if (!isVisible(h)) continue;
      if (pt.x >= h.x && pt.x <= h.x + h.w && pt.y >= h.y && pt.y <= h.y + h.h) return h;
    }
    return null;
  }

  function floorBand() {
    var f = currentScene && currentScene.floor;
    if (f && typeof f.yMin === 'number' && typeof f.yMax === 'number') return f;
    return { yMin: 100, yMax: 175 };
  }

  function playerScale() {
    var f = floorBand();
    if (f.yMax === f.yMin) return 1;
    var r = clamp((player.y - f.yMin) / (f.yMax - f.yMin), 0, 1);
    return 0.6 + 0.4 * r;
  }

  function defaultWalkPoint(h) {
    if (h.walkTo && typeof h.walkTo.x === 'number') return h.walkTo;
    var f = floorBand();
    return { x: h.x + h.w / 2, y: clamp(h.y + h.h, f.yMin, f.yMax) };
  }

  // ---------- walking ----------
  function startWalk(x, y) {
    var f = floorBand();
    var tx = clamp(x, 4, (canvas ? canvas.width : 320) - 4);
    var ty = clamp(y, f.yMin, f.yMax);
    if (walk && walk.resolve) walk.resolve(); // release a superseded walk
    return new Promise(function (resolve) {
      walk = { x: tx, y: ty, resolve: resolve };
    });
  }

  function updatePlayer(dt) {
    if (!walk) { player.walking = false; return; }
    var dx = walk.x - player.x, dy = walk.y - player.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var step = WALK_SPEED * dt;
    if (dist <= step || dist < 0.5) {
      player.x = walk.x; player.y = walk.y;
      player.walking = false;
      var done = walk; walk = null;
      if (done.resolve) done.resolve();
      return;
    }
    player.x += dx / dist * step;
    player.y += dy / dist * step;
    if (Math.abs(dx) > 0.4) player.flip = dx < 0;
    player.walking = true;
    stepTimer -= dt;
    if (stepTimer <= 0) { sfx('step'); stepTimer = STEP_SFX_INTERVAL; }
  }

  // ---------- render loop ----------
  function frame(now) {
    if (!t0) { t0 = now; lastNow = now; }
    var t = (now - t0) / 1000;
    var dt = clamp((now - lastNow) / 1000, 0, 0.05);
    lastNow = now;

    updatePlayer(dt);

    if (ctx && currentScene) {
      ctx.imageSmoothingEnabled = false;
      try { currentScene.paint(ctx, t, GAME.state); }
      catch (e) { ctx.fillStyle = '#0a0a23'; ctx.fillRect(0, 0, canvas.width, canvas.height); }

      // depth-sorted draws: hotspots by rect bottom, player by feet y
      var draws = [];
      var hs = currentScene.hotspots || [];
      for (var i = 0; i < hs.length; i++) {
        var h = hs[i];
        if (typeof h.draw === 'function' && isVisible(h)) {
          draws.push({ depth: h.y + h.h, hotspot: h });
        }
      }
      draws.push({ depth: player.y, playerDraw: true });
      draws.sort(function (a, b) { return a.depth - b.depth; });

      for (var j = 0; j < draws.length; j++) {
        var d = draws[j];
        try {
          if (d.playerDraw) {
            if (window.SPRITES && typeof SPRITES.drawPlayer === 'function') {
              SPRITES.drawPlayer(ctx, player.x, player.y, t, player.walking, player.flip, playerScale());
            }
          } else {
            d.hotspot.draw(ctx, t, GAME.state);
          }
        } catch (e) { /* one bad draw must not kill the frame */ }
      }
    }
    requestAnimationFrame(frame);
  }

  // ---------- speech bubbles ----------
  function showBubble(text, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var b = el('div', 'bubble');
      b.dir = 'rtl';
      b.textContent = String(text);
      if (opts.color) b.style.color = opts.color;
      else if (opts.who === 'player') b.style.color = '#ffe9a8';
      // defensive inline base — style.css refines the look
      b.style.position = 'absolute';
      b.style.zIndex = '30';
      b.style.pointerEvents = 'auto';
      b.style.cursor = 'pointer';

      var sr = stageEl.getBoundingClientRect();
      b.style.maxWidth = Math.max(140, Math.floor(sr.width * 0.55)) + 'px';
      stageEl.appendChild(b);

      // anchor point in world coords
      var wx, wy;
      if (typeof opts.x === 'number' && typeof opts.y === 'number') {
        wx = opts.x; wy = opts.y;
      } else if (opts.who && opts.who !== 'player') {
        var host = null;
        var hs = (currentScene && currentScene.hotspots) || [];
        for (var i = 0; i < hs.length; i++) if (hs[i].id === opts.who) { host = hs[i]; break; }
        if (host) { wx = host.x + host.w / 2; wy = host.y - 2; }
        else { wx = player.x; wy = player.y - 32 * playerScale(); }
      } else {
        wx = player.x; wy = player.y - 32 * playerScale();
      }

      var p = worldToStage(wx, wy);
      var bw = b.offsetWidth, bh = b.offsetHeight;
      b.style.left = clamp(p.x - bw / 2, 2, Math.max(2, sr.width - bw - 2)) + 'px';
      b.style.top = clamp(p.y - bh - 4, 2, Math.max(2, sr.height - bh - 2)) + 'px';

      var ms = 1200 + 55 * String(text).length;
      var timer = setTimeout(done, ms);
      var finished = false;
      function done() {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (dismissCurrentBubble === done) dismissCurrentBubble = null;
        if (b.parentNode) b.parentNode.removeChild(b);
        resolve();
      }
      dismissCurrentBubble = done;
      b.addEventListener('pointerdown', function (e) { e.stopPropagation(); done(); });
    });
  }

  function say(text, opts) {
    // sequential queue — bubbles never overlap in time
    sayChain = sayChain.then(function () { return showBubble(text, opts); });
    return sayChain;
  }

  // ---------- choose menu ----------
  function choose(options) {
    return new Promise(function (resolve) {
      inputLocked++;
      var box = el('div', 'choices');
      box.dir = 'rtl';
      box.style.position = 'absolute';
      box.style.left = '0';
      box.style.right = '0';
      box.style.bottom = '0';
      box.style.zIndex = '40';
      (options || []).forEach(function (o) {
        var c = el('div', 'choice');
        c.dir = 'rtl';
        c.textContent = o && o.text != null ? o.text : '...';
        c.style.cursor = 'pointer';
        c.addEventListener('click', function (e) {
          e.stopPropagation();
          if (box.parentNode) box.parentNode.removeChild(box);
          inputLocked = Math.max(0, inputLocked - 1);
          sfx('click');
          resolve(o ? o.value : undefined);
        });
        box.appendChild(c);
      });
      stageEl.appendChild(box);
    });
  }

  // ---------- toasts ----------
  function toast(text) {
    if (!stageEl) return;
    var d = el('div', 'toast');
    d.dir = 'rtl';
    d.textContent = String(text);
    d.style.position = 'absolute';
    d.style.top = (8 + toastCount * 30) + 'px';
    d.style.zIndex = '50';
    d.style.pointerEvents = 'none';
    stageEl.appendChild(d);
    toastCount++;
    setTimeout(function () {
      if (d.parentNode) d.parentNode.removeChild(d);
      toastCount = Math.max(0, toastCount - 1);
    }, 2400);
  }

  // ---------- fade ----------
  function makeFadeEl() {
    fadeEl = el('div', 'fade');
    fadeEl.style.position = 'absolute';
    fadeEl.style.left = '0';
    fadeEl.style.top = '0';
    fadeEl.style.right = '0';
    fadeEl.style.bottom = '0';
    fadeEl.style.background = '#000';
    fadeEl.style.zIndex = '60';
    fadeEl.style.transition = 'opacity ' + FADE_MS + 'ms ease';
    fadeEl.style.opacity = '1';
    fadeEl.style.pointerEvents = 'none';
    stageEl.appendChild(fadeEl);
  }

  function fadeOut() {
    if (!fadeEl) return Promise.resolve();
    fadeEl.style.pointerEvents = 'auto';
    fadeEl.style.opacity = '1';
    return wait(FADE_MS + 30);
  }

  function fadeIn() {
    if (!fadeEl) return Promise.resolve();
    fadeEl.style.opacity = '0';
    return wait(FADE_MS + 30).then(function () {
      if (fadeEl) fadeEl.style.pointerEvents = 'none';
    });
  }

  // ---------- HUD / inventory rendering ----------
  function renderHud() {
    if (!hudEl || !cfg || typeof cfg.hud !== 'function') return;
    try { hudEl.innerHTML = cfg.hud(GAME.state); }
    catch (e) { /* bad hud must not crash */ }
  }

  // deterministic fallback color per sprite-map char (when item icon has no palette)
  var AUTO_COLORS = ['#e8d8a8', '#ffd166', '#1f7a8c', '#e63946', '#a26bd4', '#8f8fb0', '#ff8c42', '#6b6b8f', '#ffb347', '#7a512f'];
  function autoPal(map) {
    var pal = {};
    for (var r = 0; r < map.length; r++) {
      var row = map[r];
      for (var c = 0; c < row.length; c++) {
        var ch = row[c];
        if (ch === '.' || ch === ' ' || pal[ch]) continue;
        pal[ch] = AUTO_COLORS[ch.charCodeAt(0) % AUTO_COLORS.length];
      }
    }
    return pal;
  }

  function renderInventory() {
    if (!invEl) return;
    invEl.innerHTML = '';
    GAME.state.inventory.forEach(function (id) {
      var item = itemsById[id];
      var cell = el('canvas', 'inv-item' + (selectedItem === id ? ' selected' : ''));
      cell.width = 32; cell.height = 32;
      cell.title = item ? (item.name + (item.desc ? ' — ' + item.desc : '')) : id;
      try {
        var icon = item && item.icon;
        var map = icon && icon.map ? icon.map : icon;
        if (map && map.length && window.SPRITES && typeof SPRITES.draw === 'function') {
          var pal = (icon && icon.pal) ? icon.pal : autoPal(map);
          var mw = 0;
          for (var i = 0; i < map.length; i++) mw = Math.max(mw, map[i].length);
          var sc = Math.min(28 / mw, 28 / map.length);
          var c2 = cell.getContext('2d');
          c2.imageSmoothingEnabled = false;
          SPRITES.draw(c2, map, pal, (32 - mw * sc) / 2, (32 - map.length * sc) / 2, sc, false);
        }
      } catch (e) { /* icon failure = blank cell, not a crash */ }
      cell.addEventListener('click', function () {
        selectedItem = (selectedItem === id) ? null : id;
        if (selectedItem) selectedVerb = null; // item selection implies "use item on..."
        sfx('click');
        renderInventory();
        updateVerbUI();
        updateStatus();
      });
      invEl.appendChild(cell);
    });
  }

  // ---------- verbs / status line ----------
  function updateVerbUI() {
    verbButtons.forEach(function (btn) {
      var v = btn.getAttribute('data-verb');
      if (v === selectedVerb) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }

  function clearVerbAndItem() {
    selectedVerb = null;
    selectedItem = null;
    updateVerbUI();
    renderInventory();
  }

  function statusText(h) {
    var usingItem = selectedItem && (!selectedVerb || selectedVerb === 'use');
    if (!h) {
      if (usingItem) return 'השתמש ב־' + itemName(selectedItem) + ' על...';
      if (selectedVerb) return VERB_LABEL[selectedVerb] || '';
      return '';
    }
    var name = h.name || h.id || '';
    if (usingItem) return 'השתמש ב־' + itemName(selectedItem) + ' על ' + name;
    if (selectedVerb === 'use') return 'השתמש ב־' + name;
    if (selectedVerb) return (VERB_LABEL[selectedVerb] || '') + ' ' + name;
    return (TYPE_LABEL[h.type] || 'הבט על') + ' ' + name;
  }

  function updateStatus() {
    if (statusEl) statusEl.textContent = statusText(hoverHotspot);
  }

  // ---------- actions ----------
  function runVerb(h, verb, itemId) {
    var fn = h ? h[verb] : null;
    var run;
    if (typeof fn === 'function') {
      run = Promise.resolve().then(function () {
        return verb === 'use' ? fn(gApi, itemId || null) : fn(gApi);
      });
    } else {
      run = gApi.playerSay(fmt(pick(DEFAULT_LINES[verb] || DEFAULT_LINES.look), h && h.name));
    }
    return run.catch(function (err) {
      try { console.error('handler failed:', h && h.id, verb, err); } catch (e2) { }
    });
  }

  function walkToHotspot(h, seq) {
    var p = defaultWalkPoint(h);
    return startWalk(p.x, p.y).then(function () {
      return seq === clickSeq; // false if the player clicked elsewhere meanwhile
    });
  }

  function handleClick(pt) {
    var seq = ++clickSeq;
    var h = hitTest(pt);
    var afterAction = function () { renderHud(); renderInventory(); updateStatus(); };

    // verb explicitly selected on the verb bar
    if (selectedVerb) {
      var verb = selectedVerb;
      var item = selectedItem;
      selectedVerb = null;
      if (verb === 'use') selectedItem = null;
      updateVerbUI();
      renderInventory();
      if (!h) { startWalk(pt.x, pt.y); updateStatus(); return; }
      if (verb === 'look') { runVerb(h, 'look').then(afterAction); return; } // look never walks
      walkToHotspot(h, seq).then(function (ok) {
        if (!ok) return;
        return runVerb(h, verb, verb === 'use' ? item : null);
      }).then(afterAction);
      return;
    }

    // item selected in inventory = implicit "use item on target"
    if (selectedItem && h) {
      var itemId = selectedItem;
      selectedItem = null;
      renderInventory();
      walkToHotspot(h, seq).then(function (ok) {
        if (!ok) return;
        return runVerb(h, 'use', itemId);
      }).then(afterAction);
      return;
    }
    if (selectedItem && !h) {
      selectedItem = null; // clicking empty floor drops the selection
      renderInventory();
      startWalk(pt.x, pt.y);
      updateStatus();
      return;
    }

    // default mode
    if (!h) { startWalk(pt.x, pt.y); return; }
    if (h.type === 'char') {
      walkToHotspot(h, seq).then(function (ok) {
        if (!ok) return;
        return runVerb(h, 'talk');
      }).then(afterAction);
    } else if (h.type === 'exit') {
      walkToHotspot(h, seq).then(function (ok) {
        if (!ok) return;
        if (h.target) return gApi.goto(h.target, h.spawn);
        return runVerb(h, 'look');
      }).then(afterAction);
    } else {
      // objects: look, no walk needed
      runVerb(h, 'look').then(afterAction);
    }
  }

  // ---------- scene switching ----------
  function placePlayer(spawn) {
    var f = floorBand();
    if (spawn && typeof spawn.x === 'number' && typeof spawn.y === 'number') {
      player.x = clamp(spawn.x, 4, (canvas ? canvas.width : 320) - 4);
      player.y = clamp(spawn.y, f.yMin, f.yMax);
    } else {
      player.x = 160;
      player.y = clamp((f.yMin + f.yMax) / 2 + 10, f.yMin, f.yMax);
    }
    player.walking = false;
  }

  function gotoScene(sceneId, spawn) {
    var def = scenes[sceneId];
    if (!def) {
      try { console.error('unknown scene:', sceneId); } catch (e) { }
      return Promise.resolve();
    }
    return fadeOut().then(function () {
      if (walk && walk.resolve) { walk.resolve(); walk = null; }
      GAME.state.scene = sceneId;
      currentScene = def;
      hoverHotspot = null;
      placePlayer(spawn);
      renderHud();
      updateStatus();
      return fadeIn();
    }).then(function () {
      if (typeof def.onEnter === 'function') {
        return Promise.resolve().then(function () { return def.onEnter(gApi); })
          .catch(function (err) { try { console.error('onEnter failed:', sceneId, err); } catch (e2) { } });
      }
    }).then(function () { renderHud(); });
  }

  // ---------- game API (g) ----------
  var gApi = {
    say: function (text, opts) { return say(text, opts); },
    playerSay: function (text) { return say(text, { who: 'player' }); },
    choose: function (options) { return choose(options); },
    give: function (itemId) {
      if (gApi.has(itemId)) return;
      GAME.state.inventory.push(itemId);
      toast('קיבלת: ' + itemName(itemId));
      sfx('pickup');
      renderInventory();
      renderHud();
    },
    remove: function (itemId) {
      var idx = GAME.state.inventory.indexOf(itemId);
      if (idx >= 0) GAME.state.inventory.splice(idx, 1);
      if (selectedItem === itemId) selectedItem = null;
      renderInventory();
      renderHud();
    },
    has: function (itemId) { return GAME.state.inventory.indexOf(itemId) >= 0; },
    flag: function (name, value) {
      if (arguments.length >= 2) {
        GAME.state.flags[name] = value;
        renderHud();
        return value;
      }
      return GAME.state.flags[name];
    },
    addSeal: function (id, labelHe) {
      if (gApi.hasSeal(id)) return;
      GAME.state.seals.push(id);
      sfx('seal');
      toast('חותם נוסף: ' + (labelHe || id));
      renderHud();
    },
    hasSeal: function (id) { return GAME.state.seals.indexOf(id) >= 0; },
    goto: function (sceneId, spawn) { return gotoScene(sceneId, spawn); },
    walkTo: function (x, y) { return startWalk(x, y); },
    sfx: function (name) { sfx(name); },
    cutscene: function (fn) {
      inputLocked++;
      if (stageEl) stageEl.classList.add('cutscene');
      return Promise.resolve().then(function () { return fn(gApi); })
        .catch(function (err) { try { console.error('cutscene failed:', err); } catch (e2) { } })
        .then(function () {
          inputLocked = Math.max(0, inputLocked - 1);
          if (stageEl && inputLocked === 0) stageEl.classList.remove('cutscene');
        });
    },
    wait: function (ms) { return wait(ms); },
    win: function () {
      if (GAME.state.flags.won) return;
      GAME.state.flags.won = true;
      renderHud();
      if (cfg && typeof cfg.ending === 'function') gApi.cutscene(cfg.ending);
    }
  };

  // ---------- input binding ----------
  function bindInput() {
    // audio unlock on the very first pointerdown anywhere
    document.addEventListener('pointerdown', function () {
      try { if (window.AUDIO && typeof AUDIO.unlock === 'function') AUDIO.unlock(); }
      catch (e) { /* silent */ }
    }, { once: true });

    canvas.addEventListener('click', function (e) {
      if (inputLocked > 0) {
        // clicking during a cutscene skips the current speech bubble
        if (dismissCurrentBubble) dismissCurrentBubble();
        return;
      }
      handleClick(toLogical(e));
    });

    canvas.addEventListener('mousemove', function (e) {
      var h = (inputLocked > 0) ? null : hitTest(toLogical(e));
      if (h !== hoverHotspot) {
        hoverHotspot = h;
        updateStatus();
      }
    });

    canvas.addEventListener('mouseleave', function () {
      hoverHotspot = null;
      updateStatus();
    });

    verbButtons = Array.prototype.slice.call(document.querySelectorAll('[data-verb]'));
    verbButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var v = btn.getAttribute('data-verb');
        if (!VERB_LABEL[v]) return;
        selectedVerb = (selectedVerb === v) ? null : v;
        if (selectedVerb && selectedVerb !== 'use') selectedItem = null;
        sfx('click');
        updateVerbUI();
        renderInventory();
        updateStatus();
      });
    });
  }

  // ---------- public GAME object ----------
  var GAME = {
    state: { flags: {}, inventory: [], scene: '', seals: [] },

    // scene registry, public per spec (also used by e2e tests)
    scenes: scenes,

    registerScene: function (id, def) {
      if (!id || !def) return;
      scenes[id] = def;
    },

    boot: function (bootCfg) {
      if (booted) return;
      booted = true;
      cfg = bootCfg || {};

      canvas = cfg.canvas || document.querySelector('canvas');
      if (!canvas) {
        try { console.error('GAME.boot: no canvas found'); } catch (e) { }
        return;
      }
      ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      canvas.style.cursor = 'crosshair';

      stageEl = document.getElementById('stage') || canvas.parentElement || document.body;
      statusEl = document.getElementById('status');
      invEl = document.getElementById('inventory') || document.getElementById('inv') ||
        document.querySelector('.inventory');
      hudEl = document.getElementById('hud') || document.querySelector('.hud');

      itemsById = {};
      (cfg.items || []).forEach(function (it) { if (it && it.id) itemsById[it.id] = it; });

      makeFadeEl();
      bindInput();

      // start scene (direct switch, no fade-out — we open from black)
      var startId = cfg.startScene;
      if (!scenes[startId]) {
        // fall back to the first registered scene so a typo never blanks the game
        for (var k in scenes) { if (Object.prototype.hasOwnProperty.call(scenes, k)) { startId = k; break; } }
      }
      var startDef = scenes[startId] || null;
      GAME.state.scene = startId || '';
      currentScene = startDef;
      placePlayer(null);

      renderHud();
      renderInventory();
      updateStatus();
      requestAnimationFrame(frame);

      // open from black, run intro cutscene, then start-scene onEnter
      fadeIn().then(function () {
        if (typeof cfg.intro === 'function') return gApi.cutscene(cfg.intro);
      }).then(function () {
        if (startDef && typeof startDef.onEnter === 'function') {
          return Promise.resolve().then(function () { return startDef.onEnter(gApi); })
            .catch(function (err) { try { console.error('onEnter failed:', startId, err); } catch (e2) { } });
        }
      }).then(function () { renderHud(); });
    }
  };

  window.GAME = GAME;

})();
