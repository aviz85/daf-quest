# DAF QUEST — "תעלומת הרשויות האבודות" (The Mystery of the Lost Domains)

A SCUMM-style pixel-art point-and-click adventure teaching the FIRST PAGE OF MASECHET SHABBAT
(Shabbat 2a-2b — "יציאות השבת שתים שהן ארבע"). Same engine as the Berakhot game
(`games/berakhot-2`), same hero, same art style, all-new content and puzzles for this daf.

## HARD RULES (every agent) — identical to the Berakhot game

- Vanilla JS + Canvas 2D. ZERO dependencies, no build step, no modules — plain `<script>` globals.
- ES2020, `'use strict'` per file.
- ALL code, comments, identifiers, console logs: ENGLISH ONLY.
- ALL player-facing in-game strings: HEBREW ONLY (dialogue, names, UI labels, quiz).
- Hebrew strings must never contain `→` arrows; use `←` if an arrow is needed.
- Logical resolution 320x180, scaled up with `image-rendering: pixelated`.
- You own ONLY your assigned file(s). Never create or edit other files.
- Before finishing, run `node --check <yourfile>` and fix any syntax error.
- Defensive coding: never crash if a handler/flag is missing.
- DO NOT touch `js/engine.js`, `js/audio.js`, `js/sprites.js` (root, shared with the Berakhot
  game) or anything under `games/berakhot-2/`. Those are frozen and out of scope.

## FILE LAYOUT & LOAD ORDER (this game's index.html loads in this order)

```
games/shabbat-2/index.html            (shell agent)
games/shabbat-2/style.css             (shell agent — may start from games/berakhot-2/style.css
                                        as a base, adjust palette per Art Direction below)
../../js/sprites.js                   SHARED, already exists at repo root — do not edit
../../js/audio.js                     SHARED, already exists at repo root — do not edit
../../js/engine.js                    SHARED, already exists at repo root — do not edit
games/shabbat-2/scenes/square.js          GAME.registerScene('square', {...})
games/shabbat-2/scenes/courtyard.js       GAME.registerScene('courtyard', {...})
games/shabbat-2/scenes/market.js          GAME.registerScene('market', {...})
games/shabbat-2/scenes/beitmidrash.js     GAME.registerScene('beitmidrash', {...})
games/shabbat-2/scenes/roof.js            GAME.registerScene('roof', {...})
games/shabbat-2/main.js               (shell agent; calls GAME.boot(...))
```

index.html script tags, in order:
```html
<script src="../../js/sprites.js"></script>
<script src="../../js/audio.js"></script>
<script src="../../js/engine.js"></script>
<script src="scenes/square.js"></script>
<script src="scenes/courtyard.js"></script>
<script src="scenes/market.js"></script>
<script src="scenes/beitmidrash.js"></script>
<script src="scenes/roof.js"></script>
<script src="main.js"></script>
```

## ENGINE API CONTRACT — window.GAME (already implemented, read-only reference)

`GAME.registerScene(id, def)` — store scene definition.
`GAME.boot(cfg)` — called by main.js on DOMContentLoaded.
  `cfg = { canvas, startScene, items, intro(g), ending(g), hud(state) }`
  - `items`: array of `{ id, name(He), desc(He), icon }` (icon = sprite map, see SPRITES).
  - `intro(g)`: async cutscene run once at start. `ending(g)`: async, run when `g.flag('won')` set via `g.win()`.
  - `hud(state)`: returns HTML string for the HUD strip (seals etc.); engine re-renders it after every action.
`GAME.state` = `{ flags:{}, inventory:[], scene:'', seals:[] }` (seals = array of seal ids).

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
- `await g.playerSay(text)` — shorthand.
- `await g.choose(options)` — SCUMM-style dialogue menu; `options = [{text, value}]`; resolves value.
- `g.give(itemId)` / `g.remove(itemId)` / `g.has(itemId)` — inventory; give shows a toast + sfx 'pickup'.
- `g.flag(name)` get / `g.flag(name, value)` set.
- `g.addSeal(id, labelHe)` — push to state.seals if missing, sfx 'seal', toast "חותם נוסף: <labelHe>".
- `g.hasSeal(id)`.
- `await g.goto(sceneId, spawn?)` — fade out/in, switch scene, call onEnter.
- `await g.walkTo(x, y)` — walk player, resolve on arrival.
- `g.sfx(name)` — forward to `AUDIO.sfx(name)`.
- `await g.cutscene(fn)` — lock input, run `await fn(g)`, unlock. **Use this for ANY handler that
  chains more than ~2 sequential `g.say()`/`g.choose()` calls** (the engine now also auto-locks
  input for the duration of every verb handler, so this is for clarity/nesting, not strictly
  required for correctness — but wrap multi-step quiz sequences in it anyway for consistency
  with the Berakhot game's style).
- `await g.wait(ms)`.
- `g.win()` — set flag 'won', run cfg.ending cutscene.

Input model — identical to the Berakhot game:
- Verb bar (HTML, RTL): buttons `הבט` `דבר` `קח` `השתמש`. No verb selected = default mode.
- Default mode click: hotspot type 'char' → walk near + talk; 'object' → look (no walk needed for look); 'exit' → walk + goto; empty floor → walk there.
- Missing handler defaults (engine, Hebrew, picks randomly): look "סתם <name>. או שלא?" / talk "זה לא ממש מדבר. מביך." / take "זה לא זז. כמו חמור עקשן." / use "זה לא עובד. אולי חסר לי משהו מהדף?"

## SPRITES API CONTRACT — window.SPRITES (already implemented, read-only reference)

- `SPRITES.draw(ctx, map, pal, x, y, scale=1, flip=false)` — map = array of equal-length strings, pal = `{char:'#hex'}`, '.' and ' ' transparent.
- `SPRITES.px(ctx, x, y, w, h, color)` — fillRect helper.
- `SPRITES.dither(ctx, x, y, w, h, c1, c2)` — checkerboard 1px dither fill.
- `SPRITES.glow(ctx, x, y, r, color, alpha)` — radial-ish glow.
- `SPRITES.drawPlayer(ctx, x, y, t, walking, flip, scale)` — the SAME hero, זרח: young Talmud
  student, teal/indigo robe, small cap, candle in hand with flickering flame, 2-frame walk cycle,
  idle sways gently. Reuse as-is — do not redesign him, he is shared across both games (nice
  continuity: same student, new daf, new night).
- Generic props: `SPRITES.star(ctx,x,y,t,size,color)`; `SPRITES.candle(ctx,x,y,t,scale)`;
  `SPRITES.torch(ctx,x,y,t)`; `SPRITES.moon(ctx,x,y,phase)`.
- Scene-specific characters/props (fishmonger, cat, frozen villagers, sage trio, gate, etc.) are
  drawn by YOUR scene file directly with `SPRITES.px`/`dither`/`glow`, exactly like `road.js` and
  `kohen.js` draw their own characters in the Berakhot game. Do not add anything to sprites.js.

## AUDIO API CONTRACT — window.AUDIO (already implemented, read-only reference)

- `AUDIO.sfx(name)` — names available: `pickup, seal, door, star, roar, fail, win, step, magic, snore, hic, click, quiz`. Reuse these; do not invent new sfx names (audio.js is frozen).
- `AUDIO.music(mode)` — modes available: `night, tense, dawn`. This game is set at DUSK/erev
  Shabbat rather than deep night — use `'night'` for the ambient default (still moody/minor) and
  `'tense'`/`'dawn'` for climax/ending exactly as the Berakhot game does.

## ART DIRECTION — differentiate from the Berakhot game: DUSK, not deep night

Erev Shabbat, sun still setting — warm gold/amber/rose sky instead of deep indigo, transitioning
toward violet at the horizon's edges only. This is the signature visual difference from the first
game (which is all indigo/violet deep night). Palette guide (harmonize with, not enforced):
sky `#3a2050 #7a3d5c #d97a4a #ffb347` (violet-to-rose-to-gold horizon band, dithered gradient),
stone `#4a4a68 #6b6b8f #8f8fb0`, wood `#5a3a24 #7a512f`, warm light `#ffd166 #ffb347 #ff8c42`,
parchment `#e8d8a8`, robes teal `#1f7a8c` (player, unchanged), accents `#e63946 #a26bd4`.
Detail level: HIGH, same bar as the Berakhot game — 8+ animated micro-details per scene (laundry
lines, candles being lit one by one as t increases, a fish flopping, banners, smoke).
Recurring sight gag: windows lighting up with Shabbat candles progressively as the player
completes seals — ties visually to the "race before sundown" stakes.

## TALMUD CONTENT SHEET — Shabbat 2a-2b, verified against Sefaria. Quote precisely.

### The Mishnah (2a) — six cases, the game's central puzzle

Header: «יְצִיאוֹת הַשַּׁבָּת, שְׁתַּיִם שֶׁהֵן אַרְבַּע בִּפְנִים, וּשְׁתַּיִם שֶׁהֵן אַרְבַּע בַּחוּץ.»
(Transfers on Shabbat are two [actions] that comprise four [cases], from the perspective of the
person inside, and two that comprise four from the perspective of the person outside.)

«הֶעָנִי עוֹמֵד בַּחוּץ, וּבַעַל הַבַּיִת בִּפְנִים» — the poor person (עני) stands outside in
רְשׁוּת הָרַבִּים (the public domain), the homeowner (בעל הבית) stands inside in רְשׁוּת הַיָּחִיד
(the private domain). Six sub-cases, EXACT text:

1. «פָּשַׁט הֶעָנִי אֶת יָדוֹ לִפְנִים וְנָתַן לְתוֹךְ יָדוֹ שֶׁל בַּעַל הַבַּיִת... הֶעָנִי חַיָּיב וּבַעַל
   הַבַּיִת פָּטוּר» — the poor person reaches his hand IN and PLACES an object into the
   homeowner's hand → **העני חייב, בעל הבית פטור** (the poor person performed the whole action).
2. «אוֹ שֶׁנָּטַל מִתּוֹכָהּ וְהוֹצִיא — הֶעָנִי חַיָּיב» — the poor person reaches his hand IN,
   TAKES an object from the homeowner's hand, and carries it OUT → **העני חייב, בעל הבית פטור**
   (same reasoning: the poor person alone completed the whole transfer).
3. «פָּשַׁט בַּעַל הַבַּיִת אֶת יָדוֹ לַחוּץ וְנָתַן לְתוֹךְ יָדוֹ שֶׁל עָנִי... בַּעַל הַבַּיִת חַיָּיב
   וְהֶעָנִי פָּטוּר» — the homeowner reaches his hand OUT and PLACES an object into the poor
   person's hand → **בעל הבית חייב, העני פטור**.
4. «אוֹ שֶׁנָּטַל מִתּוֹכָהּ וְהִכְנִיס — בַּעַל הַבַּיִת חַיָּיב» — the homeowner reaches his hand
   OUT, TAKES from the poor person's hand, and brings it IN → **בעל הבית חייב, העני פטור**.
5. «פָּשַׁט הֶעָנִי אֶת יָדוֹ לִפְנִים וְנָטַל בַּעַל הַבַּיִת מִתּוֹכָהּ, אוֹ שֶׁנָּתַן לְתוֹכָהּ וְהוֹצִיא —
   שְׁנֵיהֶם פְּטוּרִין» — the poor person reaches his hand IN (only that — an empty reach), and
   EITHER the homeowner takes from it OR the homeowner places into it and the poor person carries
   out → **שניהם פטורים** (each did only half the action — the reach and the actual
   carrying/placing were split between two people, so neither completed a full prohibited act).
6. «פָּשַׁט בַּעַל הַבַּיִת אֶת יָדוֹ לַחוּץ וְנָטַל הֶעָנִי מִתּוֹכָהּ, אוֹ שֶׁנָּתַן לְתוֹכָהּ וְהִכְנִיס —
   שְׁנֵיהֶם פְּטוּרִין» — mirror image, homeowner's empty reach out, split with the poor person →
   **שניהם פטורים**.

**The one-line rule the game must teach clearly**: liability follows whoever performed the ENTIRE
prohibited act (both the lifting/extending AND the placing/taking) by himself; when the act is
split between two people — one only reaches, the other only takes/places — both are exempt,
because Torah-level "carrying" requires one person to do the whole motion.

### The Gemara (2a-2b) — the "שתים שהן ארבע" pattern, and the counting fight

Gemara opens by noting the SAME phrase appears in tractate Shevuot: «תְּנַן הָתָם: שְׁבוּעוֹת,
שְׁתַּיִם שֶׁהֵן אַרְבַּע» (oaths: two that comprise four), and (2b) two more instances of the
pattern: «יְדִיעוֹת הַטּוּמְאָה, שְׁתַּיִם שֶׁהֵן אַרְבַּע» (awareness of impurity) and «מַרְאוֹת
נְגָעִים, שְׁנַיִם שֶׁהֵן אַרְבָּעָה» (signs of tzaraat/leprosy affliction). The Gemara asks why
OUR mishnah spells out eight cases (inside AND outside) while Shevuot's stops at four, and works
through several answers (אבות/תולדות — primary vs. derivative categories of Shabbat labor;
חיובי/פטורי — liable vs. exempt cases; ultimately Rava: the word is not יציאות but **רְשׁוּיוֹת**
— "the DOMAINS of Shabbat are two that comprise four").

The counting fight (2b), verbatim — great slapstick material:
«אֲמַר לֵיהּ רַב מַתְנָה לְאַבָּיֵי: הָא תַּמְנֵי הָוְיָין? תַּרְתֵּי סְרֵי הָוְיָין!» — Rav Mattana
says to Abaye: "Aren't these eight [cases]? They're actually TWELVE!" (Because in the four
"both exempt" cases, TWO people each perform a distinct action — reaching AND taking/placing —
so those four mishnah-cases are really eight physical actions; 4 [solo cases] + 8 [joint-case
actions] = 12.)
«וְלִיטַעְמָיךְ שִׁיתְסְרֵי הָוְיָין!» — Abaye retorts: "By YOUR logic, it's SIXTEEN!" (because even
in the four solo-liability cases, the receiving hand and the giving hand both "act", so those
should count as two actions each too: 8 + 8 = 16). The daf's text trails off mid-resolution
("אָמַר לֵיהּ — הָא לָא קַשְׁיָא: בִּשְׁלָמָא...") — the argument is *left hanging*, continuing past
this daf. **Do not fabricate a tidy resolution.** The game should treat 12 as the number the text
explicitly settles on for now (Rav Mattana's count, unchallenged within this daf's own math) while
playing Abaye's 16-retort as an honest cliffhanger gag ("אביי עוד לא ויתר. הוויכוח ימשיך גם בדף
הבא.").

### The four domains (רשויות) — necessary context for "inside" vs "outside", well-established halacha

- **רְשׁוּת הַיָּחִיד** (private domain): an area at least 4×4 טפחים, enclosed by walls at least
  10 טפחים high.
- **רְשׁוּת הָרַבִּים** (public domain): an open thoroughfare at least 16 אמה wide, used by the
  masses.
- **כַּרְמְלִית** (intermediate domain): an area that is neither properly enclosed (walls under 10
  טפחים) nor a public thoroughfare — e.g. a field, an unwalled lot, a sea or river.
- **מְקוֹם פָּטוּר** (exempt place): smaller than 4×4 טפחים, and raised (or set apart) at least 3
  טפחים from its surroundings — too small to count as ANY domain; you may place into or take from
  it freely regardless of which domain is on either side.
  Source: standard halachic measurements (Shulchan Aruch Orach Chaim 345; see also Mishnah/Gemara
  Shabbat 6a-8a where these are elaborated in depth — the game only needs the definitions above,
  it does not need to dramatize those later dapim).

## GAME DESIGN — story, scenes, puzzles

Hero: **זרח** — the SAME curious student from the Berakhot game (nice continuity, no dependency:
a player who never played the first game loses nothing). Tonight he is in a different village,
**כפר שבתא**, and it's ערב שבת — the sun is dipping, candle-lighting is close, and nothing can be
carried anywhere: the **מְחִיצַת הָרְשֻׁיּוֹת** ("the Partition of Domains"), the quiet ancient
enchantment that has kept the village's private/public domain lines straight since Sinai, has
short-circuited. Two villagers are frozen mid-handoff in the alley — reality itself "hung" because
nobody can tell whether the object crossed a domain line. Fix requires **three seals of
understanding**, brought to the **שַׁעַר הָרְשֻׁיּוֹת** ("the Gate of Domains") in the beit
midrash — this game's equivalent of the Ark of Times.

Seals: `handoff` (חותם המשא ומתן), `domains` (חותם הרשויות), `count` (חותם המניין).

Tone: identical house style to the Berakhot game — Monkey Island meets Beit Midrash. Absurd, warm,
never mocking the content itself; jokes live in the world, the Torah stays accurate. Light fourth
wall breaks OK.

### Scene `square` — כיכר כפר שבתא (hub; player starts here)

Paint: village square at dusk sliding toward sunset — the signature warm-dusk palette (see Art
Direction). A well, a market road leading off, a path toward the beit midrash, a path toward the
frozen alley, external stairs up to the roof. Windows light with Shabbat candles one by one as `t`
increases and as seals are collected (a nice subtle indicator of progress). Exits: courtyard,
market, beitmidrash, roof.

Hotspots & humor:
- **הכרוז זבדיה** (char): the village crier/town-crier type (this game's counterpart to Gershon
  the gabbai) — panicked, gives the quest in the intro cutscene (owned by main.js, but this
  hotspot's own `talk` should let the player re-hear a short recap of which seals remain, same
  pattern as Gershon in the Berakhot game). Running gag: his voice cracks mid-announcement because
  he keeps accidentally shouting things from inside his own רשות היחיד into the רשות הרבים
  and panicking about whether that "counts."
- **חנה מוכרת הדגים** (char, object-like flavor NPC): a fishmonger; a fish keeps flopping right at
  the edge between her stall (private-ish) and the road (public) — running gag foreshadowing the
  whole game's theme ("אם אתה לא יודע איפה נגמרת רשות היחיד ומתחילה רשות הרבים — גם הדג לא
  יודע."). look/talk comedy, no puzzle mechanics needed here (pure flavor).
- **עוקצין** (char): the village cat (this game's cat, distinct from Rashi the cat in the
  Berakhot game — funny in-universe convention: village cats are named after mesechtot/topics;
  עוקצין is itself a real (small, obscure) mesechet, which is the joke). talk: meow gags; take:
  refuses, citing invented-but-flagged "law" ("זה לא בדף, זה חתול.").
- **לוח המודעות** (object): look — village notices (absurd) + a REAL hint: the Mishnah header text
  «יציאות השבת שתים שהן ארבע בפנים ושתים שהן ארבע בחוץ».
- **הבאר** (object): look/use — same running gag as the Berakhot game's well (echoes back in
  Aramaic, "מַאי?") — nice callback for players of both games, entirely self-contained for players
  of only this one.
- Exits with Hebrew names as usual.

### Scene `courtyard` — הַמָּבוֹי הַקָּפוּא (The Frozen Alley) — SEAL 1: `handoff`

Paint: a narrow stone alley/threshold, visually split — left/outside: open cobblestone street, no
walls (רשות הרבים); right/inside: a walled doorway into a home (רשות היחיד). Two villagers stand
frozen mid-reach across the threshold with a shimmering "time-paradox" sparkle effect (animate
with `t`: freeze-shimmer, comic motion-lines frozen mid-air).

This is the CORE PUZZLE scene, structurally like the lion's watch-quiz in the Berakhot game
(`road.js`): a sequential multi-round `g.choose()` quiz, each round presenting ONE of the six
Mishnah cases (see Content Sheet above — use the exact scenarios, may paraphrase the setup line in
plain Hebrew but the halachic content must match exactly), three options each round:
`{ text: 'העני חייב', value: 'poor' }`, `{ text: 'בעל הבית חייב', value: 'owner' }`,
`{ text: 'שניהם פטורים', value: 'both' }`. Shuffle the order the 6 cases are presented across
playthroughs (like the lion quiz shuffles). Correct answer un-freezes a piece of the tableau
(sparkle + sfx 'magic' or 'click'; visually thaw a limb/object each time — small satisfying
progress bar). Wrong answer: comic "still stuck!" line + sfx 'fail', retry same question.
After all 6 correct → short cutscene: both villagers complete their actual handoff naturally,
laugh it off, sfx 'seal', `g.addSeal('handoff', 'חותם המשא ומתן')`.

Hotspots:
- **העני זוסמן** (char, frozen, outside): talk starts/resumes the quiz. Before solved: comic
  frozen dialogue ("קר... לי... בַּיָּד..."). look: description of the freeze. After solved: happy
  epilogue lines, teaches the summary rule in his own words.
- **בעל הבית תודרוס** (char, frozen, inside): counterpart banter; talk before solved offers the
  SAME quiz (only one quiz instance total — both hotspots may launch/continue it, guard with a
  flag so it isn't duplicated); after solved, explains the rule from his side ("מי שעשה את
  המלאכה בשלמות — הוא חייב. אני או הוא. לא שנינו יחד.").
- **סף הדלת** (object, the threshold itself): look — explicitly names which side is רשות היחיד
  and which is רשות הרבים and why (walls ≥10 טפחים vs. open street), a hint players can revisit.
- **הדף גמרא** item support: `use('daf', ...)` on either frozen villager (if player has the `daf`
  item from beitmidrash) → quotes the relevant Mishnah line as a hint, does not auto-solve.

### Scene `market` — שׁוּק עֶרֶב שַׁבָּת — SEAL 2: `domains`

Paint: bustling market at dusk. Four distinct depicted micro-locations for the domain-classifying
puzzle: (1) the open market road (wide, unfenced, foot traffic = ר"ה), (2) a walled storage yard
behind a stall (fully enclosed, tall walls = ר"י), (3) an unfenced side lot / hitching area next
to the well-adjacent field (not enclosed, not a thoroughfare = כרמלית), (4) a small high windowsill
ledge above a stall, too small and too high to belong to either (מקום פטור) — a coin is stuck
there.

Puzzle: **הרוכל שמעון** (char, peddler) walks the player through classifying the four spots — a
`g.choose()` sequence per spot with four options each: `רשות היחיד`, `רשות הרבים`, `כרמלית`,
`מקום פטור` (shuffle option order). Use the exact definitions from the Content Sheet when
confirming correct answers (teach the measurements — 4×4 טפחים, 10 טפחים, 16 אמה — briefly, in
one punchy line each, not a lecture). Wrong answer: comic rejection + retry.
Side beat: the coin on the windowsill can only be retrieved (`use` on the windowsill hotspot)
once the player has the `paturseal` item from the roof scene — using it there explains WHY a
מקום פטור lets you take freely regardless of which domain is which side (sfx 'click', small
reward line, no separate seal — this is flavor/depth, not required for `domains`).
On all four spots correctly classified → cutscene beat, sfx 'seal',
`g.addSeal('domains', 'חותם הרשויות')`.

Hotspots: the peddler (char, drives the quiz), the four location hotspots (mix of `object`/`look`
triggers into the relevant quiz round — implement however reads cleanest, e.g. `talk` on the
peddler runs the whole sequence in order, OR each location hotspot's own `look`/`talk` asks its
own question — pick ONE clean approach, don't require both), plus 1-2 flavor objects for texture
(e.g. **עגלת ירקות** look-only gag, **שלט השוק** look — village market rules poster, comic).

### Scene `beitmidrash` — same location idea as the Berakhot game, new night's discussion — SEAL 3: `count`, FINALE

Paint: interior, bookshelves floor-to-ceiling, hanging oil lamps, bimah, and the **שַׁעַר
הָרְשֻׁיּוֹת** — an ornate stone/wood gate with three keyhole-seal-slots and a dial (this game's
equivalent centerpiece to the Berakhot game's ארון הזמנים; similar visual weight/detail).

Hotspots:
- **חֲבוּרַת הַחֲכָמִים** (char, 3 sages speaking in unison — same fun device as the Berakhot
  game's מקהלת החכמים): teach that "שתים שהן ארבע" is a recurring Mishnaic PATTERN — cite
  שבועות, ידיעות הטומאה, and מראות נגעים by name (exact phrases from the Content Sheet); comic
  "collect the set!" enthusiasm, maybe a running bit where they keep finding one more example and
  high-five, missing.
- **רב מתנה** and **אביי** (2 chars, mid-argument, animate with exaggerated gesture loops): the
  COUNTING PUZZLE. Dialogue plays out their exact exchange (see Content Sheet, quote precisely),
  then turns to the player via `g.choose()`: "כמה פעולות יש כאן באמת, לדעת רב מתנה?" with options
  `8`, `12`, `16`, `6` (shuffle order) — correct = **12** (award seal on this answer). If the
  player picks 16, a fun line acknowledging "זו דעתו של אביי — אבל רב מתנה טוען אחרת. תספור שוב
  לפי השיטה שלו." (redirect, not a fail-and-retreat, since 16 is Abaye's real position, just not
  the one being asked about) — then retry. If player picks 8 or 6, plain wrong/retry. After
  correct: sfx 'seal', `g.addSeal('count', 'חותם המניין')`, plus a closing cliffhanger line noting
  Abaye "isn't done arguing" (honest nod that the daf's debate continues past this point, per the
  Content Sheet's "do not fabricate a resolution" instruction).
- **סֵפֶר גְּמָרָא עֲנָק** (object): look — shows the real Mishnah header text; take — gives item
  `daf` (usable elsewhere as a hint sheet, same pattern as the Berakhot game).
- **שַׁעַר הָרְשֻׁיּוֹת** (object, the finale): `talk`/`use` with fewer than 3 seals → gate murmurs
  something like "שלוש רשויות חסרות. שלוש הבנות חסרות." (playful, not literally about the seal
  names, just a locked-door flavor line) — with all 3 seals present → THE FINALE QUIZ (wrap in
  `g.cutscene`, `AUDIO.music('tense')`): four questions, `g.choose()`, 3 options each, wrong =
  gentle mockery + retry, no punishment:
  1. «יציאות השבת שתים שהן ___» → **ארבע** (distractors: שלוש / שמונה)
  2. עני פשט ידו לפנים ונתן ליד בעל הבית — מי חייב? → **העני חייב, בעל הבית פטור** (distractors:
     ההפך / שניהם פטורים)
  3. מהי כַּרְמְלִית? → **מקום שאינו מוקף כראוי (מחיצות נמוכות מ־10 טפחים) ואין הרבים עוברים בו**
     (distractors: two plausible-sounding wrong definitions mixing up the other three domains)
  4. באיזה עוד שני מקומות במשנה מופיע התבנית "שתים שהן ארבע"? → **שבועות ומראות נגעים** (or
     substitute טומאה for one of the two — pick any two of the three cited in the Content Sheet)
     (distractors: other mesechtot names that do NOT contain this pattern)
  All correct → `g.win()`.

### Scene `roof` — עֲלִיַּת הַגַּג / גַּג הַכְּפָר — item scene, `paturseal`

Paint: rooftop at dusk, laundry lines, a chimney, several ledges of visibly different sizes/
heights (playing directly on the domain-size rule). Sky warms toward violet at the edges as the
sun continues to set (this scene is a good place to lean into the "time is running out" visual).

Puzzle: **עוקצין** the cat sits on ONE particular tiny, high ledge. Several other decoy ledges/
spots exist (a wide flat section that's clearly part of the walled roof = ר"י-ish; a low unwalled
ledge at street level = כרמלית-ish; a normal-size window). Player must click the ONE spot that is
genuinely **מקום פטור**: smaller than 4×4 טפחים AND separated (raised or set apart) at least 3
טפחים from any surrounding recognized domain. Wrong clicks get a specific, funny, ON-TOPIC
rejection line explaining WHY that spot fails the definition (not just "wrong") — e.g. clicking
the wide flat section: "גדול מדי. זו כבר רשות של ממש." Right click: sfx 'magic', cat approves,
`g.give('paturseal')` (אישור מקום פטור — small parchment/tag). No formal seal here — this is an
item-gated side puzzle feeding the `market` scene's coin beat, same pattern as `starproof` feeding
into the kohen scene in the Berakhot game.

Hotspots: the cat (char, hints/explains if asked via `talk` before solved), the correct ledge +
2-3 decoy ledges (all `object`, `look`/`use`-driven — implement the click-to-classify however
reads cleanest, consistent with how `roof.js` in the Berakhot game handles its star-clicking
puzzle), 1-2 flavor objects (laundry line, chimney) for texture and jokes.

## ITEMS (main.js registry)

- `daf` — "דף גמרא" — hint sheet; may reuse similar icon styling to the Berakhot game's `daf`
  item (parchment/wood-frame look) but this is a SEPARATE item id/definition in THIS game's own
  main.js (no cross-game state).
- `paturseal` — "אישור מקום פטור" — small parchment/tag icon.

## SEALS (labels for HUD, main.js)

`handoff`: "חותם המשא ומתן" · `domains`: "חותם הרשויות" · `count`: "חותם המניין"

## SHELL (index.html + style.css + main.js) — the "shell agent" owns all three

- Same dark retro UI skeleton as the Berakhot game (canvas centered, pixelated scaling, RTL
  everything, status line, verb bar, inventory strip, HUD seal area) — start from
  `games/berakhot-2/style.css` as a base and adjust the palette to the dusk/gold direction above;
  do not just copy it unchanged, the two games should feel like siblings, not clones.
- Title: "תעלומת הרשויות האבודות — שבת דף ב". Footer: `דף ב · «יְצִיאוֹת הַשַּׁבָּת שְׁתַּיִם שֶׁהֵן
  אַרְבַּע»`.
- index.html: script order exactly as listed in FILE LAYOUT above. `<noscript>` fallback line in
  the same house style (something dryly in-universe, e.g. "המשחק הזה דורש JavaScript. בלי זה —
  השער יישאר נעול לנצח. גם החכמים מסכימים.").
- main.js: item registry, SEALS map, `hud(state)` renderer (same shape as the Berakhot game's,
  3 seal slots instead of 3 — same count coincidentally, still 3 slots), intro cutscene (crier's
  panic → quest, following the Story beats above — write the actual dialogue with the same comic
  energy as the Berakhot game's intro, personal creative latitude here, just hit the required
  beats: מחיצת הרשויות broke, two villagers frozen, שער הרשויות needs 3 seals, urgency of erev
  Shabbat/sundown), ending cutscene (gate opens, domains snap back into place, the two frozen
  villagers are freed as a callback beat, Shabbat candles fully lit across the village, hero's
  closing line, closing card with a comic credits list in the same style as the Berakhot game's,
  a "בקרוב: הדף הבא" teaser line), then `GAME.boot({...})`.
- A finale visual (light cascade / gate opening) is a nice-to-have, not required to match the
  Berakhot game's bespoke canvas animation line-for-line — a simpler CSS/HTML-driven "gate opens,
  golden light, candles light up" sequence is fine if time-constrained; prioritize working over
  spectacular, this game doesn't need to duplicate that whole custom animation function.
