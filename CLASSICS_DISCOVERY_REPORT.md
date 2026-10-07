# BookClub Classics Discovery Report

Operation: 2026-10-07T05:20:35.654Z (UTC). Source commit: `a9cdef3deb391e2a189708d387b2d2659db520ac`. Production snapshot: 2026-10-07T05:03:37.599Z.

**HIGH-RECALL, NON-EXHAUSTIVE DISCOVERY**

Qualification uses the real current `rankMovie`, `effectiveRankingScores`, `scoreValue` and `sortClassics`: four active members answer Unseen in memory, seed 0, residual score ≥47,656, and at least three genuine live required dimensions. Optional ratings and discovery vote counts do not affect scoring. Missing required dimensions use the real available-score-average imputation. No production mutation occurred.

## Production baseline

- movies: 985
- classics: 462
- ranked: 235
- unranked: 84
- seen: 143
- outstanding: 314
- activeMembers: 4
- activeHistoryEvents: 251
- activeHistoryUniqueFilms: 465

The exact production D1 target was verified. Fresh export restored offline, integrity/FKs passed, and schema compatibility was checked against current migrations in a separate in-memory database.

## Discovery nets and funnel

Net A reuses the parent run's four successful MDBList catalogue first pages. Net B uses [official IMDb non-commercial datasets](https://data.imdb.com/non-commercial-datasets/), restricted to non-adult movies: B1 rating ≥8.3 / votes ≥100; B2 rating ≥7.5 / votes ≥10,000. Net C uses [official TMDB Discover](https://developer.themoviedb.org/reference/discover-movie): C1 rating ≥8.3 / votes ≥50; C2 rating ≥7.5 / votes ≥1,000; non-adult, deterministic vote-average descending sort, all reported pages traversed.

- Cached imdbrating: 100 records, 100 unique identities, one cached request.
- Cached letterrating: 100 records, 100 unique identities, one cached request.
- Cached metacritic: 100 records, 100 unique identities, one cached request.
- Cached rtaudience: 100 records, 100 unique identities, one cached request.
- IMDb B1: 2205; B2: 2444; unique union: 4393.
- TMDB C1: 253 unique (13 pages); C2: 865 unique (44 pages).

- rawUnion: 5920
- deduped: 5628
- EXCLUDED_CURRENT_CLASSICS: 611
- EXCLUDED_ACTIVE_HISTORY: 136
- EXCLUDED_KNOWN_PRUNE_REJECT: 52
- eligibleCandidates: 4829
- finalDedupedCandidates: 4438
- excludedAfterTargetedIdentity: 0
- scoringAttempted: 4438
- scored: 4174
- providerScored: 4174
- quotaUnscored: 0

Priority favoured cached catalogue entries, multiple independent nets, strong outliers, then consensus-only entries; score/vote support and IDs provided deterministic ties. MDBList responses resolved aliases before followups; exact identity exclusions were checked again after targeted lookups. The 149-film prune list was retained as a negative cache.

The cached MDBList union contains 393 distinct candidates across 400 records. Stream-exclusive contributions: imdbrating 100; letterrating 93; metacritic 93; rtaudience 100. Funnel counts describe candidate identity records at the available resolution; exclusions can exceed canonical membership counts where an IMDb-only and TMDB-only discovery are separately excluded before their shared alias is resolved.

## Provider usage

- mdblistBatch: 481
- mdblistIndividual: 364
- tmdbDiscovery: 57
- tmdbDetail: 986
- tmdbFind: 532
- omdbPrimary: 1015
- omdbSecondary: 1003
- cachedMdblistCallsReused: 4
- cacheHits: 3333
- mdblistQuotaStart: 994
- mdblistReserve: 150
- mdblistQuota: {"limit":1000,"remaining":150,"reset":1791417600}

MDBList batches held up to ten identities; no catalogue requests were repeated or added. A hard reserve of max(150, 15% of live starting remaining quota) was enforced. Batch omissions were recorded and recovered individually only when they could materially resolve a plausible qualification. Optimistic upper bounds used the real ranking model with missing dimensions set to 100 before deciding targeted followups.

## Outcomes

- QUALIFIER: 432
- INSUFFICIENT_EVIDENCE: 387
- REJECT: 3349
- IDENTITY_CONFLICT: 2
- IMPORT_REVIEW_REQUIRED: 268
- NOT_SCORED_QUOTA_CAP: 0
- Near misses retained: 100.

## Full qualifier table

Scores below are genuine normalised /100 values; a dash is absent evidence, not a persisted imputation. JSON retains exact values, raw scales, provenance, ranking decomposition and attempted provider paths. Hypothetical position inserts each film independently into the actual current Ranked baseline.

| Title | Year | IMDb ID | TMDB ID | Canonical | IMDb | RT audience | RT critic | Letterboxd | MC critic | TMDB | Coverage | Residual | Margin | Hypothetical rank |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Love, Murder and Miracles | 2022 | tt7758540 | 1385773 | new | 85 | 96 | 100 | — | — | 100 | 4 | 60252.868 | 12596.868 | 1 |
| Fishmans: Otokotachi no Wakare 98.12.28 @ Akasaka Blitz | 2005 | tt16477464 | 376644 | new | 97 | — | — | 92 | — | 95 | 3 | 59366.737 | 11710.737 | 1 |
| Hello Beautiful | 2025 | tt9018874 | 1288251 | new | 86 | 97 | — | — | — | 100 | 3 | 59055.461 | 11399.461 | 1 |
| Laufey's A Night at the Symphony: Hollywood Bowl | 2024 | tt34227779 | 1375774 | new | 89 | 99 | — | 88 | — | 100 | 4 | 58654.409 | 10998.409 | 1 |
| The Forgotten Carols | 2020 | tt13327144 | 773394 | new | 84 | 97 | — | — | — | 100 | 3 | 58265.131 | 10609.131 | 1 |
| Twenty One Pilots: Livestream Experience | 2021 | tt14717082 | 832199 | new | 94 | 98 | — | 90 | — | 92 | 4 | 57937.483 | 10281.483 | 1 |
| j-hope Tour: Hope on the Stage in Japan - Live Viewing | 2025 | tt36750027 | 1468891 | new | 86 | 99 | — | 90 | — | 97 | 4 | 57402.686 | 9746.686 | 1 |
| Travis: A Soldier's Story | 2013 | tt3134910 | 307472 | new | 86 | 100 | — | — | — | 93 | 3 | 57389.44 | 9733.44 | 1 |
| SUGA / Agust D TOUR 'D-DAY' in JAPAN : LIVE VIEWING | 2023 | tt27667758 | 1124669 | new | 84 | 99 | — | 88 | — | 100 | 4 | 57184.269 | 9528.269 | 1 |
| Attack on Titan: The Last Attack | 2024 | tt33175825 | 1333100 | new | 89 | 99 | — | 94 | — | 88 | 4 | 56751.988 | 9095.988 | 1 |
| Shoah | 1985 | tt0090015 | 42044 | new | 87 | 96 | 100 | 90 | 99 | 82 | 6 | 56747.021 | 9091.021 | 1 |
| O.J.: Made in America | 2016 | tt5275892 | 377462 | new | 89 | 97 | 100 | 90 | — | 84 | 5 | 56239.267 | 8583.267 | 1 |
| National Theatre Live: Prima Facie | 2022 | tt21093976 | 963568 | new | 91 | 97 | — | 92 | — | 88.1 | 4 | 56131.989 | 8475.989 | 1 |
| Dua Lipa Live from Mexico | 2026 | tt42694139 | 1694958 | new | 90 | — | — | 88 | — | 98 | 3 | 56117.847 | 8461.847 | 1 |
| The Nightman Cometh Live! | 2009 | tt8006524 | 433103 | new | 92 | — | — | 90 | — | 94 | 3 | 56064.864 | 8408.864 | 1 |
| Kadaisi Vivasayi | 2022 | tt10300570 | 613703 | new | 87 | 100 | 100 | 86 | — | 86 | 5 | 56060.714 | 8404.714 | 1 |
| My Chemical Romance: Life on the Murder Scene | 2006 | tt2986620 | 81815 | new | 89 | — | — | 90 | — | 96 | 3 | 55682.209 | 8026.209 | 1 |
| Night and Fog | 1956 | tt0048434 | 803 | new | 86 | 95 | 100 | 92 | — | 82.86 | 5 | 55260.31 | 7604.31 | 1 |
| Taylor Swift: Folklore: The Long Pond Studio Sessions | 2020 | tt13524234 | 768141 | new | 85 | 94 | 100 | 90 | — | 84.75 | 5 | 54726.077 | 7070.077 | 1 |
| RM: Right People, Wrong Place | 2024 | tt33319928 | 1346709 | new | 83 | 100 | — | 88 | — | 92 | 4 | 54713.935 | 7057.935 | 1 |
| TAEYONG: TY TRACK IN CINEMAS | 2024 | tt33335615 | 1338226 | new | 83 | 99 | — | 80 | — | 100 | 4 | 54606.176 | 6950.176 | 2 |
| Kill Bill: The Whole Bloody Affair | 2025 | tt6019206 | 414419 | new | 87 | — | 100 | 90 | 95 | 81 | 5 | 54598.294 | 6942.294 | 2 |
| NCT Dream The Movie: In A DREAM | 2022 | tt23849218 | 1038198 | new | 86 | — | — | 86 | — | 100 | 3 | 54587.227 | 6931.227 | 2 |
| American Doctor | 2026 | tt39149951 | 1596332 | new | 86 | 96 | 100 | 84 | 86 | 91 | 6 | 54467.647 | 6811.647 | 2 |
| Nirvana | 1993 | tt0365559 | 18942 | new | 93 | — | — | 92 | — | 87 | 3 | 54465.807 | 6809.807 | 2 |
| Daft Punk: Alive 2007 | 2007 | tt32014090 | 843809 | new | 92 | — | — | 90 | — | 90 | 3 | 54445.939 | 6789.939 | 2 |
| Dead Can Dance: Toward the Within | 1994 | tt0111467 | 30100 | new | 87 | 100 | — | — | — | 84 | 3 | 54203.1 | 6547.1 | 3 |
| The Beatles: Get Back - The Rooftop Concert | 2022 | tt16899584 | 923403 | new | 89 | 94 | 100 | 88 | — | 80 | 5 | 54127.717 | 6471.717 | 3 |
| Louis Tomlinson: All of Those Voices | 2023 | tt26675252 | 1084072 | new | 86 | 100 | — | 86 | — | 89 | 4 | 54090.281 | 6434.281 | 3 |
| Hisaishi Jo in Budoukan | 2008 | tt4673554 | 66943 | new | 88 | — | — | 90 | — | 93 | 3 | 54057.397 | 6401.397 | 3 |
| Sufjan Stevens: Carrie & Lowell Live | 2017 | tt8011446 | 529424 | new | 91 | — | — | 90 | — | 90 | 3 | 54044.151 | 6388.151 | 3 |
| Hadestown: The Musical | 2026 | tt36307021 | 1439808 | new | 84 | 98 | 97 | 90 | 82 | 89 | 6 | 53881.522 | 6225.522 | 5 |
| A Winter Tale | 2007 | tt0494291 | 343898 | new | 85 | 100 | — | — | — | 85 | 3 | 53810.878 | 6154.878 | 6 |
| LINKIN PARK: UNSHATTER | 2026 | tt43442522 | 1388805 | new | 86 | 98 | — | 84 | — | 92 | 4 | 53777.764 | 6121.764 | 6 |
| Ghost: Rite Here Rite Now | 2024 | tt32260498 | 1203397 | new | 86 | 99 | — | 86 | — | 89 | 4 | 53771.141 | 6115.141 | 6 |
| A Brighter Summer Day | 1991 | tt0101985 | 15804 | new | 82 | 94 | 100 | 90 | 91 | 82 | 6 | 53717.054 | 6061.054 | 6 |
| Dear Jack | 2009 | tt1517750 | 32647 | new | 86 | 94 | — | — | — | 90 | 3 | 53680.628 | 6024.628 | 6 |
| Hannibal: This Is My Design | 2014 | tt4397770 | 478256 | new | 86 | — | — | 90 | — | 94 | 3 | 53680.628 | 6024.628 | 6 |
| My Chemical Romance: The Black Parade Is Dead! | 2008 | tt1239310 | 79712 | new | 93 | — | — | 90 | — | 87 | 3 | 53665.175 | 6009.175 | 6 |
| Where the Light Is: John Mayer Live in Concert | 2008 | tt1270491 | 20313 | new | 92 | — | — | 90 | — | 88 | 3 | 53654.137 | 5998.137 | 6 |
| Macario | 1960 | tt0054042 | 122019 | new | 83 | 95 | 100 | 84 | — | 87 | 5 | 53648.662 | 5992.662 | 6 |
| Renaissance: A Film by Beyoncé | 2023 | tt29354040 | 1185743 | new | 85 | 99 | 98 | 92 | 86 | 78 | 6 | 53616.607 | 5960.607 | 6 |
| Bring Me The Horizon - L.I.V.E. in São Paulo (Live Immersive Virtual Experiment) | 2026 | tt39634490 | 1621113 | new | 90 | 99 | — | 88 | — | 82 | 4 | 53511.883 | 5855.883 | 7 |
| Le trou | 1960 | tt0054407 | 29259 | new | 85 | 96 | 95 | 90 | — | 82.44 | 5 | 53431.488 | 5775.488 | 7 |
| The Warning Live from Auditorio Nacional, CDMX | 2025 | tt37710246 | 1523985 | new | 92 | — | — | 82 | — | 95 | 3 | 53350.956 | 5694.956 | 7 |
| Violet Evergarden: The Movie | 2020 | tt8652818 | 533514 | new | 83 | 99 | 100 | 82 | — | 83 | 5 | 53309.041 | 5653.041 | 7 |
| Stray Kids: The Dominate Experience | 2026 | tt39216314 | 1600421 | new | 81 | 100 | — | 86 | — | 91 | 4 | 53268.354 | 5612.354 | 7 |
| IU Concert: The Golden Hour | 2023 | tt28997098 | 1165656 | new | 88 | 100 | — | 84 | — | 86 | 4 | 53221.994 | 5565.994 | 7 |
| David Gilmour Live at the Circus Maximus, Rome | 2025 | tt37731277 | 1522301 | new | 86 | 97 | — | 82 | — | 93 | 4 | 53202.126 | 5546.126 | 7 |
| RiffTrax Live: The Room | 2015 | tt4625336 | 425846 | new | 84 | 96 | — | — | — | 88 | 3 | 52935.923 | 5279.923 | 9 |
| The Cure: Anniversary 1978-2018 Live in Hyde Park | 2019 | tt10407900 | 605702 | new | 84 | 100 | 100 | 78 | — | 83 | 5 | 52927.828 | 5271.828 | 9 |
| Twin Peaks | 1991 | tt27449259 | 452522 | new | 89 | — | — | 94 | — | 85 | 3 | 52898.393 | 5242.393 | 9 |
| Look Back | 2024 | tt31711040 | 1244492 | new | 78 | 98 | 100 | 86 | 90 | 81.92 | 6 | 52866.993 | 5210.993 | 10 |
| Hearts of Darkness: A Filmmaker's Apocalypse | 1991 | tt0102015 | 4539 | new | 81 | 94 | 100 | 84 | 95 | 79.2 | 6 | 52707.772 | 5051.772 | 12 |
| Evangelion: 3.0+1.0 Thrice Upon a Time | 2021 | tt2458948 | 283566 | new | 80 | 100 | 100 | 86 | 85 | 82 | 6 | 52701.546 | 5045.546 | 12 |
| Iron Maiden: Rock in Rio | 2002 | tt0280898 | 31477 | new | 90 | 100 | — | 80 | — | 86 | 4 | 52693.82 | 5037.82 | 12 |
| Neon Genesis Evangelion: The End of Evangelion | 2024 | tt0169858 | 18491 | new | 81 | 99 | 92 | 90 | — | 83 | 5 | 52691.612 | 5035.612 | 12 |
| For Love & Life: No Ordinary Campaign | 2022 | tt23130054 | 1025902 | new | 85 | — | 100 | — | — | 82 | 3 | 52665.121 | 5009.121 | 13 |
| Present Laughter | 2019 | tt10384504 | 607715 | new | 85 | 100 | — | 86 | — | 85 | 4 | 52638.629 | 4982.629 | 14 |
| For Sama | 2019 | tt9617456 | 576017 | new | 85 | 92 | 98 | 88 | 89 | 82 | 6 | 52632.006 | 4976.006 | 14 |
| BTS: Yet to Come in Cinemas | 2023 | tt24807190 | 1063453 | new | 86 | 99 | — | 88 | — | 83 | 4 | 52620.968 | 4964.968 | 14 |
| Break the Silence: The Movie | 2020 | tt12850582 | 730647 | new | 82 | 97 | — | 86 | — | 91 | 4 | 52598.892 | 4942.892 | 14 |
| 20 Days in Mariupol | 2023 | tt24082438 | 1058616 | new | 86 | 97 | 100 | 86 | 83 | 81 | 6 | 52597.788 | 4941.788 | 14 |
| Hamilton | 2025 | tt8503618 | 556574 | new | 83 | 99 | 98 | 86 | 88 | 78.29 | 6 | 52501.01 | 4845.01 | 14 |
| Michael Jackson Live at Wembley July 16, 1988 | 2012 | tt2622038 | 118403 | new | 90 | — | — | 90 | — | 87 | 3 | 52466.434 | 4810.434 | 14 |
| Best Kept Secret | 2013 | tt2433448 | 178917 | new | 74 | 92 | 100 | — | 100 | 76 | 5 | 52464.845 | 4808.845 | 14 |
| Ocean with David Attenborough | 2025 | tt33022710 | 1448497 | new | 84 | — | 100 | 86 | 93 | 80.68 | 5 | 52413.827 | 4757.827 | 14 |
| Visaaranai | 2016 | tt4991384 | 372226 | new | 84 | 97 | 100 | 82 | — | 80 | 5 | 52363.736 | 4707.736 | 15 |
| Satantango | 1994 | tt0111341 | 31414 | new | 82 | 92 | 100 | 88 | 90 | 80 | 6 | 52356.053 | 4700.053 | 15 |
| Spider-Man: Across the Spider-Verse | 2023 | tt9362722 | 569094 | new | 85 | 95 | 95 | 88 | 86 | 83.5 | 6 | 52306.657 | 4650.657 | 17 |
| BTS: Permission to Dance on Stage - LA | 2022 | tt22010428 | 1022102 | new | 85 | 94 | — | 88 | — | 88 | 4 | 52212.695 | 4556.695 | 18 |
| j-hope IN THE BOX | 2023 | tt26425683 | 1076443 | new | 84 | 99 | — | 88 | — | 83.46 | 4 | 52179.231 | 4523.231 | 18 |
| The Human Condition III: A Soldier's Prayer | 1970 | tt0055233 | 34530 | new | 88 | — | — | 94 | — | 84 | 3 | 52123.516 | 4467.516 | 18 |
| The Best of Youth | 2003 | tt0346336 | 11659 | new | 84 | 98 | 94 | 86 | 89 | 80 | 6 | 52114.318 | 4458.318 | 18 |
| Dio: Dreamers Never Die | 2022 | tt11851698 | 934670 | new | 84 | 100 | 100 | 80 | — | 77 | 5 | 52060.496 | 4404.496 | 18 |
| Sweet Smell of Success | 1957 | tt0051036 | 976 | new | 80 | 91 | 98 | 84 | 100 | 76 | 6 | 52008.352 | 4352.352 | 19 |
| Wolfwalkers | 2020 | tt5198068 | 441130 | new | 80 | 98 | 99 | 84 | 87 | 81.71 | 6 | 51996.789 | 4340.789 | 19 |
| War and Peace | 1968 | tt0063794 | 29266 | new | 83 | 94 | 100 | 88 | — | 76 | 5 | 51905.962 | 4249.962 | 19 |
| Investigation of a Citizen Above Suspicion | 1970 | tt0065889 | 26451 | new | 80 | 94 | 100 | 84 | 89 | 81.97 | 6 | 51804.236 | 4148.236 | 20 |
| Something to Stand for with Mike Rowe | 2024 | tt32277067 | 1287266 | new | 85 | 98 | 80 | — | — | 90 | 4 | 51774.482 | 4118.482 | 21 |
| Virunga | 2014 | tt3455224 | 263614 | new | 81 | 93 | 100 | 80 | 95 | 79 | 6 | 51742.333 | 4086.333 | 21 |
| Madonna: The Celebration Tour in Rio | 2024 | tt31945362 | 1280042 | new | 85 | — | — | 90 | — | 90 | 3 | 51695.237 | 4039.237 | 23 |
| Hans Zimmer Live in Prague | 2017 | tt5732482 | 435011 | new | 91 | — | — | 88 | — | 86 | 3 | 51690.822 | 4034.822 | 23 |
| The Legend of Hei 2 | 2025 | tt37284198 | 1144107 | new | 81 | 98 | — | 84 | — | 89.54 | 4 | 51629.709 | 3973.709 | 25 |
| Leonard Cohen: Live in London | 2009 | tt1424065 | 36026 | new | 88 | 100 | — | 76 | — | 88 | 4 | 51605.46 | 3949.46 | 26 |
| Mur. Ty [romantyka] | 2025 | tt36507005 | 1456688 | new | 88 | — | — | 76 | — | 100 | 3 | 51605.46 | 3949.46 | 26 |
| The Wild Robot | 2024 | tt29623480 | 1184918 | new | 81 | 98 | 97 | 84 | 85 | 83 | 6 | 51596.63 | 3940.63 | 27 |
| Roger Waters: The Wall | 2015 | tt3970482 | 290382 | new | 85 | 93 | 100 | 82 | — | 80 | 5 | 51594.422 | 3938.422 | 27 |
| The Ascent | 1977 | tt0075404 | 50183 | new | 82 | 91 | 100 | 88 | — | 79 | 5 | 51585.592 | 3929.592 | 27 |
| A Special Day | 1977 | tt0076085 | 42229 | new | 81 | 92 | 100 | 86 | — | 81 | 5 | 51576.761 | 3920.761 | 27 |
| Thug Rose: Mixed Martial Artist | 2022 | tt22742018 | 1059930 | new | 86 | 100 | — | — | — | 78 | 3 | 51561.308 | 3905.308 | 27 |
| Punjab '95 | 2026 | tt28089784 | 1155818 | new | 88 | — | 100 | 84 | — | 80 | 4 | 51534.816 | 3878.816 | 29 |
| The Loss of Nameless Things | 2004 | tt0399298 | 197660 | new | 84 | 100 | — | — | — | 80 | 3 | 51534.816 | 3878.816 | 29 |
| The Odyssey | 2026 | tt33764258 | 1368337 | new | 84 | 96 | 94 | 86 | 88 | 80 | 6 | 51490.664 | 3834.664 | 30 |
| Pallati 176 | 1986 | tt4307176 | 262673 | new | 94 | — | — | 78 | — | 92 | 3 | 51455.342 | 3799.342 | 30 |
| Bring the Soul: The Movie | 2019 | tt10545076 | 611291 | new | 84 | 99 | — | 86 | — | 82.92 | 4 | 51448.374 | 3792.374 | 30 |
| Papanasam | 2015 | tt4429128 | 330421 | new | 84 | 96 | 100 | 80 | — | 78.85 | 5 | 51429.839 | 3773.839 | 30 |
| Umberto D. | 1952 | tt0045274 | 833 | new | 81 | 93 | 98 | 84 | 92 | 79 | 6 | 51410.085 | 3754.085 | 30 |
| The Wrong Trousers | 1993 | tt0108598 | 531 | new | 83 | 92 | 100 | 86 | — | 78 | 5 | 51373.483 | 3717.483 | 31 |
| Where Is The Friend's House? | 1987 | tt0093342 | 49964 | new | 81 | 91 | 100 | 88 | — | 79 | 5 | 51366.86 | 3710.86 | 32 |
| Björk at the Royal Opera House | 2002 | tt0362449 | 48730 | new | 92 | — | — | 90 | — | 82 | 3 | 51349.376 | 3693.376 | 32 |
| Jesus O Nosso Bem | 2025 | tt31013163 | 1437787 | new | 86 | — | — | 92 | — | 86.07 | 3 | 51340.95 | 3684.95 | 32 |
| BTS World Tour 'Arirang' in Busan: Live Viewing | 2026 | tt42867738 | 1701849 | new | 84 | — | — | 90 | — | 90 | 3 | 51314.054 | 3658.054 | 32 |
| Silenced | 2011 | tt2070649 | 81481 | new | 80 | 93 | 100 | 84 | — | 81.59 | 5 | 51279.146 | 3623.146 | 32 |
| C/o Kancharapalem | 2018 | tt7391996 | 544795 | new | 88 | 92 | 100 | 84 | — | 74.23 | 5 | 51278.637 | 3622.637 | 32 |
| TAYLOR SWIFT \| THE ERAS TOUR | 2023 | tt28814949 | 1160164 | new | 80 | 98 | 98 | 86 | 82 | 82 | 6 | 51274.316 | 3618.316 | 33 |
| Jibon Theke Neya | 1970 | tt0989831 | 93162 | new | 93 | — | — | 76 | — | 94.29 | 3 | 51242.098 | 3586.098 | 33 |
| Burn the Stage: The Movie | 2018 | tt9151704 | 553512 | new | 85 | 99 | — | 84 | — | 83 | 4 | 51185.046 | 3529.046 | 33 |
| Ordet | 1955 | tt0048452 | 48035 | new | 82 | 91 | 100 | 86 | — | 79 | 5 | 51123.933 | 3467.933 | 35 |
| 12th Fail | 2023 | tt23849204 | 1163258 | new | 87 | 97 | 91 | 84 | — | 79.19 | 5 | 51069.532 | 3413.532 | 35 |
| The Human Condition II: Road to Eternity | 1959 | tt0053115 | 34528 | new | 85 | 94 | — | 90 | — | 81.86 | 4 | 51051.238 | 3395.238 | 37 |
| Time of the Gypsies | 1988 | tt0097223 | 20123 | new | 81 | 96 | 100 | 84 | — | 76 | 5 | 51048.874 | 3392.874 | 37 |
| Michael Jackson Live in Bucharest: The Dangerous Tour | 1992 | tt0480827 | 20227 | new | 90 | — | — | 86 | — | 87.35 | 3 | 51044.462 | 3388.462 | 37 |
| I'm Still Here | 2024 | tt14961016 | 1000837 | new | 81 | 97 | 97 | 86 | 85 | 79 | 6 | 51041.412 | 3385.412 | 37 |
| A Poet | 2025 | tt36544524 | 1465563 | new | 78 | 92 | 100 | 82 | 85 | 88 | 6 | 51041.412 | 3385.412 | 37 |
| The Voice of Hind Rajab | 2025 | tt36943034 | 1480382 | new | 82 | 100 | 93 | 88 | 81 | 80.7 | 6 | 50985.658 | 3329.658 | 37 |
| My Neighbor Totoro | 1988 | tt0096283 | 8392 | new | 81 | 98 | 94 | 84 | 87 | 81 | 6 | 50981.806 | 3325.806 | 37 |
| Radiohead: In Rainbows - From the Basement | 2008 | tt1454148 | 60399 | new | 87 | — | — | 94 | — | 82 | 3 | 50979.966 | 3323.966 | 37 |
| Departures | 2019 | tt8126544 | 609934 | new | 72 | 100 | — | — | — | 90 | 3 | 50957.89 | 3301.89 | 37 |
| Piper | 2016 | tt5613056 | 399106 | new | 83 | 91 | 100 | 82 | — | 81.31 | 5 | 50946.393 | 3290.393 | 37 |
| Tom Petty and the Heartbreakers: Runnin' Down a Dream | 2007 | tt0965382 | 31147 | new | 86 | 92 | 100 | 82 | — | 77 | 5 | 50942.908 | 3286.908 | 37 |
| Linkin Park: Live in Texas | 2003 | tt0404202 | 40444 | new | 85 | — | — | 88 | — | 90 | 3 | 50913.738 | 3257.738 | 37 |
| The Pop Out: Ken & Friends | 2024 | tt32655276 | 1306624 | new | 88 | — | — | 90 | — | 85 | 3 | 50913.738 | 3257.738 | 37 |
| The Clock | 2010 | tt2008009 | 138829 | new | 89 | — | — | 88 | — | 86 | 3 | 50904.907 | 3248.907 | 37 |
| Metallica & San Francisco Symphony - S&M2 | 2019 | tt10765852 | 621949 | new | 86 | 97 | — | 80 | — | 87 | 4 | 50870.873 | 3214.873 | 37 |
| The Rescue | 2021 | tt9098872 | 680058 | new | 83 | 99 | 96 | 82 | 84 | 79.65 | 6 | 50808.643 | 3152.643 | 38 |
| Coldplay Music of The Spheres Live Broadcast from Buenos Aires | 2022 | tt23016388 | 1020776 | new | 84 | 95 | — | 84 | — | 87 | 4 | 50795.814 | 3139.814 | 38 |
| Les Misérables in Concert: The 25th Anniversary | 2010 | tt1754109 | 158675 | new | 88 | 95 | — | 84 | — | 82.85 | 4 | 50762.699 | 3106.699 | 39 |
| Year | 2023 | tt26914506 | 1091503 | new | 90 | — | — | 76 | — | 96 | 3 | 50745.958 | 3089.958 | 39 |
| Rome, Open City | 1945 | tt0038890 | 307 | new | 80 | 92 | 100 | 84 | — | 80 | 5 | 50691.327 | 3035.327 | 40 |
| The First Slam Dunk | 2022 | tt15242330 | 783675 | new | 80 | 99 | 100 | 86 | 79 | 78 | 6 | 50689.296 | 3033.296 | 40 |
| Distant Sky: Nick Cave & The Bad Seeds Live in Copenhagen | 2018 | tt8217244 | 514826 | new | 87 | 100 | — | 82 | — | 80 | 4 | 50685.018 | 3029.018 | 40 |
| Flow | 2024 | tt4772188 | 823219 | new | 78 | 98 | 97 | 82 | — | 80.63 | 5 | 50679.512 | 3023.512 | 40 |
| Dominion | 2018 | tt5773402 | 472796 | new | 89 | 90 | — | 86 | — | 84.7 | 4 | 50640.012 | 2984.012 | 40 |
| The Heiress | 1949 | tt0041452 | 28571 | new | 81 | 93 | 100 | 84 | — | 77.53 | 5 | 50625.668 | 2969.668 | 40 |
| Paris Is Burning | 1991 | tt0100332 | 31225 | new | 82 | 88 | 99 | 92 | 82 | 80 | 6 | 50617.548 | 2961.548 | 40 |
| Josee, the Tiger and the Fish | 2020 | tt12879624 | 652837 | new | 77 | 99 | 100 | 76 | — | 82.44 | 5 | 50611.894 | 2955.894 | 40 |
| Gaza: Doctors Under Attack | 2025 | tt37504739 | 1486460 | new | 86 | — | — | 82 | — | 94 | 3 | 50595.839 | 2939.839 | 40 |
| No Half Measures: Creating the Final Season of Breaking Bad | 2013 | tt3088036 | 239459 | new | 83 | — | — | 94 | — | 85 | 3 | 50589.217 | 2933.217 | 40 |
| Paradise Lost: The Child Murders at Robin Hood Hills | 1996 | tt0117293 | 17204 | new | 82 | 94 | 100 | 82 | 88 | 76 | 6 | 50559.046 | 2903.046 | 40 |
| Pink Floyd: P. U. L. S. E. Live at Earls Court | 1995 | tt0110758 | 24970 | new | 92 | — | — | 86 | — | 84 | 3 | 50551.687 | 2895.687 | 40 |
| Queen Live at Wembley Stadium | 1986 | tt0158874 | 20575 | new | 91 | — | — | 86 | — | 85 | 3 | 50536.234 | 2880.234 | 40 |
| Madonna: The Confessions Tour | 2006 | tt0902306 | 18527 | new | 91 | — | — | 86 | — | 85 | 3 | 50536.234 | 2880.234 | 40 |
| Lost Ladies | 2023 | tt21626284 | 1163194 | new | 83 | 94 | 100 | 80 | — | 78 | 5 | 50530.347 | 2874.347 | 40 |
| Taylor Swift: The Eras Tour - The Final Show | 2025 | tt38673135 | 1562010 | new | 88 | 92 | — | 90 | — | 79 | 4 | 50526.069 | 2870.069 | 40 |
| Just a Bit Outside: The Story of the 1982 Milwaukee Brewers | 2025 | tt27489635 | 1352885 | new | 84 | 100 | — | 74 | — | 90 | 4 | 50521.516 | 2865.516 | 41 |
| The Father | 2020 | tt10272386 | 600354 | new | 82 | 88 | 98 | 86 | 88 | 80.95 | 6 | 50515.889 | 2859.889 | 41 |
| American Gospel: Christ Crucified | 2019 | tt11465650 | 656187 | new | 87 | — | — | 74 | — | 100 | 3 | 50501.647 | 2845.647 | 42 |
| Strive, Strive, Strive | 2021 | tt14687192 | 808734 | new | 87 | — | — | 74 | — | 100 | 3 | 50501.647 | 2845.647 | 42 |
| Minding the Gap | 2018 | tt7476236 | 489985 | new | 80 | 90 | 100 | 86 | 89 | 77 | 6 | 50495.024 | 2839.024 | 42 |
| Still Walking | 2008 | tt1087578 | 25050 | new | 79 | 90 | 100 | 86 | 89 | 78 | 6 | 50490.609 | 2834.609 | 42 |
| David Attenborough: A Life on Our Planet | 2020 | tt11989890 | 664280 | new | 89 | 96 | 96 | 84 | 72 | 84.36 | 6 | 50454.856 | 2798.856 | 42 |
| Unrivaled: Red Wings v. Avalanche | 2022 | tt21153268 | 993094 | new | 85 | — | — | 76 | — | 100 | 3 | 50453.08 | 2797.08 | 42 |
| Day of Wrath | 1943 | tt0036506 | 41391 | new | 80 | 91 | 100 | 84 | — | 80 | 5 | 50450.872 | 2794.872 | 42 |
| Song of the Sea | 2014 | tt1865505 | 110416 | new | 80 | 92 | 99 | 86 | 85 | 80 | 6 | 50428.796 | 2772.796 | 42 |
| Neil Young: Harvest Time | 2022 | tt23941342 | 1045848 | new | 85 | — | 100 | 78 | — | 85 | 4 | 50413.342 | 2757.342 | 42 |
| Christspiracy | 2024 | tt29630794 | 1211087 | new | 85 | 98 | — | 72 | — | 92.5 | 4 | 50404.27 | 2748.27 | 42 |
| Imagine Dragons Live in Vegas | 2023 | tt27805539 | 1128979 | new | 84 | 100 | — | 80 | — | 84 | 4 | 50389.058 | 2733.058 | 43 |
| 777 Charlie | 2022 | tt7466810 | 634120 | new | 87 | 94 | 100 | 76 | — | 77 | 5 | 50382.7 | 2726.7 | 43 |
| The Given Word | 1962 | tt0056322 | 59990 | new | 83 | 100 | — | 84 | — | 81 | 4 | 50382.436 | 2726.436 | 43 |
| Yuzuru Hanyu Ice Story GIFT at Tokyo Dome | 2023 | tt26919016 | 1093472 | new | 85 | 99 | — | 78 | — | 86 | 4 | 50382.436 | 2726.436 | 43 |
| King in the Wilderness | 2018 | tt7689960 | 493001 | new | 80 | 94 | 100 | 78 | 97 | 70 | 6 | 50365.878 | 2709.878 | 43 |
| Ramayana: The Legend of Prince Rama | 1997 | tt0259534 | 84092 | new | 91 | 96 | — | 78 | — | 83 | 4 | 50342.698 | 2686.698 | 43 |
| AlphaGo | 2017 | tt6700846 | 455008 | new | 78 | 100 | 100 | 78 | — | 77 | 5 | 50330.071 | 2674.071 | 43 |
| Spirited Away: Live on Stage | 2022 | tt26678995 | 1001196 | new | 86 | 98 | — | 84 | — | 80 | 4 | 50327.245 | 2671.245 | 43 |
| SIX: The Musical Live! | 2025 | tt35391146 | 1417019 | new | 83 | 95 | 93 | 80 | — | 84 | 5 | 50320.622 | 2664.622 | 44 |
| Be Here Now | 2015 | tt2473476 | 339158 | new | 85 | 93 | 100 | 76 | — | 80 | 5 | 50316.472 | 2660.472 | 44 |
| Project Hail Mary | 2026 | tt12042730 | 687163 | new | 82 | 95 | 95 | 86 | 77 | 86.36 | 6 | 50286.459 | 2630.459 | 44 |
| Sapta Sagaradaache Ello – Side A | 2023 | tt11992424 | 1168104 | new | 82 | 93 | 100 | 78 | — | 81 | 5 | 50281.15 | 2625.15 | 44 |
| Twenty Years Later | 1984 | tt0134402 | 86320 | new | 83 | 95 | — | 86 | — | 84 | 4 | 50227.902 | 2571.902 | 46 |
| La Strada | 1954 | tt0047528 | 405 | new | 80 | 93 | 98 | 84 | — | 79 | 5 | 50206.09 | 2550.09 | 46 |
| Oasis: Don't Look Back in Anger | 2026 | tt36150957 | 1447853 | new | 83 | 98 | 97 | 86 | 81 | 75 | 6 | 50205.826 | 2549.826 | 46 |
| A Dog's Will | 2000 | tt0271383 | 40096 | new | 86 | 94 | — | 84 | — | 84 | 4 | 50203.618 | 2547.618 | 46 |
| CMYLMZ | 2008 | tt1578118 | 80981 | new | 92 | — | — | 82 | — | 87 | 3 | 50183.749 | 2527.749 | 47 |
| Rush in Rio | 2003 | tt0390441 | 30658 | new | 88 | 100 | — | 76 | — | 83 | 4 | 50179.472 | 2523.472 | 47 |
| Mahanati | 2018 | tt7465992 | 459713 | new | 84 | 95 | 100 | 78 | — | 76 | 5 | 50157.876 | 2501.876 | 47 |
| Like Stars on Earth | 2007 | tt0986264 | 7508 | new | 83 | 96 | 93 | 82 | — | 80 | 5 | 50126.616 | 2470.616 | 48 |
| Eh Janam Tumhare Lekhe | 2015 | tt4280824 | 321675 | new | 86 | 100 | — | — | — | 74 | 3 | 50118.992 | 2462.992 | 49 |
| Nobody Knows | 2004 | tt0408664 | 2517 | new | 80 | 93 | 92 | 88 | 88 | 80 | 6 | 50114.209 | 2458.209 | 49 |
| Kaithi | 2019 | tt9900782 | 587030 | new | 84 | 93 | 100 | 80 | — | 76.1 | 5 | 50112.26 | 2456.26 | 49 |
| 2 Big to Rig | 2026 | tt43683692 | 1693400 | new | 86 | 99 | — | 84 | — | 78 | 4 | 50099.997 | 2443.997 | 49 |
| The Last Waltz | 1978 | tt0077838 | 13963 | new | 81 | 94 | 98 | 86 | 84 | 77 | 6 | 50093.237 | 2437.237 | 49 |
| Michael Jackson: HIStory Live | 1997 | tt7625046 | 90724 | new | 90 | — | — | 84 | — | 86.84 | 3 | 50087.005 | 2431.005 | 49 |
| The Cameraman | 1928 | tt0018742 | 31411 | new | 80 | 93 | 100 | 82 | — | 78 | 5 | 50065.156 | 2409.156 | 49 |
| Scenes from a Marriage | 1974 | tt6725014 | 133919 | new | 83 | 95 | 88 | 88 | — | 80 | 5 | 50042.726 | 2386.726 | 49 |
| The Dawn Wall | 2017 | tt7286916 | 489471 | new | 81 | 95 | 100 | 82 | 81 | 80.27 | 6 | 50018.479 | 2362.479 | 49 |
| To Be or Not to Be | 1942 | tt0035446 | 198 | new | 81 | 93 | 96 | 86 | 86 | 78 | 6 | 50004.932 | 2348.932 | 50 |
| Kaguya-sama: Love Is War - The First Kiss That Never Ends | 2022 | tt23770418 | 997317 | new | 85 | 100 | — | 82 | — | 79.57 | 4 | 49996.356 | 2340.356 | 50 |
| Hi Nanna | 2023 | tt25433734 | 1068452 | new | 83 | 96 | 100 | 74 | — | 79 | 5 | 49988.33 | 2332.33 | 50 |
| A Matter of Life and Death | 1946 | tt0038733 | 28162 | new | 80 | 93 | 97 | 86 | — | 77 | 5 | 49983.473 | 2327.473 | 50 |
| Lemonade | 2016 | tt5662106 | 394269 | new | 83 | 78 | 100 | 88 | — | 84 | 5 | 49972.435 | 2316.435 | 51 |
| Batman: Knightfall - Part 1: Knightfall | 2026 | tt32333324 | 1560520 | new | 78 | 94 | 92 | 78 | — | 91 | 5 | 49945.944 | 2289.944 | 51 |
| Little Mix: Glory Days - The Documentary | 2017 | tt7578850 | 489065 | new | 91 | — | — | 76 | — | 93 | 3 | 49935.759 | 2279.759 | 51 |
| Cria! | 1976 | tt0074360 | 51857 | new | 79 | 94 | 100 | 84 | — | 75 | 5 | 49917.686 | 2261.686 | 51 |
| Demon Slayer: Kimetsu no Yaiba Infinity Castle | 2025 | tt32820897 | 1311031 | new | 84 | 98 | 98 | 82 | 67 | 88 | 6 | 49915.523 | 2259.523 | 51 |
| Jogo de cena | 2007 | tt1165293 | 86321 | new | 84 | 93 | — | 86 | — | 84 | 4 | 49901.311 | 2245.311 | 51 |
| Black Sabbath: The End | 2017 | tt11918406 | 491193 | new | 87 | 100 | — | 76 | — | 83 | 4 | 49890.687 | 2234.687 | 52 |
| Il Sorpasso | 1962 | tt0056512 | 24188 | new | 82 | 93 | 92 | 84 | — | 82.35 | 5 | 49877.123 | 2221.123 | 52 |
| Make Way for Tomorrow | 1937 | tt0029192 | 41059 | new | 81 | 92 | 100 | 84 | — | 75 | 5 | 49860.288 | 2204.288 | 52 |
| Ballad of a Soldier | 1959 | tt0052600 | 46592 | new | 82 | 93 | 94 | 84 | — | 80 | 5 | 49853.224 | 2197.224 | 52 |
| 2000 Meters to Andriivka | 2025 | tt34964205 | 1400789 | new | 84 | 87 | 94 | 86 | 88 | 80.98 | 6 | 49846.822 | 2190.822 | 52 |
| The Young and the Damned | 1950 | tt0042804 | 800 | new | 82 | 95 | 91 | 84 | — | 81 | 5 | 49833.355 | 2177.355 | 53 |
| Forbidden Games | 1952 | tt0043686 | 5000 | new | 80 | 92 | 100 | 82 | — | 78 | 5 | 49822.758 | 2166.758 | 54 |
| Rammstein: Live in Berlin | 1999 | tt0207697 | 22099 | new | 91 | — | — | 80 | — | 89 | 3 | 49820.963 | 2164.963 | 54 |
| PNYC: Portishead - Roseland New York | 1997 | tt0133157 | 15520 | new | 89 | — | — | 90 | — | 81 | 3 | 49798.886 | 2142.886 | 54 |
| One Crazy Summer: A Look Back at Gravity Falls | 2018 | tt8660578 | 531326 | new | 88 | — | — | 90 | — | 82 | 3 | 49783.433 | 2127.433 | 55 |
| Better Days | 2019 | tt9586294 | 575813 | new | 76 | 97 | 97 | 84 | 83 | 81 | 6 | 49781.961 | 2125.961 | 56 |
| Robot Dreams | 2023 | tt13429870 | 838240 | new | 76 | 95 | 98 | 82 | 87 | 80 | 6 | 49779.754 | 2123.754 | 56 |
| Dune: Part Two | 2024 | tt15239678 | 693134 | new | 84 | 95 | 92 | 88 | 79 | 81 | 6 | 49772.027 | 2116.027 | 56 |
| The Shop on Main Street | 1965 | tt0059527 | 25905 | new | 82 | 94 | 100 | 84 | — | 71 | 5 | 49768.097 | 2112.097 | 57 |
| Godspeed | 2020 | tt14403480 | 779819 | new | 86 | — | — | 84 | — | 90 | 3 | 49765.772 | 2109.772 | 57 |
| Z | 1969 | tt0065234 | 2721 | new | 81 | 92 | 94 | 88 | 86 | 78 | 6 | 49765.404 | 2109.404 | 57 |
| Taylor Swift: Speak Now World Tour Live | 2011 | tt2103256 | 80009 | new | 88 | — | — | 88 | — | 84 | 3 | 49756.942 | 2100.942 | 57 |
| Two Trains Runnin' | 2016 | tt3738128 | 392163 | new | 77 | 100 | 100 | — | 81 | 72 | 5 | 49748.847 | 2092.847 | 57 |
| BTS the Comeback Live: Arirang | 2026 | tt39578533 | 1628123 | new | 86 | — | — | 88 | — | 86 | 3 | 49748.111 | 2092.111 | 57 |
| Grand Illusion | 1937 | tt0028950 | 777 | new | 80 | 92 | 97 | 84 | — | 79 | 5 | 49710.169 | 2054.169 | 57 |
| Primal: Tales of Savagery | 2020 | tt11191124 | 704264 | new | 84 | 94 | — | 84 | — | 84.23 | 4 | 49701.487 | 2045.487 | 58 |
| Jisoe | 2005 | tt0439649 | 24042 | new | 83 | — | — | 76 | — | 100 | 3 | 49699.543 | 2043.543 | 58 |
| Hope | 2017 | tt3153634 | 255709 | new | 82 | 96 | — | 84 | — | 84 | 4 | 49689.793 | 2033.793 | 58 |
| Kind Hearts and Coronets | 1949 | tt0041546 | 11898 | new | 80 | 93 | 100 | 82 | — | 76 | 5 | 49648.886 | 1992.886 | 59 |
| The Three Deaths of Marisela Escobedo | 2020 | tt13206564 | 753230 | new | 81 | 93 | — | 84 | — | 88 | 4 | 49643.433 | 1987.433 | 59 |
| Viduthalai: Part I | 2023 | tt11396310 | 786345 | new | 81 | 93 | 100 | 78 | — | 79 | 5 | 49633.432 | 1977.432 | 59 |
| Top Gun: Maverick | 2022 | tt1745960 | 361743 | new | 82 | 99 | 96 | 80 | 78 | 82 | 6 | 49615.286 | 1959.286 | 59 |
| War and Peace, Part III: The Year 1812 | 1967 | tt0062455 | 149467 | new | 83 | 100 | — | 86 | — | 76 | 4 | 49604.385 | 1948.385 | 60 |
| Divorce Italian Style | 1961 | tt0055913 | 20271 | new | 79 | 93 | 100 | 80 | — | 78.88 | 5 | 49603.538 | 1947.538 | 60 |
| Senna | 2010 | tt1424432 | 58496 | new | 84 | 95 | 93 | 86 | 79 | 80.98 | 6 | 49588.53 | 1932.53 | 60 |
| The Phantom of the Opera at the Royal Albert Hall | 2011 | tt2077886 | 76115 | new | 88 | — | — | 88 | — | 83.55 | 3 | 49587.694 | 1931.694 | 60 |
| South Beach Shark Club: Legends and Lore of the South Florida Shark Hunters | 2022 | tt18968266 | 934120 | new | 85 | 91 | 100 | — | — | 68 | 4 | 49585.483 | 1929.483 | 60 |
| Unforgivable Blackness: The Rise and Fall of Jack Johnson | 2004 | tt0413615 | 32063 | new | 83 | 95 | 100 | 80 | — | 72 | 5 | 49554.576 | 1898.576 | 61 |
| I Swear | 2025 | tt31514146 | 1317149 | new | 83 | 98 | 96 | 86 | 70 | 83 | 6 | 49554.576 | 1898.576 | 61 |
| Mirror | 1975 | tt0072443 | 1396 | new | 79 | 91 | 100 | 86 | 82 | 79 | 6 | 49542.434 | 1886.434 | 61 |
| Au Revoir les Enfants | 1987 | tt0092593 | 1786 | new | 80 | 93 | 97 | 84 | 88 | 75 | 6 | 49542.434 | 1886.434 | 61 |
| Jai Bhim | 2021 | tt15097216 | 855400 | new | 86 | 94 | 100 | 76 | — | 74 | 5 | 49539.123 | 1883.123 | 61 |
| The Cranes Are Flying | 1957 | tt0050634 | 38360 | new | 83 | 93 | 96 | 90 | 76 | 79 | 6 | 49529.188 | 1873.188 | 61 |
| How the Grinch Stole Christmas! | 1966 | tt0060345 | 13377 | new | 83 | 94 | 100 | 78 | — | 75.22 | 5 | 49528.767 | 1872.767 | 61 |
| Come from Away | 2021 | tt7638556 | 727333 | new | 85 | 92 | 98 | 84 | 83 | 75 | 6 | 49520.358 | 1864.358 | 61 |
| Day for Night | 1973 | tt0070460 | 1675 | new | 80 | 91 | 98 | 84 | — | 78 | 5 | 49512.013 | 1856.013 | 61 |
| Hans Zimmer & Friends: Diamond in the Desert | 2025 | tt35616060 | 1425725 | new | 84 | 97 | — | 82 | — | 82 | 4 | 49441.021 | 1785.021 | 63 |
| Sigur Rós: Heima | 2007 | tt1094594 | 14793 | new | 84 | 96 | 90 | 84 | — | 77 | 5 | 49436.954 | 1780.954 | 63 |
| Jujutsu Kaisen: Hidden Inventory / Premature Death - The Movie | 2025 | tt36956670 | 1338799 | new | 79 | 96 | — | 84 | — | 86 | 4 | 49436.606 | 1780.606 | 63 |
| A Silent Voice: The Movie | 2016 | tt5323662 | 378064 | new | 82 | 94 | 95 | 84 | 78 | 83.99 | 6 | 49427.991 | 1771.991 | 63 |
| National Theatre Live: Vanya | 2024 | tt29578220 | 1189877 | new | 84 | 100 | — | 88 | — | 72 | 4 | 49424.326 | 1768.326 | 63 |
| Dipu Number 2 | 1996 | tt1935109 | 93527 | new | 89 | — | — | 76 | — | 93.64 | 3 | 49410.712 | 1754.712 | 63 |
| Pyaasa | 1957 | tt0050870 | 41053 | new | 83 | 90 | 100 | 84 | — | 72.92 | 5 | 49401.78 | 1745.78 | 63 |
| In the Name of the Father | 1993 | tt0107207 | 7984 | new | 81 | 95 | 94 | 84 | 84 | 78.87 | 6 | 49400.569 | 1744.569 | 63 |
| Gintama: The Final | 2021 | tt10766468 | 732203 | new | 87 | — | — | 90 | — | 82 | 3 | 49399.306 | 1743.306 | 63 |
| Le Samouraï | 1967 | tt0062229 | 5511 | new | 80 | 93 | 92 | 84 | 90 | 78 | 6 | 49398.938 | 1742.938 | 63 |
| Batman: Under the Red Hood | 2010 | tt1569923 | 40662 | new | 80 | 92 | 100 | 80 | — | 78 | 5 | 49389.004 | 1733.004 | 63 |
| Metallica: S&M | 2000 | tt0271061 | 22724 | new | 88 | — | — | 84 | — | 87 | 3 | 49372.815 | 1716.815 | 65 |
| Dragon Inn | 1967 | tt0060635 | 104237 | new | 75 | 85 | 100 | 80 | 100 | 74 | 6 | 49369.135 | 1713.135 | 65 |
| Pink Floyd: Live at Pompeii | 1972 | tt0069090 | 25771 | new | 86 | — | 100 | 88 | 75 | 81 | 5 | 49364.72 | 1708.72 | 65 |
| To Live | 1994 | tt0110081 | 31439 | new | 83 | 96 | 87 | 84 | — | 81 | 5 | 49364.102 | 1708.102 | 65 |
| 2018 | 2023 | tt9006564 | 866440 | new | 83 | 96 | 100 | 74 | — | 76 | 5 | 49361.011 | 1705.011 | 65 |
| Maratonci trce pocasni krug | 1982 | tt0084302 | 29450 | new | 88 | 100 | — | 80 | — | 76 | 4 | 49353.682 | 1697.682 | 65 |
| A Trip to the Moon | 1902 | tt0000417 | 775 | new | 81 | 90 | 100 | 80 | — | 79 | 5 | 49338.229 | 1682.229 | 66 |
| The Cove | 2009 | tt1313104 | 23128 | new | 84 | 94 | 95 | 80 | 84 | 79.51 | 6 | 49334.741 | 1678.741 | 66 |
| Rocco and His Brothers | 1960 | tt0054248 | 8422 | new | 82 | 94 | 91 | 86 | 84 | 80 | 6 | 49332.71 | 1676.71 | 66 |
| Super/Man: The Christopher Reeve Story | 2024 | tt27902121 | 1128559 | new | 80 | 98 | 98 | 82 | 76 | 81 | 6 | 49306.218 | 1650.218 | 67 |
| Taylor Swift: Reputation Stadium Tour | 2018 | tt9426852 | 568332 | new | 85 | 88 | — | 90 | — | 81.99 | 4 | 49305.801 | 1649.801 | 67 |
| Human | 2015 | tt3327994 | 359364 | new | 86 | 91 | — | 84 | — | 84 | 4 | 49304.148 | 1648.148 | 68 |
| 96 | 2018 | tt7019842 | 441717 | new | 84 | 89 | 100 | 80 | — | 76.68 | 5 | 49276.215 | 1620.215 | 68 |
| Strangers on a Train | 1951 | tt0044079 | 845 | new | 79 | 92 | 98 | 82 | 88 | 76.58 | 6 | 49275.859 | 1619.859 | 68 |
| Central Station | 1998 | tt0140888 | 666 | new | 80 | 95 | 94 | 86 | 80 | 81 | 6 | 49249.924 | 1593.924 | 68 |
| I Am a Fugitive from a Chain Gang | 1932 | tt0023042 | 29740 | new | 82 | 91 | 96 | 82 | 87 | 78 | 6 | 49227.847 | 1571.847 | 69 |
| Bleach: Thousand-Year Blood War - The Calamity | 2026 | tt43383343 | 1669841 | new | 90 | 96 | — | 80 | — | 78 | 4 | 49221.224 | 1565.224 | 69 |
| Justice League: The Flashpoint Paradox | 2013 | tt2820466 | 183011 | new | 81 | 93 | 100 | 76 | — | 79 | 5 | 49217.516 | 1561.516 | 69 |
| Through a Glass Darkly | 1961 | tt0055499 | 11602 | new | 79 | 92 | 100 | 82 | 84 | 78 | 6 | 49195.837 | 1539.837 | 69 |
| The Twilight Samurai | 2002 | tt0351817 | 12496 | new | 80 | 94 | 99 | 82 | 82 | 78 | 6 | 49195.837 | 1539.837 | 69 |
| Sing Sing | 2024 | tt28479262 | 1155828 | new | 76 | 98 | 97 | 86 | 83 | 74 | 6 | 49174.864 | 1518.864 | 70 |
| White Heat | 1949 | tt0042041 | 15794 | new | 81 | 93 | 94 | 82 | 89 | 76.5 | 6 | 49167.414 | 1511.414 | 70 |
| Nero's Guests | 2009 | tt1756640 | 249650 | new | 92 | — | — | 76 | — | 90 | 3 | 49150.58 | 1494.58 | 70 |
| Pretty Village, Pretty Flame | 1997 | tt0116860 | 29927 | new | 86 | 95 | — | 84 | — | 79 | 4 | 49130.712 | 1474.712 | 71 |
| La Jetée | 1962 | tt0056119 | 662 | new | 82 | 93 | 90 | 86 | — | 79 | 5 | 49126.297 | 1470.297 | 71 |
| Early Summer | 1951 | tt0043313 | 50247 | new | 80 | 92 | 100 | 68 | 94 | 78.59 | 6 | 49120.102 | 1464.102 | 71 |
| The Salt of the Earth | 2014 | tt3674140 | 265297 | new | 84 | 90 | 94 | 84 | 83 | 81 | 6 | 49117.466 | 1461.466 | 71 |
| The Letter: An American Town and the 'Somali Invasion' | 2003 | tt0383460 | 253212 | new | 87 | — | — | — | 70 | 100 | 3 | 49103.484 | 1447.484 | 71 |
| Free Solo | 2018 | tt7775622 | 515042 | new | 81 | 93 | 97 | 82 | 83 | 79 | 6 | 49089.871 | 1433.871 | 71 |
| Kumbalangi Nights | 2019 | tt8413338 | 575351 | new | 85 | 94 | — | 84 | — | 81 | 4 | 49086.559 | 1430.559 | 71 |
| When We Were Kings | 1996 | tt0118147 | 10548 | new | 79 | 94 | 100 | 82 | 83 | 76 | 6 | 49082.144 | 1426.144 | 71 |
| Life of Crime 1984-2020 | 2021 | tt15119154 | 854345 | new | 84 | 93 | — | 86 | — | 81 | 4 | 49068.898 | 1412.898 | 71 |
| Meiyazhagan | 2024 | tt26758372 | 1136423 | new | 85 | 93 | — | 84 | — | 82 | 4 | 49060.068 | 1404.068 | 71 |
| Demon Slayer -Kimetsu no Yaiba- The Movie: Mugen Train | 2020 | tt11032374 | 635302 | new | 82 | 99 | 98 | 80 | 72 | 82 | 6 | 49050.133 | 1394.133 | 71 |
| Atomic People | 2024 | tt33049440 | 1299509 | new | 83 | — | 100 | 76 | — | 84 | 4 | 49039.233 | 1383.233 | 71 |
| National Theatre Live: Angels in America Part Two: Perestroika | 2017 | tt6847810 | 444460 | new | 89 | — | — | 88 | — | 81 | 3 | 49024.746 | 1368.746 | 71 |
| A Little Life | 2023 | tt28020183 | 1138074 | new | 86 | — | — | 82 | — | 90 | 3 | 49018.123 | 1362.123 | 71 |
| A Short Film About Love | 1988 | tt0095467 | 31056 | new | 81 | 93 | 95 | 82 | — | 78 | 5 | 49014.414 | 1358.414 | 71 |
| Bibi Rajni | 2024 | tt32526187 | 1339996 | new | 84 | 100 | — | — | — | 73 | 3 | 49010.764 | 1354.764 | 71 |
| The Quiet Girl | 2022 | tt15109082 | 916405 | new | 77 | 94 | 97 | 82 | 89 | 74.67 | 6 | 49003.342 | 1347.342 | 71 |
| Avengers: Endgame | 2019 | tt4154796 | 299534 | new | 84 | 96 | 94 | 80 | 78 | 82.46 | 6 | 49000.077 | 1344.077 | 71 |
| Gleason | 2016 | tt4632316 | 373446 | new | 83 | 90 | 96 | 82 | 80 | 84 | 6 | 48992.735 | 1336.735 | 71 |
| Pixote | 1980 | tt0082912 | 42148 | new | 79 | 93 | 94 | 84 | — | 79 | 5 | 48992.338 | 1336.338 | 71 |
| The Eighth Sense | 2023 | tt27161773 | 1097582 | new | 86 | — | — | 84 | — | 88 | 3 | 48991.631 | 1335.631 | 71 |
| Dog Day Afternoon | 1975 | tt0072890 | 968 | new | 80 | 90 | 94 | 86 | 86 | 79 | 6 | 48975.074 | 1319.074 | 72 |
| Inside Job | 2010 | tt1645089 | 44639 | new | 82 | 91 | 98 | 78 | 88 | 77 | 6 | 48971.763 | 1315.763 | 72 |
| The Remarkable Life of Ibelin | 2024 | tt19811010 | 1167027 | new | 81 | 95 | 97 | 82 | 78 | 81 | 6 | 48969.555 | 1313.555 | 72 |
| My Mom Jayne | 2025 | tt36464353 | 1461714 | new | 83 | 95 | 100 | 80 | 75 | 80 | 6 | 48941.96 | 1285.96 | 73 |
| Bangalore Days | 2014 | tt3668162 | 268660 | new | 83 | 89 | 100 | 80 | — | 76.11 | 5 | 48936.285 | 1280.285 | 73 |
| The Message | 1976 | tt0075143 | 881210 | new | 89 | — | — | 84 | — | 84.81 | 3 | 48926.582 | 1270.582 | 73 |
| The Phantom Carriage | 1921 | tt0012364 | 58129 | new | 80 | 89 | 100 | 82 | — | 77 | 5 | 48900.412 | 1244.412 | 75 |
| How to Make Millions Before Grandma Dies | 2024 | tt31392609 | 1103621 | new | 79 | 93 | 98 | 88 | 74 | 81.16 | 6 | 48899.955 | 1243.955 | 75 |
| 13th | 2016 | tt5895028 | 407806 | new | 82 | 90 | 97 | 86 | 81 | 78 | 6 | 48870.212 | 1214.212 | 75 |
| Sandhya Raagam | 1989 | tt0235742 | 338357 | new | 84 | — | — | 76 | — | 97 | 3 | 48851.815 | 1195.815 | 75 |
| The Way to the Heart | 2022 | tt14590480 | 987032 | new | 56 | 99 | — | — | — | 99 | 3 | 48836.362 | 1180.362 | 76 |
| STILL: A Michael J. Fox Movie | 2023 | tt19853258 | 1058699 | new | 81 | 95 | 99 | 82 | 78 | 77.77 | 6 | 48836.185 | 1180.185 | 76 |
| Godzilla Minus One | 2023 | tt23289160 | 940721 | new | 76 | 98 | 99 | 82 | 81 | 76 | 6 | 48834.89 | 1178.89 | 76 |
| John Mayer: Someday I'll Fly | 2014 | tt4661866 | 321091 | new | 86 | — | — | 76 | — | 95 | 3 | 48803.247 | 1147.247 | 76 |
| Le Clandestin | 1989 | tt7255020 | 414932 | new | 86 | — | — | 76 | — | 95 | 3 | 48803.247 | 1147.247 | 76 |
| Making of The Wild Pear Tree | 2018 | tt10688008 | 612167 | new | 83 | 83 | 94 | — | — | 83 | 4 | 48798.602 | 1142.602 | 76 |
| Beauty and the Beast | 1946 | tt0038348 | 648 | new | 79 | 90 | 95 | 82 | 92 | 75 | 6 | 48765.35 | 1109.35 | 77 |
| National Theatre Live: Frankenstein | 2011 | tt1795369 | 203912 | new | 85 | 100 | — | 80 | — | 77 | 4 | 48760.383 | 1104.383 | 77 |
| The Fog of War | 2003 | tt0317910 | 12698 | new | 80 | 93 | 96 | 80 | 87 | 77 | 6 | 48747.689 | 1091.689 | 77 |
| Steal This Story, Please! | 2026 | tt36748956 | 1492865 | new | 83 | — | 97 | 84 | 71 | 92 | 5 | 48735.723 | 1079.723 | 77 |
| The Unnamed | 2016 | tt5510934 | 418204 | new | 89 | 100 | — | 76 | — | 76.6 | 4 | 48734.31 | 1078.31 | 77 |
| Ernest & Celestine | 2012 | tt1816518 | 126319 | new | 78 | 89 | 98 | 84 | 86 | 78 | 6 | 48727.82 | 1071.82 | 77 |
| I Want to Eat Your Pancreas | 2018 | tt7236034 | 504253 | new | 81 | 92 | 93 | 80 | — | 82 | 5 | 48706.141 | 1050.141 | 77 |
| John Williams: Live in Vienna | 2020 | tt12888358 | 728463 | new | 88 | — | — | 78 | — | 91 | 3 | 48706.112 | 1050.112 | 77 |
| Scream for Me Sarajevo | 2017 | tt6481232 | 474594 | new | 86 | 87 | 100 | 76 | — | 78 | 5 | 48698.194 | 1042.194 | 77 |
| The Straight Story | 1999 | tt0166896 | 404 | new | 80 | 91 | 95 | 84 | 86 | 77 | 6 | 48663.799 | 1007.799 | 78 |
| Neil Peart: No One's Disciple | 2026 | tt44085358 | 1747920 | new | 87 | — | — | 80 | — | 90 | 3 | 48661.959 | 1005.959 | 78 |
| I Vitelloni | 1953 | tt0046521 | 12548 | new | 78 | 90 | 100 | 80 | 87 | 77 | 6 | 48658.28 | 1002.28 | 78 |
| Autumn Sonata | 1978 | tt0077711 | 12761 | new | 81 | 92 | 85 | 90 | — | 80 | 5 | 48653.158 | 997.158 | 78 |
| Angels in America: Part I - Millennium Approaches | 2017 | tt6846664 | 444459 | new | 88 | — | — | 88 | — | 81 | 3 | 48639.883 | 983.883 | 78 |
| Metallica: Live Shit - Binge & Purge, Seattle | 1993 | tt1700430 | 434084 | new | 90 | — | — | 82 | — | 85 | 3 | 48639.883 | 983.883 | 78 |
| Spring, Summer, Fall, Winter... and Spring | 2003 | tt0374546 | 113 | new | 80 | 92 | 94 | 84 | 85 | 78 | 6 | 48639.515 | 983.515 | 78 |
| Ram Ke Naam | 1992 | tt0105208 | 260669 | new | 88 | — | — | 82 | — | 87 | 3 | 48626.637 | 970.637 | 78 |
| Muse - Live at Rome Olympic Stadium | 2013 | tt3411614 | 240237 | new | 88 | — | — | 82 | — | 87 | 3 | 48626.637 | 970.637 | 78 |
| RRR | 2022 | tt8178634 | 579974 | new | 78 | 94 | 96 | 84 | 83 | 77.2 | 6 | 48612.847 | 956.847 | 79 |
| May It Last: A Portrait of the Avett Brothers | 2017 | tt6487050 | 438522 | new | 83 | 98 | 89 | 80 | — | 77 | 5 | 48607.681 | 951.681 | 79 |
| Perfect Days | 2023 | tt27503384 | 976893 | new | 79 | 93 | 96 | 86 | 80 | 78.23 | 6 | 48591.977 | 935.977 | 80 |
| Short Term 12 | 2013 | tt2370248 | 169813 | new | 79 | 92 | 98 | 84 | 82 | 77 | 6 | 48587.636 | 931.636 | 80 |
| September 11: The New Pearl Harbor | 2013 | tt3828916 | 299783 | new | 88 | 93 | — | 76 | — | 85 | 4 | 48583.772 | 927.772 | 81 |
| The Holdovers | 2023 | tt14849194 | 840430 | new | 79 | 92 | 97 | 86 | 82 | 76 | 6 | 48578.805 | 922.805 | 81 |
| Bad Genius | 2017 | tt6788942 | 455714 | new | 76 | 93 | 100 | 78 | — | 79 | 5 | 48577.746 | 921.746 | 81 |
| Microcosmos | 1996 | tt0117040 | 9305 | new | 79 | 91 | 97 | 82 | 87 | 76 | 6 | 48567.767 | 911.767 | 81 |
| Peter Gabriel: Growing Up Live | 2003 | tt0413108 | 24502 | new | 87 | 100 | — | 74 | — | 80 | 4 | 48545.829 | 889.829 | 81 |
| Les Misérables: The Staged Concert | 2019 | tt11229886 | 653151 | new | 86 | 100 | — | 84 | — | 70.77 | 4 | 48541.184 | 885.184 | 81 |
| Kiki's Delivery Service | 1989 | tt0097814 | 16859 | new | 78 | 89 | 98 | 84 | 85 | 78 | 6 | 48539.068 | 883.068 | 81 |
| The Second Mother | 2015 | tt3742378 | 310569 | new | 78 | 90 | 98 | 84 | 82 | 80 | 6 | 48532.445 | 876.445 | 81 |
| Sullivan's Travels | 1941 | tt0034240 | 16305 | new | 79 | 89 | 100 | 80 | 89 | 74 | 6 | 48522.511 | 866.511 | 81 |
| Mr. Dressup: The Magic of Make-Believe | 2023 | tt12277540 | 1154686 | new | 85 | 100 | 89 | 76 | — | 76 | 5 | 48520.347 | 864.347 | 81 |
| Simon of the Desert | 1965 | tt0059719 | 36265 | new | 78 | 91 | 100 | 80 | — | 77 | 5 | 48515.932 | 859.932 | 81 |
| Andhadhun | 2018 | tt8108198 | 534780 | new | 82 | 90 | 100 | 78 | — | 76 | 5 | 48504.894 | 848.894 | 81 |
| Thiruchitrambalam | 2022 | tt11772746 | 858067 | new | 79 | 96 | 100 | 76 | — | 74 | 5 | 48494.916 | 838.916 | 81 |
| Pépé le Moko | 1937 | tt0029453 | 26252 | new | 76 | 87 | 100 | 76 | 98 | 72.1 | 6 | 48483.226 | 827.226 | 81 |
| BTS Permission to Dance on Stage - Seoul: Live Viewing | 2022 | tt18687124 | 939984 | new | 79 | 86 | — | 88 | — | 89 | 4 | 48482.222 | 826.222 | 81 |
| The Thin Man | 1934 | tt0025878 | 3529 | new | 79 | 93 | 98 | 80 | 86 | 75.03 | 6 | 48478.911 | 822.911 | 81 |
| Batman: The Dark Knight Returns, Part 1 | 2012 | tt2313197 | 123025 | new | 79 | 93 | 100 | 76 | — | 77.43 | 5 | 48458.525 | 802.525 | 81 |
| The Last Laugh | 1924 | tt0015064 | 5991 | new | 80 | 88 | 100 | 80 | — | 78 | 5 | 48443.08 | 787.08 | 81 |
| The Human Condition I: No Greater Love | 1959 | tt0053114 | 31217 | new | 85 | 95 | 73 | 92 | — | 81 | 5 | 48416.589 | 760.589 | 81 |
| Who's Singin' Over There? | 1980 | tt0076276 | 17909 | new | 87 | 97 | — | 82 | — | 75 | 4 | 48415.579 | 759.579 | 81 |
| Harry Potter and the Deathly Hallows: Part 2 | 2011 | tt1201607 | 12445 | new | 81 | 89 | 96 | 80 | 85 | 80.8 | 6 | 48404.006 | 748.006 | 81 |
| Poetry | 2010 | tt1287878 | 47909 | new | 78 | 86 | 100 | 84 | 87 | 75.75 | 6 | 48394.538 | 738.538 | 81 |
| A Woman Under the Influence | 1974 | tt0072417 | 29845 | new | 80 | 91 | 88 | 88 | 88 | 77 | 6 | 48393.365 | 737.365 | 81 |
| Roman Holiday | 1953 | tt0046250 | 804 | new | 80 | 93 | 97 | 84 | 78 | 79 | 6 | 48390.053 | 734.053 | 81 |
| Paradise Lost 3: Purgatory | 2012 | tt2028530 | 83660 | new | 80 | 93 | 100 | 78 | 85 | 74 | 6 | 48384.534 | 728.534 | 81 |
| Sentimental Value | 2025 | tt27714581 | 1124566 | new | 77 | 94 | 95 | 84 | 86 | 74.69 | 6 | 48369.739 | 713.739 | 82 |
| Blackfish | 2013 | tt2545118 | 158999 | new | 81 | 90 | 98 | 80 | 83 | 79 | 6 | 48341.486 | 685.486 | 83 |
| Tantura | 2022 | tt16378034 | 913847 | new | 85 | 94 | 94 | 80 | 81 | 77 | 6 | 48332.655 | 676.655 | 83 |
| Paper Moon | 1973 | tt0070510 | 11293 | new | 81 | 95 | 91 | 88 | 77 | 79 | 6 | 48326.032 | 670.032 | 83 |
| The Exterminating Angel | 1962 | tt0056732 | 29264 | new | 79 | 92 | 94 | 82 | — | 79 | 5 | 48308.415 | 652.415 | 83 |
| The Broken Landlord | 1985 | tt0201368 | 31401 | new | 86 | 95 | — | 78 | — | 82 | 4 | 48307.405 | 651.405 | 83 |
| A Night to Remember | 1958 | tt0051994 | 10971 | new | 79 | 91 | 100 | 78 | — | 77 | 5 | 48302.852 | 646.852 | 85 |
| The Great Silence | 1968 | tt0063032 | 9028 | new | 77 | 89 | 100 | 84 | — | 75 | 5 | 48298.437 | 642.437 | 85 |
| Searching for Sugar Man | 2012 | tt2125608 | 84334 | new | 82 | 92 | 95 | 84 | 79 | 79 | 6 | 48292.918 | 636.918 | 85 |
| Anbe Sivam | 2003 | tt0367495 | 26910 | new | 86 | 94 | — | 84 | — | 76.94 | 4 | 48278.319 | 622.319 | 87 |
| Shahid | 2013 | tt2181831 | 128206 | new | 82 | 93 | 100 | 76 | — | 73.33 | 5 | 48268.112 | 612.112 | 87 |
| BTS World Tour 'Love Yourself' in Seoul | 2019 | tt9448868 | 568300 | new | 88 | — | — | 86 | — | 82 | 3 | 48246.926 | 590.926 | 87 |
| All the President's Men | 1976 | tt0074119 | 891 | new | 79 | 92 | 95 | 84 | 84 | 76.58 | 6 | 48243.794 | 587.794 | 87 |
| Homebound | 2025 | tt26733325 | 1227739 | new | 79 | 90 | 97 | 82 | 85 | 77.5 | 6 | 48242.418 | 586.418 | 87 |
| Lady Gaga Presents: The Monster Ball Tour at Madison Square Garden | 2011 | tt1843961 | 63513 | new | 84 | — | — | 86 | — | 86 | 3 | 48229.265 | 573.265 | 87 |
| One Love Manchester | 2017 | tt6970184 | 460492 | new | 86 | — | — | 86 | — | 84 | 3 | 48229.265 | 573.265 | 87 |
| Earthlings | 2005 | tt0358456 | 30238 | new | 86 | 92 | — | 82 | — | 81 | 4 | 48214.685 | 558.685 | 87 |
| Aguner Poroshmoni | 1994 | tt0383177 | 93526 | new | 90 | 96 | — | 76 | — | 78.21 | 4 | 48210.86 | 554.86 | 87 |
| The King of Kong: A Fistful of Quarters | 2007 | tt0923752 | 13958 | new | 80 | 93 | 97 | 80 | 83 | 77 | 6 | 48210.132 | 554.132 | 87 |
| A Bronx Tale | 1993 | tt0106489 | 1607 | new | 78 | 92 | 97 | 84 | 80 | 79.12 | 6 | 48206.792 | 550.792 | 87 |
| System Crasher | 2019 | tt8535968 | 567410 | new | 78 | 93 | 94 | 80 | 89 | 76 | 6 | 48199.094 | 543.094 | 87 |
| Sinners | 2025 | tt31193180 | 1233413 | new | 75 | 96 | 97 | 82 | 84 | 75 | 6 | 48186.952 | 530.952 | 87 |
| Dear You | 2026 | tt41791573 | 1671548 | new | 82 | 98 | 91 | 80 | 70 | 88 | 6 | 48184.744 | 528.744 | 88 |
| Breathless | 1960 | tt0053472 | 269 | new | 76 | 89 | 95 | 78 | 96 | 75 | 6 | 48178.121 | 522.121 | 88 |
| Eternity and a Day | 1998 | tt0156794 | 24858 | new | 78 | 93 | 95 | 86 | 80 | 78 | 6 | 48168.187 | 512.187 | 88 |
| Marcel the Shell with Shoes On | 2022 | tt15339456 | 869626 | new | 76 | 95 | 98 | 84 | 80 | 76 | 6 | 48167.083 | 511.083 | 88 |
| Attack on Titan: The Roar of Awakening | 2018 | tt7941892 | 492999 | new | 83 | 84 | — | 90 | — | 84 | 4 | 48166.117 | 510.117 | 88 |
| Wings of Desire | 1987 | tt0093191 | 144 | new | 79 | 93 | 95 | 86 | 79 | 78 | 6 | 48165.979 | 509.979 | 88 |
| SUGA \| Agust D TOUR 'D-DAY' THE MOVIE | 2024 | tt31579728 | 1254724 | new | 83 | 100 | — | 88 | — | 68 | 4 | 48150.664 | 494.664 | 89 |
| Honeyland | 2019 | tt8991268 | 566213 | new | 80 | 86 | 100 | 80 | 85 | 78.72 | 6 | 48145.932 | 489.932 | 89 |
| The Celebration | 1998 | tt0154420 | 309 | new | 80 | 94 | 91 | 86 | 82 | 77 | 6 | 48088.712 | 432.712 | 91 |
| Butterfly in the Sky | 2024 | tt15358498 | 893397 | new | 83 | 92 | 100 | 82 | 69 | 82 | 6 | 48084.297 | 428.297 | 91 |
| Woman in Motion | 2019 | tt4512946 | 549358 | new | 86 | 96 | 100 | 72 | — | 68 | 5 | 48063.722 | 407.722 | 91 |
| Black Woodstock | 1969 | — | 495644 | new | 80 | — | — | 84 | 96 | 80 | 4 | 48040.145 | 384.145 | 91 |
| Sardar Udham | 2021 | tt10280296 | 598826 | new | 83 | 94 | 95 | 80 | — | 71.96 | 5 | 48035.646 | 379.646 | 92 |
| Rangasthalam | 2018 | tt7392212 | 461126 | new | 82 | 91 | 100 | 78 | — | 72.39 | 5 | 48015.503 | 359.503 | 94 |
| Aladdin | 1992 | tt0103639 | 812 | new | 80 | 92 | 96 | 78 | 86 | 77 | 6 | 48003.719 | 347.719 | 94 |
| Concert for George | 2003 | tt0380275 | 28236 | new | 86 | 82 | 95 | 84 | 82 | 81 | 6 | 48000.407 | 344.407 | 94 |
| Fireworks | 1997 | tt0119250 | 5910 | new | 77 | 92 | 96 | 84 | 83 | 77 | 6 | 47997.096 | 341.096 | 94 |
| Dilwale Dulhania Le Jayenge | 2025 | tt0112870 | 19404 | new | 80 | 94 | 86 | 80 | — | 85 | 5 | 47995.992 | 339.992 | 94 |
| Angels with Dirty Faces | 1938 | tt0029870 | 13696 | new | 78 | 92 | 100 | 78 | — | 75.31 | 5 | 47984.127 | 328.127 | 95 |
| Monster | 2023 | tt23736044 | 1050035 | new | 78 | 90 | 97 | 86 | 79 | 79 | 6 | 47983.85 | 327.85 | 95 |
| Promises | 2001 | tt0282864 | 38880 | new | 83 | 96 | 96 | 78 | 80 | 75 | 6 | 47938.594 | 282.594 | 96 |
| Viridiana | 1962 | tt0055601 | 4497 | new | 80 | 90 | 97 | 80 | — | 77 | 5 | 47937.534 | 281.534 | 96 |
| Jeff Buckley: Live in Chicago | 2000 | tt0288581 | 41526 | new | 87 | — | — | 90 | — | 78 | 3 | 47936.386 | 280.386 | 96 |
| No Other Choice | 2025 | tt1527793 | 639988 | new | 75 | 93 | 97 | 82 | 86 | 75 | 6 | 47936.386 | 280.386 | 96 |
| Queen Live in Budapest | 2026 | tt0093427 | 142773 | new | 86 | 92 | 83 | 82 | — | 82 | 5 | 47929.763 | 273.763 | 96 |
| Young Frankenstein | 1974 | tt0072431 | 3034 | new | 80 | 92 | 95 | 80 | 83 | 79 | 6 | 47926.452 | 270.452 | 96 |
| If Anything Happens I Love You | 2020 | tt11768948 | 713776 | new | 78 | 92 | 100 | 76 | — | 77 | 5 | 47916.694 | 260.694 | 96 |
| The Crowd | 1928 | tt0018806 | 3061 | new | 80 | 90 | 96 | 82 | — | 76 | 5 | 47913.25 | 257.25 | 96 |
| Hiroshima Mon Amour | 1959 | tt0052893 | 5544 | new | 78 | 89 | 96 | 84 | — | 77 | 5 | 47902.212 | 246.212 | 96 |
| Grand Theft Auto VI: An Extended Look | 2026 | tt43749709 | 1744462 | new | 83 | — | — | 84 | — | 88.04 | 3 | 47881.021 | 225.021 | 96 |
| Pariyerum Perumal | 2018 | tt8176054 | 462718 | new | 86 | 88 | — | 84 | — | 82 | 4 | 47872.365 | 216.365 | 96 |
| Mickey's Christmas Carol | 1983 | tt0085936 | 14813 | new | 80 | 90 | 100 | 76 | — | 77 | 5 | 47863.711 | 207.711 | 96 |
| Love and Death | 1975 | tt0073312 | 11686 | new | 76 | 90 | 100 | 78 | 89 | 74 | 6 | 47858.015 | 202.015 | 96 |
| Taylor Swift: The 1989 World Tour Live | 2015 | tt5297750 | 373558 | new | 87 | — | — | 84 | — | 84 | 3 | 47856.912 | 200.912 | 96 |
| The Ox-Bow Incident | 1943 | tt0036244 | 980 | new | 80 | 91 | 92 | 84 | — | 77.06 | 5 | 47830.772 | 174.772 | 96 |
| National Theatre Live: Fleabag | 2019 | tt10702760 | 620350 | new | 83 | 69 | 100 | 92 | — | 78 | 5 | 47818.676 | 162.676 | 97 |
| Citizenfour | 2014 | tt4044364 | 293310 | new | 80 | 87 | 96 | 80 | 88 | 77.35 | 6 | 47808.369 | 152.369 | 98 |
| Everybody’s Everything | 2019 | tt9617716 | 576712 | new | 75 | 99 | 100 | 76 | 71 | 84 | 6 | 47793.994 | 137.994 | 98 |
| Cries and Whispers | 1972 | tt0069467 | 10238 | new | 79 | 90 | 92 | 84 | — | 79 | 5 | 47787.416 | 131.416 | 98 |
| Radical | 2023 | tt14570440 | 1058694 | new | 78 | 99 | 96 | 80 | 70 | 83 | 6 | 47784.06 | 128.06 | 98 |
| Faust | 1926 | tt0016847 | 10728 | new | 81 | 91 | 91 | 82 | — | 79 | 5 | 47771.962 | 115.962 | 98 |
| Wolf Children | 2012 | tt2140203 | 110420 | new | 81 | 92 | 95 | 82 | 76 | 82 | 6 | 47766.399 | 110.399 | 98 |
| The Cremator | 1969 | tt0063633 | 18352 | new | 80 | 91 | 89 | 86 | — | 78 | 5 | 47765.339 | 109.339 | 98 |
| Chainsaw Man - The Movie: Reze Arc | 2025 | tt30472557 | 1218925 | new | 83 | — | 96 | 88 | 71 | 85 | 5 | 47764.368 | 108.368 | 98 |
| Mitski: The Land | 2025 | tt38207459 | 1543360 | new | 83 | 99 | — | 86 | — | 70 | 4 | 47758.12 | 102.12 | 98 |
| Baraka | 1993 | tt0103767 | 14002 | new | 85 | 96 | 85 | 86 | 74 | 82 | 6 | 47753.153 | 97.153 | 98 |
| Castle in the Sky | 1986 | tt0092067 | 10515 | new | 80 | 91 | 97 | 82 | 78 | 79.72 | 6 | 47743.526 | 87.526 | 99 |
| High Noon | 1952 | tt0044706 | 288 | new | 79 | 89 | 94 | 80 | 89 | 77 | 6 | 47737.7 | 81.7 | 99 |
| Orpheus | 1950 | tt0041719 | 4558 | new | 78 | 89 | 97 | 82 | — | 77 | 5 | 47711.385 | 55.385 | 99 |
| Dosti | 1964 | tt0146645 | 172658 | new | 85 | 100 | — | 74 | — | 79 | 4 | 47709.553 | 53.553 | 99 |
| National Theatre Live: The Motive and the Cue | 2024 | tt23781890 | 1237527 | new | 85 | 100 | — | 78 | — | 75 | 4 | 47700.722 | 44.722 | 99 |
| Cléo from 5 to 7 | 1962 | tt0055852 | 499 | new | 78 | 89 | 93 | 84 | 87 | 77 | 6 | 47693.547 | 37.547 | 99 |
| In a Lonely Place | 1950 | tt0042593 | 17057 | new | 79 | 88 | 96 | 84 | — | 76 | 5 | 47673.855 | 17.855 | 100 |
| Manichitrathazhu | 1993 | tt0214915 | 84368 | new | 87 | 94 | — | 82 | — | 75.63 | 4 | 47665.601 | 9.601 | 100 |
| Rush: Beyond the Lighted Stage | 2010 | tt1545103 | 41120 | new | 84 | 94 | 90 | 80 | — | 75 | 5 | 47656.194 | 0.194 | 100 |

## Full insufficient-evidence table

| Title | Year | IMDb ID | TMDB ID | Canonical | IMDb | RT audience | RT critic | Letterboxd | MC critic | TMDB | Coverage | Residual | Margin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Asking the CEO of YouTube a question | 2026 | — | 1780453 | new | 100 | — | — | — | — | — | 1 | 66228.773 | 18572.773 |
| Barcelona - Madrid | 2020 | tt12372270 | — | new | 100 | — | — | — | — | — | 1 | 66228.773 | 18572.773 |
| Krishna - Makhan Chor | 2007 | tt6442984 | 867801 | new | — | — | — | — | — | 100 | 1 | 66228.773 | 18572.773 |
| Golpe de Asa | 1999 | tt0205974 | 690697 | new | 99 | — | — | — | — | 100 | 2 | 65568.693 | 17912.693 |
| La Trifulca I. Five Billion Dollar. A Trilogy | 2019 | tt10628318 | 642817 | new | 99 | — | — | — | — | 100 | 2 | 65568.693 | 17912.693 |
| Meu diário no fim do mundo: Edição futebol | 2020 | tt13865444 | 790643 | new | 99 | — | — | — | — | 100 | 2 | 65568.693 | 17912.693 |
| Bereaved | 2021 | tt13905860 | 680924 | new | 99 | — | — | — | — | 100 | 2 | 65568.693 | 17912.693 |
| minicômios | 2021 | tt14695042 | 840833 | new | 99 | — | — | — | — | 100 | 2 | 65568.693 | 17912.693 |
| Modulation | 2019 | tt14862388 | 847616 | new | 99 | — | — | — | — | 100 | 2 | 65568.693 | 17912.693 |
| THE QUEST: Everest VR | 2024 | tt15150372 | 1228325 | new | 99 | — | — | — | — | 100 | 2 | 65568.693 | 17912.693 |
| Shiksha O Tripura | 2022 | tt19399658 | 959505 | new | 99 | — | — | — | — | 100 | 2 | 65568.693 | 17912.693 |
| Love and Cocoa | 2022 | tt21741396 | 1156687 | new | 99 | — | — | — | — | 100 | 2 | 65568.693 | 17912.693 |
| Íris' Window | 2023 | tt26313658 | 1242790 | new | 99 | — | — | — | — | 100 | 2 | 65568.693 | 17912.693 |
| First Role | 2022 | tt26531517 | 1079388 | new | 99 | — | — | — | — | 100 | 2 | 65568.693 | 17912.693 |
| This Is Roundnet | 2023 | tt28061422 | 1192149 | new | 99 | — | — | — | — | 100 | 2 | 65568.693 | 17912.693 |
| Kacche | 2023 | tt28237049 | 1156679 | new | 99 | — | — | — | — | 100 | 2 | 65568.693 | 17912.693 |
| Variazioni, Opera Ultima | 2023 | tt28641522 | 1246343 | new | 99 | — | — | — | — | 100 | 2 | 65568.693 | 17912.693 |
| Perspective | 2010 | tt3072560 | 1217388 | new | 99 | — | — | — | — | 100 | 2 | 65568.693 | 17912.693 |
| Gatorama | 2024 | tt31692528 | 1257867 | new | 99 | — | — | — | — | 100 | 2 | 65568.693 | 17912.693 |
| Platonic | 2016 | tt5276154 | 945168 | new | 99 | — | — | — | — | 100 | 2 | 65568.693 | 17912.693 |
| Community Patrol | 2018 | tt7486402 | 519005 | new | 99 | — | — | — | — | 100 | 2 | 65568.693 | 17912.693 |
| Marina | 2013 | tt7972596 | 840845 | new | 99 | — | — | — | — | 100 | 2 | 65568.693 | 17912.693 |
| Beega | 2023 | tt26768535 | — | new | 99 | — | — | — | — | — | 1 | 64910.821 | 17254.821 |
| Anireekshitha Atithigalu | 2026 | tt36588979 | — | new | 98 | — | — | — | — | — | 1 | 63606.114 | 15950.114 |
| I Respond to You, God | 1996 | tt9673398 | — | new | 98 | — | — | — | — | — | 1 | 63606.114 | 15950.114 |
| What's New, Scooby-Doo? Vol. 7: Ghosts on the Go! | 2006 | — | 386024 | new | — | — | — | — | — | 98 | 1 | 63606.114 | 15950.114 |
| What's New Scooby-Doo? Vol. 10: Monstrous Tails | 2006 | — | 441348 | new | — | — | — | — | — | 98 | 1 | 63606.114 | 15950.114 |
| Bittersweet Memories: 14 Dias Isolados Para Fazer Um Álbum | 2023 | tt30590562 | 1555088 | new | 95 | — | — | — | — | 100 | 2 | 62972.525 | 15316.525 |
| Going Furthur | 2016 | tt5119202 | 401616 | new | 95 | — | — | — | — | 100 | 2 | 62972.525 | 15316.525 |
| I Forced an AI to Play a Kids Adventure Game | 2023 | tt41475193 | 1736225 | new | 94 | — | — | — | — | 100 | 2 | 62334.522 | 14678.522 |
| What's New Scooby-Doo? Vol. 3: Halloween Boos and Clues | 2004 | — | 414119 | new | — | — | — | — | — | 97 | 1 | 62314.653 | 14658.653 |
| Time and motion | 2019 | tt10738796 | — | new | 97 | — | — | — | — | — | 1 | 62314.653 | 14658.653 |
| Filthy Frank Final Full Lore Movie | 2018 | tt10895784 | — | new | 97 | — | — | — | — | — | 1 | 62314.653 | 14658.653 |
| Sri Jagannatha Daasaru | 2021 | tt16118492 | — | new | 97 | — | — | — | — | — | 1 | 62314.653 | 14658.653 |
| KambliHula | 2022 | tt23060836 | — | new | 97 | — | — | — | — | — | 1 | 62314.653 | 14658.653 |
| Yalakunni | 2024 | tt27349553 | — | new | 97 | — | — | — | — | — | 1 | 62314.653 | 14658.653 |
| Paramvah | 2023 | tt28363962 | — | new | 97 | — | — | — | — | — | 1 | 62314.653 | 14658.653 |
| From China with Love | 2025 | tt35694518 | — | new | 97 | — | — | — | — | — | 1 | 62314.653 | 14658.653 |
| Scooby-Doo! and the Werewolves | 2012 | — | 263311 | new | — | — | — | — | — | 96 | 1 | 61036.438 | 13380.438 |
| Scooby-Doo! and the Sea Monsters | 2012 | — | 414105 | new | — | — | — | — | — | 96 | 1 | 61036.438 | 13380.438 |
| Lagan | 2022 | tt14552832 | — | new | 96 | — | — | — | — | — | 1 | 61036.438 | 13380.438 |
| Wedding Gift | 2022 | tt15516018 | — | new | 96 | — | — | — | — | — | 1 | 61036.438 | 13380.438 |
| Nava Pappa | 2023 | tt27219252 | — | new | 96 | — | — | — | — | — | 1 | 61036.438 | 13380.438 |
| Rang De Basanti | 2024 | tt31591241 | — | new | 96 | — | — | — | — | — | 1 | 61036.438 | 13380.438 |
| Kandor Mane Kathe | 2024 | tt32528712 | — | new | 96 | — | — | — | — | — | 1 | 61036.438 | 13380.438 |
| Raakshasa | 2025 | tt35952270 | — | new | 96 | — | — | — | — | — | 1 | 61036.438 | 13380.438 |
| Theeyor Koodam | 2026 | tt41974682 | — | new | 96 | — | — | — | — | — | 1 | 61036.438 | 13380.438 |
| Common Man | 2026 | tt42191456 | — | new | 96 | — | — | — | — | — | 1 | 61036.438 | 13380.438 |
| Bhagyavantha | 1981 | tt0260737 | 1073609 | new | 91 | — | — | — | — | 100 | 2 | 60447.002 | 12791.002 |
| Barbenheimer and the Cult of Walt Disney | 2024 | tt33510862 | 1457215 | new | 91 | — | — | — | — | 100 | 2 | 60447.002 | 12791.002 |
| Validation: isolados por 7 dias para criar um álbum | 2022 | tt24805970 | 1539407 | new | 90 | — | — | — | — | 100 | 2 | 59826.659 | 12170.659 |
| Tell 'Em Steve-Dave Puppet Theatre | 2013 | tt2857196 | 187527 | new | 90 | — | — | — | — | 100 | 2 | 59826.659 | 12170.659 |
| Krishna - Kans Vadh | 2008 | tt6442890 | 867815 | new | 90 | — | — | — | — | 100 | 2 | 59826.659 | 12170.659 |
| Ratne price sa Kosara | 2019 | tt10156610 | — | new | 95 | — | — | — | — | — | 1 | 59771.468 | 12115.468 |
| Pichhodu | 2019 | tt11428992 | — | new | 95 | — | — | — | — | — | 1 | 59771.468 | 12115.468 |
| Jamalinte Punjiri | 2024 | tt16899902 | — | new | 95 | — | — | — | — | — | 1 | 59771.468 | 12115.468 |
| 90 Bidi Manig Nadi | 2023 | tt28080602 | — | new | 95 | — | — | — | — | — | 1 | 59771.468 | 12115.468 |
| The Incredibles | 2024 | tt32832609 | — | new | 95 | — | — | — | — | — | 1 | 59771.468 | 12115.468 |
| Mhanje Waghache Panje | 2025 | tt36048374 | — | new | 95 | — | — | — | — | — | 1 | 59771.468 | 12115.468 |
| Halgat | 2025 | tt36386357 | 1471002 | new | 95 | — | — | — | — | 95 | 2 | 59771.468 | 12115.468 |
| Pravas | 2025 | tt38644653 | — | new | 95 | — | — | — | — | — | 1 | 59771.468 | 12115.468 |
| Poonga | 2025 | tt39122445 | — | new | 95 | — | — | — | — | — | 1 | 59771.468 | 12115.468 |
| Picture Boyz | 2026 | tt40555293 | — | new | 95 | — | — | — | — | — | 1 | 59771.468 | 12115.468 |
| Loop | 2026 | tt42369038 | — | new | 95 | — | — | — | — | — | 1 | 59771.468 | 12115.468 |
| Pope | 2017 | tt4746216 | — | new | 95 | — | — | — | — | — | 1 | 59771.468 | 12115.468 |
| The Best Years Ever | 1994 | tt9686178 | — | new | 95 | — | — | — | — | — | 1 | 59771.468 | 12115.468 |
| Rush: Cinema Strangiato 2019 | 2019 | tt10471420 | 624474 | new | 89 | — | — | — | — | 100 | 2 | 59210.731 | 11554.731 |
| Avicii Tribute Concert: In Loving Memory of Tim Bergling | 2019 | tt11544236 | 654230 | new | 89 | — | — | — | — | 100 | 2 | 59210.731 | 11554.731 |
| Dear Audrey | 2021 | tt12980080 | 891447 | new | 89 | — | — | — | — | 100 | 2 | 59210.731 | 11554.731 |
| The Have Not | 2023 | tt16980022 | 1175663 | new | 89 | — | — | — | — | 100 | 2 | 59210.731 | 11554.731 |
| Bhale Unnade | 2024 | tt32089590 | 1321944 | new | 89 | — | — | — | — | 100 | 2 | 59210.731 | 11554.731 |
| Herr Puntila und sein Knecht Matti | 1966 | tt0136992 | 479851 | new | 99 | — | — | — | — | 90 | 2 | 59188.655 | 11532.655 |
| Die eiskalte Nacht | 1960 | tt0336358 | 286202 | new | 99 | — | — | — | — | 90 | 2 | 59188.655 | 11532.655 |
| Gandhada Gudi | 1973 | tt0279012 | 307400 | new | 88 | — | — | — | — | 100 | 2 | 58599.219 | 10943.219 |
| Torn from the Flag: A Film by Klaudia Kovacs | 2007 | tt0468559 | 300145 | new | 88 | — | — | — | — | 100 | 2 | 58599.219 | 10943.219 |
| A Lion in the House | 2006 | tt0492472 | — | new | 88 | — | 100 | — | — | — | 2 | 58599.219 | 10943.219 |
| Napozz Holddal - A Kispálfilm | 2010 | tt1727806 | 143557 | new | 88 | — | — | — | — | 100 | 2 | 58599.219 | 10943.219 |
| Wild Hungary - A Water Wonderland | 2011 | tt1980298 | 169506 | new | 88 | — | — | — | — | 100 | 2 | 58599.219 | 10943.219 |
| Croatia: Defining a Nation | 2022 | tt21048836 | 989033 | new | 88 | — | — | — | — | 100 | 2 | 58599.219 | 10943.219 |
| Scooby-Doo! and the Pirates | 2011 | — | 316272 | new | — | — | — | — | — | 94 | 1 | 58519.744 | 10863.744 |
| Sandcastles | 2004 | tt0414476 | — | new | 94 | — | — | — | — | — | 1 | 58519.744 | 10863.744 |
| House of Cards: Rust | 2021 | tt13992188 | — | new | 94 | — | — | — | — | — | 1 | 58519.744 | 10863.744 |
| Dhamaka | 2022 | tt21954370 | — | new | 94 | — | — | — | — | — | 1 | 58519.744 | 10863.744 |
| Kirik | 2025 | tt31158793 | — | new | 94 | — | — | — | — | — | 1 | 58519.744 | 10863.744 |
| Kanni | 2024 | tt32316129 | — | new | 94 | — | — | — | — | — | 1 | 58519.744 | 10863.744 |
| Sanatani | 2025 | tt34996226 | — | new | 94 | — | — | — | — | — | 1 | 58519.744 | 10863.744 |
| Bolo Har Har Shambhu | 2025 | tt35873301 | — | new | 94 | — | — | — | — | — | 1 | 58519.744 | 10863.744 |
| Ashtapadi | 2025 | tt37021145 | — | new | 94 | — | — | — | — | — | 1 | 58519.744 | 10863.744 |
| Bad Girlz | 2025 | tt38045101 | — | new | 94 | — | — | — | — | — | 1 | 58519.744 | 10863.744 |
| Oru Wayanadan Kadha | 2025 | tt38961336 | — | new | 94 | — | — | — | — | — | 1 | 58519.744 | 10863.744 |
| Gangs of Raipur | 2025 | tt39052988 | — | new | 94 | — | — | — | — | — | 1 | 58519.744 | 10863.744 |
| Toss | 2026 | tt39315064 | — | new | 94 | — | — | — | — | — | 1 | 58519.744 | 10863.744 |
| Fallout: Echos of the Wasteland | 2026 | tt41834765 | — | new | 94 | — | — | — | — | — | 1 | 58519.744 | 10863.744 |
| Psychic | 2026 | tt42191325 | — | new | 94 | — | — | — | — | — | 1 | 58519.744 | 10863.744 |
| Maa Bhoomi | 1979 | tt0137925 | 260782 | new | 87 | — | — | — | — | 100 | 2 | 57992.122 | 10336.122 |
| Social Media Monster | 2021 | tt11506798 | 1017145 | new | 87 | — | — | — | — | 100 | 2 | 57992.122 | 10336.122 |
| Alya | 2023 | tt14417286 | 1194195 | new | 87 | — | — | — | — | 100 | 2 | 57992.122 | 10336.122 |
| Boome Satellites in Texas | 2022 | tt15301994 | 865149 | new | 87 | — | — | — | — | 100 | 2 | 57992.122 | 10336.122 |
| Il tricheco che voleva troppo | 2023 | tt27095808 | 1164987 | new | 87 | — | — | — | — | 100 | 2 | 57992.122 | 10336.122 |
| Love Mein | 2025 | tt5873376 | 1424042 | new | 87 | — | — | — | — | 100 | 2 | 57992.122 | 10336.122 |
| Andaz Tera Mera | 2025 | tt6463730 | 1423729 | new | 87 | — | — | — | — | 100 | 2 | 57992.122 | 10336.122 |
| A Weekend of Deceased Persons | 1988 | tt0339865 | 249084 | new | 86 | — | — | — | — | 100 | 2 | 57389.44 | 9733.44 |
| Boys in the Sky | 2003 | tt0370928 | 613700 | new | 86 | — | — | — | — | 100 | 2 | 57389.44 | 9733.44 |
| Saving Luna | 2007 | tt1140873 | 71810 | new | 86 | — | — | — | — | 100 | 2 | 57389.44 | 9733.44 |
| Son Bulusma | 2008 | tt1566624 | 246691 | new | 86 | — | — | — | — | 100 | 2 | 57389.44 | 9733.44 |
| 10 Nahi 40 | 2022 | tt7705476 | 989114 | new | 86 | — | — | — | — | 100 | 2 | 57389.44 | 9733.44 |
| Dropping Gear | 2019 | tt12009844 | 703008 | new | 99 | — | — | — | — | 87 | 2 | 57360.741 | 9704.741 |
| Antaryatri Mahapurush (The Walking God) | 2022 | tt16226960 | — | new | 93 | — | — | — | — | — | 1 | 57281.266 | 9625.266 |
| Monk the Young | 2025 | tt23857668 | — | new | 93 | — | — | — | — | — | 1 | 57281.266 | 9625.266 |
| OC | 2024 | tt32423806 | — | new | 93 | — | — | — | — | — | 1 | 57281.266 | 9625.266 |
| Madurai 16 | 2025 | tt38116840 | — | new | 93 | — | — | — | — | — | 1 | 57281.266 | 9625.266 |
| Life Today | 2026 | tt39821515 | — | new | 93 | — | — | — | — | — | 1 | 57281.266 | 9625.266 |
| Dharmasthala Niyojakavargam | 2026 | tt39917515 | — | new | 93 | — | — | — | — | — | 1 | 57281.266 | 9625.266 |
| Khakee(Khaki) | 2026 | tt40247289 | — | new | 93 | — | — | — | — | — | 1 | 57281.266 | 9625.266 |
| São Paulo: 447th Anniversary | 2001 | tt6081240 | — | new | 93 | — | — | — | — | — | 1 | 57281.266 | 9625.266 |
| The Flip Side: A Truth That Could Not Reach You | 2015 | tt6321972 | — | new | 93 | — | — | — | — | — | 1 | 57281.266 | 9625.266 |
| Nanak Naam Jahaz Hai | 1969 | tt0142681 | 277555 | new | 85 | — | — | — | — | 100 | 2 | 56791.173 | 9135.173 |
| Decak iz Junkovca | 1996 | tt0254254 | 338468 | new | 85 | — | — | — | — | 100 | 2 | 56791.173 | 9135.173 |
| Na Ninna Mareyalare | 1976 | tt0334007 | 1073509 | new | 85 | — | — | — | — | 100 | 2 | 56791.173 | 9135.173 |
| Secret of the Ninth | 2021 | tt13898300 | 789174 | new | 85 | — | — | — | — | 100 | 2 | 56791.173 | 9135.173 |
| MST - Terra Prometida | 2025 | tt36934451 | 1485844 | new | 85 | — | — | — | — | 100 | 2 | 56791.173 | 9135.173 |
| An Inconvenient Study | 2025 | tt38687502 | 1564451 | new | 85 | — | — | — | — | 100 | 2 | 56791.173 | 9135.173 |
| Tower of Song: A Memorial Tribute to Leonard Cohen | 2018 | tt7586752 | 496196 | new | 85 | — | — | — | — | 100 | 2 | 56791.173 | 9135.173 |
| Svet Koji Nestaje | 1987 | tt1852112 | 203042 | new | 95 | — | — | — | — | 90 | 2 | 56680.792 | 9024.792 |
| Manavoori Pandavulu | 1978 | tt0155853 | 714721 | new | 84 | — | — | — | — | 100 | 2 | 56197.322 | 8541.322 |
| Chibideka monogatari | 1958 | tt0407643 | 97232 | new | 84 | — | — | — | — | 100 | 2 | 56197.322 | 8541.322 |
| Enemy Image | 2005 | tt0485898 | 419732 | new | 84 | — | — | — | — | 100 | 2 | 56197.322 | 8541.322 |
| Yaren | 2019 | tt10985972 | 1252548 | new | 84 | — | — | — | — | 100 | 2 | 56197.322 | 8541.322 |
| Chidiakhana | 2023 | tt14188316 | 1137429 | new | 84 | — | — | — | — | 100 | 2 | 56197.322 | 8541.322 |
| Dada Lakhmi | 2022 | tt14677728 | 1091609 | new | 84 | — | — | — | — | 100 | 2 | 56197.322 | 8541.322 |
| Krishna in Vrindavan | 2007 | tt6443066 | 867806 | new | 84 | — | — | — | — | 100 | 2 | 56197.322 | 8541.322 |
| BTS 2021 Muster: Sowoozoo Day 2 | 2021 | — | 863291 | new | — | — | — | — | — | 92 | 1 | 56056.034 | 8400.034 |
| Opulence | 2019 | tt11256052 | — | new | 92 | — | — | — | — | — | 1 | 56056.034 | 8400.034 |
| Surveillance Camera Man | 2018 | tt13587614 | 1483705 | new | 92 | — | — | — | — | — | 1 | 56056.034 | 8400.034 |
| Oppanda | 2022 | tt15137146 | — | new | 92 | — | — | — | — | — | 1 | 56056.034 | 8400.034 |
| Siri Lambodara Vivaha | 2023 | tt15434200 | — | new | 92 | — | — | — | — | — | 1 | 56056.034 | 8400.034 |
| Deck of Cards | 2022 | tt21986824 | — | new | 92 | — | — | — | — | — | 1 | 56056.034 | 8400.034 |
| Sarkari Baccha | 2025 | tt22796670 | — | new | 92 | — | — | — | — | — | 1 | 56056.034 | 8400.034 |
| Haya | 2022 | tt23049420 | — | new | 92 | — | — | — | — | — | 1 | 56056.034 | 8400.034 |
| Brahma Kamala | 2026 | tt27773916 | — | new | 92 | — | — | — | — | — | 1 | 56056.034 | 8400.034 |
| Bilichukki Hallihakki | 2025 | tt33983494 | — | new | 92 | — | — | — | — | — | 1 | 56056.034 | 8400.034 |
| Kanasondu Shuruvagide | 2025 | tt35657788 | — | new | 92 | — | — | — | — | — | 1 | 56056.034 | 8400.034 |
| Hey Chikittha | 2026 | tt35836621 | — | new | 92 | — | — | — | — | — | 1 | 56056.034 | 8400.034 |
| Bhalobasa.Com | 2025 | tt36858379 | — | new | 92 | — | — | — | — | — | 1 | 56056.034 | 8400.034 |
| Missterious | 2025 | tt37275151 | — | new | 92 | — | — | — | — | — | 1 | 56056.034 | 8400.034 |
| Monster | 2024 | tt37897393 | — | new | 92 | — | — | — | — | — | 1 | 56056.034 | 8400.034 |
| Sherr | 2026 | tt42952864 | — | new | 92 | — | — | — | — | — | 1 | 56056.034 | 8400.034 |
| Trenches of Rock | 2019 | tt4329396 | — | new | 92 | — | — | — | — | — | 1 | 56056.034 | 8400.034 |
| Balidaan | 1997 | tt6566022 | — | new | 92 | — | — | — | — | — | 1 | 56056.034 | 8400.034 |
| Jajabara 2.0 | 2024 | tt31410023 | 1104327 | new | 83 | — | — | — | — | 100 | 2 | 55607.886 | 7951.886 |
| Abel Ernest Tembo's Suspect | 2026 | tt31638629 | 1409643 | new | 83 | — | — | — | — | 100 | 2 | 55607.886 | 7951.886 |
| No Land's Man | 2021 | tt3996192 | 856836 | new | 83 | — | — | — | — | 100 | 2 | 55607.886 | 7951.886 |
| Sikuru Hathe | 2007 | tt4871740 | 564190 | new | 87 | — | — | — | — | 96 | 2 | 55493.089 | 7837.089 |
| Leaving Home: The Life and Music of Indian Ocean | 2008 | tt1401130 | 156175 | new | 88 | — | — | — | — | 95 | 2 | 55475.428 | 7819.428 |
| Gothalo | 1996 | tt5093808 | 495223 | new | 88 | — | — | — | — | 95 | 2 | 55475.428 | 7819.428 |
| Bangarada Manushya | 1972 | tt0315255 | 310767 | new | 89 | — | — | — | — | 94 | 2 | 55462.183 | 7806.183 |
| Launder Run | 2014 | tt4029958 | 1424316 | new | 85 | — | — | — | — | 97 | 2 | 54923.522 | 7267.522 |
| Pinjra | 1972 | tt0316406 | 300920 | new | 87 | — | — | — | — | 95 | 2 | 54879.369 | 7223.369 |
| Cholay | 2024 | tt5798156 | 1424012 | new | 88 | — | — | — | — | 94 | 2 | 54863.916 | 7207.916 |
| Carnaval fi Dachra | 1994 | tt6852206 | 414902 | new | 90 | — | — | — | — | 92 | 2 | 54846.255 | 7190.255 |
| BTS World Tour: Love Yourself - Japan Edition | 2019 | — | 665399 | new | — | — | — | — | — | 91 | 1 | 54844.047 | 7188.047 |
| La bicicleta de los Huanca | 2007 | — | 628442 | new | — | — | — | — | — | 91 | 1 | 54844.047 | 7188.047 |
| I'm Not Surprised | 2019 | tt10934482 | — | new | 91 | — | — | — | — | — | 1 | 54844.047 | 7188.047 |
| Doraleous and Associates | 2010 | tt1753729 | — | new | 91 | — | — | — | — | — | 1 | 54844.047 | 7188.047 |
| Long Drive | 2023 | tt21211580 | — | new | 91 | — | — | — | — | — | 1 | 54844.047 | 7188.047 |
| South Indian Hero | 2023 | tt22489250 | — | new | 91 | — | — | — | — | — | 1 | 54844.047 | 7188.047 |
| Terror | 2026 | tt24499568 | — | new | 91 | — | — | — | — | — | 1 | 54844.047 | 7188.047 |
| Fearless Vampire Killers: At War with the Thirst | 2013 | tt2617724 | — | new | 91 | — | — | — | — | — | 1 | 54844.047 | 7188.047 |
| Black Sheep | 2025 | tt28456271 | — | new | 91 | — | — | — | — | — | 1 | 54844.047 | 7188.047 |
| Konchem Hatke | 2024 | tt28520479 | — | new | 91 | — | — | — | — | — | 1 | 54844.047 | 7188.047 |
| Back Benchers | 2024 | tt32359454 | — | new | 91 | — | — | — | — | — | 1 | 54844.047 | 7188.047 |
| Racket | 2025 | tt36690033 | — | new | 91 | — | — | — | — | — | 1 | 54844.047 | 7188.047 |
| Posco 307 | 2025 | tt36721788 | — | new | 91 | — | — | — | — | — | 1 | 54844.047 | 7188.047 |
| Triguni | 2025 | tt36955610 | — | new | 91 | — | — | — | — | — | 1 | 54844.047 | 7188.047 |
| Taane C/O Srirampura | 2025 | tt37172842 | — | new | 91 | — | — | — | — | — | 1 | 54844.047 | 7188.047 |
| Varta | 2025 | tt37813976 | — | new | 91 | — | — | — | — | — | 1 | 54844.047 | 7188.047 |
| Maamaram | 2025 | tt37818091 | — | new | 91 | — | — | — | — | — | 1 | 54844.047 | 7188.047 |
| KKK: 3 Raja | 2026 | tt40233043 | — | new | 91 | — | — | — | — | — | 1 | 54844.047 | 7188.047 |
| Hope for What We Do Not See | 2016 | tt6779266 | — | new | 91 | — | — | — | — | — | 1 | 54844.047 | 7188.047 |
| Jeevan Sangharsha | 1995 | tt17493572 | 1427618 | new | 84 | — | — | — | — | 97 | 2 | 54336.293 | 6680.293 |
| Grey Games | 2024 | tt15654332 | 1206057 | new | 86 | — | — | — | — | 95 | 2 | 54287.726 | 6631.726 |
| Lucent | 2014 | tt4134784 | 346645 | new | 86 | — | — | — | — | 95 | 2 | 54287.726 | 6631.726 |
| Chunauti | 1996 | tt5093788 | 1425860 | new | 87 | — | — | — | — | 94 | 2 | 54270.065 | 6614.065 |
| The Godfather Trilogy: 1901-1980 | 1992 | tt0150742 | 364150 | new | 93 | — | — | — | — | 88 | 2 | 54256.819 | 6600.819 |
| THEVR10: A dokumentumfilm | 2023 | tt28970800 | 1174716 | new | 89 | — | — | — | — | 92 | 2 | 54247.988 | 6591.988 |
| Druglawed | 2015 | tt4450674 | 340012 | new | 91 | — | — | — | — | 90 | 2 | 54243.573 | 6587.573 |
| The Flowering Tree | 1992 | tt0231348 | 534197 | new | 83 | — | — | — | — | 97 | 2 | 53753.48 | 6097.48 |
| August | 2024 | tt32126803 | 1278741 | new | 85 | — | — | — | — | 95 | 2 | 53700.497 | 6044.497 |
| Da Vinci | 2024 | tt33455770 | 1374264 | new | 85 | — | — | — | — | 95 | 2 | 53700.497 | 6044.497 |
| EXO PLANET #2 The EXO'luxion in Japan | 2016 | — | 672490 | new | — | — | — | — | — | 90 | 1 | 53645.306 | 5989.306 |
| Wizards of Waverly Place: Wizard School | 2008 | — | 77982 | new | — | — | — | — | — | 90 | 1 | 53645.306 | 5989.306 |
| Smoke and Mirrors: A History of Denial | 1999 | tt0230796 | 426462 | new | 90 | — | — | — | — | 90 | 2 | 53645.306 | 5989.306 |
| Seeds | 2004 | tt0385157 | 1545082 | existing | 90 | — | — | — | — | 90 | 2 | 53645.306 | 5989.306 |
| The 14th February & Beyond | 2020 | tt10895566 | — | new | 90 | — | — | — | — | — | 1 | 53645.306 | 5989.306 |
| Scooby-Doo's A Nutcracker Scoob | 1984 | tt1183445 | 48919 | new | — | — | — | — | — | 90 | 1 | 53645.306 | 5989.306 |
| Travel from Moscow to St. Petersburg on the ship Nikolai Karamzin | 2020 | tt12180672 | — | new | 90 | — | — | — | — | — | 1 | 53645.306 | 5989.306 |
| Cheruvaina Dooramaina | 2021 | tt12861616 | — | new | 90 | — | — | — | — | — | 1 | 53645.306 | 5989.306 |
| Kasturi Nivasa | 1971 | tt1416733 | 609343 | new | 90 | — | — | — | — | 90 | 2 | 53645.306 | 5989.306 |
| Niggers | 2009 | tt2087894 | — | new | 90 | — | — | — | — | — | 1 | 53645.306 | 5989.306 |
| Howling at the Moon | 2011 | tt2169050 | — | new | 90 | — | — | — | — | — | 1 | 53645.306 | 5989.306 |
| Sean and Melissa: 10 Years Later | 2012 | tt2177711 | — | new | 90 | — | — | — | — | — | 1 | 53645.306 | 5989.306 |
| Seeking the First Dinosaur Hunters | 2022 | tt22037128 | — | new | 90 | — | — | — | — | — | 1 | 53645.306 | 5989.306 |
| The Epic Journey | 2015 | tt2632928 | — | new | 90 | — | — | — | — | — | 1 | 53645.306 | 5989.306 |
| Golden Legends | 2023 | tt27033088 | 1092230 | new | — | — | — | — | — | 90 | 1 | 53645.306 | 5989.306 |
| Daniel El Travieso Una Aventura Familiar | 2023 | tt29257921 | 1190476 | new | 90 | — | — | — | — | 90 | 2 | 53645.306 | 5989.306 |
| Tax Broke | 2024 | tt30841470 | 1229765 | new | — | — | — | — | — | 90 | 1 | 53645.306 | 5989.306 |
| I 20 | 2024 | tt32485455 | — | new | 90 | — | — | — | — | — | 1 | 53645.306 | 5989.306 |
| Marali Manasaagide | 2026 | tt38491456 | — | new | 90 | — | — | — | — | — | 1 | 53645.306 | 5989.306 |
| Jerriyude Aanmakkal | 2025 | tt38568283 | — | new | 90 | — | — | — | — | — | 1 | 53645.306 | 5989.306 |
| Bharathi Teacher | 2026 | tt39366591 | — | new | 90 | — | — | — | — | — | 1 | 53645.306 | 5989.306 |
| Spies Are Forever | 2016 | tt5891144 | — | new | 90 | — | — | — | — | — | 1 | 53645.306 | 5989.306 |
| Generation: Freedom | 2019 | tt6487784 | — | new | 90 | — | — | — | — | — | 1 | 53645.306 | 5989.306 |
| Legends of War | 2019 | tt9426254 | — | new | 90 | — | — | — | — | — | 1 | 53645.306 | 5989.306 |
| Bei tag und bei nacht oder der hund des gärtners | 1957 | tt0336015 | 525039 | new | 99 | — | — | — | — | 80 | 2 | 53250.141 | 5594.141 |
| Wild Horses: A Tale from the Puszta | 2021 | tt15477976 | 891413 | new | 83 | — | — | — | — | 96 | 2 | 53144.175 | 5488.175 |
| The Ukrainians | 2015 | tt5868596 | 327688 | new | 84 | — | — | — | — | 95 | 2 | 53117.684 | 5461.684 |
| WWE WrestleMania X-Seven | 2001 | tt0282267 | 209740 | new | 91 | — | — | — | — | 88 | 2 | 53055.87 | 5399.87 |
| România Salbatica | 2021 | tt15416740 | 869834 | new | 91 | — | — | — | — | 88 | 2 | 53055.87 | 5399.87 |
| Bhootayyana Maga Ayyu | 1974 | tt0313312 | 233056 | new | 89 | — | — | — | — | 90 | 2 | 53051.455 | 5395.455 |
| Markiplier from North Korea | 2022 | tt23752540 | 1473862 | new | 91 | — | — | — | — | 87 | 2 | 52468.642 | 4812.642 |
| Mr Jinnah: The Making of Pakistan | 1997 | tt0246792 | 781783 | new | 88 | — | — | — | — | 90 | 2 | 52462.019 | 4806.019 |
| Ashta Vinayak | 1979 | tt0258431 | 305209 | new | 88 | — | — | — | — | 90 | 2 | 52462.019 | 4806.019 |
| Bedara Kannappa | 1954 | tt0273458 | 279417 | new | 88 | — | — | — | — | 90 | 2 | 52462.019 | 4806.019 |
| Raj Kapoor | 1987 | tt0483785 | 1414248 | new | 88 | — | — | — | — | 90 | 2 | 52462.019 | 4806.019 |
| Bhagyavantharu | 1977 | tt1401709 | 1074593 | new | 88 | — | — | — | — | 90 | 2 | 52462.019 | 4806.019 |
| BTS 2021 Muster: Sowoozoo Day 1 | 2021 | — | 839976 | new | — | — | — | — | — | 89 | 1 | 52459.811 | 4803.811 |
| Budapest - the capital of Hungary | 2019 | tt11426730 | — | new | 89 | — | — | — | — | — | 1 | 52459.811 | 4803.811 |
| Helsreach: The Movie | 2019 | tt12820524 | — | new | 89 | — | — | — | — | — | 1 | 52459.811 | 4803.811 |
| Yello Jogappa Ninnaramane | 2025 | tt26923729 | — | new | 89 | — | — | — | — | — | 1 | 52459.811 | 4803.811 |
| Abhiramachandra | 2023 | tt29420709 | — | new | 89 | — | — | — | — | — | 1 | 52459.811 | 4803.811 |
| L Jagadamma 7 B State First | 2025 | tt33245915 | — | new | 89 | — | — | — | — | — | 1 | 52459.811 | 4803.811 |
| SiMP | 2026 | tt37674883 | — | new | 89 | — | — | — | — | — | 1 | 52459.811 | 4803.811 |
| Sholay: The Final Cut | 2025 | tt39151096 | — | new | 89 | — | — | — | — | — | 1 | 52459.811 | 4803.811 |
| Ichata Love Ammabadunu Konabadunu | 2026 | tt40223697 | — | new | 89 | — | — | — | — | — | 1 | 52459.811 | 4803.811 |
| Bolagolam | 2026 | tt42273710 | — | new | 89 | — | — | — | — | — | 1 | 52459.811 | 4803.811 |
| Feedback | 2017 | tt6175402 | — | new | 89 | — | — | — | — | — | 1 | 52459.811 | 4803.811 |
| Buzzfeed Unsolved: 3 Horrifying Cases of Ghosts and Demons | 2016 | tt6190796 | — | new | 89 | — | — | — | — | — | 1 | 52459.811 | 4803.811 |
| Awakening | 2015 | tt7600054 | — | new | 89 | — | — | — | — | — | 1 | 52459.811 | 4803.811 |
| The Moment of Change | 2017 | tt7636058 | — | new | 89 | — | — | — | — | — | 1 | 52459.811 | 4803.811 |
| George Michael Freedom: The Director's Cut | 2018 | tt8000146 | — | new | 89 | — | — | — | — | — | 1 | 52459.811 | 4803.811 |
| Dark Shadows and Beyond - The Jonathan Frid Story | 2021 | tt16227726 | 884220 | new | 83 | — | — | — | — | 94 | 2 | 51938.812 | 4282.812 |
| The Last Shepherd | 2012 | tt2315610 | 160219 | new | 83 | — | — | — | — | 94 | 2 | 51938.812 | 4282.812 |
| 19.20.21 | 2023 | tt21842984 | 1094599 | new | 87 | — | — | — | — | 90 | 2 | 51876.998 | 4220.998 |
| A Horse Named Winx | 2024 | tt32323344 | 1317408 | new | 87 | — | — | — | — | 90 | 2 | 51876.998 | 4220.998 |
| Ruta | 2018 | tt7953386 | 508291 | new | 87 | — | — | — | — | 90 | 2 | 51876.998 | 4220.998 |
| Beneath the Helmet | 2014 | tt4221060 | 321146 | new | 83 | — | — | — | — | 93 | 2 | 51342.753 | 3686.753 |
| Manto | 2015 | tt4943992 | 421337 | new | 83 | — | — | — | — | 93 | 2 | 51342.753 | 3686.753 |
| Moleman 4: Longplay | 2017 | tt5891492 | 461695 | new | 84 | — | — | — | — | 92 | 2 | 51322.884 | 3666.884 |
| The Last Just Man | 2002 | tt0355680 | 63058 | new | 91 | — | — | — | — | 85 | 2 | 51307.431 | 3651.431 |
| Sugihara: Conspiracy of Kindness | 2000 | tt0258224 | 276060 | new | 86 | — | — | — | — | 90 | 2 | 51296.393 | 3640.393 |
| Surya Vamsha | 1999 | tt13572142 | 1281377 | new | 86 | — | — | — | — | 90 | 2 | 51296.393 | 3640.393 |
| Bulbule | 2021 | tt14332510 | 1009059 | new | 86 | — | — | — | — | 90 | 2 | 51296.393 | 3640.393 |
| Sammarth | 2026 | tt43679089 | 1747939 | new | 86 | — | — | — | — | 90 | 2 | 51296.393 | 3640.393 |
| Katyar Kaljat Ghusali | 2015 | tt5190958 | 368330 | new | 87 | — | — | — | — | 89 | 2 | 51289.77 | 3633.77 |
| Pieces of a Dream | 2005 | tt0440974 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| Hip Hop Get Down | 2003 | tt0446354 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| Impact | 2004 | tt0466841 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| Love Sorries | 2021 | tt14742596 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| Star War the Third Gathers: The Backstroke of the West | 2010 | tt18183916 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| In Medias Res | 2011 | tt1954538 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| Jurisdiction | 2012 | tt2185170 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| Ovalley | 2022 | tt23785710 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| Pourusham - The Manhood | 2025 | tt30457867 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| Vaaradhi | 2024 | tt35157624 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| Suthradaari | 2025 | tt36266954 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| Mother Mary | 2025 | tt36671015 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| Aagakadavana | 2025 | tt36949582 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| 1st Day 1st Show | 2025 | tt37421468 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| Napaas | 2025 | tt38682734 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| Bozeman | 2025 | tt38952504 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| Six: The Way Home | 2026 | tt39372712 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| Unsolved Mysteries: Original Robert Stack Episodes | 1989 | tt6844314 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| Escape from the Devil's Den | 2017 | tt7411252 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| Blessed Are the Poor in Spirit | 2016 | tt7599200 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| Yazh | 2017 | tt7681554 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| From the End Into the Beginning | 2016 | tt8244674 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| Unutulmaz Maçlar | 2005 | tt8367070 | — | new | 88 | — | — | — | — | — | 1 | 51287.562 | 3631.562 |
| Kanyasulkam | 1955 | tt0252590 | 86134 | new | 85 | — | — | — | — | 90 | 2 | 50720.202 | 3064.202 |
| Sri Shirdi Saibaba Mahathyam | 1986 | tt0283005 | 80832 | new | 85 | — | — | — | — | 90 | 2 | 50720.202 | 3064.202 |
| Dale | 2007 | tt0815140 | 139010 | new | 85 | — | — | — | — | 90 | 2 | 50720.202 | 3064.202 |
| Moscow. Dormitory area | 2020 | tt11802110 | 786644 | new | 90 | — | — | — | — | 85 | 2 | 50720.202 | 3064.202 |
| Regresar al Final | 2022 | tt12749438 | 985248 | new | 85 | — | — | — | — | 90 | 2 | 50720.202 | 3064.202 |
| Bangaarada Panjara | 1973 | tt1407940 | 830651 | new | 85 | — | — | — | — | 90 | 2 | 50720.202 | 3064.202 |
| Alor Michil | 1974 | tt5076822 | 685140 | new | 85 | — | — | — | — | 90 | 2 | 50720.202 | 3064.202 |
| 250 Stepenika | 2017 | tt7622496 | 554870 | new | 90 | — | — | — | — | 85 | 2 | 50720.202 | 3064.202 |
| Vigilantes Inc.: America's New Vote Suppression Hitmen | 2024 | tt22439720 | 1048484 | new | 88 | — | — | — | — | 87 | 2 | 50706.957 | 3050.957 |
| 45 Days: The Fight for a Nation | 2021 | tt15196204 | 903458 | new | 94 | — | — | — | — | 80 | 2 | 50236.732 | 2580.732 |
| University Square: Romania | 1991 | tt0138020 | 655484 | new | 91 | — | — | — | — | 83 | 2 | 50163.881 | 2507.881 |
| Queen: Magic Years, Volume Two - A Visual Anthology | 1987 | tt0157956 | 770738 | new | 84 | — | — | — | — | 90 | 2 | 50148.427 | 2492.427 |
| Victory at Sea | 1954 | tt0232902 | 443948 | new | 84 | — | — | — | — | 90 | 2 | 50148.427 | 2492.427 |
| The Himmler Project | 2000 | tt0266624 | 153399 | new | 84 | — | — | — | — | 90 | 2 | 50148.427 | 2492.427 |
| Ragat | 1997 | tt0301762 | 1426732 | new | 84 | — | — | — | — | 90 | 2 | 50148.427 | 2492.427 |
| The Gold Bracelet | 2006 | tt0421061 | 277440 | new | 84 | — | — | — | — | 90 | 2 | 50148.427 | 2492.427 |
| Panghrun | 2019 | tt11146760 | 938477 | new | 84 | — | — | — | — | 90 | 2 | 50148.427 | 2492.427 |
| Dahan | 1985 | tt1189030 | 470275 | new | 84 | — | — | — | — | 90 | 2 | 50148.427 | 2492.427 |
| A Dog Named Gucci | 2015 | tt3588852 | 543357 | new | 84 | — | — | — | — | 90 | 2 | 50148.427 | 2492.427 |
| The Importance of Being Earnest on Stage | 2015 | tt5280954 | 375206 | new | 84 | — | — | — | — | 90 | 2 | 50148.427 | 2492.427 |
| 90 Years of PAOK: Nostalgia for the Future | 2016 | tt5588280 | 430388 | new | 86 | — | — | — | — | 88 | 2 | 50130.766 | 2474.766 |
| Chaar Sahibzaade 2: Rise of Banda Singh Bahadur | 2016 | tt6246170 | 425694 | new | 86 | — | — | — | — | 88 | 2 | 50130.766 | 2474.766 |
| Closure | 2007 | tt0810803 | — | new | 87 | — | — | — | — | — | 1 | 50128.559 | 2472.559 |
| Loving Neverland | 2020 | tt13092932 | 1769973 | new | 87 | — | — | — | — | — | 1 | 50128.559 | 2472.559 |
| Guru Shishyaru | 1981 | tt1344112 | — | new | 87 | — | — | — | — | — | 1 | 50128.559 | 2472.559 |
| Love Is a Thieves' Game | 2011 | tt1380912 | — | new | 87 | — | — | — | — | — | 1 | 50128.559 | 2472.559 |
| Brandy Diaries | 2021 | tt15192796 | — | new | 87 | — | — | — | — | — | 1 | 50128.559 | 2472.559 |
| Groufie | 2021 | tt15210472 | — | new | 87 | — | — | — | — | — | 1 | 50128.559 | 2472.559 |
| Bhala Chora Bhala | 2022 | tt16901072 | — | new | 87 | — | — | — | — | — | 1 | 50128.559 | 2472.559 |
| Karma (Nepal Bhasa Movie) | 2022 | tt18689606 | — | new | 87 | — | — | — | — | — | 1 | 50128.559 | 2472.559 |
| Bypass Road | 2022 | tt22528322 | — | new | 87 | — | — | — | — | — | 1 | 50128.559 | 2472.559 |
| Uruttu Factory | 2024 | tt33810459 | — | new | 87 | — | — | — | — | — | 1 | 50128.559 | 2472.559 |
| Blindsided | 2025 | tt36092525 | — | new | 87 | — | — | — | — | — | 1 | 50128.559 | 2472.559 |
| Kousalya Tanaya Ragava | 2025 | tt36460794 | — | new | 87 | — | — | — | — | — | 1 | 50128.559 | 2472.559 |
| Tale of Phantom a Love Story | 2023 | tt37534500 | — | new | 87 | — | — | — | — | — | 1 | 50128.559 | 2472.559 |
| Groom from Mars | 2026 | tt41947892 | — | new | 87 | — | — | — | — | — | 1 | 50128.559 | 2472.559 |
| Stay Out of My Business | 2017 | tt7637558 | — | new | 87 | — | — | — | — | — | 1 | 50128.559 | 2472.559 |
| The Lord of the Rings - The Appendices Part 1: From Book to Vision | 2002 | tt9810488 | — | new | 87 | — | — | — | — | — | 1 | 50128.559 | 2472.559 |
| Trance: The Cathy O'Brien Story | 2022 | tt18311204 | 1322970 | new | 93 | — | — | — | — | 80 | 2 | 49647.296 | 1991.296 |
| Der Klosterjäger | 1920 | tt0011369 | 628413 | new | 83 | — | — | — | — | 90 | 2 | 49581.067 | 1925.067 |
| Saptapadi | 1961 | tt0055411 | 366056 | new | 83 | — | — | — | — | 90 | 2 | 49581.067 | 1925.067 |
| Mera spored mera | 1981 | tt0082728 | 336617 | new | 83 | — | — | — | — | 90 | 2 | 49581.067 | 1925.067 |
| Dopatta | 1952 | tt0150422 | 876392 | new | 83 | — | — | — | — | 90 | 2 | 49581.067 | 1925.067 |
| The Power of Good: Nicholas Winton | 2002 | tt0328499 | 433239 | new | 83 | — | — | — | — | 90 | 2 | 49581.067 | 1925.067 |
| 8/12 Binay Badal Dinesh | 2022 | tt17493272 | 854269 | new | 83 | — | — | — | — | 90 | 2 | 49581.067 | 1925.067 |
| Vakondok 2 - Demoscene | 2011 | tt2170661 | 102108 | new | 83 | — | — | — | — | 90 | 2 | 49581.067 | 1925.067 |
| Bahrain: Shouting in the Dark | 2011 | tt2203745 | 337655 | new | 83 | — | — | — | — | 90 | 2 | 49581.067 | 1925.067 |
| Supercar Saints | 2025 | tt25955828 | 1412869 | new | 83 | — | — | — | — | 90 | 2 | 49581.067 | 1925.067 |
| Resacón en China | 2019 | tt11378230 | 660282 | new | 88 | — | — | — | — | 85 | 2 | 49558.991 | 1902.991 |
| Premada Kanike | 1976 | tt1399073 | 301665 | new | 86 | — | — | — | — | 87 | 2 | 49554.576 | 1898.576 |
| Shankar Guru | 1978 | tt1401730 | 835304 | new | 86 | — | — | — | — | 87 | 2 | 49554.576 | 1898.576 |
| Disappearing Oasis, Last Oasis | 1983 | tt0247628 | 203706 | new | 94 | — | — | — | — | 78 | 2 | 49124.089 | 1468.089 |
| The Rise and Fall of Timex Dundee | 2019 | tt11153078 | 817523 | new | 92 | — | — | — | — | 80 | 2 | 49062.275 | 1406.275 |
| One Heart: The A.R. Rahman Concert Film | 2017 | tt6484956 | 482346 | new | 84 | — | — | — | — | 88 | 2 | 48991.631 | 1335.631 |
| Jeff Lynne's ELO: Wembley or Bust | 2017 | tt7474562 | 487784 | new | 88 | — | — | — | — | 84 | 2 | 48991.631 | 1335.631 |
| Paduvarahalli Pandavaru | 1978 | tt0232252 | 305904 | new | 87 | — | — | — | — | 85 | 2 | 48985.008 | 1329.008 |
| Kavirathna Kaalidaasa | 1983 | tt0309764 | 512995 | new | 87 | — | — | — | — | 85 | 2 | 48985.008 | 1329.008 |
| Buamama | 1985 | tt0328912 | 538898 | new | 87 | — | — | — | — | 85 | 2 | 48985.008 | 1329.008 |
| Calvinist | 2017 | tt7444934 | 478553 | new | 85 | — | — | — | — | 87 | 2 | 48985.008 | 1329.008 |
| Kolej Havasi | 2019 | tt7520068 | 630514 | new | 87 | — | — | — | — | 85 | 2 | 48985.008 | 1329.008 |
| Ricardo Arjona, Circo Soledad En Vivo | 2019 | — | 671643 | new | — | — | — | — | — | 86 | 1 | 48982.801 | 1326.801 |
| Franco Escamilla: RPM | 2020 | — | 707533 | new | — | — | — | — | — | 86 | 1 | 48982.801 | 1326.801 |
| BLACKPINK ARENA TOUR [SPECIAL FINAL IN OSAKA] | 2018 | — | 714187 | new | — | — | — | — | — | 86 | 1 | 48982.801 | 1326.801 |
| Janma Bhoomi | 1995 | tt0305692 | 1425389 | new | 86 | — | — | — | — | 86 | 2 | 48982.801 | 1326.801 |
| Unknown Passage: The Dead Moon Story | 2006 | tt0396913 | — | new | 86 | — | — | — | — | — | 1 | 48982.801 | 1326.801 |
| Madonna: The Immaculate Collection | 1990 | tt0500162 | 284582 | new | 86 | — | — | — | — | 86 | 2 | 48982.801 | 1326.801 |
| Canceling | 2020 | tt11540082 | — | new | 86 | — | — | — | — | — | 1 | 48982.801 | 1326.801 |
| Najva Ashorai | 2008 | tt1179449 | — | new | 86 | — | — | — | — | — | 1 | 48982.801 | 1326.801 |
| 1997 | 2021 | tt15417090 | — | new | 86 | — | — | — | — | — | 1 | 48982.801 | 1326.801 |
| Made in China | 2022 | tt15516780 | — | new | 86 | — | — | — | — | — | 1 | 48982.801 | 1326.801 |
| Mia Palia Fotografia | 2005 | tt1765914 | — | new | 86 | — | — | — | — | — | 1 | 48982.801 | 1326.801 |
| Chiclets 2K Kids | 2024 | tt33475704 | — | new | 86 | — | — | — | — | — | 1 | 48982.801 | 1326.801 |
| Inky | 2025 | tt37344893 | — | new | 86 | — | — | — | — | — | 1 | 48982.801 | 1326.801 |
| Brotherhood of Blades Kill Evil | 2024 | tt37517198 | — | new | 86 | — | — | — | — | — | 1 | 48982.801 | 1326.801 |
| The Legend of Man and Loong | 2024 | tt37897669 | — | new | 86 | — | — | — | — | — | 1 | 48982.801 | 1326.801 |
| Sugriva | 2026 | tt39558804 | — | new | 86 | — | — | — | — | — | 1 | 48982.801 | 1326.801 |
| Rayudu Gari Thaluka | 2026 | tt40329244 | — | new | 86 | — | — | — | — | — | 1 | 48982.801 | 1326.801 |
| The Sketch Comedy Movie 2 | 2026 | tt40550717 | — | new | 86 | — | — | — | — | — | 1 | 48982.801 | 1326.801 |
| Kalagamanam | 2026 | tt41527740 | — | new | 86 | — | — | — | — | — | 1 | 48982.801 | 1326.801 |
| Billy Joel: Live at Shea Stadium | 2011 | tt4238832 | — | new | 86 | — | — | — | — | — | 1 | 48982.801 | 1326.801 |
| Brumville | 2018 | tt6522392 | — | new | 86 | — | — | — | — | — | 1 | 48982.801 | 1326.801 |
| The Invisible Life of Thomas Lynch | 2009 | tt1284066 | 253436 | new | 91 | — | — | — | — | 80 | 2 | 48481.67 | 825.67 |
| The Blizzard of AAHHH's | 1988 | tt0094760 | 28378 | new | 83 | — | — | — | — | 88 | 2 | 48428.687 | 772.687 |
| From the River to the Sea: The Frontiers of Faith | 2024 | tt34881149 | 1368683 | new | 83 | — | — | — | — | 88 | 2 | 48428.687 | 772.687 |
| 30 Years and 15 Minutes | 2020 | tt12865416 | 757018 | new | 84 | — | — | — | — | 87 | 2 | 48419.856 | 763.856 |
| Daari Tappida Maga | 1975 | tt1414477 | 608121 | new | 84 | — | — | — | — | 87 | 2 | 48419.856 | 763.856 |
| Queen: Magic Years, Volume One - A Visual Anthology | 1987 | tt0158745 | 770732 | new | 86 | — | — | — | — | 85 | 2 | 48415.441 | 759.441 |
| 17 Mayis | 2005 | tt0913349 | 651679 | new | 86 | — | — | — | — | 85 | 2 | 48415.441 | 759.441 |
| Adrenalin: The BMW Touring Car Story | 2014 | tt4265816 | 312911 | new | 85 | — | — | — | — | 86 | 2 | 48415.441 | 759.441 |
| Chhatrapati Shivaji | 1952 | tt0252316 | 270296 | new | 90 | — | — | — | — | 80 | 2 | 47905.479 | 249.479 |
| Arvydas Sabonis 11 | 2014 | tt4225230 | 304873 | new | 88 | — | — | — | — | 82 | 2 | 47870.157 | 214.157 |
| Partisans of Vilna | 1986 | tt0091726 | 193937 | new | 83 | — | — | — | — | 87 | 2 | 47859.119 | 203.119 |
| Lava Kusa | 1963 | tt0206877 | 183167 | new | 83 | — | — | — | — | 87 | 2 | 47859.119 | 203.119 |
| Michael Jackson Video Greatest Hits: HIStory | 1995 | tt0167988 | 45865 | new | 86 | — | — | — | — | 84 | 2 | 47852.496 | 196.496 |
| HIStory on Film, Volume II | 1997 | tt0168070 | 30621 | new | 84 | — | — | — | — | 86 | 2 | 47852.496 | 196.496 |
| Shut Up and Deal | 2007 | tt0972571 | — | new | 85 | — | — | — | — | — | 1 | 47850.289 | 194.289 |
| The Dark Knight: The Ballad of the N Word | 2018 | tt10378660 | — | new | 85 | — | — | — | — | — | 1 | 47850.289 | 194.289 |
| Vol. 1 Dream the Name Is Rogells (Ruggells) | 2011 | tt1316072 | — | new | 85 | — | — | — | — | — | 1 | 47850.289 | 194.289 |
| God Lives in the Himalayas | 2009 | tt1519638 | — | new | 85 | — | — | — | — | — | 1 | 47850.289 | 194.289 |
| Le Shuru Hoge Maya Ke Kahani | 2023 | tt23848044 | — | new | 85 | — | — | — | — | — | 1 | 47850.289 | 194.289 |
| Line in the Sand | 2024 | tt33829507 | 1362257 | new | 85 | — | — | — | — | 85 | 2 | 47850.289 | 194.289 |
| Gumti | 2024 | tt34531109 | — | new | 85 | — | — | — | — | — | 1 | 47850.289 | 194.289 |
| Citizen Glenn | 2024 | tt35286402 | — | new | 85 | — | — | — | — | — | 1 | 47850.289 | 194.289 |
| Khancha | 2026 | tt35344016 | — | new | 85 | — | — | — | — | — | 1 | 47850.289 | 194.289 |
| Premaku Jai: True Love Never Ends | 2025 | tt36411755 | — | new | 85 | — | — | — | — | — | 1 | 47850.289 | 194.289 |
| Mission of Love | 2016 | tt7600122 | — | new | 85 | — | — | — | — | — | 1 | 47850.289 | 194.289 |
| Chal Man Jeetva Jaiye | 2017 | tt8185004 | 552553 | new | 85 | — | — | — | — | 85 | 2 | 47850.289 | 194.289 |
| Michael Jackson: Smooth Criminal (II) | 1988 | tt9106768 | — | new | 85 | — | — | — | — | — | 1 | 47850.289 | 194.289 |
| The Coronation of King George VI | 1937 | tt0189444 | 252337 | new | 99 | — | — | — | — | 70 | 2 | 47753.153 | 97.153 |
| Word on the Street | 2008 | tt1351276 | 256900 | new | 99 | — | — | — | — | 70 | 2 | 47753.153 | 97.153 |

- Asking the CEO of YouTube a question (2026), 1780453: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH, TMDB_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Barcelona - Madrid (2020), tt12372270: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:network. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Krishna - Makhan Chor (2007), tt6442984: actual tmdb:rating; missing imdb:rating, rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, TMDB_DETAILS, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Golpe de Asa (1999), tt0205974: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- La Trifulca I. Five Billion Dollar. A Trilogy (2019), tt10628318: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Meu diário no fim do mundo: Edição futebol (2020), tt13865444: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Bereaved (2021), tt13905860: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- minicômios (2021), tt14695042: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Modulation (2019), tt14862388: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- THE QUEST: Everest VR (2024), tt15150372: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Shiksha O Tripura (2022), tt19399658: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Love and Cocoa (2022), tt21741396: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Íris' Window (2023), tt26313658: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- First Role (2022), tt26531517: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- This Is Roundnet (2023), tt28061422: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Kacche (2023), tt28237049: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Variazioni, Opera Ultima (2023), tt28641522: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Perspective (2010), tt3072560: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Gatorama (2024), tt31692528: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Platonic (2016), tt5276154: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Community Patrol (2018), tt7486402: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Marina (2013), tt7972596: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Beega (2023), tt26768535: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Anireekshitha Atithigalu (2026), tt36588979: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- I Respond to You, God (1996), tt9673398: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- What's New, Scooby-Doo? Vol. 7: Ghosts on the Go! (2006), 386024: actual tmdb:rating; missing imdb:rating, rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- What's New Scooby-Doo? Vol. 10: Monstrous Tails (2006), 441348: actual tmdb:rating; missing imdb:rating, rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Bittersweet Memories: 14 Dias Isolados Para Fazer Um Álbum (2023), tt30590562: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Going Furthur (2016), tt5119202: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- I Forced an AI to Play a Kids Adventure Game (2023), tt41475193: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- What's New Scooby-Doo? Vol. 3: Halloween Boos and Clues (2004), 414119: actual tmdb:rating; missing imdb:rating, rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Time and motion (2019), tt10738796: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Filthy Frank Final Full Lore Movie (2018), tt10895784: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Sri Jagannatha Daasaru (2021), tt16118492: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- KambliHula (2022), tt23060836: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Yalakunni (2024), tt27349553: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Paramvah (2023), tt28363962: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- From China with Love (2025), tt35694518: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Scooby-Doo! and the Werewolves (2012), 263311: actual tmdb:rating; missing imdb:rating, rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Scooby-Doo! and the Sea Monsters (2012), 414105: actual tmdb:rating; missing imdb:rating, rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Lagan (2022), tt14552832: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Wedding Gift (2022), tt15516018: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Nava Pappa (2023), tt27219252: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Rang De Basanti (2024), tt31591241: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Kandor Mane Kathe (2024), tt32528712: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Raakshasa (2025), tt35952270: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Theeyor Koodam (2026), tt41974682: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Common Man (2026), tt42191456: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Bhagyavantha (1981), tt0260737: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Barbenheimer and the Cult of Walt Disney (2024), tt33510862: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Validation: isolados por 7 dias para criar um álbum (2022), tt24805970: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Tell 'Em Steve-Dave Puppet Theatre (2013), tt2857196: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Krishna - Kans Vadh (2008), tt6442890: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, TMDB_DETAILS, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Ratne price sa Kosara (2019), tt10156610: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Pichhodu (2019), tt11428992: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Jamalinte Punjiri (2024), tt16899902: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- 90 Bidi Manig Nadi (2023), tt28080602: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Incredibles (2024), tt32832609: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Mhanje Waghache Panje (2025), tt36048374: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Halgat (2025), tt36386357: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Pravas (2025), tt38644653: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Poonga (2025), tt39122445: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Picture Boyz (2026), tt40555293: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Loop (2026), tt42369038: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Pope (2017), tt4746216: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Best Years Ever (1994), tt9686178: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Rush: Cinema Strangiato 2019 (2019), tt10471420: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Avicii Tribute Concert: In Loving Memory of Tim Bergling (2019), tt11544236: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Dear Audrey (2021), tt12980080: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Have Not (2023), tt16980022: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Bhale Unnade (2024), tt32089590: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Herr Puntila und sein Knecht Matti (1966), tt0136992: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS, TMDB_DETAILS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Die eiskalte Nacht (1960), tt0336358: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Gandhada Gudi (1973), tt0279012: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Torn from the Flag: A Film by Klaudia Kovacs (2007), tt0468559: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- A Lion in the House (2006), tt0492472: actual imdb:rating, rottentomatoes:critic; missing rottentomatoes:audience, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Napozz Holddal - A Kispálfilm (2010), tt1727806: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Wild Hungary - A Water Wonderland (2011), tt1980298: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Croatia: Defining a Nation (2022), tt21048836: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Scooby-Doo! and the Pirates (2011), 316272: actual tmdb:rating; missing imdb:rating, rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Sandcastles (2004), tt0414476: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- House of Cards: Rust (2021), tt13992188: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Dhamaka (2022), tt21954370: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Kirik (2025), tt31158793: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Kanni (2024), tt32316129: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Sanatani (2025), tt34996226: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Bolo Har Har Shambhu (2025), tt35873301: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Ashtapadi (2025), tt37021145: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Bad Girlz (2025), tt38045101: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Oru Wayanadan Kadha (2025), tt38961336: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Gangs of Raipur (2025), tt39052988: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Toss (2026), tt39315064: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Fallout: Echos of the Wasteland (2026), tt41834765: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Psychic (2026), tt42191325: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Maa Bhoomi (1979), tt0137925: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS, TMDB_DETAILS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Social Media Monster (2021), tt11506798: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Alya (2023), tt14417286: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Boome Satellites in Texas (2022), tt15301994: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Il tricheco che voleva troppo (2023), tt27095808: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Love Mein (2025), tt5873376: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Andaz Tera Mera (2025), tt6463730: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- A Weekend of Deceased Persons (1988), tt0339865: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Boys in the Sky (2003), tt0370928: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Saving Luna (2007), tt1140873: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Son Bulusma (2008), tt1566624: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- 10 Nahi 40 (2022), tt7705476: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Dropping Gear (2019), tt12009844: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Antaryatri Mahapurush (The Walking God) (2022), tt16226960: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Monk the Young (2025), tt23857668: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- OC (2024), tt32423806: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Madurai 16 (2025), tt38116840: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Life Today (2026), tt39821515: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Dharmasthala Niyojakavargam (2026), tt39917515: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Khakee(Khaki) (2026), tt40247289: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- São Paulo: 447th Anniversary (2001), tt6081240: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Flip Side: A Truth That Could Not Reach You (2015), tt6321972: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Nanak Naam Jahaz Hai (1969), tt0142681: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Decak iz Junkovca (1996), tt0254254: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Na Ninna Mareyalare (1976), tt0334007: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Secret of the Ninth (2021), tt13898300: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- MST - Terra Prometida (2025), tt36934451: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- An Inconvenient Study (2025), tt38687502: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Tower of Song: A Memorial Tribute to Leonard Cohen (2018), tt7586752: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Svet Koji Nestaje (1987), tt1852112: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Manavoori Pandavulu (1978), tt0155853: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Chibideka monogatari (1958), tt0407643: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS, TMDB_DETAILS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Enemy Image (2005), tt0485898: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Yaren (2019), tt10985972: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Chidiakhana (2023), tt14188316: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Dada Lakhmi (2022), tt14677728: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Krishna in Vrindavan (2007), tt6443066: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- BTS 2021 Muster: Sowoozoo Day 2 (2021), 863291: actual tmdb:rating; missing imdb:rating, rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Opulence (2019), tt11256052: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Surveillance Camera Man (2018), tt13587614: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH, OMDB_SUCCESS, TMDB_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Oppanda (2022), tt15137146: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Siri Lambodara Vivaha (2023), tt15434200: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Deck of Cards (2022), tt21986824: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Sarkari Baccha (2025), tt22796670: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Haya (2022), tt23049420: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Brahma Kamala (2026), tt27773916: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Bilichukki Hallihakki (2025), tt33983494: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Kanasondu Shuruvagide (2025), tt35657788: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Hey Chikittha (2026), tt35836621: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Bhalobasa.Com (2025), tt36858379: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Missterious (2025), tt37275151: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Monster (2024), tt37897393: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Sherr (2026), tt42952864: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Trenches of Rock (2019), tt4329396: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Balidaan (1997), tt6566022: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Jajabara 2.0 (2024), tt31410023: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Abel Ernest Tembo's Suspect (2026), tt31638629: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- No Land's Man (2021), tt3996192: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Sikuru Hathe (2007), tt4871740: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Leaving Home: The Life and Music of Indian Ocean (2008), tt1401130: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Gothalo (1996), tt5093808: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Bangarada Manushya (1972), tt0315255: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Launder Run (2014), tt4029958: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Pinjra (1972), tt0316406: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Cholay (2024), tt5798156: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Carnaval fi Dachra (1994), tt6852206: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- BTS World Tour: Love Yourself - Japan Edition (2019), 665399: actual tmdb:rating; missing imdb:rating, rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- La bicicleta de los Huanca (2007), 628442: actual tmdb:rating; missing imdb:rating, rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH_OMITTED, TMDB_DETAILS, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- I'm Not Surprised (2019), tt10934482: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Doraleous and Associates (2010), tt1753729: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Long Drive (2023), tt21211580: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- South Indian Hero (2023), tt22489250: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Terror (2026), tt24499568: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Fearless Vampire Killers: At War with the Thirst (2013), tt2617724: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Black Sheep (2025), tt28456271: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Konchem Hatke (2024), tt28520479: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Back Benchers (2024), tt32359454: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Racket (2025), tt36690033: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Posco 307 (2025), tt36721788: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Triguni (2025), tt36955610: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Taane C/O Srirampura (2025), tt37172842: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Varta (2025), tt37813976: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Maamaram (2025), tt37818091: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- KKK: 3 Raja (2026), tt40233043: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Hope for What We Do Not See (2016), tt6779266: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Jeevan Sangharsha (1995), tt17493572: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Grey Games (2024), tt15654332: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Lucent (2014), tt4134784: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Chunauti (1996), tt5093788: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Godfather Trilogy: 1901-1980 (1992), tt0150742: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- THEVR10: A dokumentumfilm (2023), tt28970800: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Druglawed (2015), tt4450674: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Flowering Tree (1992), tt0231348: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- August (2024), tt32126803: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Da Vinci (2024), tt33455770: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- EXO PLANET #2 The EXO'luxion in Japan (2016), 672490: actual tmdb:rating; missing imdb:rating, rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Wizards of Waverly Place: Wizard School (2008), 77982: actual tmdb:rating; missing imdb:rating, rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Smoke and Mirrors: A History of Denial (1999), tt0230796: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS, TMDB_DETAILS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Seeds (2004), tt0385157: actual tmdb:rating, imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The 14th February & Beyond (2020), tt10895566: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Scooby-Doo's A Nutcracker Scoob (1984), tt1183445: actual tmdb:rating; missing imdb:rating, rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH_OMITTED, TMDB_DETAILS, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Travel from Moscow to St. Petersburg on the ship Nikolai Karamzin (2020), tt12180672: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Cheruvaina Dooramaina (2021), tt12861616: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Kasturi Nivasa (1971), tt1416733: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Niggers (2009), tt2087894: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Howling at the Moon (2011), tt2169050: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Sean and Melissa: 10 Years Later (2012), tt2177711: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Seeking the First Dinosaur Hunters (2022), tt22037128: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Epic Journey (2015), tt2632928: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Golden Legends (2023), tt27033088: actual tmdb:rating; missing imdb:rating, rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, TMDB_DETAILS, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Daniel El Travieso Una Aventura Familiar (2023), tt29257921: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Tax Broke (2024), tt30841470: actual tmdb:rating; missing imdb:rating, rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- I 20 (2024), tt32485455: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Marali Manasaagide (2026), tt38491456: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Jerriyude Aanmakkal (2025), tt38568283: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Bharathi Teacher (2026), tt39366591: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Spies Are Forever (2016), tt5891144: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Generation: Freedom (2019), tt6487784: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Legends of War (2019), tt9426254: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Bei tag und bei nacht oder der hund des gärtners (1957), tt0336015: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS, TMDB_DETAILS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Wild Horses: A Tale from the Puszta (2021), tt15477976: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Ukrainians (2015), tt5868596: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- WWE WrestleMania X-Seven (2001), tt0282267: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- România Salbatica (2021), tt15416740: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Bhootayyana Maga Ayyu (1974), tt0313312: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Markiplier from North Korea (2022), tt23752540: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Mr Jinnah: The Making of Pakistan (1997), tt0246792: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Ashta Vinayak (1979), tt0258431: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Bedara Kannappa (1954), tt0273458: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Raj Kapoor (1987), tt0483785: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Bhagyavantharu (1977), tt1401709: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- BTS 2021 Muster: Sowoozoo Day 1 (2021), 839976: actual tmdb:rating; missing imdb:rating, rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Budapest - the capital of Hungary (2019), tt11426730: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Helsreach: The Movie (2019), tt12820524: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Yello Jogappa Ninnaramane (2025), tt26923729: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Abhiramachandra (2023), tt29420709: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- L Jagadamma 7 B State First (2025), tt33245915: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- SiMP (2026), tt37674883: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Sholay: The Final Cut (2025), tt39151096: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Ichata Love Ammabadunu Konabadunu (2026), tt40223697: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Bolagolam (2026), tt42273710: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Feedback (2017), tt6175402: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Buzzfeed Unsolved: 3 Horrifying Cases of Ghosts and Demons (2016), tt6190796: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Awakening (2015), tt7600054: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Moment of Change (2017), tt7636058: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- George Michael Freedom: The Director's Cut (2018), tt8000146: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Dark Shadows and Beyond - The Jonathan Frid Story (2021), tt16227726: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Last Shepherd (2012), tt2315610: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- 19.20.21 (2023), tt21842984: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- A Horse Named Winx (2024), tt32323344: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Ruta (2018), tt7953386: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Beneath the Helmet (2014), tt4221060: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Manto (2015), tt4943992: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Moleman 4: Longplay (2017), tt5891492: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Last Just Man (2002), tt0355680: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Sugihara: Conspiracy of Kindness (2000), tt0258224: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Surya Vamsha (1999), tt13572142: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Bulbule (2021), tt14332510: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Sammarth (2026), tt43679089: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:outage. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Katyar Kaljat Ghusali (2015), tt5190958: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Pieces of a Dream (2005), tt0440974: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Hip Hop Get Down (2003), tt0446354: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Impact (2004), tt0466841: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Love Sorries (2021), tt14742596: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Star War the Third Gathers: The Backstroke of the West (2010), tt18183916: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- In Medias Res (2011), tt1954538: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Jurisdiction (2012), tt2185170: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Ovalley (2022), tt23785710: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Pourusham - The Manhood (2025), tt30457867: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Vaaradhi (2024), tt35157624: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Suthradaari (2025), tt36266954: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Mother Mary (2025), tt36671015: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Aagakadavana (2025), tt36949582: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- 1st Day 1st Show (2025), tt37421468: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Napaas (2025), tt38682734: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Bozeman (2025), tt38952504: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Six: The Way Home (2026), tt39372712: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Unsolved Mysteries: Original Robert Stack Episodes (1989), tt6844314: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Escape from the Devil's Den (2017), tt7411252: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Blessed Are the Poor in Spirit (2016), tt7599200: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Yazh (2017), tt7681554: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- From the End Into the Beginning (2016), tt8244674: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Unutulmaz Maçlar (2005), tt8367070: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Kanyasulkam (1955), tt0252590: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Sri Shirdi Saibaba Mahathyam (1986), tt0283005: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Dale (2007), tt0815140: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Moscow. Dormitory area (2020), tt11802110: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Regresar al Final (2022), tt12749438: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Bangaarada Panjara (1973), tt1407940: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Alor Michil (1974), tt5076822: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS, TMDB_DETAILS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- 250 Stepenika (2017), tt7622496: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Vigilantes Inc.: America's New Vote Suppression Hitmen (2024), tt22439720: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- 45 Days: The Fight for a Nation (2021), tt15196204: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- University Square: Romania (1991), tt0138020: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Queen: Magic Years, Volume Two - A Visual Anthology (1987), tt0157956: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS, TMDB_DETAILS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Victory at Sea (1954), tt0232902: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Himmler Project (2000), tt0266624: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Ragat (1997), tt0301762: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Gold Bracelet (2006), tt0421061: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Panghrun (2019), tt11146760: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Dahan (1985), tt1189030: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS, TMDB_DETAILS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- A Dog Named Gucci (2015), tt3588852: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Importance of Being Earnest on Stage (2015), tt5280954: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- 90 Years of PAOK: Nostalgia for the Future (2016), tt5588280: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Chaar Sahibzaade 2: Rise of Banda Singh Bahadur (2016), tt6246170: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Closure (2007), tt0810803: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Loving Neverland (2020), tt13092932: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH, OMDB_SUCCESS, TMDB_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Guru Shishyaru (1981), tt1344112: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Love Is a Thieves' Game (2011), tt1380912: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Brandy Diaries (2021), tt15192796: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Groufie (2021), tt15210472: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Bhala Chora Bhala (2022), tt16901072: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Karma (Nepal Bhasa Movie) (2022), tt18689606: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Bypass Road (2022), tt22528322: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Uruttu Factory (2024), tt33810459: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Blindsided (2025), tt36092525: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Kousalya Tanaya Ragava (2025), tt36460794: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Tale of Phantom a Love Story (2023), tt37534500: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Groom from Mars (2026), tt41947892: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Stay Out of My Business (2017), tt7637558: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Lord of the Rings - The Appendices Part 1: From Book to Vision (2002), tt9810488: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Trance: The Cathy O'Brien Story (2022), tt18311204: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Der Klosterjäger (1920), tt0011369: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited, TMDB_DETAILS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Saptapadi (1961), tt0055411: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Mera spored mera (1981), tt0082728: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Dopatta (1952), tt0150422: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Power of Good: Nicholas Winton (2002), tt0328499: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- 8/12 Binay Badal Dinesh (2022), tt17493272: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Vakondok 2 - Demoscene (2011), tt2170661: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Bahrain: Shouting in the Dark (2011), tt2203745: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Supercar Saints (2025), tt25955828: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Resacón en China (2019), tt11378230: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Premada Kanike (1976), tt1399073: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Shankar Guru (1978), tt1401730: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Disappearing Oasis, Last Oasis (1983), tt0247628: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Rise and Fall of Timex Dundee (2019), tt11153078: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- One Heart: The A.R. Rahman Concert Film (2017), tt6484956: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Jeff Lynne's ELO: Wembley or Bust (2017), tt7474562: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Paduvarahalli Pandavaru (1978), tt0232252: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Kavirathna Kaalidaasa (1983), tt0309764: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Buamama (1985), tt0328912: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Calvinist (2017), tt7444934: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Kolej Havasi (2019), tt7520068: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Ricardo Arjona, Circo Soledad En Vivo (2019), 671643: actual tmdb:rating; missing imdb:rating, rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Franco Escamilla: RPM (2020), 707533: actual tmdb:rating; missing imdb:rating, rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- BLACKPINK ARENA TOUR [SPECIAL FINAL IN OSAKA] (2018), 714187: actual tmdb:rating; missing imdb:rating, rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Janma Bhoomi (1995), tt0305692: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Unknown Passage: The Dead Moon Story (2006), tt0396913: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Madonna: The Immaculate Collection (1990), tt0500162: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Canceling (2020), tt11540082: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Najva Ashorai (2008), tt1179449: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- 1997 (2021), tt15417090: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Made in China (2022), tt15516780: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Mia Palia Fotografia (2005), tt1765914: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Chiclets 2K Kids (2024), tt33475704: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Inky (2025), tt37344893: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Brotherhood of Blades Kill Evil (2024), tt37517198: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Legend of Man and Loong (2024), tt37897669: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Sugriva (2026), tt39558804: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Rayudu Gari Thaluka (2026), tt40329244: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Sketch Comedy Movie 2 (2026), tt40550717: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Kalagamanam (2026), tt41527740: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Billy Joel: Live at Shea Stadium (2011), tt4238832: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Brumville (2018), tt6522392: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Invisible Life of Thomas Lynch (2009), tt1284066: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Blizzard of AAHHH's (1988), tt0094760: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- From the River to the Sea: The Frontiers of Faith (2024), tt34881149: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- 30 Years and 15 Minutes (2020), tt12865416: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Daari Tappida Maga (1975), tt1414477: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Queen: Magic Years, Volume One - A Visual Anthology (1987), tt0158745: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- 17 Mayis (2005), tt0913349: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Adrenalin: The BMW Touring Car Story (2014), tt4265816: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Chhatrapati Shivaji (1952), tt0252316: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Arvydas Sabonis 11 (2014), tt4225230: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Partisans of Vilna (1986), tt0091726: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Lava Kusa (1963), tt0206877: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_FAILED:rate_limited. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Michael Jackson Video Greatest Hits: HIStory (1995), tt0167988: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- HIStory on Film, Volume II (1997), tt0168070: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Shut Up and Deal (2007), tt0972571: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Dark Knight: The Ballad of the N Word (2018), tt10378660: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Vol. 1 Dream the Name Is Rogells (Ruggells) (2011), tt1316072: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- God Lives in the Himalayas (2009), tt1519638: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Le Shuru Hoge Maya Ke Kahani (2023), tt23848044: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Line in the Sand (2024), tt33829507: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Gumti (2024), tt34531109: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Citizen Glenn (2024), tt35286402: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Khancha (2026), tt35344016: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Premaku Jai: True Love Never Ends (2025), tt36411755: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Mission of Love (2016), tt7600122: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_SKIPPED_QUOTA_RESERVE. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Chal Man Jeetva Jaiye (2017), tt8185004: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Michael Jackson: Smooth Criminal (II) (1988), tt9106768: actual imdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic, tmdb:rating. Attempts: MDBLIST_BATCH_OMITTED, OMDB_SUCCESS, TMDB_FIND, MDBLIST_RECOVERY_FAILED:not_found. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- The Coronation of King George VI (1937), tt0189444: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS, TMDB_DETAILS. Fewer than three distinct usable live required dimensions after available targeted provider paths.
- Word on the Street (2008), tt1351276: actual imdb:rating, tmdb:rating; missing rottentomatoes:audience, rottentomatoes:critic, letterboxd:rating, metacritic:critic. Attempts: MDBLIST_BATCH, OMDB_SUCCESS. Fewer than three distinct usable live required dimensions after available targeted provider paths.

## Top 100 near misses

| Title | Year | IMDb ID | TMDB ID | Canonical | IMDb | RT audience | RT critic | Letterboxd | MC critic | TMDB | Coverage | Residual | Margin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The Man from Nowhere | 2010 | tt1527788 | 51608 | new | 77 | 90 | 100 | 78 | — | 77 | 5 | 47646.481 | -9.519 |
| The Killer | 1989 | tt0097202 | 10835 | new | 77 | 92 | 96 | 84 | 82 | 76 | 6 | 47646.083 | -9.917 |
| The Big Sleep | 1946 | tt0038355 | 910 | new | 79 | 91 | 96 | 80 | 86 | 75 | 6 | 47639.461 | -16.539 |
| The King's Speech | 2010 | tt1504320 | 45269 | new | 80 | 92 | 94 | 76 | 88 | 77 | 6 | 47628.422 | -27.578 |
| Sound of Metal | 2019 | tt5363618 | 502033 | new | 77 | 90 | 97 | 84 | 82 | 77 | 6 | 47626.215 | -29.785 |
| Nayakan | 1987 | tt0093603 | 29971 | new | 86 | 88 | — | 86 | — | 79 | 4 | 47620.834 | -35.166 |
| Maqbool | 2003 | tt0379370 | 21265 | new | 80 | 93 | 100 | 78 | — | 70 | 5 | 47599.326 | -56.674 |
| Billie Eilish - Hit Me Hard and Soft: The Tour (Live in 3D) | 2026 | tt39018643 | 1515899 | new | 75 | 97 | 92 | 86 | 73 | 83 | 6 | 47587.581 | -68.419 |
| Dangal | 2016 | tt5074352 | 360814 | new | 83 | 93 | 89 | 80 | — | 78 | 5 | 47574.512 | -81.488 |
| Emicida: AmarElo - It's All for Yesterday | 2020 | tt13458600 | 765613 | new | 85 | 84 | — | 84 | — | 86 | 4 | 47572.266 | -83.734 |
| Letter from an Unknown Woman | 1948 | tt0040536 | 946 | new | 78 | 85 | 100 | 82 | — | 77 | 5 | 47558.176 | -97.824 |
| The Thin Blue Line | 1988 | tt0096257 | 14285 | new | 79 | 90 | 100 | 82 | 79 | 76 | 6 | 47554.467 | -101.533 |
| Steamboat Bill, Jr. | 1928 | tt0019421 | 25768 | new | 78 | 92 | 96 | 80 | — | 76 | 5 | 47533.892 | -122.108 |
| King Kong | 1933 | tt0024216 | 244 | new | 79 | 86 | 97 | 76 | 92 | 76 | 6 | 47532.391 | -123.609 |
| Nayattu | 2021 | tt11604676 | 753946 | new | 80 | 92 | 100 | 74 | — | 75 | 5 | 47524.267 | -131.733 |
| The Young Girls of Rochefort | 1967 | tt0062873 | 2433 | new | 77 | 85 | 98 | 86 | — | 76 | 5 | 47522.854 | -133.146 |
| Miss Kobayashi's Dragon Maid: A lonely dragon wants to be loved | 2025 | tt36592985 | 1359607 | new | 77 | 100 | — | 72 | — | 88 | 4 | 47522.594 | -133.406 |
| The Miracle Worker | 1962 | tt0056241 | 1162 | new | 81 | 88 | 96 | 80 | 83 | 79 | 6 | 47520.249 | -135.751 |
| Symphony of the Soil | 2012 | tt2229397 | 186845 | new | 85 | 100 | 63 | — | — | 88 | 4 | 47519.145 | -136.855 |
| Good Morning | 1959 | tt0053134 | 28276 | new | 78 | 87 | 94 | 84 | 87 | 77 | 6 | 47511.418 | -144.582 |
| Yungblud: Are You Ready, Boy? | 2025 | tt37542725 | 1511773 | new | 88 | 99 | — | 80 | — | 70 | 4 | 47509.349 | -146.651 |
| Great Expectations | 1946 | tt0038574 | 14320 | new | 78 | 88 | 100 | 76 | 90 | 73 | 6 | 47500.38 | -155.62 |
| Cat on a Hot Tin Roof | 1958 | tt0051459 | 261 | new | 79 | 92 | 97 | 78 | 84 | 76 | 6 | 47497.069 | -158.931 |
| Anatomy of a Fall | 2023 | tt17009710 | 915935 | new | 76 | 91 | 96 | 82 | 86 | 75 | 6 | 47483.823 | -172.177 |
| Letting Go of God | 2008 | tt1027091 | 40594 | new | 85 | 86 | — | — | — | 83 | 3 | 47480.879 | -175.121 |
| Twice: One in a Mill10n | 2025 | tt38628056 | 1516525 | new | 83 | — | — | 86 | — | 85 | 3 | 47480.879 | -175.121 |
| Much Ado About Nothing | 2011 | tt5569310 | 196242 | new | 85 | — | — | 86 | — | 83 | 3 | 47480.879 | -175.121 |
| Turtles Can Fly | 2004 | tt0424227 | 8340 | new | 80 | 94 | 87 | 84 | 85 | 77 | 6 | 47480.511 | -175.489 |
| Drawing Closer | 2024 | tt31078761 | 1291559 | new | 77 | 95 | — | 82 | — | 84 | 4 | 47479.96 | -176.04 |
| Sling Blade | 1996 | tt0117666 | 12498 | new | 80 | 92 | 96 | 78 | 85 | 75 | 6 | 47479.408 | -176.592 |
| Rascal Does Not Dream of a Dreaming Girl | 2019 | tt9881586 | 572154 | new | 83 | 95 | — | 78 | — | 82 | 4 | 47466.714 | -189.286 |
| Young Hearts | 2024 | tt15245268 | 1232449 | new | 79 | 97 | 92 | 82 | 69 | 86 | 6 | 47458.435 | -197.565 |
| Drifting Clouds | 1996 | tt0116752 | 8214 | new | 76 | 90 | 100 | 80 | — | 75 | 5 | 47453.623 | -202.377 |
| The Big Heat | 1953 | tt0045555 | 14580 | new | 79 | 90 | 95 | 82 | — | 76 | 5 | 47452.21 | -203.79 |
| Exit Through the Gift Shop | 2010 | tt1587707 | 39452 | new | 79 | 91 | 96 | 80 | 85 | 75 | 6 | 47450.709 | -205.291 |
| Jai Bhim Comrade | 2011 | tt2157192 | 258541 | new | 85 | 100 | — | 78 | — | 74 | 4 | 47443.12 | -212.88 |
| Klaus | 2019 | tt4729430 | 508965 | new | 82 | 96 | 95 | 84 | 65 | 82 | 6 | 47430.84 | -225.16 |
| Being There | 1979 | tt0078841 | 10322 | new | 79 | 92 | 95 | 82 | 83 | 75 | 6 | 47428.632 | -227.368 |
| The Official Story | 1985 | tt0089276 | 29263 | new | 77 | 89 | 100 | 80 | — | 75 | 5 | 47424.923 | -231.077 |
| Impossible Things | 2021 | tt10032342 | 667257 | new | 77 | 100 | — | 76 | — | 84 | 4 | 47416.628 | -239.372 |
| Nausicaä of the Valley of the Wind | 1984 | tt0087544 | 81 | new | 80 | 91 | 87 | 84 | 86 | 79 | 6 | 47401.037 | -254.963 |
| Sing Street | 2016 | tt3544112 | 369557 | new | 79 | 92 | 95 | 82 | 79 | 79 | 6 | 47393.31 | -262.69 |
| Hard Boiled | 1992 | tt0104684 | 11782 | new | 77 | 92 | 92 | 84 | 86 | 75 | 6 | 47391.103 | -264.897 |
| Black Narcissus | 1947 | tt0039192 | 16391 | new | 77 | 87 | 100 | 80 | 86 | 75 | 6 | 47374.545 | -281.455 |
| One Battle After Another | 2025 | tt30144839 | 1054867 | new | 76 | 85 | 94 | 82 | 95 | 73 | 6 | 47370.13 | -285.87 |
| Where Is Gilgamesh? | 2024 | tt22817100 | 1168426 | new | 89 | — | — | 72 | — | 92 | 3 | 47359.46 | -296.54 |
| The Spirit of the Beehive | 1973 | tt0070040 | 4495 | new | 77 | 89 | 93 | 84 | 87 | 76 | 6 | 47353.573 | -302.427 |
| The Earrings of Madame De... | 1953 | tt0046022 | 27030 | new | 78 | 90 | 97 | 82 | — | 74 | 5 | 47334.411 | -321.589 |
| For Those About to Rock: Monsters in Moscow | 1992 | tt0304033 | 45558 | new | 89 | — | — | — | — | 80 | 2 | 47333.704 | -322.296 |
| Abhijaan | 2021 | tt13224254 | 790740 | new | 89 | — | — | — | — | 80 | 2 | 47333.704 | -322.296 |
| Secrets of Sinauli | 2021 | tt13577982 | 858993 | new | 89 | — | — | — | — | 80 | 2 | 47333.704 | -322.296 |
| WordLotto | 2023 | tt27610971 | 1275551 | new | 89 | — | — | — | — | 80 | 2 | 47333.704 | -322.296 |
| The Return | 2003 | tt0376968 | 11190 | new | 79 | 93 | 95 | 84 | 82 | 72 | 6 | 47330.393 | -325.607 |
| Puss in Boots: The Last Wish | 2022 | tt3915174 | 315162 | new | 79 | 94 | 95 | 82 | 73 | 82 | 6 | 47330.393 | -325.607 |
| The Virgin Spring | 1960 | tt0053976 | 11656 | new | 80 | 92 | 88 | 84 | — | 78 | 5 | 47321.96 | -334.04 |
| Nirvanna the Band the Show the Movie | 2025 | tt35522483 | 1154538 | new | 77 | 94 | 95 | 84 | 80 | 75 | 6 | 47321.562 | -334.438 |
| The Gleaners & I | 2000 | tt0247380 | 44379 | new | 77 | 87 | 93 | 86 | 86 | 77 | 6 | 47318.251 | -337.749 |
| About Elly | 2009 | tt1360860 | 37181 | new | 79 | 84 | 99 | 82 | 87 | 74 | 6 | 47317.147 | -338.853 |
| Athlete A | 2020 | tt11905462 | 684700 | new | 76 | 92 | 100 | 76 | 85 | 75 | 6 | 47316.043 | -339.957 |
| Fire of Love | 2022 | tt16227014 | 913823 | new | 76 | 88 | 98 | 84 | 84 | 75 | 6 | 47310.524 | -345.476 |
| C.R.A.Z.Y. | 2005 | tt0401085 | 11421 | new | 78 | 93 | 100 | 78 | 81 | 74 | 6 | 47302.798 | -353.202 |
| Boogie Nights | 1997 | tt0118749 | 4995 | new | 79 | 89 | 91 | 84 | 87 | 76 | 6 | 47291.759 | -364.241 |
| The Umbrellas of Cherbourg | 1964 | tt0058450 | 5967 | new | 78 | 87 | 97 | 84 | 86 | 73 | 6 | 47290.656 | -365.344 |
| Ivan the Terrible, Part I | 1944 | tt0037824 | 9797 | new | 76 | 91 | 100 | 80 | — | 73 | 5 | 47289.552 | -366.448 |
| Tarnovskata tzaritza | 1981 | tt0255659 | 584811 | new | 84 | — | — | — | — | 85 | 2 | 47289.552 | -366.448 |
| 681 AD: The Glory of Khan | 1981 | tt0444982 | 767810 | new | 84 | — | — | — | — | 85 | 2 | 47289.552 | -366.448 |
| Hunt for the Wilderpeople | 2016 | tt4698684 | 371645 | new | 78 | 91 | 97 | 82 | 81 | 76 | 6 | 47281.825 | -374.175 |
| The Insider | 1999 | tt0140352 | 9008 | new | 78 | 90 | 96 | 82 | 85 | 74 | 6 | 47270.787 | -385.213 |
| Kagemusha: The Shadow Warrior | 1980 | tt0080979 | 11953 | new | 79 | 92 | 89 | 84 | 84 | 78 | 6 | 47267.476 | -388.524 |
| Aaranya Kaandam | 2010 | tt1496729 | 119123 | new | 84 | 96 | — | 82 | — | 75 | 4 | 47262.095 | -393.905 |
| Justice League Dark: Apokolips War | 2020 | tt11079148 | 618344 | new | 77 | 89 | 100 | 72 | — | 82 | 5 | 47258.645 | -397.355 |
| Jab We Met | 2007 | tt1093370 | 11807 | new | 79 | 90 | 100 | 78 | — | 73 | 5 | 47254.23 | -401.77 |
| Million Dollar Baby | 2004 | tt0405159 | 70 | new | 81 | 90 | 90 | 80 | 86 | 79 | 6 | 47240.984 | -415.016 |
| Mr. Muhsin | 1987 | tt0184756 | 31415 | new | 84 | 96 | — | 78 | — | 79 | 4 | 47235.603 | -420.397 |
| The Nagano Tapes: Rewound, Replayed & Reviewed | 2018 | tt6859280 | 509231 | new | 91 | — | — | 76 | — | 86 | 3 | 47231.418 | -424.582 |
| Obsession | 2026 | tt37287335 | 1339713 | new | 78 | 94 | 93 | 82 | 77 | 81 | 6 | 47224.427 | -431.573 |
| L'Atalante | 1934 | tt0024844 | 43904 | new | 77 | 89 | 100 | 80 | — | 74 | 5 | 47223.323 | -432.677 |
| Manjummel Boys | 2024 | tt26458038 | 1069945 | new | 82 | 96 | — | 80 | — | 79 | 4 | 47217.942 | -438.058 |
| The Seed of the Sacred Fig | 2024 | tt32178949 | 1278263 | new | 75 | 93 | 97 | 80 | 84 | 75 | 6 | 47203.454 | -452.546 |
| Avatar Spirits | 2010 | tt1900832 | 278698 | new | 81 | — | — | 92 | — | 80 | 3 | 47200.511 | -455.489 |
| American Movie | 1999 | tt0181288 | 14242 | new | 78 | 90 | 94 | 84 | 84 | 75 | 6 | 47195.728 | -460.272 |
| Suga: Road to D-Day | 2023 | tt27410896 | 1106732 | new | 84 | 94 | 80 | 88 | — | 75 | 5 | 47188.708 | -467.292 |
| Nine Queens | 2000 | tt0247586 | 18079 | new | 79 | 94 | 92 | 82 | 80 | 78 | 6 | 47186.897 | -469.103 |
| Pain and Glory | 2019 | tt8291806 | 519010 | new | 75 | 91 | 96 | 82 | 87 | 73 | 6 | 47181.378 | -474.622 |
| The Farewell | 2019 | tt8637428 | 565310 | new | 75 | 87 | 97 | 82 | 89 | 74 | 6 | 47159.302 | -496.698 |
| Life Itself | 2014 | tt2382298 | 250766 | new | 78 | 88 | 98 | 78 | 87 | 75 | 6 | 47143.849 | -512.151 |
| Peter Asher: Everywhere Man | 2025 | tt38066059 | 1537635 | new | 85 | — | 96 | 72 | 77 | 90 | 5 | 47143.849 | -512.151 |
| Les Misérables | 1934 | tt0025509 | 67532 | new | 83 | 93 | — | 82 | — | 79 | 4 | 47131.845 | -524.155 |
| Sairat | 2016 | tt5312232 | 383367 | new | 83 | 83 | 100 | 78 | — | 76 | 5 | 47126.188 | -529.812 |
| Earth's Greatest Enemy | 2025 | tt37547719 | 862476 | new | 83 | — | — | 82 | — | 88 | 3 | 47125.452 | -530.548 |
| Life in the Doghouse | 2018 | tt5178264 | 526171 | new | 84 | 99 | — | 74 | — | 79 | 4 | 47117.357 | -538.643 |
| Led Zeppelin: Celebration Day | 2012 | tt2414166 | 137366 | new | 87 | — | — | 84 | — | 82 | 3 | 47116.621 | -539.379 |
| Aguirre, the Wrath of God | 1972 | tt0068182 | 2000 | new | 78 | 90 | 96 | 82 | — | 74 | 5 | 47084.243 | -571.757 |
| La belle noiseuse | 1991 | tt0101428 | 12627 | new | 75 | 82 | 100 | 84 | 89 | 73 | 6 | 47083.139 | -572.861 |
| Kireedam | 1989 | tt0237376 | 191017 | new | 89 | 86 | — | 84 | — | 78 | 4 | 47081.069 | -574.931 |
| Mustang | 2015 | tt3966404 | 336804 | new | 76 | 88 | 97 | 84 | 83 | 76 | 6 | 47077.62 | -578.38 |
| The Lost Weekend | 1945 | tt0037884 | 28580 | new | 78 | 89 | 97 | 80 | — | 76 | 5 | 47073.205 | -582.795 |
| Charade | 1963 | tt0056923 | 4808 | new | 78 | 92 | 95 | 80 | 83 | 76 | 6 | 47064.374 | -591.626 |
| The Conversation | 1974 | tt0071360 | 592 | new | 77 | 89 | 94 | 82 | 88 | 74 | 6 | 47055.544 | -600.456 |
| Monsieur Verdoux | 1947 | tt0039631 | 30588 | new | 78 | 88 | 97 | 80 | — | 77 | 5 | 47046.713 | -609.287 |

## Identity and import review

- Milen (2025), IMDb tt36005864, TMDB 1437338: TMDB_IMDB_IDENTITY_MISMATCH
- The Yin and Yang of Gerry Lopez (2021), IMDb tt12348486, TMDB 948084: OMDB_FAILED:rate_limited, TMDB_IMDB_IDENTITY_MISMATCH
- Peaceable Kingdom (2004), IMDb tt0435715, TMDB 340714: Score passes, but verified TMDB import metadata is incomplete.
- Philipp Mickenbecker: Real Life (2023), IMDb tt28627002, TMDB 1156957: Score passes, but verified TMDB import metadata is incomplete.
- Gintama: Yoshiwara in Flames (2026), IMDb tt37931873, TMDB 1530941: Score passes, but verified TMDB import metadata is incomplete.
- HERO! HITO! (2025), IMDb tt39261436, TMDB 1546166: Score passes, but verified TMDB import metadata is incomplete.
- România (1934), IMDb tt0173139, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Baraka (1998), IMDb tt0176507, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Donga Police (1992), IMDb tt0363011, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Comfort the Disturbed, Disturb the Comforted (2006), IMDb tt0886469, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Sound, Verses, Fury (2007), IMDb tt0970193, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Hello Jindagi (2022), IMDb tt10188844, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Superhit (2016), IMDb tt10240904, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Chinnada Gombe (2018), IMDb tt10368582, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Russian death (2019), IMDb tt10544422, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Udumba (2019), IMDb tt10749962, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Damayana (2023), IMDb tt11032386, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Veshadhari (2020), IMDb tt11496966, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- III (2019), IMDb tt11616194, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Maduve Madri Sari Hogtane (2020), IMDb tt11779574, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Tharle Nan Maga (1992), IMDb tt11867398, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Manmauji (2024), IMDb tt12119248, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Josiah (2020), IMDb tt12233622, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Walk (2023), IMDb tt12395840, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Bed Room (2007), IMDb tt12569318, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Mental - 'B' Positive (2017), IMDb tt12664632, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Kanneri (2022), IMDb tt12909482, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- The Story of Your Life (2008), IMDb tt1326868, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Broken Wild (2021), IMDb tt13370514, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- The Case Is Solved. I Know Everyone Who Tried to Kill Me (2020), IMDb tt13876280, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Iftikhar (2022), IMDb tt13892722, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Lai Jhakaas (2023), IMDb tt14210206, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Uparwala & Sons (2024), IMDb tt14400948, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- I Love You (2004), IMDb tt1440195, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Avtar Dharine Aavu Chu (2015), IMDb tt14490602, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Ieandavi (2021), IMDb tt14676768, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Marley (2022), IMDb tt14716556, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Devara Kanassu (2023), IMDb tt14780150, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Gods of Technology: Soul to Science (2022), IMDb tt15028138, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- The Silent Shadows (2018), IMDb tt15028718, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Dahanam (2023), IMDb tt15242712, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Katharine Hepburn (2019), IMDb tt15324860, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Chori Chori Chupke Chupke (2021), IMDb tt15374748, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Litti Chokha (2021), IMDb tt15477158, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- 1922 Pratikaar Chauri Chaura (2023), IMDb tt15502122, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- India's Space Odyssey (2021), IMDb tt15609374, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Rudrakshapuram 3KM (2024), IMDb tt15891774, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Petipack (2022), IMDb tt16589340, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Vikram (2021), IMDb tt16751954, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Luz de amor (1993), IMDb tt1740812, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- The Tradesmen (2011), IMDb tt1850451, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Like Al (2011), IMDb tt1887796, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Ataturk I 1881-1919 (2023), IMDb tt19394770, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Kaya Palat (2024), IMDb tt19397086, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Call for Peace (2022), IMDb tt19511880, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Moori (2022), IMDb tt19514306, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- 120db Dhwani (2022), IMDb tt19638504, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Naalo Ninnu Dachaane (2022), IMDb tt19730338, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Haemolymph (2022), IMDb tt20244398, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Kandhidi Nodana (2022), IMDb tt20324566, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Harry Potter und ein Stein (2006), IMDb tt20766450, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Kenkemam (2023), IMDb tt21048602, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Sidemen Charity Match 2022 (Sidemen FC VS Youtube Allstars) (2022), IMDb tt21254218, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Ram Mohan Kanchukommala (2022), IMDb tt21830514, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Paggal (2022), IMDb tt21843290, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Half the Sky (2012), IMDb tt2193091, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Ninga (2022), IMDb tt22330532, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Idem Colony: Photobooth (2021), IMDb tt22409446, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Ek Radha Ek Meera (2018), IMDb tt22478984, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- 3.0 (2022), IMDb tt22689992, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Kathalekhana (2022), IMDb tt22742518, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Bullet (2024), IMDb tt22756110, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Nee Maayeyolago Maaye Ninnolago (2022), IMDb tt23057870, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Satvut Advut (2022), IMDb tt23135090, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Ap04ramapuram (2022), IMDb tt23647024, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- A Life More Ordinary (2002), IMDb tt2445508, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Nuvve Naa Pranam (2022), IMDb tt25234532, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Sreemantha (2023), IMDb tt25385428, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Mareyade Kshamisu (2023), IMDb tt25814516, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Govindaa Bhaja Govindaa (2023), IMDb tt26655017, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Ondolle Love Story (2023), IMDb tt26754306, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Circuitt (2023), IMDb tt26938268, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Look Back: Beyond the Blades (2023), IMDb tt27350099, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Code Red Planet Earth (2023), IMDb tt27353917, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Gally Gang Stars (2024), IMDb tt27426266, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Ramzan (2023), IMDb tt27525917, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Suraari (2023), IMDb tt27555270, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Bisilu Kudure (2023), IMDb tt27571912, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Kunwarapur (2024), IMDb tt27613229, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Prema Desapu Yuvarani (2023), IMDb tt27853907, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Rocky in Risk 2 (2023), IMDb tt27881008, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Radha Ramana (2023), IMDb tt27989367, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Koon (2024), IMDb tt28142589, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Dvija (2024), IMDb tt28153684, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Detroit: Become Human (2023), IMDb tt28208443, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Tom and Jerry Classic Collection Volume 3 (1953), IMDb tt28335309, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Tom and Jerry Classic Collection Volume 4 (1956), IMDb tt28335314, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Tom and Jerry Classic Collection Volume 5 (1962), IMDb tt28335316, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Tom and Jerry Classic Collection Volume 6 (1967), IMDb tt28335318, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Akasham Kadann (2023), IMDb tt28357218, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Sandeh (2024), IMDb tt28372295, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Journey to War with an Actor (2019), IMDb tt28429950, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Nimmellara Aashirvada (2023), IMDb tt28435593, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Kattapadathe Mandrikan (2024), IMDb tt28478883, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Come pesci nell'acqua (2024), IMDb tt28497709, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Iddaru (2024), IMDb tt28504269, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Okkaroju... 48 Hours (2023), IMDb tt28504359, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Marutha (2025), IMDb tt28613561, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Laadla 2 (2023), IMDb tt28660106, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Ardhambardha Premakathe (2023), IMDb tt28660608, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Mukalpparappu (2023), IMDb tt28766081, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Digvijaya (2023), IMDb tt29225630, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Journey (2025), IMDb tt29262008, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Nene Saroja (2023), IMDb tt29284103, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- GE Week - Ghost Encounters (2023), IMDb tt29466237, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- S-99 (2024), IMDb tt29515802, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Shoshite (2023), IMDb tt29553451, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Marco Polo: Silk Road by Land & Sea (2023), IMDb tt29612122, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Janam (2023), IMDb tt29764940, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Dilon Mein Uphaan (2023), IMDb tt29766795, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Crazy Keerthy (2023), IMDb tt29852565, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- School Days (2023), IMDb tt29900565, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- The Suit (2024), IMDb tt30139449, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Take 69 B (2020), IMDb tt30151030, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Siempre la duda: Always the doubt (2021), IMDb tt30177720, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Raghava Reddy (2024), IMDb tt30526444, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Dooradarshana (2023), IMDb tt30589332, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Right (2023), IMDb tt30643742, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Jimin's Production Diary (2023), IMDb tt30689416, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Chalachithram (2022), IMDb tt30790344, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Peppatty (2024), IMDb tt30790410, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Zeitgeist: Requiem (2024), IMDb tt31023169, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Raghu 350 (2024), IMDb tt31079452, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- A Half-Life Documentary: Superposition (2021), IMDb tt31155767, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- All the Eyes (2024), IMDb tt31365712, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Silk Saree (2024), IMDb tt31614983, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Omlo (2026), IMDb tt31631483, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Desai (2024), IMDb tt31838402, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Ryûsei (2013), IMDb tt3185040, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Agrico's (2024), IMDb tt31897337, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Appa (2019), IMDb tt31954934, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Never Escape (2024), IMDb tt32034305, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Pyar Ke Do Naam (2024), IMDb tt32060363, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Chhava (2024), IMDb tt32117939, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Nenu Keerthana (2024), IMDb tt32130925, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Anshu (2024), IMDb tt32134468, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- The Indian Story (2024), IMDb tt32222964, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Hawala (2024), IMDb tt32258895, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Akkada Varu Ikkada Unnaru (2024), IMDb tt32324638, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Bisaahee (2025), IMDb tt32380372, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Ishttaragam (2024), IMDb tt32410136, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Big Brother (2024), IMDb tt32491118, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Ladies First (2025), IMDb tt32508972, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Kaalam raasina kathalu (2024), IMDb tt32728672, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Taj (2024), IMDb tt32765580, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- The Rulers (2024), IMDb tt32765751, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Raja Rani (2024), IMDb tt32813775, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Oru Smartphone Prenayam (2024), IMDb tt32820768, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Chitti - Potti (2024), IMDb tt32856857, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Suchana (2024), IMDb tt33042892, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Vikaasaparva (2024), IMDb tt33083593, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Mother's in Love (2024), IMDb tt33095253, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Qingchun zheng dao (2024), IMDb tt33097492, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Wedding Diaries (2024), IMDb tt33131012, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Durga (2024), IMDb tt33164315, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Karma Wallet (2024), IMDb tt33241080, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Sanju (2024), IMDb tt33254423, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Seetharam Sitralu (2024), IMDb tt33268763, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Langoti Man (2024), IMDb tt33269409, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Ranbhoomi (2024), IMDb tt33292024, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Churul (2024), IMDb tt33305909, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- I Love You 2 (2024), IMDb tt33337159, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Dhil Raja (2024), IMDb tt33396613, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Love Matteru (2025), IMDb tt33684347, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- For King + Country: A Drummer Boy Christmas - Live (2024), IMDb tt34422601, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Sun Tzu's Dream (2024), IMDb tt34571787, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Bingo (2026), IMDb tt34588594, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Notuku Potu (2017), IMDb tt34957128, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Avanirabekittu (2025), IMDb tt35615057, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Sajana (2025), IMDb tt36456422, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Gopi Galla Goa Trip (3GT) (2025), IMDb tt36835726, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Ananta (2025), IMDb tt36997770, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- The Land of Women (2024), IMDb tt37517315, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Don Pollo: King of Ohio (2025), IMDb tt37529138, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Secret Soldier (2026), IMDb tt37563690, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Bhalare Sitram (2025), IMDb tt37768271, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Kapal (2025), IMDb tt37798172, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- 31 Days (2025), IMDb tt37813815, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Gulmohammad (2024), IMDb tt37833512, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Next to Normal (2025), IMDb tt37835599, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Baba Aur Cricket (2025), IMDb tt37837392, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Hockeytown (2024), IMDb tt37969235, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Esteghlalish Blue Vol.1 (2009), IMDb tt3815114, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Devghar on Rent (2026), IMDb tt38164450, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Link Click: Bridon Arc - The Movie (2025), IMDb tt38221489, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Jotheyagi Hithavagi (2025), IMDb tt38288845, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Deivathankunn - The Mountain of Gods (2025), IMDb tt38359861, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Alone in Tehran (2025), IMDb tt38517133, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Stalkers 1 (2023), IMDb tt38689659, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Stalkers 2 (2023), IMDb tt38689909, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Boss (2026), IMDb tt38840393, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Detective Dee and the Fire Dragon (2023), IMDb tt38840412, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Andhaka (2025), IMDb tt38907532, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Nayi Idae Yecharikae (2025), IMDb tt38947795, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Guruji Namaskar (2026), IMDb tt38975886, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Vellakuthira (2025), IMDb tt39018624, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Lovely Ladies Dormitory 2 (2022), IMDb tt39139726, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Under the Eye (2025), IMDb tt39205963, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Bengaluru Inn (2026), IMDb tt39245908, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Fight Maha (2026), IMDb tt39281522, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Magnetic Rose (1995), IMDb tt39282391, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- One/4 (2026), IMDb tt39444605, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Erracheera (2026), IMDb tt39833601, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Mirage of Desire (2025), IMDb tt39842244, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Operation Padma (2026), IMDb tt40108693, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Shri Krishna (2026), IMDb tt41302207, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Picture (2026), IMDb tt41559843, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Shreemati Sindoora (2026), IMDb tt42331111, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Diamond Dacoit (2026), IMDb tt42405037, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Rudrabhishekam (2026), IMDb tt42596761, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Ungleich (2013), IMDb tt4267586, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- I'm Handsome (since 2009) (2026), IMDb tt43310374, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Cannabis and Cancer (2026), IMDb tt43370666, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Manu (2026), IMDb tt43558417, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Mudharkanal (2026), IMDb tt43587729, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Raithara Makkalige Hennu Kodi (2026), IMDb tt43588168, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Oka Court Case (2026), IMDb tt43594042, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Dirty Pleasures (2024), IMDb tt43600147, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Beauty (2026), IMDb tt43612289, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Linebala (2026), IMDb tt43622427, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Adhey Neevu Adhey Nenu (2026), IMDb tt43635494, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Maa Ramudu Andarivadu (2026), IMDb tt43638980, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Prema Yudham (2026), IMDb tt43688223, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Amma Naaku aa Abbayi Kaavaali (2026), IMDb tt43691290, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Sardar Sarvai Papanna - The Rebel King of Deccan (2026), IMDb tt43710843, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Yamudu (2026), IMDb tt43730020, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Karimbadam (2026), IMDb tt43733442, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Hushar Pittalu (2026), IMDb tt43737953, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Dark Attraction (2026), IMDb tt43751384, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Baththa (2026), IMDb tt44090278, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Saalagaarara Sahakaara Sangha (2026), IMDb tt44112609, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Warrior (2026), IMDb tt44536358, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Rupayanamaha (2026), IMDb tt44733972, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Oye Chill Maar (2026), IMDb tt44734409, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Paavai (2026), IMDb tt44924837, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Okka Chuputho (2026), IMDb tt45368623, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Bentlee (2026), IMDb tt45605002, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Ee Paata Korinavaaru Nemalipaalem Nundi (2026), IMDb tt45643304, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Wheels of War (2015), IMDb tt4866704, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Janma Janma (1994), IMDb tt5093756, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Born Warriors Redux: Bound Fists (2016), IMDb tt5123416, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Warmth (2016), IMDb tt5285908, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- 2wenty9ine (2006), IMDb tt5658252, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Pop Lock 'n Roll (2016), IMDb tt6098788, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Tobias and the Half-Pariah (2014), IMDb tt6604860, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- The Volunteers (2017), IMDb tt6892282, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Mang nu da tao wang (1966), IMDb tt6932870, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Genius Montis (2017), IMDb tt7391952, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- The Don Reed Story: A life on the Edge of Eternity (2017), IMDb tt7504500, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- The Ragin 13 (2023), IMDb tt7747456, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- 100 Yillik Sevda (2006), IMDb tt8366496, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Shree Swosthani (1994), IMDb tt8503108, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Vaarthakal Ithuvare (2019), IMDb tt8571428, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Making Unsound: The 7 Year Journey (2018), IMDb tt8612678, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Rahadani (2016), IMDb tt8878780, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Pathibeku.com (2018), IMDb tt8933672, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- This Guest of Summer (unknown), IMDb tt9013026, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Refuge 2099 (2019), IMDb tt9016540, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- Mata (2022), IMDb tt9399096, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.
- The Guy Who Didn't Like Musicals (2018), IMDb tt9509866, TMDB —: No usable live ranking evidence was obtained; this candidate has not been rejected by an exact numeric score.

## Quota-unscored cohort

{
  "count": 0,
  "byDiscoveryTier": {
    "B1": 0,
    "B2": 0,
    "C1": 0,
    "C2": 0
  },
  "highestDiscoverySignals": []
}

Unscored candidates are not rejected by the BookClub test.

## Offline import rehearsal

- status: PASSED
- qualifiersRehearsed: 432
- integrity: ok
- foreignKeyViolations: 0
- schemaCompatible: true
- activeMembers: 4
- duplicateCanonicalIdentities: 0
- top100Unchanged: true
- seenPreserved: true
- syntheticSeenPersisted: false
- allAdditionsUnranked: true
- productionMutation: false

Repository persistence rehearsed canonical creation/reuse, identities, score observations, metadata, genres, artwork, enrichment, canonical title authority and Classics membership. No synthetic Seen answers were persisted. Existing Seen rows and the actual Ranked Top 100 remained unchanged; every successful proposed addition is Unranked. The private frozen manifest contains 432 films and SHA-256 `72eab57827fe0c816cb00759a93b2dd21cb7b427500fd04331e421ebec51dae8`.

Private operation: `.verification/classics-discovery-practical-20261007-164000`. Parent evidence remains intact at `.verification/classics-discovery-20261007-154815`.

## Discovery limitations

- HIGH-RECALL, NON-EXHAUSTIVE DISCOVERY. IMDb and TMDB thresholds are discovery heuristics, not guarantees of complete BookClub qualifier coverage.
- MDBList permits four distinct catalogue query signatures per rolling seven days. Only the four successful parent-run first-page streams (100 results each) were reused; no catalogue calls were made in this run. RT Critic catalogue stream was unavailable in the parent run.
- IMDb official datasets are refreshed independently of live MDBList/OMDb evidence. Dataset values and all discovery vote counts never enter final ranking.
- TMDB was traversed to each tier's reported last page, with include_video=true to avoid silently excluding that catalogue subset. Mutable page results can shift during traversal; IDs were deduplicated.
- Identity merging uses exact provider IDs only. Provider omissions, unresolved identities and missing metadata can leave evidence insufficient or require import review.
- Hypothetical rank inserts each qualifier independently into the current actual Ranked baseline; qualifiers do not compete with each other.
- Frozen import is a rehearsal, not a production APPLY authorisation. Production roster, identities, membership, History and Seen state must be revalidated against a fresh export before any later guarded APPLY.
- MDBList Media Info 404 recoveries consume daily quota; their response headers are included in the reserve accounting. Repeated not-found recoveries are served from private negative cache.
- OMDb quota/rate limits exhausted the available credential paths during the targeted pass. Successful observations were retained; later missing OMDb dimensions remain unresolved. Primary and secondary request counts include rejected/in-flight attempts.

## Validation

Targeted checks: `corepack pnpm exec vitest run tests/ranking.test.ts tests/providers.test.ts tests/score-lifecycle.test.ts` — 47 tests passed across three files. The offline rehearsal uses current repository persistence methods and independently reloads stored scores to reproduce every qualifier. The full suite, builds and deployments were outside this discovery-only operation. Before commit, the public files are checked for JSON validity, reconciled counts, identical qualifier sets, exact source calculations, exclusions and sensitive material.

## Recommended next action

The frozen automatic-qualifier manifest passed offline rehearsal and appears ready for owner review followed by a later, separately authorised guarded production APPLY with fresh state checks. No production import or deployment was performed.
