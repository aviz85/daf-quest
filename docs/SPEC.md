# DAF QUEST — "תעלומת השמע האבוד" (The Mystery of the Lost Shema)

A SCUMM-style pixel-art point-and-click adventure teaching the FIRST PAGE OF THE TALMUD
(Berakhot 2a — "מאימתי קורין את שמע בערבין"). Beautiful detailed pixel art, wild humor,
puzzles solvable only by knowing the daf.

## HARD RULES (every agent)

- Vanilla JS + Canvas 2D. ZERO dependencies, no build step, no modules — plain `<script>` globals.
- ES2020, `'use strict'` per file.
- ALL code, comments, identifiers, console logs: ENGLISH ONLY.
- ALL player-facing in-game strings: HEBREW ONLY (dialogue, names, UI labels, quiz).
- Hebrew strings must never contain `→` arrows; use `←` if an arrow is needed.
- Logical resolution 320x180, scaled up with `image-rendering: pixelated`.
- You own ONLY your assigned file(s). Never create or edit other files.
- Before finishing, run `node --check <yourfile>` and fix any syntax error.
- Defensive coding: never crash if a handler/flag is missing.

## FILE LAYOUT & LOAD ORDER (index.html loads in this order)

```
index.html            (shell agent)
style.css             (shell agent)
js/sprites.js         -> window.SPRITES   (sprites agent)
js/audio.js           -> window.AUDIO     (audio agent)
js/engine.js          -> window.GAME      (engine agent; may use SPRITES, AUDIO)
js/scenes/square.js       GAME.registerScene('square', {...})
js/scenes/beitmidrash.js  GAME.registerScene('beitmidrash', {...})
js/scenes/kohen.js        GAME.registerScene('kohen', {...})
js/scenes/roof.js         GAME.registerScene('roof', {...})
js/scenes/road.js         GAME.registerScene('road', {...})
js/main.js            (shell agent; calls GAME.boot(...))
```

## ENGINE API CONTRACT (engine.js implements EXACTLY this)

`window.GAME`:

- `GAME.registerScene(id, def)` — store scene definition.
- `GAME.boot(cfg)` — called by main.js on DOMContentLoaded.
  `cfg = { canvas, startScene, items, intro(g), ending(g), hud(state) }`
  - `items`: array of `{ id, name(He), desc(He), icon }` (icon = sprite map, see SPRITES).
  - `intro(g)`: async cutscene run once at start. `ending(g)`: async, run when `g.flag('won')` set via `g.win()`.
  - `hud(state)`: returns HTML string for the HUD strip (seals etc.); engine re-renders it after every action.
- `GAME.state` = `{ flags:{}, inventory:[], scene:'', seals:[] }` (seals = array of seal ids).

Scene definition `def`:
- `name`: Hebrew display name.
- `floor`: `{ yMin, yMax }` — walkable Y band. Player scale: `0.6 + 0.4*(y-yMin)/(yMax-yMin)`, engine computes.
- `paint(ctx, t, S)` — draw full background EVERY frame. `t` = seconds since load, `S` = GAME.state. Must repaint everything (no clearing needed by scene).
- `hotspots`: array of:
  - `id`, `name` (Hebrew), `type`: `'object' | 'char' | 'exit'`
  - `x, y, w, h` — hit rect in logical px.
  - `walkTo: {x, y}` — player walks here before the action runs (optional; default = rect bottom-center clamped to floor band).
  - `visible(S)` — optional predicate; hidden hotspots don't draw or hit.
  - `draw(ctx, t, S)` — optional; engine calls after paint (sorted by hotspot y+h for depth vs player).
  - handlers (all optional, may be async): `look(g)`, `talk(g)`, `take(g)`, `use(g, itemId)`, plus for exits: `target` (scene id), `spawn: {x,y}`.
- `onEnter(g)` — optional, async ok.

Game API object `g` (engine passes to every handler/cutscene):
- `await g.say(text, opts)` — speech bubble. `opts = { who:'player'|hotspotId|null, color:'#hex', x, y }`.
  If `who:'player'` anchor above player; if x,y given anchor there. Bubble is an HTML div overlay,
  RTL, click-to-dismiss or auto after `1200 + 55*text.length` ms. Queue sequential.
- `await g.playerSay(text)` — shorthand.
- `await g.choose(options)` — SCUMM-style dialogue menu (HTML overlay, RTL list at bottom); `options = [{text, value}]`; resolves value.
- `g.give(itemId)` / `g.remove(itemId)` / `g.has(itemId)` — inventory; give shows a toast "קיבלת: <name>" and plays sfx 'pickup'.
- `g.flag(name)` get / `g.flag(name, value)` set.
- `g.addSeal(id)` — push to state.seals if missing, sfx 'seal', toast "חותם נוסף: <id label from main's SEALS map via hud>". Engine just stores id + plays sfx + toast with the Hebrew text passed: `g.addSeal(id, labelHe)`.
- `g.hasSeal(id)`.
- `await g.goto(sceneId, spawn?)` — fade out/in, switch scene, call onEnter.
- `await g.walkTo(x, y)` — walk player, resolve on arrival.
- `g.sfx(name)` — forward to `AUDIO.sfx(name)`.
- `await g.cutscene(fn)` — lock input, run `await fn(g)`, unlock.
- `await g.wait(ms)`.
- `g.win()` — set flag 'won', run cfg.ending cutscene.

Input model (CRITICAL — the requested default behavior):
- Verb bar (HTML, RTL): buttons `הבט` `דבר` `קח` `השתמש`. No verb selected = default mode.
- Default mode click: hotspot type 'char' → walk near + talk; 'object' → look (no walk needed for look); 'exit' → walk + goto; empty floor → walk there.
- With verb selected: click hotspot → walk (for קח/השתמש/דבר) then run that handler; verb resets after use. `הבט` never walks.
- `השתמש`: if an inventory item is selected (click item in inventory strip), clicking hotspot calls `use(g, selectedItemId)`; if no item selected and hotspot has `use`, call `use(g, null)`.
- Missing handler defaults (engine, Hebrew, pick randomly from 2-3 variants):
  look: "סתם <name>. או שלא?" / talk: "זה לא ממש מדבר. מביך." / take: "זה לא זז. כמו חמור עקשן." / use: "זה לא עובד. אולי חסר לי משהו מהדף?"
- Hover: show hotspot name in a status line (HTML, above verb bar): "<verb or default action> <name>".
- Cursor: crosshair on canvas; player walk animation via SPRITES.drawPlayer.

Rendering loop: engine runs rAF; each frame: scene.paint → sorted hotspot draws + player (depth by feet y) → nothing else. Canvas context: `imageSmoothingEnabled=false`.

Player: engine tracks `{x, y, flip, walking}`. Draw via `SPRITES.drawPlayer(ctx, x, y, t, walking, flip, scale)` (feet anchor). Walk speed ~55 px/s, straight line, clamp y to floor band.

## SPRITES API CONTRACT (sprites.js)

`window.SPRITES`:
- `SPRITES.draw(ctx, map, pal, x, y, scale=1, flip=false)` — map = array of equal-length strings, pal = `{char:'#hex'}`, '.' and ' ' transparent. Integer-snapped pixels: each map cell = scale x scale rect (scale may be fractional; use fillRect, it's fine).
- `SPRITES.px(ctx, x, y, w, h, color)` — fillRect helper.
- `SPRITES.dither(ctx, x, y, w, h, c1, c2)` — checkerboard 1px dither fill.
- `SPRITES.glow(ctx, x, y, r, color, alpha)` — radial-ish glow (concentric alpha rects ok).
- `SPRITES.drawPlayer(ctx, x, y, t, walking, flip, scale)` — the hero "זרח": young Talmud student,
  ~16px wide x 30px tall at scale 1, feet anchored at (x,y). Design: teal/indigo robe, small cap,
  candle in hand with flickering flame (use t), 2-frame walk cycle (t*6 alternates legs), idle sways gently.
  Lovable, big expressive eyes, chibi proportions. MUST look great — this is on screen 100% of the time.
- `SPRITES.text(ctx, ...)` NOT needed — all text is HTML.
- Generic props others may reuse: `SPRITES.star(ctx,x,y,t,size,color)` twinkling star; `SPRITES.candle(ctx,x,y,t,scale)`; `SPRITES.torch(ctx,x,y,t)`; `SPRITES.moon(ctx,x,y,phase)` crescent.

## AUDIO API CONTRACT (audio.js)

`window.AUDIO` (WebAudio, chiptune, created lazily on first user gesture — engine calls `AUDIO.unlock()` on first click):
- `AUDIO.unlock()` — create/resume context, start bgm.
- `AUDIO.sfx(name)` — names: `pickup, seal, door, star, roar, fail, win, step, magic, snore, hic, click, quiz`.
  Short synthesized jingles (square/triangle osc + noise). `roar` = descending growl; `win` = triumphant arpeggio; `hic` = comic hiccup blip.
- `AUDIO.music(mode)` — modes: `night` (default; slow minor-key mystical loop, sparse), `tense`, `dawn` (major, warm). Simple sequencer via setInterval or lookahead scheduler; volume LOW (bgm gain ~0.06, sfx ~0.15).
- Everything must fail silent (try/catch) if AudioContext unavailable.

## ART DIRECTION

Night scenes. Rich indigo/violet sky with dithered gradient bands, twinkling stars, big crescent moon.
Warm amber light from windows/candles/torches contrasting the cold night — this contrast is the signature look.
Stone + plaster Galilee village, arched doorways, olive trees, laundry lines, cats.
Detail level: HIGH — every scene needs 8+ decorative micro-details (potted plants, scrolls, pigeons, smoke wisps animated with t).
Palette guide (not enforced, harmonize with it):
sky `#0a0a23 #141440 #232366`, stone `#4a4a68 #6b6b8f #8f8fb0`, wood `#5a3a24 #7a512f`,
amber light `#ffd166 #ffb347 #ff8c42`, parchment `#e8d8a8`, robes teal `#1f7a8c`, accents `#e63946 #a26bd4`.
Animate with `t`: flames flicker (sin), stars twinkle, smoke drifts, characters bob/blink.

## TALMUD CONTENT SHEET (Berakhot 2a + opening sugya — the game's soul; quote precisely)

- Mishnah: «מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִית? מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן» — i.e. from צאת הכוכבים.
- ר' אליעזר: עד סוף האשמורה הראשונה. חכמים: עד חצות. רבן גמליאל: עד שיעלה עמוד השחר.
- מעשה: בניו של רבן גמליאל באו מבית המשתה אחר חצות ולא קראו שמע; אמר להם: אם לא עלה עמוד השחר — חייבין אתם לקרות.
- ולא זו בלבד: כל מה שאמרו חכמים "עד חצות" — מצוותן עד שיעלה עמוד השחר (הקטר חלבים ואיברים, אכילת קדשים).
- ולמה אמרו חכמים עד חצות? כְּדֵי לְהַרְחִיק אֶת הָאָדָם מִן הָעֲבֵרָה.
- גמרא: "תנא היכא קאי דקתני מאימתי?" — התנא על הפסוק עומד: «בְּשָׁכְבְּךָ וּבְקוּמֶךָ» (שמע, דברים ו).
- ולמה שנה ערבית לפני שחרית? כבריאת העולם: «וַיְהִי עֶרֶב וַיְהִי בֹקֶר».
- כהן שנטמא: טובל במקווה, וב**הערב שמש** (צאת הכוכבים) נטהר ואוכל בתרומתו. "ביאת שמשו מעכבתו, ואין כפרתו מעכבתו".
- (2b) ברייתא: משעה שהעני נכנס לאכול פתו במלח — time marker of the poor man's supper.
- (המשך הסוגיה, ג ע"א — for the watchman puzzle): שלוש משמרות הוי הלילה, ועל כל משמר יושב הקב"ה ושואג כארי.
  סימנים: ראשונה — חמור נוער; שנייה — כלבים צועקים; שלישית — תינוק יונק ואשה מספרת עם בעלה.

## GAME DESIGN — story, scenes, puzzles

Hero: **זרח**, a curious young student. Tonight in **כפר ברכות** nobody can pray Maariv:
the ancient Ark ("ארון הזמנים") sealed itself because the villagers forgot WHEN to say Shema.
It opens only for one who collects **three seals** and answers the Daf's questions.
Seals: `stars` (חותם הכוכבים), `midnight` (חותם חצות), `watch` (חותם המשמרות).

Tone: Monkey Island meets the Beit Midrash. Absurd, warm, never mocking the content itself —
the JOKES are in the world, the TORAH is accurate. Characters can break the 4th wall lightly.

### Scene `square` — כיכר כפר ברכות (hub; player starts here)
Paint: village square at dusk-into-night, well in center, olive tree, laundry line with a sock that has tzitzit,
sleeping cat, poster wall. Exits: beitmidrash (big arched doors, right), kohen house (left, amber window), road (far background gate), roof (external stone staircase).
Hotspots & humor:
- **הגבאי גרשון** (char): panicked gabbai, gives the quest in opening dialogue (choose-tree). Recaps state: tells you which seals remain. Running gag: he "misplaced" the community's sense of time; his pocket-watch shows a question mark.
- **העני של הברייתא** (char): a cheerful pauper eating pita with salt. Teaches: "משעה שהעני נכנס לאכול פתו במלח" — he IS a halachic clock and proud of it ("אני לא עני, אני שעון!"). look/talk jokes about bread with salt gourmet tasting notes.
- **הבאר** (object): look — echo answers back in Aramaic ("מַאי?"). use with anything — comic splash.
- **חתול** (object/char): a cat named רש"י; talk — it only says "מְיָאו... פירוש: מיאו". take — refuses, cites חז"ל on cat dignity (made-up, flagged as made-up: "זה לא בדף, זה חתול").
- **לוח מודעות** (object): look — absurd village notices ("אבד: עמוד השחר. המוצא הישר יתבקש"), plus a REAL hint: the Mishnah text of מאימתי.
- Exits with names in Hebrew.

### Scene `beitmidrash` — בית המדרש
Paint: glowing interior, bookshelves floor-to-ceiling, hanging oil lamps, bimah, and the **ארון הזמנים** —
an ark with a giant mechanical clock-lock showing three keyholes (seal slots) + a mysterious dial from "ערב" to "בוקר".
Hotspots:
- **רבי אליעזר** (char): stern but kind; teaches his shita (עד סוף האשמורה הראשונה) and hints the lion-watchman on the road knows the משמרות. Gag: he argues with an empty chair and wins.
- **מקהלת החכמים** (char): THREE sages who always speak in unison (one bubble, "אנחנו אומרים: עד חצות!"). If asked why: «כדי להרחיק את האדם מן העבירה» — then they high-five and miss.
- **רבן גמליאל** (char): calm, sipping tea; teaches עד שיעלה עמוד השחר; mentions his sons are STILL at a wedding ("שוב חתונה. שלישית השבוע.") — points to road scene.
- **ספר גמרא ענק** (object): look — shows the actual Mishnah text; take — gives item `daf` (דף גמרא) used as hint sheet anywhere (use daf on anything → quotes relevant line).
- **ארון הזמנים** (object): the finale. use/talk with <3 seals → it snores ("האָרוֹן יָשֵׁן. חסרים חותמות."). With 3 seals → THE QUIZ (see below) → win.
- **התנא** (char, easter egg): a ghostly Tanna floating near the ceiling; talk: "תנא היכא קאי?" — "אקרא קאי!" and he stands on a floating pasuk «בשכבך ובקומך». Teaches why ערבית first: «ויהי ערב ויהי בקר». Genuinely funny AND the actual gemara.

### Scene `kohen` — בית הכהן פנחס
Paint: cozy stone house interior + mikveh corner (steaming), table set with covered terumah bread that GLOWS,
grandfather clock with Hebrew letters, hungry kohen pacing.
Puzzle chain (teaches: כהנים נכנסים לאכול בתרומתן = צאת הכוכבים; טבילה + הערב שמש):
1. Talk to **הכהן פנחס**: dramatic starving monologue (stomach growls audible — sfx 'roar' small). He became tamei today (touched a שרץ! he re-enacts it in horror), already did tevila in the mikveh — now must wait for הערב שמש = stars out. He can't SEE stars from inside and is too weak from hunger to climb.
- **התרומה** (object): glowing challah under glass dome. take → electric-fence style rejection ("אַתָּה לֹא כֹּהֵן!" booming voice, sfx 'fail'). look → drooling description.
- **המקווה** (object): look — "מים כשרים. גם קרים. שאלו את פנחס." use → זרח dips a toe, yelps.
- **שעון סבא** (object): broken, shows "בערך לילה?" — gag about why halacha doesn't use clocks.
2. Player goes to `roof`, completes star puzzle, gets item `starproof` (אישור צאת הכוכבים — a parchment with 3 stars drawn).
3. use starproof on הכהן → cutscene: he UNVEILS the terumah, eats with cosmic joy (confetti pixels), declares the halacha:
   «משעה שהכהנים נכנסים לאכול בתרומתן» = מעכשיו! — gives **חותם הכוכבים** (`stars`).

### Scene `roof` — גג המצפה
Paint: rooftop with ancient telescope (brass, patched with duct-tape scroll straps), sky DOMINANT: dozens of stars
fading in as flags progress, moon, bat crossing occasionally, distant village silhouette.
Puzzle (teaches: night = צאת הכוכבים, three medium stars):
- **הטלסקופ** (object): use → sky-view mode flag; זרח comments.
- Interactive stars: sky has big bright stars (visible from twilight — DON'T count), and exactly 3 MEDIUM stars that appear one by one (t-based after entering with the puzzle active). Player must click the 3 medium ones ("כוכבים בינוניים"). Clicking a big star: "גדול מדי! את זה רואים גם ביום. לא נחשב." Clicking a firefly hotspot: it's a firefly, it giggles ("גחלילית, לא כוכב. תתרכז.").
- When 3 medium stars clicked → cutscene: sky fully blossoms with stars, sfx 'magic', item `starproof` given, זרח: "שלושה כוכבים בינוניים — יצאו הכוכבים! זה הרגע שהכהנים נכנסים לאכול בתרומתן!"
- **ינשוף** (char): owl wearing tiny glasses, the roof's pedant; explains the 3-medium-stars rule if asked; hoots in Aramaic ("הוּ? הוּא!").

### Scene `road` — הדרך מהחתונה
Paint: moonlit road out of the village, vineyard fence, distant wedding tent with tiny dancing silhouettes + faint music sfx cue, a large regal LION at a guard post with a punch-clock, two tipsy young men wobbling (synchronized wobble, t-based).
Puzzles (two seals here):
A. **בני רבן גמליאל** (char, the two together): hiccuping (sfx 'hic'), worried: "חזרנו אחרי חצות!! לא קראנו שמע!! אבא יהרוג אותנו!!"
   Dialogue choose-tree — player must give the CORRECT ruling (this is the actual Mishnah story!):
   - "מאוחר מדי, הלך עליכם" → they wail, fail sfx, retry.
   - "אם לא עלה עמוד השחר — חייבין אתם לקרות!" → correct! They say Shema on the spot with wildly overdone kavana, then reveal their father's teaching: כל מה שאמרו חכמים עד חצות — מצוותן עד שיעלה עמוד השחר, וטעם חכמים: להרחיק את האדם מן העבירה. Give **חותם חצות** (`midnight`).
   - Third option: "רגע, אבדוק בדף" (needs item daf → reads the answer aloud, also succeeds).
B. **אריה השומר** (char): a majestic lion, night-watchman with punch-clock; on each משמרת change he ROARS (sfx 'roar') — "זה לא אני, אני רק מצטרף לשאגה של מעלה. על כל משמר ומשמר יושב הקב\"ה ושואג כארי." He lost his shift chart! Quiz: he asks the player to match the signs to the 3 watches (choose-menu, order can shuffle):
   חמור נוער ← ראשונה; כלבים צועקים ← שנייה; תינוק יונק ואשה מספרת עם בעלה ← שלישית.
   Wrong: comic roar-sneeze. All correct → punch-clock DINGS, gives **חותם המשמרות** (`watch`).
   Bonus gag: a donkey behind the fence brays on cue when mentioned (sfx).

### FINALE — the Ark Quiz (in beitmidrash, needs 3 seals)
`use`/`talk` on ארון הזמנים with all seals → cutscene, music 'tense', ark speaks in booming style. 4 questions (choose-menus, 3 options each; wrong answer = gentle mockery + retry, no punishment):
1. «מאימתי קורין את שמע בערבין?» → משעה שהכהנים נכנסים לאכול בתרומתן ✓ (distractors: משעה שהעני שם שעון מעורר / משהחתול מפהק)
2. «ומה הסימן בשמים?» → צאת הכוכבים — שלושה כוכבים בינוניים ✓
3. «עד מתי אמרו חכמים לקרות — ולמה?» → עד חצות, כדי להרחיק את האדם מן העבירה ✓
4. «ולמה שנה התנא ערבית תחילה?» → שנאמר «ויהי ערב ויהי בקר», וכתיב «בשכבך ובקומך» ✓
All correct → `g.win()`: ark opens in light cascade, music 'dawn', whole village says Shema together (silhouettes + text overlay of «שמע ישראל»), sun edge rises (עמוד השחר!), closing card: "וזה היה רק הדף הראשון. דף ב עמוד א — סיימת אותו באמת. 🎉" + credits gag.

## ITEMS (main.js registry)

- `daf` — "דף גמרא" — hint sheet; use on major hotspots gives a relevant quote (scenes implement; default engine line otherwise).
- `starproof` — "אישור צאת הכוכבים" — parchment, 3 stars.
- (scenes may add small gag items if self-contained, max 2 more.)

## SEALS (labels for HUD, main.js)

`stars`: "חותם הכוכבים" · `midnight`: "חותם חצות" · `watch`: "חותם המשמרות"

## SHELL (index.html + style.css + main.js)

- Dark retro UI: canvas centered (scaled x3 or fit-width, keep aspect, pixelated), title bar "תעלומת השמע האבוד — ברכות דף ב", RTL everything.
- Below canvas: status line, verb bar (4 verbs, big pixel-styled buttons), inventory strip (item icons on 32x32 mini-canvases via SPRITES.draw), HUD seals area (3 seal slots, filled = glowing).
- Speech bubbles/choice menus: absolutely-positioned divs over the canvas wrapper (engine creates; style.css must style `.bubble`, `.choices`, `.choice`, `.toast`, `.fade` classes: pixel border, dark bg, Hebrew font stack `'Rubik','Arial Hebrew',sans-serif`, text-shadow).
- main.js: items registry, SEALS map, `hud(state)` renderer, intro cutscene (gabbai panic → quest), ending cutscene per finale spec, then `GAME.boot({...})`.
- index.html includes a `<noscript>` and loads scripts in the order listed above. NO external fonts/CDN (system fonts only).
