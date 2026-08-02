# Historical Audit — *A Famosa: Streets of Golden Melaka*

**Scope:** all shipped player-facing text as of `graphics-overhaul-local` @ `0503132` —
`src/data/npcs.json`, `src/data/quests/*.json`, `src/data/historical-objects.json`,
`examineText` fields in `src/data/locations/*.location.json`, `docs/PROJECT_BRIEFING.md`.

**Reviewer frame:** Portuguese Estado da Índia / post-Sultanate Melaka, specifically the year **1580** —
i.e. two years after Alcácer Quibir, five years after the last great Acehnese siege of Melaka and the
loss of Ternate, thirteen years after the Ming lifted the *haijin*, eight years after the Portuguese
appointed Melaka's first Kapitan China, and sixty-one years before any Dutchman takes the town.

**Sourcing convention.** Every factual claim below is either (a) footnoted to a source in §5, or
(b) explicitly marked **[PJ]** — professional judgement, i.e. my reading of the period where the
evidence is thin, contested, or a matter of interpretation rather than fact. Nothing is asserted
bare.

**Headline.** The *material* history in this game is genuinely good — better than most commercial
period games. The location prop prose (`padrão`, `guarita`, chengal piles, attap, damar-payed seams,
cargo "measured in Malay bahar", the sewn dhow that "cannot leave until it turns") is the work of
someone who read properly. The failure is not research depth; it is **date discipline**. The world is
richly *sixteenth-century* and only loosely *1580*. Roughly two-thirds of the errors below are
things that are true of Portuguese Melaka at some point in its 130 years, placed in the wrong
decade — or, in three cases, in the wrong century entirely.

---

## 1. ERRORS

Ranked by severity. Tier A = a period specialist would call it wrong on sight. Tier B = wrong but
recoverable. Tier C = imprecision, internal contradiction, or pop-history.

---

### TIER A

---

#### E1 — The church is called by its Dutch name, sixty-one years early ★ highest-value fix

**Where:** `src/data/locations/st-pauls-church.location.json:3` (`"name": "St. Paul's Church"`);
`npcs.json:316` (Padre Tomás greeting, "the Church of St. Paul"); `npcs.json:349`;
`historical-objects.json` — the entire `st-pauls-church` location key and its `objectsByLocation` block;
`PROJECT_BRIEFING.md:52, 60`; `rua-direita.location.json:719` ("where the lane climbs to St Paul's").

**Problem.** The chapel on the hill was raised in **1521** by Duarte Coelho as a votive offering for
surviving a storm, dedicated as **Nossa Senhora da Annunciada** (Our Lady of the Annunciation). It was
deeded to the Society of Jesus in **1548** — the title deeds received by Francis Xavier — enlarged in
1556, and under the Jesuits took the name **Igreja de Madre de Deus** (Church of the Mother of God).
It became **"St. Paul's"** only when the **Dutch took Melaka in 1641** and reconsecrated it for
Reformed use as *St. Paulus Kerk* / the *Bovenkerk*.¹ In 1580 there is no St. Paul's in Melaka and no
Portuguese would recognise the phrase.

The game already knows this. `st-pauls-church.location.json:236` reads:

> "Nossa Senhora da Anunciada, raised in 1521 by a captain who had promised it in a storm."

That prop text is **correct and excellent**. It is simply contradicted by every other string in the
build.

**Fix.** Keep the internal ID `st-pauls-church` (renaming it would touch the whole codebase for zero
player benefit). Change **player-facing strings only**. In-world, the town calls it *a igreja do
outeiro* — "the church on the hill" — which is how a merchant or a Malay vendor would refer to it
anyway; the Padre uses the formal name.

Drop-in, Padre Tomás `greeting` (`npcs.json:316`), in his established warm-formal register:

```
"Peace be with you, my child. What brings you up the hill to Madre de Deus? Here, all are welcome in God's house — the Fathers took this chapel from Our Lady of the Annunciation and gave her a grander title, but she was a sailor's thank-offering first and she has never quite stopped being one."
```

Drop-in, Padre Tomás `church` topic (`npcs.json:349`) — see also **E2**, which this line also fixes:

```
"A captain named Coelho promised Our Lady a chapel if she brought him out of a storm in the China sea, and in 1521 he paid. The Fathers were given the deeds in Saint Francis Xavier's own hand and have been enlarging her ever since. *gestures down the slope* The Sultan's istana stood below us, by the water, not here. What is under these stones is only the hill."
```

Location display name → `"Nossa Senhora da Anunciada"` or `"The Church on the Hill"`.

---

#### E2 — The Padre's account of what stood on the hill is wrong twice, and contradicts the game's own props

**Where:** `npcs.json:349` — "St. Paul's was built on the ruins of a local chief's home. From
darkness, light. The stones came from a Hindu temple - now they serve Christ."

**Problem.** Two distinct errors. (i) The Sultan's *istana* stood at the **foot** of the hill by the
river, not on the summit; the summit was bare when Coelho built.¹ (ii) The Portuguese demolition
programme took stone from the **congregational mosque and the royal tombs** to build **A Famosa** —
not from a Hindu temple, and not for the chapel.² Melaka's Muslim monumental fabric was the quarry;
that is the historically loaded fact, and it is the one the game is discarding.

**Internal contradiction.** `historical-objects.json:287` (`sultan-palace-ruins`) states the palace
*was* on the hilltop; `a-famosa-gate.location.json:446` states — correctly and much better — that the
wall was "raised by Albuquerque's men in five months out of the stones of the sultan's mosque and the
tombs of his fathers." Three shipped texts, three different stories.

**Fix.** Use the drop-in at **E1** for the Padre. Then rewrite `sultan-palace-ruins` (`historical-objects.json:287`)
so the ruins are the *istana at the foot of the hill*, visible from the churchyard — which is
dramatically stronger, because the player can then see both at once:

```
"Foundations, and a line of cut stone running down toward the water. The istana stood here — not on the crown of the hill, but below it, where a ruler could hear the river.

*Nobody quarried this. It was simply left. The mosque and the royal tombs were quarried, and they are up there now, holding up a wall.*

*Which is its own kind of message: the palace was allowed to rot, the mosque was not allowed to exist.*"
```

---

#### E3 — A Dutch gravestone in 1580

**Where:** `st-pauls-church.location.json:254` — "A Portuguese name, and cut straight across it a
Dutch one. The stone was too good to waste on only one family."

**Problem.** This is a real and much-loved feature of the ruin **as it stands today** — Dutch
tombstones recut over Portuguese ones. It dates from **after 1641**.¹ It cannot exist in 1580 under
any reading. This is the single cleanest anachronism in the build: the player is looking at a
seventeenth-century artefact in a sixteenth-century town.

**Fix.** The *idea* — a stone reused because good stone is scarce — is worth keeping. Recut it as
Portuguese-over-Portuguese, which was also common:

```
"A Portuguese name, and cut straight across it a second Portuguese name in a fresher hand. Good stone does not come out to Melaka often enough to spend it on one family."
```

---

#### E4 — Chen Wei's junk sails to the wrong port on the wrong wind

**Where:** `npcs.json:600` ("until the next northeast wind, which is to say until next year");
`npcs.json:638, 644` ("clears for Canton on the fourth day"); `npcs.json:1277`;
`merchants-seal.json:62, 63`.

**Problem — two separate errors in one plot device.**

**(i) The wind is backwards.** The Asian monsoon runs north-easterly roughly October–March and
south-westerly roughly May–September.³ Shipping *reaches* Melaka from China on the **north-east**
monsoon and *returns* to China on the **south-west** monsoon. Chen Wei's silk waiting for "the next
northeast wind" to sail *to* China is sailing into the wind. The game gets this exactly right
elsewhere — `waterfront.location.json:786`, of Rashid's dhow: *"She came down on the north-east
monsoon and cannot leave until it turns."* That line is correct; Chen Wei's contradicts it.

**(ii) Canton is the wrong destination.** After the **1567 Longqing lifting** of the *haijin*, Chinese
junks could legally sail to Southeast Asia from exactly **one** licensed port — **Yuegang in
Zhangzhou, Fujian** — under a fixed annual quota (50 licences at first, 88 by 1589).⁴ Guangzhou/Canton
was not the port a Melaka-based junk cleared for. Meanwhile the game's own waterfront props correctly
identify the shipping as **Fujianese** (`waterfront.location.json:777` "A Fujian junk";
`:1020` "the board of the Fujian merchants' association"). And Chen Wei's creditors are stated to be
**in Macau** (`npcs.json:644`) — so Macau is *already* the logical destination, and it fixes the
creditor logic for free.

**Fix.** Global find-and-replace `Canton` → `Macau` in the silk plot (5 sites), and correct the wind.

Drop-in, Chen Wei `greetingVariant` (`npcs.json:600`), unchanged in register — flat, arithmetical:

```
"The junk sailed without my silk. Forty bolts sit in a bonded shed until the wind comes round to the south-west, which is to say until next year. Do not speak to me of the customs house today."
```

Drop-in, `silk-consignment` (`npcs.json:644`) opening clause:

```
"Forty bolts of patterned Nanking weave, bonded at the gate under a customs seal, booked onto the junk that clears for Macau on the fourth day."
```

---

#### E5 — The game is set in 1580 but nobody has heard of 1578, and everybody has heard of 1581

**Where:** `npcs.json:1433` (Rudra, `union`: "They speak of a new Spanish King in Lisbon");
`npcs.json:99` (Gomes: "English privateers nosing near the straits"); `npcs.json:223` (Rodrigues:
"If Drake's spawn pushes into the straits"); `npcs.json:1436` (Rudra: "Drake has shown them the
route"); `npcs.json:809` (Rashid: "There are northern ships everyone whispers about. I met some in
Aceh").

**Problem — the 1580 news cycle is inverted.** What Melaka would be talking about in 1580, and what
it could not yet be talking about:

- **Sebastian died at Alcácer Quibir, 4 August 1578**, body never identified; his great-uncle Cardinal
  Henry died **31 January 1580**, leaving the throne genuinely vacant.⁵ *This* is the news that would
  have come out on the 1579 and 1580 carracks and be tearing through every Portuguese household in
  Asia. It is completely absent from the game.
- **Philip II** won the field at Alcântara in **August 1580** and was acclaimed at Tomar in **April
  1581**; Goa proclaimed him later still, Melaka later than Goa. In 1580 there is **no** new king in
  Lisbon — there is a hole where the king was. Rudra's line is roughly two years premature.⁵
- **Drake** was at **Ternate in November 1579**, dealing with Sultan Babullah, and did not reach
  England until September 1580. He never entered the Straits of Melaka. No English vessel does: Ralph
  Fitch arrives overland in **1588**, Lancaster by sea in **1592**. "English privateers nosing near
  the straits" in 1580 is 8–12 years early. **[PJ]** — but a *rumour of an English ship in the
  Moluccas* is not merely permissible in 1580, it is exactly right, and far more sinister, because
  Babullah had **expelled the Portuguese from Ternate in 1575**.

**Fix.** These three characters are already doing the right *dramatic* job — dread of a coming
northern power. Re-aim it at what 1580 actually knew.

Drop-in, Rudra `union` (`npcs.json:1433`) — his voice is dry, contractual, sovereign-indifferent:

```
"There is no King in Lisbon at all, which is a stranger thing than a bad one. The boy died in Africa and the old Cardinal followed him, and now Castile and Bragança are both counting their cousins. *turns a bolt over* My cartaz bears a seal. A seal must belong to someone. The captains here look anxious about the throne; I am anxious about the seal."
```

Drop-in, Rodrigues `english` (`npcs.json:223`) — same spit, better geography:

```
"*spits* An Englishman was at Ternate. Sat down with Babullah — the same Babullah who put our people out of that fortress five years ago — bought his cloves, and went off west, and nobody caught him. *flat* They have not come into the straits. They have found out that they can."
```

Drop-in, Gomes `rumors` (`npcs.json:99`):

```
"An English ship was trading in the Moluccas last season and none of ours could lay a hand on her. When men like that find the straits, they will bring hard bargains and harder guns."
```

---

#### E6 — Rodrigues's war is forty years too old, and skips the sieges he actually lived through

**Where:** `npcs.json:217` — "I fought at Diu in '38, when the Ottoman fleet came to drive us from
India."

**Problem.** The first siege of Diu was **1538**. A man who fought there is at minimum sixty-two in
1580 and probably older, and — more damagingly — this puts his formative combat memory in *India,
forty-two years ago*, when Melaka itself was besieged **four times in the seven years before the game
starts**: Aceh in **1568** (Ottoman-backed, part of a pan-Islamic coalition), again in **1573**, a
Javanese/Japara assault in **1574**, and a 113-vessel Acehnese armada including 40 galleys in
**January 1575**, held by Tristão Vaz da Veiga.⁶

Rodrigues is standing on the wall that survived all four and talking about Gujarat. **[PJ]** This is
the largest wasted asset in the script: the game has a paranoid old soldier, and history handed it a
paranoia that is *literally correct and five years old*.

**Fix.** Drop-in, `war` topic (`npcs.json:217`), preserving the brother, the scar, and the closing
epigram:

```
"January of '75. A hundred and thirteen sail came up out of the south — forty of them galleys, oars in the water, and the Acehnese do not row for exercise. *touches scar on face* Five years, and I still count sails before I count anything else. My brother went into the water off the bar and did not come out of it. War teaches you that glory is a lie told by those who never held the line."
```

If you want the veteran to be older, keep Diu but as the *earlier* memory and make '75 the live one —
"I was at Diu when the Turk came, and I thought I had seen the worst of it. Then January of '75."

---

#### E7 — Slavery is absent from a slave society, and it hollows out the game's best plot

**Where:** structural. `npcs.json:826–873` (Siti, "Young Servant"); `npcs.json:918` (Alvares: "I pay
laborers and expect labor"); `padres-dilemma.json` throughout; no `historical-objects.json` entry;
no `examineText` in any of the five locations.

**Problem.** Portuguese Melaka ran on slavery. Portuguese settlers, *casados*, their Asian wives and
Luso-Asian children lived inside the fortress **with their personal slaves**; households commonly held
several; the non-Christian and servile majority lived outside the walls.⁷ Domestic slaves in the
Estado were drawn from South Asia, Southeast Asia and Africa. A wealthy Melaka tin merchant's
household in 1580 is *substantially* a slave household.

The game gives Alvares "servants" who are implicitly waged ("I pay laborers and expect labor"), and
Siti a mobility she very likely did not have. This is not a small softening. It is the difference
between *a girl who quit a bad employer* and *a girl whose body is legally someone's property, hiding
in the one building where that property claim is contested* — which is the actual, documented,
dramatically enormous situation, and which the game has built the entire sanctuary plot around
without saying so.

Note the game is not squeamish elsewhere: the mosque-quarry line, the pelourinho, and Mak Enang's
"tools wear out and are thrown away" are all unflinching. The silence here reads as an oversight, not
a decision — but its *effect* is apologia (see §3).

**Fix.** This is a content addition, not a correction, so it is specified in §2 (**M1**) and §3.
Minimum viable version: one line from Siti establishing the legal question, one from Alvares
establishing his claim, one examineText. All three are drafted in M1.

---

### TIER B

---

#### E8 — A bahar is about 190 kg, and a boy is carrying it

**Where:** `npcs.json:507` (`pepper-tip`: "a boat down from Kedah with one bahar of pepper");
`npcs.json:511` (`pepper-lot`: "I will send my eldest to carry it up and turn it on the mats for you");
item `pepper-pouch`; `npcs.json:1270`.

**Problem.** The Melaka **bahar** was a bulk commodity measure of roughly three piculs — on the order
of **190–210 kg**.⁸ It is a two-or-three-porter load with a pole, or a handcart. Aminah's teenage son
does not carry one up from the river, and it does not become a *pouch* in the player's inventory.

Note the game's own `waterfront.location.json:966` uses `bahar` correctly as a bulk unit of account.

**Fix.** Cheapest correct option: keep the bahar (it is the right period unit and the trade is more
convincing at bulk scale) and fix the logistics — Aminah's son brings a **handcart**, and the item
becomes `pepper-lot` / "a bahar of pepper, carted" rather than a pouch. Alternative: drop to **one
picul** (~60 kg, still a two-man lift) or a few **cates** if you want it hand-carried, and scale the
prices down accordingly.

Drop-in fragment for `pepper-lot` (`npcs.json:511`), replacing "I will send my eldest to carry it up":

```
"...and I will send my eldest up with the handcart to fetch it and turn it on the mats for you — no, do not argue, he is going that way and he is bored."
```

---

#### E9 — Rashid's Oman, and the missing cartaz

**Where:** `npcs.json:711` (description: "a respected Nakhoda (merchant captain) **from Oman**");
`npcs.json:740` ("dates from Muscat"); `npcs.json:779` ("we sail for Aden in two weeks");
`npcs.json:785`, `:794` ("My wife keeps our accounts in **Sur**").

**Problem.** "From Oman" as a polity is anachronistic in 1580 — the Ya'ariba imamate that unified Oman
and expelled the Portuguese begins in **1624**.⁹ More pointedly: **Muscat was a Portuguese fortress**
from the early sixteenth century until 1650, "the most strongly fortified base on the Arabian
peninsula."⁹ Rashid's dates from Muscat come out of a Portuguese-garrisoned port.

The deeper issue is that an Arab Muslim shipowner trading openly at Portuguese Melaka in 1580 needs a
reason, because the Muslim shipping of the age had a **standing alternative**: Gujarati, Arab, Turkish
and Acehnese shippers ran Southeast Asian pepper **Aceh → Red Sea**, bypassing Portuguese naval
strength entirely; by the 1560s that route carried comparable tonnage to the whole Cape route.¹⁰ And
Aceh had besieged Melaka four times since 1568.⁶ The Portuguese answer was the **cartaz** — a
sea-pass, sold with fees and conditions, whose issue to Muslim traders had to be liberalised because
exclusion did not work.¹¹

**None of this makes Rashid implausible. It makes him interesting** — and the game currently spends
none of it. He is a man from a Portuguese-held port, holding a Portuguese licence, drinking coffee at
the quay of a city that his co-religionists have tried to storm four times in twelve years, and
choosing this port over Aceh. That is a character. **[PJ]**

**Fix.** Change the description line to name his home port rather than a state, and add the cartaz to
his existing `cargo` topic (`npcs.json:779`):

Description (`npcs.json:711`):

```
"A respected Nakhoda (merchant captain) out of Sur on the Arabian coast, who commands the ocean-going dhow Al-Rashida. He has navigated the trade winds from Aden to the China ports, and he carries a Portuguese pass to do it."
```

Drop-in addition to `cargo` (`npcs.json:779`), in his expansive, self-amused register:

```
"This voyage? Frankincense, myrrh, dates out of the west. We take back spices, Chinese silk, perhaps some of this famous Melaka tin. *taps his chest* And a cartaz. A paper from the fortress that says the Portuguese will not sink me — which they sell to me, for money, on the understanding that without it they would. *spreads hands, delighted* I could sail to Aceh instead and pay nobody. My cousins do. They tell me I have no pride. I tell them I have a wife in Sur who prefers me alive and licensed. Both of us are right. That is what makes it a good argument."
```

---

#### E10 — "Kongsi" is an eighteenth-century word

**Where:** `rua-direita.location.json:953` — "A guild board: the Melaka Chinese kongsi, gilt characters
flaking in the salt air."

**Problem.** *Kongsi* as an institutional term for Chinese sworn brotherhoods / partnership
associations is documented from the **eighteenth century** (the Borneo kongsi republics); it is not a
sixteenth-century Melaka word. **[PJ]** — the term's origin is debated, but no specialist would place
the institution in 1580 Melaka.

What *did* exist by 1580, and is far better: the Portuguese appointed the **first Kapitan China of
Melaka, Tay Kie Ki (Tay Hong Yong), in 1572** — eight years before the game opens.¹² The Chinese
community was a recognised, headed, self-governing body with a named office.

The game's waterfront board (`waterfront.location.json:1020`, "the board of the Fujian merchants'
association") avoids the anachronism and is fine.

**Fix.**

```
"A board in gilt characters, flaking in the salt air. The names are the Fujian houses; the seal at the foot is the Kapitan's, which the fortress recognises and which therefore, in this street, is the only signature that settles anything."
```

---

#### E11 — Melaka's institutions are missing their actual names

**Where:** `npcs.json:1016–1108` (Gaspar Mesquita, "Customs Inspector");
`st-pauls-church.location.json:299` ("A factor of the Casa da India");
`a-famosa-gate.location.json:518` ("Every **governor** since Albuquerque has been sworn in beside it");
`historical-objects.json:485` (pelourinho).

**Problem — four separate slips of institutional vocabulary.**

1. **"Casa da Índia"** was the crown trading house **in Lisbon**. The Melaka equivalent is the
   **feitoria** and **alfândega**, staffed by a *feitor* (factor) and *escrivães*. A man dying of the
   flux in Melaka is a factor **of the feitoria**.
2. **"Governor."** Melaka's chief officer was the **capitão** (captain-major), a triennial appointment
   from the Viceroy at Goa — civil governor and military commander in one.² *Governador* is the Goa
   title. "Every captain since Albuquerque" is the correct phrase and costs one word.
3. **Gaspar Mesquita's post has no name.** "Customs inspector" is a modern gloss. Period options:
   *guarda-mor da alfândega*, or *escrivão da alfândega* — the clerk of the customs house, which fits
   his characterisation (paper, method, receipts in his own hand) perfectly.
4. **The pelourinho's claim is the Portuguese claim, not the reality.** The entry says it "declares
   that Portuguese law — not the Sultan's adat — governs this street." In fact the Portuguese
   **retained the bendahara, the temenggong and the shahbandars** essentially intact from the
   sultanate, to keep order and keep trade moving.² Melaka in 1580 is a legally plural city where
   the pelourinho's claim was loudly asserted and quietly not true. That is a much better examine
   text.

**Fix — pelourinho** (`historical-objects.json:485`), keeping the existing shape and closing beat:

```
"The pelourinho — a pillory, the mark of Portuguese municipal authority planted in every colonial settlement from Brazil to Macau. This one stands in Rua Direita to declare that this is, legally and spiritually, Portuguese soil.

*Which is true of the stone, and true of the street, and gets less true with every hundred paces you walk from it. The Malays still answer to a bendahara. The harbour communities still answer to their shahbandars. The Chinese answer to a Kapitan the fortress itself appointed. The pillory declares one law; the town runs on four, and the fortress has decided not to notice, because noticing would cost money.*

*The iron shackles are rusted but functional. Fresh scratches on the stone suggest recent use.*"
```

**Fix — a-famosa `padrão`** (`a-famosa-gate.location.json:518`): `governor` → `captain`.

**Fix — Casa da Índia** (`st-pauls-church.location.json:299`): "A factor of the feitoria, dead of the
flux nine weeks ago, aged twenty-six."

---

#### E12 — The Church of Melaka is one Jesuit alone on a hill

**Where:** `npcs.json:262–408` (Padre Tomás, sole cleric); no bishop, no Sé, no other order anywhere
in the shipped data.

**Problem.** Melaka was erected as a **diocese on 4 February 1558**, split from Goa and suffragan to
it.¹³ By 1580 there is a **bishop**, a **cathedral (the Sé) down in the town**, and eight parishes by
Erédia's count a generation later.¹⁴ The Jesuits hold the hill church, but Dominicans and Franciscans
were also established in Portuguese Melaka, and orders in the Estado were in chronic friction —
famously over the Jesuit policy of *accommodation*, which the game's own `jesuit-crucifix` note
correctly flags as drawing "criticism from other Catholic orders" (`historical-objects.json:255`).

So the game already knows the Church was factional. It just ships a Church with one member.

**Consequence.** Padre Tomás is unsupervised, uncontradicted, and structurally *is* Christianity in
Melaka. This is both an accuracy problem and the load-bearing weakness in the sensitivity read (§3):
his "benevolent supremacist" position is never argued with by anyone who shares his premises, so the
player experiences colonial Catholicism as a single warm temperament rather than an institution with
hard men in it.

**Fix.** Two lines. Both are in §2 (**M2**). No new NPC required — the bishop and the Dominicans can
exist entirely offstage in Tomás's own mouth, which also characterises him (he is nervous about them).

---

#### E13 — Rodrigues's conquest myth is uncontradicted anywhere in the game

**Where:** `npcs.json:211` — "conquered this city with only 1,200 men against 20,000 defenders. How?
Portuguese steel, Portuguese faith, and **Malay treachery from within. The Sultan's own people opened
the gates.**"

**Problem.** The troop figure is roughly right (c. 1,200 Portuguese plus Malabari auxiliaries, ~17–18
sail); the defender figure is a chronicle number and unreliable. The **"opened the gates"** claim is
false. Melaka fell to two assaults across the **bridge over the river** in July–August 1511, not to a
betrayal at a gate.² What actually happened is more interesting and much darker: Albuquerque was
materially assisted by **Chinese junk captains in the roads**, and by resident merchant powers —
notably the Tamil **Nina Chatu** and the Javanese **Utimutiraja** — several of whom he subsequently
destroyed once the city was his.²

**Keeping the myth in Rodrigues's mouth is legitimate and good.** He is a garrison officer in 1580
reciting the regimental version; that is exactly what such a man believes. The problem is that
**nobody in the game contradicts it.** Aminah, Mak Enang, Pak Salleh and the Sejarah Melayu prop all
touch the conquest and none of them corrects the treachery story. So it stands as the game's only
account. See §3.

**Fix.** Leave Rodrigues's line untouched. Add the counter-voice — drafted at **M3**.

---

### TIER C

---

#### E14 — Weights and measures: the Portuguese adopted local units, they did not impose the quintal

**Where:** `historical-objects.json:441` — "The Portuguese imposed their quintal system to standardize
measures, but everyone still argues," + `historicalNote` at `:442`.

**Problem.** Melaka's trade ran on the **bahar, picul, cate and tael**, and the Portuguese worked
within them.⁸ The *arrátel*/*quintal* were used for Portuguese purposes and in Lisbon accounting, not
imposed on the Melaka spice trade. The game's own far better line at `waterfront.location.json:966`
has it right: *"Every bale on this quay is written into a ledger inside, in Portuguese, from a tally
kept in Chinese, of goods measured in Malay bahar. Three chances to disagree."*

**Fix** — replace the closing sentence of the `balance-scale` examineText:

```
"...the tricks are as old as trade itself. The brass weights are Portuguese and stamped in arráteis, and they are used for exactly nothing — every bargain on this street is struck in bahar and cate, because that is what the sellers brought and what the buyers ship, and a merchant who insists on his own units is a merchant who does not want the sale."
```

---

#### E15 — Whale oil in the tropics

**Where:** `historical-objects.json:56` — "This lantern burns whale oil when the light fades."

**Problem.** Whale oil is a North Atlantic product and a later mass commodity. Lamps in Portuguese
Asia burned **coconut oil**, **gingelly (sesame) oil**, or palm oil — all locally abundant. **[PJ]**
The game's other lanterns say "pitch lantern" and are fine.

**Fix:** `whale oil` → `coconut oil`. One word. (And it smells different, which is free atmosphere.)

---

#### E16 — Culverin / demi-culverin, and an internal contradiction

**Where:** `historical-objects.json:34` — "A **culverin**, cast in Goa… could fire a **10-pound** iron
ball," vs `a-famosa-gate.location.json:491` — "A **demi-culverin** cast in Goa… a name — Sao Jorge —
cut under them."

**Problem.** A full culverin threw roughly 17–18 lb; a **demi-culverin** threw roughly 9–10 lb. The
10-pound ball belongs to the demi-culverin. The location file is correct; `historical-objects.json` is
not, and the two describe what is presumably the same gun.

**Fix:** `historical-objects.json:34` — "A demi-culverin, cast in Goa." Then consider merging the two
entries; the location-file version is markedly better written.

---

#### E17 — A Jawi manuscript on palm leaf, and a Sejarah Melayu thirty-two years early

**Where:** `historical-objects.json:352–354` — "A fragile **palm-leaf** manuscript in **Jawi** script…
**The Sejarah Melayu** — the Malay Annals… **The Portuguese burned many copies**, but this one
survived."

**Problem — three errors.**
1. **Jawi manuscripts were written on paper**, not palm leaf. Palm leaf (*lontar*) is the substrate of
   Indic scripts; Arabic-script Malay used imported paper.¹⁵ The object as described could not exist.
2. The **Sejarah Melayu** in its known recension was **commissioned in Johor in 1612** and compiled by
   **Tun Sri Lanang**.¹⁵ In 1580 there may be an earlier *Hikayat Melayu* tradition to draw on, but
   the titled work is thirty-two years in the future.
3. **"The Portuguese burned many copies"** — no evidence; and the text was compiled in the successor
   court at Johor precisely *because* it was out of Portuguese reach.

**Fix.** The intent — Malay memory surviving in the kampung — is exactly right and should survive.
Make it an older recension on paper:

```
"Paper, not palm leaf — Jawi is written on paper, and paper comes up from the ports, which is why a book like this is a small fortune lying on a mat.

*It is a hikayat of the kings: Parameswara who founded the city, the great Sultans, the day the ships came over the horizon. This copy was made by hand, by a family that served the old court and can still recite the descent.*

*The Portuguese did not burn it. They did not have to look for it. In Johor the Sultan's people are gathering these accounts into one book, and when they finish it, the story of Melaka will be written down somewhere the fortress cannot reach.*"
```

That last beat is historically precise (the Johor compilation is genuinely coming) and lands harder
than the burning did.

---

#### E18 — Aminah says "Aiyo"

**Where:** `npcs.json:445` — "Aiyo, rain again."

**Problem.** *Aiyo / aiyoh* is a Dravidian exclamation (Tamil ஐயோ) naturalised into Malaysian speech
much later. **[PJ]** A Malay woman in 1580 says **"Aduh"** or **"Amboi."** Trivial cost, and "Aduh"
is period-safe.

**Fix:** `"Aduh, rain again. Stand under my awning before the fruit and the customers both get soggy."`

---

#### E19 — Qibla: two entries, two different directions, both wrong

**Where:** `historical-objects.json:474` ("oriented **northwest** — toward Mecca") vs
`historical-objects.json:517` ("A woven mat faces qiblah… facing **west**").

**Problem.** The qibla from Melaka (≈2.2°N, 102.3°E) to Mecca is a great-circle bearing of about
**292–293°** — west-north-west, a little north of due west. "Northwest" (315°) is ~22° off; "west" is
~13° off. More importantly the two shipped entries **disagree with each other**, which a Muslim player
will notice instantly.

**Fix:** both to `"a little north of due west — toward Mecca"`.

---

#### E20 — Rua Direita has two centuries of boots in a city sixty-nine years old

**Where:** `rua-direita.location.json:890` and `:926` — "A mounting block, hollowed by **two
centuries** of boots."

**Problem.** Portuguese Melaka begins in 1511. Rua Direita in 1580 is sixty-nine years old.
(`:872`, "two generations of gossips," is fine.)

**Fix:** `"hollowed by seventy years of boots"` — which is *better*, because seventy years of wear on
stone is a specific and slightly startling amount.

---

#### E21 — Pop-history in the spice entries

**Where:** `historical-objects.json:133–134` (nutmeg: "a handful of these could buy a house"; note:
"worth more than gold by weight"); `:331–332` (Zheng He: treasure ships "400 feet long — four times
the size of Portuguese carracks").

**Problem.**
- **Nutmeg was not worth more than gold by weight**, ever. **[PJ]** The "handful buys a house" figure
  is a durable myth built out of one extreme Banda-to-Amsterdam markup. The real chain — cheap at
  source, absurd at destination, with Melaka as the hinge that captures the middle — is more
  interesting *and* is the game's actual subject.
- The **400-foot treasure ship** derives from the *Ming shi*'s 44 × 18 *zhang*, a figure naval
  architects have contested for decades as implausible for a wooden hull. **[PJ]** The entry states it
  as fact.

**Fix — nutmeg**, replace the "buy a house" sentence:

```
"*The scent is intoxicating — warm, sweet, slightly bitter. In Banda a man will sell you these for cloth. In Melaka they are worth ten times that. In Lisbon, a hundred. Nothing has been done to them in between except carrying, and the carrying is what the whole world is fighting over.*"
```

**Fix — Zheng He**, hedge the figure: `"The treasure ships were said to be four hundred feet long. The Portuguese pilots who repeat it do not believe it, and repeat it anyway, which tells you what the fleets did to people's memories."`

---

#### E22 — Smaller internal contradictions and imprecisions

| # | Where | Problem | Fix |
|---|---|---|---|
| a | `rua-direita.location.json:1131` | "**Gujarati** cottons on a bamboo rack — **Rudra's** stock" — but Rudra sells Pulicat and Masulipatam, i.e. **Coromandel** (`npcs.json:1430`). | `"Coromandel cottons on a bamboo rack — Rudra's stock, unsold since the monsoon."` |
| b | `historical-objects.json:408` | Calls Malay healing tradition **"dukun"** — Javanese/Indonesian usage. Peninsular Malay: **bomoh**, **pawang**, **bidan** (midwife). **[PJ]** | `"The toolkit of a bomoh — a Malay healer."` And see M12: making Mak Enang a **bidan** is worth more than the word change. |
| c | `npcs.json:990` | "misai kucing" reads as modern vernacular; the plants are real Malay materia medica but the names' 16th-c. currency is unattested. **[PJ]** | Low priority. If touched, prefer descriptive: "the bitter root for strength, the leaf we boil for the water in a man." |
| d | `historical-objects.json:13` | "The original fortress gate bore this symbol until its destruction in 1807." A Famosa was demolished by the British in 1807, but the **surviving Porta de Santiago carries the Dutch VOC arms and the date 1670** from the Dutch rebuild — the Portuguese arms did not survive to 1807 on that gate. | Trim to: "…bore this symbol until the Dutch rebuilt the gate in 1670 and cut their own arms over it." |
| e | `historical-objects.json:265` | Xavier's body "from 1553 to 1554." He died 3 Dec 1552 at Shangchuan; interred Melaka **March 1553**, exhumed and shipped **December 1553**, reached Goa **March 1554**. | `"Here rested the body of Francis Xavier for nine months of 1553."` |
| f | `npcs.json:800` | Coffee "from Mokha." Yemeni coffee-drinking is well established by 1580, and the Ottomans commercialised Yemeni cultivation in the later 16th c. — but **Mokha's rise as *the* coffee port is a 17th-century development**.¹⁶ **[PJ]** Defensible but at the leading edge. | Keep the coffee (it's the best scene on the quay) and lean into its strangeness: `"Qahwa. From the Yemen hills, and before you ask — no, nobody on this quay drinks it but my crew, and they only drink it because I do not permit anything else."` |
| g | `npcs.json:214` | "eighty Portuguese soldiers and two hundred local auxiliaries." I could not verify a 1580 figure; the 1511 establishment was ~500.² **[PJ]** Plausible as written. The more telling truth is that Melaka's sieges were survived by *casados*, mestiços and allied Asian contingents turning out, not by the paid garrison. | Optional addition: `"…Not enough. It is never the number that saves us. In '75 it was every casado who could hold a pike and four hundred men the Kapitan sent down from his own quarter, and the fidalgos have been careful not to write that part down."` |
| h | `npcs.json:1396` | `rudra-mudaliar.sprite: "rashid"` — a Tamil merchant rendered with an Omani captain's sheet. Already flagged in `_portraitDebt`. | Art debt, tracked. Noted here only because it is a *cultural* conflation the player sees. |
| i | `npcs.json:918` / Siti `npcs.json:856` | Alvares "takes their tin ore for nothing, threatens their families" implies direct control of upcountry mining. Melaka tin came from **Perak, Kedah and Bangka under their own rulers**; the Portuguese bought through those courts and their factors. **[PJ]** A Melaka merchant could not squeeze miners; he could squeeze the boatmen and cheat on weight and grade at the shed. | Siti's `fear`: `"He cheats the men who bring the tin down. Not the miners — he never sees a miner. The boatmen. He weighs their ore light and grades it low and writes it in a book, and when they argue he shows them the book. That is how he does it. With a book."` — which is more frightening, and matches the game's customs-corruption spine. |

---

## 2. MISSED OPPORTUNITIES

Twenty period details that would deepen immersion cheaply. Each is drafted as usable content in an
existing NPC's established voice or as examineText. No new characters required except where noted.

---

**M1 — Slavery, said once, plainly** *(fixes E7; highest value in this section)*

Three lines. Siti's `sanctuary` topic (`npcs.json:853`), replacing it wholesale:

```
"The Padre says the church is a place of sanctuary. He says it carefully, and I have learned to hear when a man is being careful. *quietly* Senhor Alvares did not hire me. He bought me. There is a paper in his house with a price on it and my name is on the paper, and the law of this city says the paper is true. The Padre says God does not read that paper. I believe he believes it. I do not know whether the Ouvidor believes it, and the Ouvidor is the one who will be asked."
```

Alvares's `servant-girl` (`npcs.json:941`) — one inserted clause, and his register does the rest:

```
"...She will say I was cruel. They always say cruelty. What she means is that I required of her precisely what I required of everyone, and she found she had no aptitude for being required of. *returns to the manifest* She is entered in my household book at eleven cruzados. I do not raise my voice about eleven cruzados. But the book is the book, and the priests may keep her exactly as long as it amuses them to argue with a book."
```

New examineText, Rua Direita (attach to any warehouse/arcade prop):

```
"Four men are unloading, and two of them are working the way men work when they will not be paid at the end of it — steadily, without hurry, without once looking up at the man counting.

*Half the hands on this street are owned. Not most of the Malays, who came in from the kampung this morning and will go home tonight. The ones from Bengal, from Coromandel, from Mozambique — brought here in a hold and entered in a household book, the same book that lists the furniture.*

*Nobody remarks on it. That is what it looks like when a thing is normal.*"
```

Source: household slavery was standard among Melaka's fortress-dwelling Portuguese and *casados*.⁷

---

**M2 — The bishop, the Sé, and a Dominican who does not like Padre Tomás** *(fixes E12)*

New topic for Padre Tomás, `bishop`:

```
"His Lordship's cathedral is down there in the town, and I am up here, and we both understand the arrangement perfectly. *carefully* The Sé has the parishes, the registers, the marriages and the burials, and Melaka has been a diocese in its own right since '58 — we are not a mission station any longer, whatever Goa likes to imply. The Society has this hill and the school. *a small pause* There is a Dominican father down there who holds that we have made too many allowances to these people — that we teach them Christ in their own words until the words are all that is left. He is not a stupid man. That is what makes him difficult."
```

Source: Diocese of Malacca erected 4 Feb 1558, suffragan to Goa;¹³ eight parishes by Erédia's
account.¹⁴ Order friction over Jesuit *accommodation* is already correctly flagged in the game's own
`jesuit-crucifix` note.

---

**M3 — Somebody contradicts the "opened the gates" story** *(fixes E13)*

Mak Enang, new topic `conquest` — her voice is dry, elderly, corrective:

```
"*does not stop grinding* They tell it in the fortress that we opened the gates. My grandmother was here. There were no gates opened. They came over the bridge twice, and the second time they stayed, and it took them the better part of a month and a great many of their own dead. *sets the pestle down* But it is a better story their way. Their way, they won because we were faithless, and if we were faithless then losing was our own doing and nobody up there need think about it again. Every conqueror tells that story, child. Ask a Javanese about the Malays sometime. We tell it too."
```

Source: the city fell to two assaults across the river bridge, July–August 1511.²

---

**M4 — Nina Chatu: the merchants who chose the Portuguese, and what it got them**

Rudra Mudaliar, new topic `nina-chatu` — this is *his* community's memory:

```
"You want to know how a merchant survives a conquest. *sets down the cloth* There was a Kling of this city named Nina Chatu, a very great man, greater than I shall ever be. When the Portuguese came he judged which way the thing would fall, and he judged correctly, and he gave them boats and grain and his own credit, and Albuquerque made him bendahara over the whole trade of Melaka. *evenly* Within four years they had accused him, ruined him, and taken everything. He died owing money to men he had made rich.

So. When you ask me why I do not befriend the fortress — I am not brave, and I am not principled. I have simply read the ledger."
```

Source: Nina Chatu's collaboration, elevation and destruction is well attested in the conquest
literature.² **[PJ]** on the precise financial end.

---

**M5 — The Kapitan China, and why Chen Wei's house is *new* power**

Chen Wei, new topic `kapitan`:

```
"There is a Kapitan over the Chinese of this city. The fortress appointed him eight years ago and pays him nothing, which is how you know they think the arrangement is favourable to them. He settles our disputes, he answers for our conduct, and when a Chinese is accused, it is his door the guard knocks on, not the Ouvidor's.

*sets the brush down* You imagine my house is old here. It is not. For fifty years after the conquest almost no junk came down from Fujian at all — the Emperor forbade the sea, and men who sailed anyway were pirates in his eyes and smugglers in everyone else's. Thirteen years ago he permitted it again. Fifty licences a year, out of one port. *precisely* Everything you see in this room is thirteen years old and could be taken away by an edict I will not hear about for six months. That is why I am careful. Not temperament. Exposure."
```

Sources: Kapitan China appointed 1572;¹² 1567 Longqing lifting of the *haijin*, single licensed port
at Yuegang, 50 licences rising to 88 by 1589.⁴ This single topic converts the Chinese community from
"patient inscrutable merchants" into a polity with an office and a policy risk — and it is more
dramatic than what is there now.

---

**M6 — Kampung Kling and Kampung China: the town has more than one quarter**

The game's single "kampung" flattens Melaka's real suburban structure. Erédia records **Tranqueira**
as the principal suburb, divided into the parish of **São Tomé — Campon Chelim (Kampung Keling)**,
populated by the *Chelis* of Coromandel, and the suburb of **São Estêvão — Campon China (Kampung
Cina)**.¹⁴ Timber houses, tiled roofs — not attap.

No new location required. Put it in Rudra's mouth, new topic `home`:

```
"You keep calling that village 'the kampung,' as though there were one. *mildly* There is the Malay kampung where you have been walking. There is Campon Chelim, where my people live and where the church of São Tomé stands, and where the roofs are tiled because we can afford tiles and because we intend to stay. There is Campon China beyond it. Three quarters, three burial grounds, three sets of quarrels.

To the fortress we are all 'the town outside the wall.' It saves them a great deal of thinking."
```

---

**M7 — Kling and Chitty: Rudra should know which he is**

Melaka's Tamil population divided between Muslim Tamils and the Hindu **Chitty** (Melaka Chitty),
long-settled, locally married, and still a distinct community today. **[PJ]** Rudra's dialogue is
currently religion-neutral, which is a missed characterisation, since it determines who he can marry,
where he is buried, and whether Padre Tomás thinks he is convertible.

Addition to Rudra's `about` (`npcs.json:1427`):

```
"My family has traded in these straits since the days of the Sultanate. My great-grandfather came for a season and married here, and his sons married here, and by now the Coromandel is a place I send letters to rather than a place I am from. *slight smile* The Portuguese call us Chetti and cannot decide whether that makes us foreigners who might leave or locals who might convert. I let them wonder. Both answers cost me money."
```

---

**M8 — The monsoon calendar as the world's actual clock**

The strongest cheap systemic detail available. The game has time-of-day; the period's real calendar
is the wind: north-easterlies roughly October–March bring the China and Java shipping down; the
south-westerlies of May–September take it home; a merchant who misses a wind loses a **year**, not a
week.³ Gomes already gestures at it (`npcs.json:87`), and Lin Mei's `silk-clock` is excellent.

Ambient/examine addition, waterfront:

```
"Half the hulls in the roads are not waiting for cargo. They are waiting for the wind to change, and it will change in its own month regardless of what anyone in this harbour requires.

*This is the fact the whole city is built on. Melaka is not here because the land is good — the land is a swamp. It is here because it is the place where the north-east wind stops and the south-west wind starts, and everything carried on the first has to sit and wait for the second. A city grew in the gap. Warehouses grew in the gap. Interest on debt grew in the gap.*"
```

---

**M9 — The Goa fleet: the year's single largest event**

Melaka's link to Europe ran through Goa on an annual rhythm — mail, orders, appointments, capital,
replacement soldiers and news, all arriving in a lump once a year. Every character's information
about Portugal is up to eighteen months stale, which is *why* E5's news lag is real rather than a
technicality.

Diogo Almeida, new topic `fleet` (his ambition runs entirely through Goa's paperwork):

```
"Everything I want arrives on one ship. *taps the satchel* The examination papers, the answer to a petition sent last year, the name of whichever fidalgo has been given which post — all of it sits in a bag in Goa for a season and then comes down at once, and for two weeks this street is unbearable and then it is quiet for eleven months.

Men here argue about the King as though the argument could reach him. Whatever we decide today, he decided eighteen months ago, and we will find out in the spring."
```

---

**M10 — The bell and the azan: the sound of who is in charge**

The Portuguese destroyed Melaka's congregational mosque and were hostile to public Islamic worship;⁷
Islam persisted in the kampung and in domestic *surau*. The game's `prayer-mat` and `surau-prayer-niche`
entries already carry this well. What is missing is the **sonic** version, which is free atmosphere and
politically exact.

Pak Salleh, new topic `bell` — his register is flat, tidal, unsentimental:

```
"*keeps mending* You hear that? Church bell. It rings on the hill for their hours — matins, the noon, the evening — and it carries all the way out here whether we are listening or not.

We do not answer it. We are not permitted a call from a minaret in this town, and there has been no great mosque to call from since before my grandfather. So the drum in the surau porch is beaten softly, and everyone within four houses hears it and that is enough. *shrugs* Their sound goes out over the whole town. Ours goes as far as the neighbours. That is the arrangement, and the arrangement is the whole of it, and you did not need me to explain it — you only needed to stand here at the noon and count what you could hear."
```

---

**M11 — Javanese rice: the port cannot feed itself**

Melaka grew nothing. Its rice came by sea, principally from **Java** — which meant the town's food
supply sat in the hands of shippers over whom the fortress had no control, and a blockade was a famine
before it was a battle. **[PJ]** on emphasis; the dependence is not in dispute.

Aminah, new topic `rice`:

```
"You are eating Java. *taps the sack* Every grain in this street came off a boat. The land here grows fruit and fish and nothing you could live on through a bad season, and it never did — Melaka has bought its rice for two hundred years.

Which is why, when the Acehnese came and sat in the roads, the fortress was not frightened of the guns. *flatly* Guns they had answers for. What frightened them was the fourth week."
```

---

**M12 — Mak Enang as *bidan*: the one Malay who is inside Portuguese houses**

Making Mak Enang a **bidan** (village midwife) rather than a generic healer costs one word and buys an
enormous amount: midwives crossed every community boundary in the port, and she would have delivered
Portuguese *casado* children. It gives her knowledge no other NPC can have and explains her standing.
**[PJ]**

Addition to her `herbs` topic (`npcs.json:986`):

```
"The Portuguese call our remedies superstition, until their own doctors fail. Then they come quietly at night for my tea. *chuckles* I charge them double.

*sets down the bundle* And they came for more than tea. I have caught more Portuguese babies in this town than their physician has, because their physician does not attend a birth and I do. There are men in that fortress who will not return my greeting in the street and whose sons I held before their fathers did. I do not hold it against them. I simply know the town from underneath, which is the only angle from which you can see all of it."
```

---

**M13 — Rashid's cousin sails to Aceh instead** *(pairs with E9)*

The Aceh → Red Sea pepper route carried comparable tonnage to the entire Cape route by the 1560s.¹⁰
Rashid's choice of Melaka is a live commercial and religious decision, not a default.

Covered in the E9 drop-in.

---

**M14 — Ternate 1575: the empire is already losing places**

The Portuguese were **expelled from Ternate in 1575** after Babullah's siege — the clove fortress, gone,
five years before the game opens. For a garrison that believes the walls hold, this is the fact that
should keep Rodrigues awake, and it also grounds the "clove" entries.

Addition to `historical-objects.json:145` (`spice-pile-cloves` note) and, in-world, to Rodrigues's
`fortress` topic:

```
"...*touches wall* These walls have never fallen. *a beat* Ternate's had not fallen either, until five years ago, and now there are Portuguese buried on that island under a flag that is not ours. I do not say this on the wall where the men can hear it. I am saying it to you because you asked what I protect, and the honest answer is: a thing that has been demonstrated to be losable."
```

---

**M15 — The *cartaz* as a visible, examinable object**

The pass system is the mechanism of Portuguese sea power and the game's customs spine already lives in
paperwork. New examineText for the waterfront customs table:

```
"A cartaz, half-filled, the ship's name still blank. A pass: this vessel may sail, and the King's ships will not take her.

*It is worth exactly as much as the Portuguese navy's ability to sink the ships that lack one — no more. Which is why the fees have come down twice in ten years, and why they are now sold to Muslim shippers who were once refused outright. An empire that must discount its own threat has already told you the price of the threat.*

*The blank line for the ship's name is the most valuable inch of paper on this quay.*"
```

Source: cartaz function and its progressive liberalisation to Muslim traders.¹¹

---

**M16 — Bazarucos: the player should see the bottom of the currency**

The game prices everything in **cruzados**, from a bahar of pepper to a fruit-seller's stall. The
Estado's money ran in a ladder: *bazarucos* (copper) → *tangas* → *pardaus*, becoming *xerafins* around
exactly this date, with the gold *cruzado* as a large-sum coin.¹⁷ Melaka retail also ran on local tin
cash.

**Recommendation:** keep the cruzado as the player-facing unit — the playability argument wins. But
seed the ladder once, so the world is not flat. Aminah, addition to `prices`:

```
"...That is Melaka. *jerks her chin at your purse* And put that away before you open it here. Nobody on this street sells anything in cruzados. Cruzados are for warehouses and debts and men who wish to be overheard. Here it is bazarucos, and tin cash by the string, and if you offer me gold for a mango I will charge you gold for a mango and tell the whole row about it."
```

---

**M17 — Xavier and Anjirō: the hill's actual world-historical moment**

Xavier passed through Melaka repeatedly, and it was **in Melaka in 1547** that he met the Japanese
Anjirō — the encounter that produced the Jesuit mission to Japan. That happened on Padre Tomás's own
hill, and he would absolutely tell you about it.

Addition to his `xavier` topic (`npcs.json:343`):

```
"...I feel his spirit in these stones. *leans in* And do you know what happened here that nobody remembers? In '47 a Japanese came up this hill to find him — a fugitive, a man with blood on him, looking for absolution. They talked. And out of that conversation, on this hill, in this town, the Fathers went to Japan. *spreads hands* Melaka is where God moves things from one half of the world to the other. He simply does it in a doorway, in the afternoon, while everyone else is at the market."
```

---

**M18 — The 1575 siege as physical residue**

The game's five locations bear no marks of the four sieges of 1568–1575.⁶ One examineText at the
a-famosa gate does enormous work:

```
"A section of the curtain wall where the laterite changes colour — newer stone, badly matched, running twelve paces and stopping.

*This is where the Acehnese guns reached in January of '75. The fortress repaired it in three weeks with whatever was to hand, which is why it does not match, and nobody has ever gone back to do it properly.*

*Every man on this gate over forty knows exactly where this patch is and none of them look at it.*"
```

---

**M19 — The tin regime, correctly**

Melaka's tin came from **Perak, Kedah and Bangka**, under rulers the Portuguese had to deal with rather
than command. Alvares's `business` topic (`npcs.json:916`) currently says "mined locally under tribute,"
which overstates Portuguese reach (see E22-i):

```
"The ore comes down from Perak, which is not mine and never will be — it is the Sultan's, and his people smelt it and his boats bring it, and I pay what he has decided I will pay. *finally looks up* What I own is the shed, the scale, the book and the pass. Everything before the shed is somebody else's country. Everything after it is mine. That is how wealth works out here, and men who imagine we conquered a tin trade have never once had to negotiate for it."
```

---

**M20 — The betel entry is exemplary; extend the method**

`historical-objects.json:411–420` (`betel-nut-tray`) is the single best-researched object in the build:
correct on ubiquity, correct on cross-communal reach, correct that refusal is an insult and that the
offer opens negotiation. **Use it as the template.** Two cheap extensions in the same spirit:

- Rashid, Chen Wei and Rudra should each *offer* betel at first meeting, and the game should let the
  player refuse — with consequences. It is the period's actual handshake.
- New examineText, any Rua Direita threshold: `"Red spatter beside every doorway at about waist height, in every street, at every door. Portuguese, Malay, Chinese, Tamil — the town has one habit in common and this is the evidence of it, and it is the first thing a newcomer finds disgusting and the last thing he gives up."`

---

## 3. SENSITIVITY READ

Assessed against the project's stated principle: *"All cultures should be portrayed as complex and
fully realized"* and *"Avoid Stereotypes."*

### What is working — and it is a lot

**The non-Portuguese cast are agents, not scenery.** This is the hardest thing to get right in a
colonial-setting game and the script gets it right repeatedly and structurally:

- **Lin Mei** (`npcs.json:1285`) — *"Master Chen goes out to meet the traders… He is good at it because
  he already knows the answer before he asks, and he knows the answer because I wrote it down."*
  That is a woman naming her own erasure without self-pity, in a game that could easily have made her
  a desk.
- **Pak Salleh** (`npcs.json:1368`) — *"The Portuguese post their guard by the church bell. The bell
  rings at the same hour all year. The water does not. You could build a whole life in the gap."*
  Colonial power described as a *technical deficiency* by a man who exploits it. Excellent.
- **Aminah's pepper play** (`npcs.json:511`) — the Malay vendor teaches the player the trick, and the
  trick is a genuine read of a Chinese counting house's month-end incentives. She is the smartest
  commercial mind in the game and the game knows it.
- **Chen Wei** (`npcs.json:682`) — *"I never wanted the seal. A seal cannot be sold, only refused, and
  refusing a man his name is a slow, ugly instrument."* The Chinese creditor is given the moral
  high ground *and* the self-awareness, defusing the "inscrutable moneylender" hazard the premise
  courts.
- **Mak Enang** (`npcs.json:1000`) — *"We bent like bamboo… Bamboo outlasts the storm."* Survival
  framed as strategy rather than passivity.

**Rodrigues is honest colonial violence, not gratuitous violence.** His racism is period-specific and
functional, not decorative — *"They smile and bow, but they remember the conquest"* (`:226`) is a
paranoid man correctly describing a real political situation. His `after-the-seal` line (`:248`),
where he concedes the sword has never held the street, is a genuinely earned arc.

**Padre Tomás's "benevolent supremacist" characterisation holds up — mostly.** `mercy` (`npcs.json:396`)
is the best-written line in the game:

> *"a good act performed outside the faith is a lamp lit in a sealed room. It gives light. It saves
> no one. This is not cruelty, my child. It is simply the arithmetic of salvation, and I did not set
> the terms."*

That is exactly the theology, exactly the tone, and exactly the horror of it — warm delivery, absolute
content, and the disclaimer at the end doing the moral work of a man who has never had to defend the
premise. `doubts` (`:370`) — *"I wonder if we bring light or merely… Portuguese light"* — is the right
crack in the right place. This characterisation is a success and should not be softened.

### Where it fails

**(S1) The conquest myth is uncontradicted, and the game's only account of 1511 is the garrison's.**
Rodrigues's *"Malay treachery from within. The Sultan's own people opened the gates"* (`npcs.json:211`)
is false (E13) and — more importantly — **no NPC in the shipped build disputes it.** Aminah, Mak Enang,
Pak Salleh and the Sejarah Melayu prop all touch the conquest; none corrects it. A player who talks to
everyone comes away believing Melaka fell to Malay betrayal, because the game told them so once and
never told them otherwise. *This is the single clearest accidental-apologia in the build.*
**Fix: M3.** One topic on one existing NPC.

**(S2) The slavery silence functions as apologia even though it plainly isn't intended as one.**
(E7.) The game shows a colonial economy of wages, contracts and negotiated favours — Alvares "pays the
day I promise, to the coin" (`npcs.json:935`), Siti is a servant who left. That world is *materially
gentler* than 1580 Melaka was.⁷ The game is scrupulously honest about the mosque-quarry, the pelourinho,
the pillage of memory — and then omits the thing that structured daily life for the largest number of
people in it. Because everything *else* is honest, the omission does not read as squeamishness; it
reads as a claim. **Fix: M1.**

Note this also *strengthens* the existing story: `padres-dilemma` is currently "will the priest protect
a girl from a bad employer," which is a small question. With Siti's legal status on the table it
becomes "will the Church's sanctuary claim survive contact with a property claim the Crown recognises"
— which is the actual historical conflict, has no comfortable answer, and makes Padre Tomás's courage
and its limits both legible.

**(S3) Padre Tomás's "their faith is shallow, only a few generations old" (`npcs.json:358`) is never
answered.** As a *belief he holds* it is perfect characterisation. But Melaka's Islamisation dates to
roughly the early fifteenth century, and Islam in the region very much earlier — so in the game's
mouth-of-the-only-cleric it currently stands as information. Worse, it's paired with *"Before Mohammed,
they followed spirits in trees and rivers. Those old beliefs linger"* — a claim with a real
condescension history behind it, delivered with no counterweight. **Fix:** M10 (Pak Salleh on the bell)
partly answers it; a sharper direct answer, added to Mak Enang's `portuguese` topic:

```
"...The priest on the hill, he has a good heart even if his God confuses him. *dry* He told my neighbour's boy that we came to God only a few lifetimes ago and had trees before that. I have counted it out on my fingers for him twice. The Sultans of this city were Muslim before his grandfather's grandfather was born, and there were Muslims in these ports for hundreds of years before that. He listens very kindly and then says it again the following month. That is not stupidity, child. He needs it to be new. If it is new it can be replaced."
```

That final sentence is the sensitivity fix: it gives a Malay woman the analysis of *why* the colonial
claim takes the shape it does — which is agency of the highest kind, and it costs one paragraph.

**(S4) Rashid drifts toward comic-relief in the briefing, though the shipped text largely rescues him.**
`CLAUDE.md` still lists him as *"Arab sailor, comic relief."* The shipped dialogue is much better than
that brief — `family` (`npcs.json:794`), with the count of his children's ages breaking off into *"You
cannot hurry home against the wind… Ask me about the fog off Sumatra instead. That story has an
ending"*, is one of the best pieces of writing in the game and is the opposite of comic relief. The
`navigation` kamal passage is respectful, specific, and technically correct. **Recommendation:** update
the brief to match the text — "Arab shipmaster; the harbour's warmest voice and its shrewdest" — before
the brief regenerates the stereotype in future content. The E9 cartaz addition further hardens him.

**(S5) Minor: `chinese-abacus` (`historical-objects.json:199`) tips into flattering essentialism.**
*"While Portuguese merchants struggle with quill and paper, a Chinese accountant clicks through complex
sums in heartbeats. No wonder they dominate the trade."* Positive stereotype is still stereotype — it
attributes commercial success to an ethnic aptitude rather than to capital, networks and information,
which the rest of the game (Lin Mei, Rudra's *"I do not sell cloth. I sell the willingness of other men
to wait"*) understands perfectly well. **Fix:**

```
"*The Portuguese clerks across the yard use quill, paper and Hindu-Arabic figures and arrive at the same answer at roughly the same speed. The advantage was never the beads. It is that this house has had correspondents in Fujian for forty years and knows what a picul fetched in Zhangzhou last season, and the Portuguese clerk knows what it fetched in Lisbon eighteen months ago.*"
```

**(S6) Alvares is the one character who risks caricature — and is nearly saved already.**
`tally-contract` (`npcs.json:935`) is the save: he pays exactly, on time, is proud of it, and delivers
*"no man who has taken my money has gone hungry for taking it"* immediately before the game shows you
what he does to a servant. That is a *system* producing cruelty through a man who considers himself
scrupulous — far better than a villain. **Recommendation:** the M1 and E22-i drop-ins reinforce this;
resist any future edit that gives him a sneer. He is most disturbing at his most reasonable.

### Verdict on portrayal

The colonial violence is **honest without being gratuitous** — arguably the game's strongest suit. The
non-Portuguese communities are **agents, comfortably**. Padre Tomás **holds up**. The two real failures
(S1, S2) are both *omissions* rather than misrepresentations, both are fixed by adding content rather
than removing it, and both fixes make the existing drama better.

---

## 4. VERDICT

### Grades by category

| Category | Grade | Reasoning |
|---|---|---|
| **Material culture & props** | **A−** | Genuinely excellent. `padrão`, `guarita`, chengal piles, attap, damar-payed seams, sewn dhow planking with no nail below the waterline, batten-lug sails, "measured in Malay bahar", the betel tray. Only pop-history spice claims and the whale oil pull it off an A. |
| **Character voice & cultural register** | **A−** | Lin Mei, Pak Salleh, Rudra's credit speech, Rashid's family topic, Chen Wei's `settled-account`. Distinct, adult, unsentimental. Docked for pinyin-Mandarin naming in a Hokkien port and "Aiyo". |
| **Maritime & trade technique** | **B** | Monsoon logic right in the props, backwards in the plot (E4). Canton-for-Macau. Bahar-as-boy's-load. The underlying commercial reasoning — Lin Mei's short manifest, Rudra's advance against a bonded lot, Chen Wei's Macau payment date — is genuinely sophisticated and correct. |
| **Non-Portuguese communities** | **B−** | Voices strong; *structures* missing. No Kapitan China, no shahbandar, no bendahara, no Kampung Kling, no Kling/Chitty distinction, and the Chinese revival after 1567 is invisible. |
| **Sensitivity & portrayal** | **B+** | Would be an A but for the uncontradicted conquest myth (S1) and the slavery silence (S2). Both fixable by addition. |
| **Institutions & administration** | **C+** | The invented customs spine is *plausible* and well-dramatised, but sits in an institutional vacuum: no alfândega vocabulary, no feitor, "Casa da Índia" misplaced, "governor" for "captain", the diocese and bishop absent, legal pluralism unacknowledged. |
| **Religion** | **C** | The church carries a Dutch name from 1641 (E1); its origin story is wrong twice (E2); one order, one priest, no bishop, no Sé, no inter-order friction. The *surau*/prayer-mat entries are much better than the Catholic material. |
| **Chronology — the 1580 frame** | **C−** | The weakest category and the root of most Tier A errors. Diu 1538 instead of the 1575 siege; English in the straits a decade early; a Spanish king a year early while Alcácer Quibir goes unmentioned; a Dutch gravestone sixty-one years early; "two centuries" of boots in a sixty-nine-year-old street. The game is convincingly *sixteenth-century* and only incidentally *1580*. |

**Overall: B−**, with an unusually high ceiling. The research quality is well above the norm; the
failure mode is that it was not *dated*. Nearly every Tier A error is a one-paragraph fix, and several
of the fixes are dramatically better than what they replace.

### The five highest-value fixes

1. **Rename the church in all player-facing text (E1, E2).** "St. Paul's" is a Dutch name from 1641.
   The game's own prop text already has the correct name; four strings and one Padre topic bring the
   whole location into 1580. *Highest ratio of credibility gained to work done in the entire audit.*

2. **Anchor the game to 1580 (E5, E6, E3, E20).** Replace Diu '38 with the January 1575 Acehnese
   armada; replace "English in the straits" with Drake at Ternate and Babullah; replace "a new Spanish
   King" with the vacant throne after Alcácer Quibir; delete the Dutch gravestone; fix "two centuries."
   Five edits. They convert a generic Portuguese-colonial century into a *specific and frightening
   year* — a garrison five years past the last siege, an empire that has just lost Ternate, and a
   kingdom with no king.

3. **Fix the junk (E4).** `Canton` → `Macau` (which also fixes the Macau-creditor logic already in the
   script), and `north-east wind` → `south-west wind`. Two find-and-replaces, and it removes the one
   error a maritime historian would notice within ninety seconds — currently contradicted by the game's
   own, correct, dhow text forty lines away.

4. **Put slavery in the world, and make Siti's status the hinge of the sanctuary plot (E7, M1, S2).**
   Three drop-in lines. Corrects the largest factual omission, closes the only accidental-apologia gap,
   and upgrades `padres-dilemma` from "will the priest protect a girl from a bad boss" to the real and
   unanswerable seventeenth-century question.

5. **Give three communities their institutions, one topic each (E11, M2, M5, M3).** The **Kapitan
   China** (appointed 1572, eight years before the game); the **bendahara/shahbandar** survival under
   Portuguese rule; the **bishop and the Sé**; and Mak Enang's correction of the conquest myth. Four
   dialogue topics on existing NPCs. They convert the Chinese, Malay and Catholic populations from
   *communities the game describes* into *polities the game contains* — and M5 in particular replaces
   "ancient inscrutable merchant house" with "thirteen-year-old position exposed to an imperial edict,"
   which is both true and better drama.

---

## 5. SOURCES

1. **Church of Saint Paul, Malacca** — construction 1521 by Duarte Coelho as *Nossa Senhora da
   Annunciada*; deeded to the Society of Jesus 1548, deeds received by Francis Xavier; enlarged 1556,
   belfry 1590, renamed *Igreja de Madre de Deus*; reconsecrated as St. Paul's / *Bovenkerk* after the
   Dutch conquest of 1641.
   https://en.wikipedia.org/wiki/Church_of_Saint_Paul,_Malacca

2. **Portuguese Malacca** — 1511 conquest force and assault across the bridge; demolition of the
   congregational mosque and government buildings for fortress stone; retention of the *bendahara*,
   *temenggong* and *shahbandars*; government by a triennial captain-major appointed from Goa; Nina
   Chatu and the collaborating merchant powers.
   https://en.wikipedia.org/wiki/Portuguese_Malacca · https://www.colonialvoyage.com/portuguese-malacca-1511-1641/

3. **Monsoon regime and Asian shipping seasons** — north-easterlies Oct–Mar, south-westerlies May–Sep;
   round-trip voyage scheduling and the enforced multi-month layover in Southeast Asian ports.
   https://oceanrelicstudio.com/blogs/maritime-library/monsoon-winds-chinese-maritime-culture ·
   https://www.maritimeasia.ws/topic/malaysia.html

4. **The 1567 Longqing lifting of the *haijin*** — single licensed port at Yuegang (Zhangzhou, Fujian),
   destinations restricted to the Eastern and Western Oceans; 50 licences initially, 88 by 1589, 117 by
   1597. https://en.wikipedia.org/wiki/Yuegang

5. **Portuguese succession crisis of 1580** — Sebastian's death at Alcácer Quibir 4 Aug 1578; Cardinal
   Henry's death 31 Jan 1580; Philip II's accession and the Iberian Union.
   https://en.wikipedia.org/wiki/Portuguese_succession_crisis_of_1580 ·
   https://en.wikipedia.org/wiki/Battle_of_Alc%C3%A1cer_Quibir

6. **The sieges of Malacca, 1568–1575** — Aceh 1568 (Ottoman-backed coalition), 1573 (with Golconda and
   Kalinyamat), 1574 (Javanese/Japara), and January 1575 (113 vessels incl. 40 galleys, defended by
   Tristão Vaz da Veiga). https://en.wikipedia.org/wiki/Siege_of_Malacca_(1568) ·
   https://en.wikipedia.org/wiki/Siege_of_Malacca_(1573) · https://en.wikipedia.org/wiki/Siege_of_Malacca_(1575)

7. **Slavery, *casados* and the social structure of Portuguese Malacca** — Portuguese settlers, soldiers,
   *casados*, Asian wives, Luso-Asian descendants and their personal slaves inside the walls;
   non-Portuguese populations and Estado slaves outside; several household slaves per *casado* family;
   intolerance of Islam and destruction of the main mosque.
   *The casados of Melaka, 1511–1641: Strategies of Adaptation and Survival*,
   https://run.unl.pt/bitstream/10362/131476/1/The_casados_of_Melaka.pdf ·
   https://en.wikipedia.org/wiki/Portuguese_Malacca

8. **Melaka weights and the bahar** — Pires's *Suma Oriental* records Melaka's trade in bahars (20,000
   bahars of pepper annually) and prices in cruzados per unit; the bahar/picul/cate/tael family as the
   working measures of the port. https://archive.org/details/McGillLibrary-136385-182 ·
   https://www.ebsco.com/research-starters/biography/tome-pires

9. **Portuguese Muscat and the Ya'ariba** — Muscat and Qurayyat held as Portuguese bases alongside
   Hormuz, "the most strongly fortified base on the Arabian peninsula," until the Omani recapture of
   1650; the Ya'rubid imamate dates from 1624.
   https://defense.info/global-dynamics/2019/07/the-portuguese-in-the-persian-gulf-hormuz-bahrain-and-mosul/ ·
   https://en.wikipedia.org/wiki/Ya%27rubids

10. **The Aceh–Red Sea pepper route** — Gujarati, Arab, Turkish and Acehnese shippers moving Southeast
    Asian pepper direct from Aceh to the Red Sea outside Portuguese naval reach; by the 1560s carrying
    comparable volume to the entire Cape route; Aceh's pepper monopolies funding its shipbuilding and
    fortification. https://grokipedia.com/page/Aceh_Sultanate ·
    https://www.researchgate.net/publication/312947586_The_Ottomans_in_Southeast_Asia

11. **The cartaz system** — the sea-pass granting immunity from Portuguese seizure in exchange for fees
    and trade conditions; incomplete enforcement and the liberalisation of issue to Muslim traders.
    https://www.ijrar.org/papers/IJRAR19D1163.pdf · https://grokipedia.com/page/Cartaz

12. **Kapitan China of Melaka** — Tay Kie Ki (Tay Hong Yong) appointed by the Portuguese in 1572, the
    only Kapitan China appointed under Portuguese rule. https://en.wikipedia.org/wiki/Kapitan_Cina ·
    https://overseaschineseinthebritishempire.blogspot.com/2009/10/chinese-kapitans.html

13. **Diocese of Malacca** — erected 4 February 1558 from territory split off from Goa, suffragan to the
    Archdiocese of Goa. https://en.wikipedia.org/wiki/Diocese_of_Malacca%E2%80%93Johor ·
    https://gcatholic.org/dioceses/diocese/mela0.htm

14. **Erédia's Malacca** — c. 7,400 Christians and eight parishes in 1613; Tranqueira as the principal
    suburb, divided into São Tomé / *Campon Chelim* (Kampung Keling, populated by the Chelis of
    Coromandel) and São Estêvão / *Campon China*; timber houses with tiled roofs.
    https://www.worldheritageofportugueseorigin.com/2015/06/21/malacca-town-during-the-portuguese-era/

15. **Sejarah Melayu / Jawi manuscript practice** — commissioned in Johor in 1612, compiled and edited by
    Tun Sri Lanang under Sultan Alauddin Riayat Shah; written in classical Malay in old Jawi script on
    paper. https://en.wikipedia.org/wiki/Malay_Annals · https://en.wikipedia.org/wiki/Tun_Sri_Lanang

16. **Coffee, Yemen and Mokha** — coffee as a beverage developed in Yemen in the 14th–15th centuries;
    Ottoman commercialisation of Yemeni cultivation in the second half of the sixteenth century; Mokha
    as the principal export port "from roughly the 16th century," peaking in the early 1700s.
    https://en.wikipedia.org/wiki/Port_of_Mokha · https://en.wikipedia.org/wiki/Coffeehouses_in_Arabic_culture

17. **Estado da Índia currency** — the *pardau* system to c. 1580 (2 réis = 1 bazaruco, 60 réis = 1 tanga,
    6 tangas = 1 pardau), succeeded by the *xerafim* period from 1580 (5 tangas = 1 xerafim); the same
    ladder applied in Portuguese Malacca; the gold *cruzado* among the Indo-Portuguese coinage.
    https://en.wikipedia.org/wiki/Portuguese_Indian_rupia ·
    https://revistas.usp.br/revhistoria/en/article/view/215975 ·
    https://en.numista.com/catalogue/malacca_portuguese-1.html

---

*Audit compiled for the "deeper domain review" outstanding since v0.9. All corrections are proposed as
data-file text edits; no code changes are implied. File boundary respected — this document is the only
file written.*
