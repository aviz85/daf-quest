# DAF QUEST — "תעלומת האור האבוד" (The Mystery of the Lost Light)

A SCUMM-style pixel-art point-and-click adventure teaching the FIRST PAGE OF MASECHET PESACHIM
(Pesachim 2a-2b — "אוֹר לְאַרְבָּעָה עָשָׂר בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר"). Same engine as
the Berakhot and Shabbat games, same hero, same art style bar — ALL-NEW locations, characters,
puzzles and story. Nothing reuses the square/market/beitmidrash/roof/courtyard locations of the
previous games: this is a fresh adventure in a new village.

## HARD RULES (every agent) — identical to the previous games

- Vanilla JS + Canvas 2D. ZERO dependencies, no build step, no modules — plain `<script>` globals.
- ES2020, `'use strict'` per file.
- ALL code, comments, identifiers, console logs: ENGLISH ONLY.
- ALL player-facing in-game strings: HEBREW ONLY (dialogue, names, UI labels, quiz).
- Hebrew strings must never contain `→` arrows; use `←` if an arrow is needed.
- Logical resolution 320x180, scaled up with `image-rendering: pixelated`.
- You own ONLY your assigned file(s). Never create or edit other files.
- Before finishing, run `node --check <yourfile>` and fix any syntax error.
- Defensive coding: never crash if a handler/flag is missing.
- DO NOT touch `js/engine.js`, `js/audio.js`, `js/sprites.js` (root, shared with the previous
  games) or anything under `games/berakhot-2/` or `games/shabbat-2/`. Frozen, out of scope.

## FILE LAYOUT & LOAD ORDER

```
games/pesachim-2/index.html           (shell agent)
games/pesachim-2/style.css            (shell agent — start from games/shabbat-2/style.css as a
                                       base, adjust palette per Art Direction below)
../../js/sprites.js                   SHARED, already exists at repo root — do not edit
../../js/audio.js                     SHARED, already exists at repo root — do not edit
../../js/engine.js                    SHARED, already exists at repo root — do not edit
games/pesachim-2/scenes/inn.js            GAME.registerScene('inn', {...})
games/pesachim-2/scenes/cellar.js         GAME.registerScene('cellar', {...})
games/pesachim-2/scenes/observatory.js    GAME.registerScene('observatory', {...})
games/pesachim-2/scenes/summit.js         GAME.registerScene('summit', {...})
games/pesachim-2/scenes/press.js          GAME.registerScene('press', {...})
games/pesachim-2/main.js              (main.js agent; calls GAME.boot(...))
```

index.html script tags, in order:
```html
<script src="../../js/sprites.js"></script>
<script src="../../js/audio.js"></script>
<script src="../../js/engine.js"></script>
<script src="scenes/inn.js"></script>
<script src="scenes/cellar.js"></script>
<script src="scenes/observatory.js"></script>
<script src="scenes/summit.js"></script>
<script src="scenes/press.js"></script>
<script src="main.js"></script>
```

## ENGINE API CONTRACT — window.GAME (already implemented, read-only reference)

`GAME.registerScene(id, def)` — store scene definition.
`GAME.boot(cfg)` — called by main.js on DOMContentLoaded.
  `cfg = { canvas, startScene, items, intro(g), ending(g), hud(state) }`
  - `items`: array of `{ id, name(He), desc(He), icon }` (icon = 16x16 sprite map, see SPRITES).
  - `intro(g)`: async cutscene run once at start. `ending(g)`: async, run when `g.win()` is called.
  - `hud(state)`: returns HTML string for the HUD strip (seals); engine re-renders after actions.
`GAME.state` = `{ flags:{}, inventory:[], scene:'', seals:[] }` (seals = array of seal ids).

Scene definition `def`:
- `name`: Hebrew display name.
- `floor`: `{ yMin, yMax }` — walkable Y band. Player scale: `0.6 + 0.4*(y-yMin)/(yMax-yMin)`.
- `paint(ctx, t, S)` — draw full background EVERY frame. `t` = seconds since load, `S` = GAME.state.
- `hotspots`: array of:
  - `id`, `name` (Hebrew), `type`: `'object' | 'char' | 'exit'`
  - `x, y, w, h` — hit rect in logical px.
  - `walkTo: {x, y}` — player walks here before action (optional).
  - `visible(S)` — optional predicate; hidden hotspots don't draw or hit.
  - `draw(ctx, t, S)` — optional; engine calls after paint (sorted by hotspot y+h for depth).
  - handlers (all optional, may be async): `look(g)`, `talk(g)`, `take(g)`, `use(g, itemId)`,
    plus for exits: `target` (scene id), `spawn: {x,y}`.
- `onEnter(g)` — optional, async ok.

Game API object `g` (engine passes to every handler/cutscene):
- `await g.say(text, opts)` — speech bubble. `opts = { who:'player'|hotspotId|null, color:'#hex', x, y }`.
- `await g.playerSay(text)` — shorthand.
- `await g.choose(options)` — dialogue menu; `options = [{text, value}]`; resolves value.
- `g.give(itemId)` / `g.remove(itemId)` / `g.has(itemId)` — inventory; give = toast + sfx 'pickup'.
- `g.flag(name)` get / `g.flag(name, value)` set.
- `g.addSeal(id, labelHe)` — push to state.seals if missing, sfx 'seal', toast.
- `g.hasSeal(id)`.
- `await g.goto(sceneId, spawn?)` — fade out/in, switch scene, call onEnter.
- `await g.walkTo(x, y)` — walk player, resolve on arrival.
- `g.sfx(name)` — forward to `AUDIO.sfx(name)`.
- `await g.cutscene(fn)` — lock input, run `await fn(g)`, unlock. Use for any handler chaining
  more than ~2 sequential say/choose calls (house style).
- `await g.wait(ms)`.
- `g.win()` — set flag 'won', run cfg.ending cutscene.

Input model — identical to the previous games:
- Verb bar (HTML, RTL): buttons `הבט` `דבר` `קח` `השתמש`. No verb selected = default mode.
- Default click: 'char' → walk near + talk; 'object' → look; 'exit' → walk + goto; floor → walk.
- Missing handlers get random Hebrew engine defaults — rely on them for pure-flavor gaps.

## SPRITES API CONTRACT — window.SPRITES (already implemented, read-only reference)

- `SPRITES.draw(ctx, map, pal, x, y, scale=1, flip=false)` — map = array of equal-length strings,
  pal = `{char:'#hex'}`, '.' and ' ' transparent.
- `SPRITES.px(ctx, x, y, w, h, color)` — fillRect helper.
- `SPRITES.dither(ctx, x, y, w, h, c1, c2)` — checkerboard 1px dither fill.
- `SPRITES.glow(ctx, x, y, r, color, alpha)` — radial-ish glow.
- `SPRITES.drawPlayer(ctx, x, y, t, walking, flip, scale)` — the SAME hero, זרח: young Talmud
  student, teal/indigo robe, small cap, candle in hand with flickering flame. Reuse as-is — and
  note the poetry: this daf is ABOUT searching by candlelight, and he has carried that candle
  through two whole games. Tonight it matters.
- Generic props: `SPRITES.star(ctx,x,y,t,size,color)`; `SPRITES.candle(ctx,x,y,t,scale)`;
  `SPRITES.torch(ctx,x,y,t)`; `SPRITES.moon(ctx,x,y,phase)`.
- Scene-specific characters/props (innkeeper, twins, astronomer, telescope, rooster, barrels,
  talking lamp, etc.) are drawn by YOUR scene file directly with `SPRITES.px`/`dither`/`glow`,
  exactly like the previous games' scene files. Do not add anything to sprites.js.

## AUDIO API CONTRACT — window.AUDIO (already implemented, read-only reference)

- `AUDIO.sfx(name)` — available names: `pickup, seal, door, star, roar, fail, win, step, magic,
  snore, hic, click, quiz`. Reuse these; do not invent new names (audio.js is frozen).
- `AUDIO.music(mode)` — available modes: `night, tense, dawn`. Ambient default `'night'`,
  `'tense'` for the finale quiz, `'dawn'` for the ending — same usage as the previous games.

## ART DIRECTION — the signature: A SKY TORN IN TWO

This game's unmistakable look, different from Berakhot (deep indigo night) and Shabbat (warm
dusk): **the sky is SPLIT DOWN THE MIDDLE** — because the village can no longer agree what
"אוֹר" means. Left/west half: deep night, indigo-violet, stars, a pale moon. Right/east half:
stuck golden dawn, amber-rose, a confused half-risen sun. Between them a shimmering vertical
SEAM (animated dithered sparkle column, slowly pulsing). As the player collects seals, the seam
NARROWS (read `S.seals.length`: 0 seals = wide seam ~14px, each seal shaves it; outdoor scenes
implement this — the game's visual progress bar, like Shabbat's window candles).

Palette guide (harmonize, not enforced): night side `#12123a #1e1e52 #2a2a70`, star white
`#fff7d6`; day side `#d97a4a #ffb347 #ffd166`; seam sparkle `#aef6ff #ffffff`; spring village —
it is Nisan! — almond blossoms `#ffd7e8 #fff0f5` on dark branches, young grass `#3f7a4a`,
stone `#5a5a7a #7a7a9c`, wood `#5a3a24 #7a512f`, copper `#b0662f`, parchment `#e8d8a8`,
candle flame `#ffd166 #ff8c42`, player robe teal `#1f7a8c` (unchanged).
Detail level: HIGH, same bar as the previous games — 8+ animated micro-details per scene.
Recurring sight gag: **feathers and wooden spoons** (bedikat-chametz kit) tucked everywhere —
on windowsills, in pockets, one stuck in the rooster. Interior scenes (cellar, press) skip the
split sky but echo the theme: cellar is lit ONLY by the player's candle cone; press has one
window on each side — one showing night, one showing dawn.

## TALMUD CONTENT SHEET — Pesachim 2a-2b, verified verbatim against Sefaria. Quote precisely.

### The Mishnah (2a) — the game's foundation

«אוֹר לְאַרְבָּעָה עָשָׂר בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר. כׇּל מָקוֹם שֶׁאֵין מַכְנִיסִין בּוֹ
חָמֵץ, אֵין צָרִיךְ בְּדִיקָה. וּבַמָּה אָמְרוּ ״שְׁתֵּי שׁוּרוֹת בַּמַּרְתֵּף״ — מָקוֹם שֶׁמַּכְנִיסִין
בּוֹ חָמֵץ. בֵּית שַׁמַּאי אוֹמְרִים: שְׁתֵּי שׁוּרוֹת עַל פְּנֵי כׇּל הַמַּרְתֵּף, וּבֵית הִלֵּל
אוֹמְרִים: שְׁתֵּי שׁוּרוֹת הַחִיצוֹנוֹת שֶׁהֵן הָעֶלְיוֹנוֹת.»

Plain meaning the game must teach: on the evening ("אוֹר") of the 14th of Nisan we search for
chametz by candlelight; any place chametz is never brought into needs no search; the "two rows
in the wine-cellar" applies to a cellar chametz IS brought into (one draws from it mid-meal);
Beit Shammai — two full rows across the whole cellar; Beit Hillel — the two OUTER rows, which
are the UPPER ones (the outward-facing top rows).

### The Gemara (2a) — מַאי אוֹר? The central mystery

«מַאי ״אוֹר״? רַב הוּנָא אָמַר: נַגְהֵי, וְרַב יְהוּדָה אָמַר: לֵילֵי. קָא סָלְקָא דַּעְתָּךְ דְּמַאן
דְּאָמַר נַגְהֵי — נַגְהֵי מַמָּשׁ, וּמַאן דְּאָמַר לֵילֵי — לֵילֵי מַמָּשׁ.»
Rav Huna says "or" = naghei (Aramaic: brightness/daylight?), Rav Yehuda says leilei (night).
The Gemara INITIALLY assumes they genuinely disagree (day vs. night) and fires a chain of
מֵיתִיבִי objections — verses where אור seems to mean DAY — each deflected. WITHIN THIS DAF the
running score piles up in favor of אור = evening (two explicit «שְׁמַע מִינַּהּ» conclusions on
2b). The full reconciliation (both actually agree it's evening, they just spoke different local
dialects — «מָר כִּי אַתְרֵיהּ וּמָר כִּי אַתְרֵיהּ») arrives only on daf 3 — the game must treat
that as an honest cliffhanger, NOT resolve it onscreen. The game's playable takeaway: every
proof on THIS daf that reaches a verdict says bedikat chametz happens at NIGHT, by candlelight.

### The verse-duel (2a-2b) — each objection and its exact deflection

1. «הַבֹּקֶר אוֹר וְהָאֲנָשִׁים שֻׁלְּחוּ» (בראשית מד:ג) — so "or" is daytime? Deflection: it does
   not say "הָאוֹר בֹּקֶר"; «״הַבֹּקֶר אוֹר״ כְּתִיב» — the morning BRIGHTENED ("צַפְרָא נְהַר"),
   "or" is a verb here, not a noun. And it teaches Rav's travel rule: «לְעוֹלָם יִכָּנֵס אָדָם
   בְּכִי טוֹב, וְיֵצֵא בְּכִי טוֹב» (always enter a town while it is still light, and leave while
   it is still light — the inn's whole comedy premise).
2. «וּכְאוֹר בֹּקֶר יִזְרַח שָׁמֶשׁ» (שמואל ב כג:ד) — deflection: it is a promise, not a clock:
   like morning light in THIS world, like sunrise for the righteous in the world to come
   («וּכְאוֹר בֹּקֶר בָּעוֹלָם הַזֶּה, כְּעֵין זְרִיחַת שֶׁמֶשׁ לַצַּדִּיקִים לָעוֹלָם הַבָּא»).
3. «וַיִּקְרָא אֱלֹהִים לָאוֹר יוֹם» (בראשית א:ה) — deflection: «לַמֵּאִיר וּבָא קְרָאוֹ יוֹם» —
   He called the BRIGHTENING one "day"; and the counter-question from «וְלַחֹשֶׁךְ קָרָא לָיְלָה»
   is answered: God summoned the light and appointed it over the day's mitzvot, and summoned the
   darkness and appointed it over the night's mitzvot («קַרְיֵיהּ רַחֲמָנָא לִנְהוֹרָא וּפַקְּדֵיהּ
   אַמִּצְוְתָא דִימָמָא, וְקַרְיֵיהּ רַחֲמָנָא לַחֲשׁוֹכָא וּפַקְּדֵיהּ אַמִּצְוְתָא דְלֵילָה»).
4. «הַלְלוּהוּ כׇּל כּוֹכְבֵי אוֹר» (תהלים קמח:ג) — this one seems to prove NIGHT ("stars of
   light")! Deflection: it means "all the illuminating stars" — but then the Gemara extracts the
   gem: starlight is genuinely called light — «דְּאוֹר דְּכוֹכָבִים נָמֵי אוֹר הוּא», practical
   consequence: «הַנּוֹדֵר מִן הָאוֹר — אָסוּר בְּאוֹרָן שֶׁל כּוֹכָבִים» (one who vows off "light"
   is forbidden even starlight).
5. «לָאוֹר יָקוּם רוֹצֵחַ יִקְטׇל עָנִי וְאֶבְיוֹן וּבַלַּיְלָה יְהִי כַגַּנָּב» (איוב כד:יד) —
   deflection (2b): it is about certainty, not hours — if the matter is CLEAR to you like light
   that he comes to kill, he is a רוצח and may be stopped at the cost of his life; if it is
   DOUBTFUL to you like night — treat him as a mere thief.
6. «יֶחְשְׁכוּ כּוֹכְבֵי נִשְׁפּוֹ יְקַו לְאוֹר וָאַיִן» (איוב ג:ט) — deflection: Job is CURSING his
   fortune (wishing his birth-night had hoped for light and found none) — poetry, not a clock.
7. «וָאוֹמַר אַךְ חֹשֶׁךְ יְשׁוּפֵנִי וְלַיְלָה אוֹר בַּעֲדֵנִי» (תהלים קלט:יא) — deflection: David
   means the world to come which is like DAY, versus this world which is like NIGHT.

### The two «שְׁמַע מִינַּהּ» proofs (2b) — the daf's own verdicts, both = night

A. Rabbi Yehuda's baraita: «בּוֹדְקִין אוֹר אַרְבָּעָה עָשָׂר, וּבְאַרְבָּעָה עָשָׂר שַׁחֲרִית,
   וּבִשְׁעַת הַבִּיעוּר» — since he lists "or of the 14th" SEPARATELY from "the 14th in the
   morning", "or" must be the EVENING. «אַלְמָא ״אוֹר״ אוּרְתָּא הוּא. שְׁמַע מִינַּהּ.»
B. The beacons: «אֵין מַשִּׂיאִין מַשּׂוּאוֹת אֶלָּא עַל הַחֹדֶשׁ שֶׁנִּרְאָה בִּזְמַנּוֹ, לְקַדְּשׁוֹ.
   וְאֵימָתַי מַשִּׂיאִין מַשּׂוּאוֹת — לְאוֹר עִבּוּרוֹ» — signal fires announcing the new month
   are lit "on the OR of its intercalation" — and beacons are obviously lit AT NIGHT.
   «אַלְמָא ״אוֹר״ אוּרְתָּא הוּא! שְׁמַע מִינַּהּ.»

### The melakhah debate (2b) — Rabbi Eliezer ben Yaakov vs. Rabbi Yehuda

«מֵאֵימָתַי אַרְבָּעָה עָשָׂר אָסוּר בַּעֲשִׂיַּית מְלָאכָה? רַבִּי אֱלִיעֶזֶר בֶּן יַעֲקֹב אוֹמֵר:
מִשְּׁעַת הָאוֹר, רַבִּי יְהוּדָה אוֹמֵר: מִשְּׁעַת הָנֵץ הַחַמָּה.»
REbY challenges: «וְכִי הֵיכָן מָצִינוּ יוֹם שֶׁמִּקְצָתוֹ אָסוּר בַּעֲשִׂיַּית מְלָאכָה וּמִקְצָתוֹ
מוּתָּר?» (where do we find a DAY half-forbidden, half-permitted for work?) R' Yehuda's comeback:
«הוּא עַצְמוֹ יוֹכִיחַ, שֶׁמִּקְצָתוֹ מוּתָּר בַּאֲכִילַת חָמֵץ וּמִקְצָתוֹ אָסוּר בַּאֲכִילַת חָמֵץ»
(the 14th itself proves it — part of it one may still EAT chametz, part of it not!). The Gemara
resolves REbY's "or" here as עַמּוּד הַשַּׁחַר (dawn-break, so his position is not evidence in the
naghei/leilei fight), and REbY's rejoinder to the comeback: «אָמֵינָא לָךְ אֲנָא מְלָאכָה
דְּרַבָּנַן, וְאַתְּ אָמְרַתְּ לִי חָמֵץ דְּאוֹרָיְיתָא?!» — I speak of RABBINIC work-prohibition,
you answer me from TORAH-level chametz?! (For chametz, the Torah itself drew the mid-day line;
for the chametz-eating hours — those are rabbinic fences, «הַרְחָקָה הוּא דַּעֲבוּד רַבָּנַן
לִדְאוֹרָיְיתָא».)

### Bonus color (2b, flavor only, no puzzle weight)

- The Temple: one standing all night offering on the altar — at DAWN («לָאוֹרָה») must re-sanctify
  hands and feet, "דִּבְרֵי רַבִּי" — deflected: «״אוֹרָה״ שָׁאנֵי» ("orah" is different from "or").
- Taanit rule cameo: one may eat before a fast «עַד שֶׁיַּעֲלֶה עַמּוּד הַשַּׁחַר» per REbY;
  «רַבִּי שִׁמְעוֹן אוֹמֵר: עַד קְרוֹת הַגֶּבֶר» (until the rooster crows — the game's rooster gag).
- The daf ENDS mid-sentence: «מֵיתִיבִי מָר זוּטְרָא:» — Mar Zutra inhales for his objection and
  the daf runs out. Gift of a cliffhanger — use it verbatim in the ending credits.

**Accuracy rule**: quiz feedback may paraphrase in plain Hebrew, but every quoted source line
must match the text above exactly. Do not fabricate resolutions the daf doesn't reach.

## GAME DESIGN — story, scenes, puzzles

Hero: **זרח** — the SAME student (third night, third village; zero dependency on prior games).
Tonight: אוֹר לארבעה עשר בניסן in **כְּפַר נְהוֹרָא** — bedikat chametz night. But the village is
paralyzed: the meaning of the word **אוֹר** itself has torn, and with it the SKY tore in two —
half the heavens insist it is night, half insist it is morning. The ancient **מְנוֹרַת
הַבְּדִיקָה** (the Great Searching-Lamp in the old olive press, from whose flame every
bedikat-chametz candle in the village is lit each year, for two thousand years) has gone out and
REFUSES to relight: "עד שלא תגידו לי מה זה אוֹר — אני לא נדלקת." No flame → no candles → no
bedikah → chametz on Pesach. The rooster crows nonstop, travelers are stuck at the inn (nobody
knows if it's בְּכִי טוֹב), and the beacon-watchman won't light the new-month beacon.
Fix: bring **three seals of understanding** to the מנורה: `bedikah` (חותם הבדיקה), `light`
(חותם האוֹר), `melakhah` (חותם המלאכה). Then she asks the daf's own questions and relights.

Tone: house style — Monkey Island meets Beit Midrash. Absurd, warm, never mocking the content;
jokes live in the world, the Torah stays accurate. Light fourth-wall breaks OK.

Item-gating flow (nonlinear where possible): inn (hub) → cellar: meet the cellar-keeper, receive
UNLIT candle `ner`, too dark to search → summit: win the melakhah quiz → beacon lights → use
`ner` on the beacon → swaps to `nerlit` → back to cellar: rows puzzle + candle search → seal
`bedikah` + item `pita` → observatory (open from the start, no gating): verse-duel → seal
`light` → press: finale. The `daf` item (from the press, available early) gives hints anywhere.

### Scene `inn` — פּוּנְדַּק "בְּכִי טוֹב" (hub; player starts here)

Paint: a roadside inn courtyard at the village crossroads under the SPLIT SKY (seam runs down
mid-screen; narrows per seal — see Art Direction). Two-story stone inn with a hanging wooden
sign ("פונדק בכי טוב" — paint tiny Hebrew-ish glyphs, unreadable is fine), stable, water trough,
a chametz-laden handcart, almond tree in bloom shedding petals (animated), lit/unlit windows
mixed (the village can't decide if it's bedtime). Exits: cellar (trapdoor + stairs by the inn
wall), observatory (uphill path, east/day side), summit (uphill path, west/night side), press
(old lane between buildings).

Hotspots & humor:
- **גד הפונדקאי** (char, id `gad`): the quest-giver (intro cutscene is owned by main.js; his own
  `talk` gives a recap of remaining seals, same pattern as previous games). Character: aggressively
  hospitable and completely fried — keeps offering guests food, remembering mid-sentence that
  every dish is chametz, and yanking it back ("קרעפלעך? לא!! אסור!! כלומר — מותר עד מחר בבוקר!!
  כלומר — תאכל מהר!!!").
- **שחר וליל** (char, one hotspot, id `twins`): twin travelers WEDGED in the inn doorway — one
  halfway out (refuses to leave: "רב אמר! לְעוֹלָם יֵצֵא אָדָם בְּכִי טוֹב! תראה שמיים! חצי טוב!"),
  one halfway in (refuses to enter, mirror argument). They argue in stereo. Pure flavor teaching
  the בכי טוב rule; after `light` seal they've swapped places and are wedged the other way
  (visible(S) variants or draw-state change — one funny state change is enough).
- **בֵּיצָה** (char, id `cat`): the village cat — the running inter-game convention: village cats
  are named after masechtot, and this village named theirs בֵּיצָה, which is both a real masechet
  and an egg; she sits ON the chametz cart like a guard. take: refuses ("אסור לטלטל אותי. אני
  מוקצה. תבדוק במסכת שלי." — flagged as her opinion, not psak). talk: meow gags + one real hint
  (chametz crumbs lead to the cellar).
- **עֲגָלַת הֶחָמֵץ** (object): the village's last chametz piled on a handcart "לביעור של מחר".
  look — inventory of absurd chametz (יש שם קרוטון בגודל של תינוק). use — Gad panics.
- **הַשּׁוֹקֶת** (object): water trough; look/use — it gurgles back «מַאי?» in Aramaic (the echo
  gag every game keeps, new vessel).
- **שֶׁלֶט הַפּוּנְדָּק** (object): look — inn rules, absurd (e.g. "אורח שנכנס — שיכנס בכי טוב.
  אורח שיוצא — שייצא בכי טוב. אורח באמצע — שיחליט כבר.") + the REAL hint: the full Mishnah header
  «אוֹר לְאַרְבָּעָה עָשָׂר בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר».
- Exits (type 'exit', Hebrew names): «אֶל הַמַּרְתֵּף», «אֶל הַמִּצְפֶּה», «אֶל הַפִּסְגָּה»,
  «אֶל בֵּית הַבַּד».

### Scene `cellar` — מַרְתֵּף הַיַּיִן — SEAL 1: `bedikah` + item `pita`

Paint: THE DARK SCENE. Near-total darkness; the only light is a warm cone/halo around the player
(and a weak grey wedge from the stairway). If `S.flags.cellarLit` is not set (set when player
arrives holding `nerlit`, via onEnter), paint everything as barely-visible silhouettes. With
`nerlit`: warm candle radius reveals a gorgeous barrel cellar — a back wall of stacked wine
barrels in a clear GRID (4 rows high × 6 columns, each barrel ~14px), dusty shelves, hanging
sausage-shaped... no — hanging garlic braids (kosher for Pesach jokes), a mouse hole with two
glinting eyes (animated), cobwebs that sway. The barrel grid is the puzzle centerpiece — rows
must read clearly (top/outer rows visually distinct).

Characters & puzzle:
- **פְּרֵידָא הַמַּרְתְּפָנִית** (char, id `freida`): the innkeeper's cellar-keeper, ancient, calm,
  carries a feather and wooden spoon like a knight's sword and shield. First talk: hands the
  player the UNLIT candle → `g.give('ner')` + explains there is NO FIRE in the village tonight —
  every flame came from the מנורה and it's out; rumor: the beacon-watchman on the summit still
  knows how to make fire ("בועז. איש של אש. קצת שרוף בעצמו.").
- **Quiz A — "מה בכלל צריך בדיקה?"** (Freida runs it, `g.choose` rounds, requires `nerlit`):
  3 rounds classifying places, options «צריך בדיקה» / «אין צריך בדיקה»:
  (1) the cellar itself — one draws wine from it during the meal → צריך («וּבַמָּה אָמְרוּ שְׁתֵּי
  שׁוּרוֹת בַּמַּרְתֵּף — מָקוֹם שֶׁמַּכְנִיסִין בּוֹ חָמֵץ»);
  (2) the sealed Pesach-dishes cabinet no chametz ever enters → אין צריך («כׇּל מָקוֹם שֶׁאֵין
  מַכְנִיסִין בּוֹ חָמֵץ, אֵין צָרִיךְ בְּדִיקָה»);
  (3) Gad's coat pockets (he eats everywhere, crumbs everywhere) → צריך (comic but halachically
  fair — chametz gets brought in there).
- **Quiz B — the ROWS puzzle** (the visual centerpiece; after Quiz A): Freida asks: according to
  בית הלל, WHICH two rows must be searched? The player must CLICK rows of the barrel wall
  (each row = an object hotspot, `rowTop`, `rowSecond`, `rowThird`, `rowBottom` — or cleaner:
  a single `g.choose` with row options AND clickable row hotspots that feed the same guard flag —
  pick ONE clean approach; clicking is preferred, it's more game-y). Correct per Beit Hillel:
  «שְׁתֵּי שׁוּרוֹת הַחִיצוֹנוֹת שֶׁהֵן הָעֶלְיוֹנוֹת» — the TOP row and the row directly behind/
  below it facing outward (visualize: the top outer row + the second/upper-outer; wrong picks get
  specific rejections — picking two full rows across the whole cellar: "זו שיטת בית שמאי! מחמירים
  יפה, אבל הלכה כבית הלל."). On success: the two correct rows GLINT (sparkle animation), and in a
  barrel-top crack the candlelight catches something — an ancient pita! → `g.give('pita')`,
  sfx 'magic', then cutscene beat → `g.addSeal('bedikah', 'חותם הבדיקה')`. Freida salutes with
  the feather.
- **חוֹר הָעַכְבָּר** (object): look — two eyes glint back; Freida mutters the future-daf worry
  gag WITHOUT fabricating psak ("ואם עכבר ייקח פירור אחרי הבדיקה? אל תפתח לי את הנושא. יש על זה
  דף שלם. לא הדף שלנו."). Fun foreshadowing of דף ט.
- **מַדַּף הַכֵּלִים** (object): look — Pesach dishes behind a curtain, gag about the annual
  dish-swap ceremony.
- `use('daf', ...)` on Freida or the barrels → quote the relevant Mishnah line as a hint.
- If the player tries to search/quiz WITHOUT `nerlit`: Freida blocks with the theme line: "בדיקה
  בלי נר? «בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר». אין נר — אין בדיקה. תביא אש, גיבור."

### Scene `observatory` — מִצְפֵּה הַכּוֹכָבִים שֶׁל נַפְתָּלִי — SEAL 2: `light`

Paint: a crooked wooden stargazing tower on the EAST hill — the absurd twist: it sits on the
DAY side of the torn sky, so the poor astronomer's stars are washed out by stuck dawn light
(his whole motivation). A big brass telescope on a swivel (animate a slow scan), star charts
pinned everywhere flapping, an astrolabe spinning lazily, wind chimes made of lens glass,
a "star jar" of captured starlight glowing faintly on a shelf. The seam of the sky is visible
crossing the background; on HIS side, only 2-3 stubborn stars pierce the daylight.

Characters & puzzle:
- **נַפְתָּלִי הַצּוֹפֶה** (char, id `naftali`): the village astronomer, dramatic, scarf, takes
  personal offense at the sky's condition. His tragic flaw: he has decided that **אוֹר = יוֹם**
  ("כתוב בפסוקים!") — because if "or" means day, then the DAY half of the sky is right, it will
  win, and he will... have no stars at all. He hasn't thought it through. The player must defeat
  him in the **VERSE-DUEL** — his six proofs, the Gemara's six deflections.
- **THE VERSE-DUEL** (talk → `g.cutscene`, multi-round `g.choose`, sfx 'quiz' per round): Naftali
  fires a verse; player picks the correct deflection from 3 options (shuffle order across
  playthroughs; wrong pick = comic rebuff + retry same round). Rounds, using the Content Sheet
  deflections EXACTLY (paraphrase allowed in feedback, quoted lines verbatim):
  R1 «הַבֹּקֶר אוֹר וְהָאֲנָשִׁים שֻׁלְּחוּ» → "הבוקר אוֹר" — פועל, לא שם: הבוקר האיר. וגם עצת
     דרך: יכנס אדם בכי טוב ויצא בכי טוב (funny cross-reference: "תגיד את זה לתאומים בפונדק").
  R2 «וּכְאוֹר בֹּקֶר יִזְרַח שָׁמֶשׁ» → הבטחה לצדיקים לעולם הבא, לא שעון.
  R3 «וַיִּקְרָא אֱלֹהִים לָאוֹר יוֹם» → למאיר ובא קראו יום; האור מונה על מצוות היום, החושך על
     מצוות הלילה.
  R4 «לָאוֹר יָקוּם רוֹצֵחַ... וּבַלַּיְלָה יְהִי כַגַּנָּב» → ודאי כאור = רוצח (ניתן להצילו
     בנפשו); ספק כלילה = גנב. עניין של ודאות, לא של שעות.
  R5 «יְקַו לְאוֹר וָאַיִן» → איוב מקלל את מזלו. שירה, לא שעון.
  R6 «וְלַיְלָה אוֹר בַּעֲדֵנִי» → דוד על העולם הבא שדומה ליום; העולם הזה דומה ללילה.
  MID-DUEL TWIST (scripted beat between R3 and R4): Naftali triumphantly fires «הַלְלוּהוּ כׇּל
  כּוֹכְבֵי אוֹר» — then freezes, realizes it calls STARS "or", i.e. night-light is light. Player
  choice of three reactions (all funny, none wrong — a free beat). Payoff line: «הַנּוֹדֵר מִן
  הָאוֹר — אָסוּר בְּאוֹרָן שֶׁל כּוֹכָבִים». אור הכוכבים — אור גמור. Naftali: "אז הכוכבים שלי...
  הם אוֹר אמיתי?" (his redemption arc begins).
  CLINCHER (after R6): the player delivers proof A (Rabbi Yehuda's baraita, quoted verbatim from
  the Content Sheet) via a final `g.choose` — pick the RIGHT proof from 3 candidates (decoys: two
  of the already-deflected day-verses). Correct → Naftali concedes with grace: if אוֹר of the
  Mishnah is evening, the night half of the sky is right, and his stars are safe. The 2-3 stubborn
  stars over his tower flare (sparkle), sfx 'seal' → `g.addSeal('light', 'חותם האוֹר')`. He gives
  a closing bit: "בדיקת חמץ בלילה, לאור הנר. והכוכבים — הם יבואו לצפות בך עובד."
- **הַטֵּלֶסְקוֹפ** (object): look — a fourth-wall gem: through the lens you see the sky seam up
  close — "מקרוב זה נראה כמו... פיקסלים? לא. לא יכול להיות. אני במשחק?!" (Naftali refuses to
  discuss it further).
- **צִנְצֶנֶת הַכּוֹכָבִים** (object): look — captured starlight; after the seal, it glows
  brighter (state-dependent draw — small nice touch).
- **מַפַּת כּוֹכָבִים** (object): look — the constellations are all renamed after masechtot gag
  ("קבוצת 'עירובין'. אף אחד לא מבין אותה, אבל היא יפה.").
- `use('daf', naftali)` → hint: which deflection fits the current round.

### Scene `summit` — פִּסְגַּת הַמַּשּׂוּאוֹת — SEAL 3: `melakhah` + candle-lighting service

Paint: a windswept rocky peak on the WEST (night) hill: the unlit BEACON pyre (a big log
tripod with oil-soaked wrappings) center-stage, a small watchman's hut with a round window,
distant OTHER hilltops fading into the dark (where answering beacons would light — after this
scene's success, paint tiny answering fires on the far hills: «הרים רואים הרים»!), wind-blown
grass and petals streaming (animated), the split sky at its most dramatic (the seam hits the
horizon here). A weathervane spinning confused (day wind vs night wind gag).

Characters & puzzle:
- **בּוֹעַז מַשִּׂיא הַמַּשּׂוּאוֹת** (char, id `boaz`): the beacon-watchman — huge beard, mild
  pyromania, heartbroken: tonight is the OR of the month's intercalation and he cannot light the
  beacon, because "light the beacon בְּאוֹר עיבורו" — and nobody knows when אוֹר is anymore. He
  guards the LAST EMBER in the village (a firebox he cradles like a baby, warm glow through the
  slats). He will share fire ONLY with someone who can untangle the daf's time-lines — the
  **MELAKHAH QUIZ**.
- **THE MELAKHAH QUIZ** (talk → `g.cutscene`, `g.choose` rounds, wrong = comic retry):
  R1 (the beacon proof): "מתי משיאין משואות על החודש שנראה בזמנו?" → **לְאוֹר עִבּוּרוֹ — בלילה**
     (distractors: בצהריים, בשעת הנץ). Feedback quotes proof B verbatim + «שְׁמַע מִינַּהּ» — and
     Boaz beams: beacons are NIGHT creatures, so אוֹר = ערב.
  R2: "מאימתי ארבעה עשר אסור בעשיית מלאכה, לדעת רבי אליעזר בן יעקב?" → **משעת האור — עמוד השחר**
     (distractors: מהנץ החמה [ר' יהודה], מהערב). Feedback teaches the Gemara's resolution that
     REbY's "or" = עמוד השחר.
  R3: "רבי אליעזר בן יעקב הקשה: היכן מצינו יום שמקצתו אסור במלאכה ומקצתו מותר? מה ענה לו רבי
     יהודה?" → **הוא עצמו יוכיח — מקצת היום מותר באכילת חמץ ומקצתו אסור** (distractors: אין תשובה,
     שבת תוכיח).
  R4: "ומה הפיל רבי אליעזר בן יעקב בחזרה?" → **אמינא לך אנא מלאכה דרבנן, ואת אמרת לי חמץ
     דאורייתא?!** (distractors: two invented-but-wrong retorts clearly labeled by feedback).
  All correct → CUTSCENE: Boaz opens the firebox, blows the ember, LIGHTS THE BEACON — big flame
  cascade (paint state via flag `beaconLit`; fire animation, sparks, glow over the whole scene,
  answering fires pop on the far hills one by one, sfx 'magic' then 'win'-adjacent... use 'star').
  → `g.addSeal('melakhah', 'חותם המלאכה')`.
- **CANDLE SERVICE**: after `beaconLit`, `use('ner', beacon-hotspot)` (or on Boaz) → he lights the
  player's candle ceremonially ("אש מאש. תגיד למנורה שבועז עוד יודע להדליק.") →
  `g.remove('ner'); g.give('nerlit')`, sfx 'magic'. If the player tries before the quiz — Boaz
  refuses with a theme line. (The `ner`→`nerlit` swap is THE key gate for the cellar seal.)
- **שֶׂכְוִי הַתַּרְנְגוֹל** (char, id `rooster`): the village rooster, stationed on the hut roof,
  utterly broken by the split sky — crows at the day half, apologizes to the night half, repeats
  (animate a small crow loop; sfx 'roar' would be too much — use 'hic' for a strangled crow, it's
  funnier). talk: the קרות הגבר cameo — he insists he is a HALACHIC INSTRUMENT («רבי שמעון אומר:
  עד קרות הגבר!» — "אנשים אוכלים לפי הקריאה שלי! זו אחריות!") and right now he's committing
  malpractice. After the ending he crows exactly once, correctly.
- **תֵּבַת הַגֶּחָלִים** (object): look — the firebox; warm glow through slats, Boaz shushes you
  ("היא ישנה.").
- **הַשַּׁבְשֶׁבֶת** (object): look — weathervane spinning confused between day-wind and
  night-wind.

### Scene `press` — בֵּית הַבַּד הָעַתִּיק — finale + `daf` item

Paint: interior of the ancient olive press: the great round crushing stone, wooden screw press,
clay oil vats, hanging oil lamps (ALL unlit — eerie), and center-stage the **מְנוֹרַת
הַבְּדִיקָה** — a grand carved stone lamp (think: ancient, seven small spouts around one great
spout, geometric carvings) with THREE seal-shaped sockets at its base and one great cold wick.
Two windows: LEFT window shows night sky, RIGHT window shows stuck dawn — the split sky leaking
inside. Dust motes in the two window beams (animated), a drip of oil from a vat (loop).

Characters & finale:
- **רַב הוּנָא וְרַב יְהוּדָה** (2 chars, ids `huna` & `yehuda`, mid-argument with exaggerated
  gesture loops — pointing at the sky through opposite windows): the source machloket, live:
  «מַאי אוֹר?» — רב הונא: "נַגְהֵי!" רב יהודה: "לֵילֵי!" — talk to either → a short comic
  exchange where each recruits the player; a `g.choose` beat where ANY answer gets both of them
  to yell "בדיוק!" simultaneously (they hear what they want). They set up the mystery; the LAMP
  resolves the gameplay. Honest-cliffhanger line required (per Content Sheet): the full peace
  treaty between them ("שניהם התכוונו לערב, רק הניב שונה") happens on the NEXT daf — one of them
  should say something like "בדף הבא נשלים. אולי. אם הוא יודה שאני צודק."
- **מְנוֹרַת הַבְּדִיקָה** (char-like object, id `menorah`, the finale): SHE TALKS. Two thousand
  years old, deadpan, exhausted, secretly warm ("אלפיים שנה אני נדלקת בזמן. פעם אחת ביקשתי
  הבהרה אחת קטנה — וכל הכפר קרס."). With fewer than 3 seals: locked-flavor lines counting what's
  missing. With all 3: THE FINALE QUIZ (wrap in `g.cutscene`, `AUDIO.music('tense')`): she asks
  four questions, `g.choose`, 3 options each, wrong = her dry mockery + retry, no punishment:
  1. «אוֹר לְאַרְבָּעָה עָשָׂר בּוֹדְקִין אֶת הֶחָמֵץ ___» → **לְאוֹר הַנֵּר** (distractors:
     לאור הלבנה / לאור המשואה — "מחמיא לבועז, אבל לא.")
  2. "מה אינו צריך בדיקה כלל?" → **כׇּל מָקוֹם שֶׁאֵין מַכְנִיסִין בּוֹ חָמֵץ** (distractors: כל
     מקום שאין בו חלונות / כל מקום שבדקו בו אשתקד)
  3. "שתי השורות במרתף, לדעת בית הלל?" → **הַחִיצוֹנוֹת שֶׁהֵן הָעֶלְיוֹנוֹת** (distractors: על
     פני כל המרתף [זו בית שמאי] / התחתונות שהן הפנימיות)
  4. "«מַאי אוֹר» — רב הונא אמר ___ ורב יהודה אמר ___" → **נַגְהֵי / לֵילֵי** (distractors with
     the pair swapped, and one silly: "בּוֹקֶר / טוֹב")
  All correct → she DRAWS BREATH (the whole room dims a beat) → `g.win()`.
- **סֵפֶר גְּמָרָא עֲנָק** (object): look — shows the real Mishnah header verbatim; take — gives
  item `daf` (hint sheet used across scenes). Same pattern as previous games.
- **אֲבַן הָרֵחַיִם** (object): look — the great crushing stone, gag about how many olives died
  for the lamp's dinner. use('pita') on the menorah or the press → she refuses to burn it:
  "בִּיעוּר מחר בבוקר, חביבי. אני מנורה, לא מדורה." (pita stays — it's tomorrow's mitzvah).
- **כַּדֵּי הַשֶּׁמֶן** (object): look — oil vats, flavor.

## ITEMS (main.js registry)

- `ner` — "נֵר הַבְּדִיקָה (כבוי)" — a plain unlit wax candle; icon: pale candle, NO flame pixels.
- `nerlit` — "נֵר הַבְּדִיקָה (דולק)" — same candle, flame lit; icon: candle WITH flame pixels.
- `daf` — "דַּף גְּמָרָא" — hint sheet (parchment/wood-frame look, same family as previous games,
  its own definition in THIS game's main.js — no cross-game state).
- `pita` — "פִּתָּה עַתִּיקָה" — the found chametz, round pita with a bite missing; desc jokes it
  is scheduled for tomorrow's ביעור and must NOT be eaten ("קשה כאבן. ביעור זה גם מחזור.").

## SEALS (labels for HUD, main.js)

`bedikah`: "חותם הבדיקה" · `light`: "חותם האוֹר" · `melakhah`: "חותם המלאכה"
Suggested HUD glyphs: bedikah `▤` (barrel rows) · light `✶` · melakhah `⚒` (builder's latitude,
any three distinct glyphs fine; unfilled slots show `?` like previous games).

## SHELL (index.html + style.css) and MAIN (main.js)

- Same dark retro UI skeleton (canvas centered, pixelated, RTL, status line, verb bar, inventory
  strip, HUD seal area) — start from `games/shabbat-2/style.css` as a base; shift the chrome
  palette to this game's identity: split-sky accent — cool indigo panel tones with ONE warm amber
  accent stripe (e.g. gradient border or title underline that is half indigo / half amber — the
  torn sky in miniature). Siblings, not clones.
- Title: "תעלומת האור האבוד — פסחים דף ב". Footer: `דף ב · «אוֹר לְאַרְבָּעָה עָשָׂר בּוֹדְקִין
  אֶת הֶחָמֵץ לְאוֹר הַנֵּר»`.
- index.html: script order exactly as in FILE LAYOUT. `<noscript>` line in house style ("המשחק
  הזה דורש JavaScript. בלי זה — המנורה תישאר כבויה. והיא כבר מספיק עצבנית.").
- main.js owns: ITEMS registry, SEALS map + HUD renderer (3 slots), the INTRO cutscene, the
  ENDING cutscene, `GAME.boot({ canvas, startScene: 'inn', items, intro, ending, hud })`, and
  exposes `window.SEALS` / `window.ITEMS` like the Shabbat game.
- CSS class contract between main.js and style.css (shell agent must define ALL of these;
  main.js agent must use ONLY these for overlays): `.caption`, `.split-veil` (intro reveal veil),
  `.seam-heal` (ending: bright vertical seam line that narrows/fades), `.lamp-overlay` +
  `.lamp-flame` (ending: the menorah lighting), `.candle-row` + `.candle` + `.lit` (ending candle
  cascade), `.endcard` + `.endcard-title` + `.endcard-sub` + `.credits` + `.replay`, `.glow-overlay`
  + `.glow-text`. Same shapes/behavior as the Shabbat game's equivalents.
- INTRO beats (main.js writes the actual dialogue, house comic energy, hit these beats): caption
  card "כְּפַר נְהוֹרָא · אוֹר לְאַרְבָּעָה עָשָׂר בְּנִיסָן"; זרח arrives planning a quiet bedikat
  chametz; notices the sky is torn in half; גד bursts out (sfx 'door'), explains: the word אוֹר
  broke — רב הונא אומר נגהי, רב יהודה אומר לילי — the sky split with it, the מנורה went out and
  refuses to relight, no bedikah possible, Pesach in danger; one flavor `g.choose` (every branch
  continues); the quest: three seals — הבדיקה, האוֹר, המלאכה — bring them to the מנורה in the old
  olive press (בית הבד); closing caption "הַמְּשִׂימָה: שְׁלוֹשָׁה חוֹתָמוֹת — וְהַמְּנוֹרָה תִּדְלַק".
- ENDING beats: sfx 'win', music 'dawn'; the menorah lights (lamp-overlay flame blooms); caption
  «וַתְּהִי אוֹרָה!... כלומר, אוֹר. כלומר — לילה. הכול כשורה.»; the SKY SEAM HEALS — the sky
  resolves to proper NIGHT (the game's punchline: night WON, because bedikat chametz is tonight
  — `.seam-heal` line narrows to nothing revealing calm stars); candle cascade — every window in
  the village lights a bedikah candle from the מנורה's flame one by one (`.candle-row`); callback
  beats: the twins finally both step (both INTO the inn — "נחליט בבוקר. בכי טוב."), שכווי crows
  exactly ONCE, correctly, and takes a bow; רב הונא ורב יהודה shake hands while each mutters his
  own word; זרח's closing line about finally using his candle for its true purpose; endcard with
  comic credits (must include a «מֵיתִיבִי מָר זוּטְרָא:» cliffhanger credit — "מר זוטרא עדיין
  באמצע נשימה. ההמשך בדף הבא") + replay button ("עוד פעם? נַגְהֵי! כלומר — לֵילֵי! כלומר — כן!").

## MENU (root index.html) — add the third game card

Insert BEFORE the "בקרוב" card, matching the existing card markup exactly:
badge "מסכת פסחים", title "תעלומת האור האבוד", line `דף ב · «אוֹר לְאַרְבָּעָה עָשָׂר בּוֹדְקִין
אֶת הֶחָמֵץ לְאוֹר הַנֵּר»`, href `games/pesachim-2/index.html`. Keep the "בקרוב" card last.
