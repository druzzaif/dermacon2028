# DERMACON 2027 – Layout extraction (in progress)

Source: DERMACON 2027 Conference Layout, 2 Nov 2026 (final). Figures are as printed on the plan.

## Design rules agreed
- **No partition walls between B-1, B-2 and B-3.** The three east-column halls in Hall B open into one another; the 6 ft dividers shown on the plan between them are not modelled.
- **No partition walls between C-1, C-2 and C-3.** The three east-column halls in Hall C open into one another; no dividers are modelled between them.

## Hall B (Hall-10, 88 × 58 m)
| Room | Size | Seating | Notes |
|---|---|---|---|
| Industries Meeting Hall 1 (B-6) | 14 × 18 m | 80 chairs | Silent hall, stage 40 × 16 ft |
| Industries Meeting Hall 2 (B-5) | 14 × 18 m | 80 chairs | Silent hall |
| Industries Meeting Hall 3 (B-4) | 14 × 18 m | 80 chairs | Silent hall |
| Open passage / Hall B | 43 × 22 m | – | Tea/coffee lounge 6 × 3 m |
| EC Hall (B-8) | 9 × 18 m | 70 chairs | Long round table 10 × 2 m |
| IADVL Hall (B-7) | 34 × 18 m | 270 chairs + 14 round tables | Stage 20 × 12 ft |
| Hall B-2 | 45 × 16 m | 260 chairs | Silent hall, stage 40 × 16 ft |
| Hall B-1 | 45 × 25 m | 756 chairs | Silent hall, stage 60 × 20 × 4 ft. No partitions to B-2 / B-3 |
| Hall B-3 | 45 × 16 m | 260 chairs | Silent hall, stage 40 × 16 ft. No partitions to B-1 |

## Hall C (Hall-9, 88 × 58 m)
| Room | Size | Seating | Notes |
|---|---|---|---|
| International Hall (C-7) | 16 × 16 m | 100 chairs | Silent hall |
| E-Poster Area | 27 × 16 m | 50 posters | |
| Open passage | 43 × 21 m | – | Tea/coffee lounge 6 × 3 m |
| SIG/Sister Hall 1 (C-6) | 14 × 21 m | 103 chairs | Silent hall |
| SIG/Sister Hall 2 (C-5) | 15 × 21 m | 98 chairs | Silent hall |
| SIG/Sister Hall 3 (C-4) | 14 × 21 m | 101 chairs | Silent hall |
| Hall C-2 | 45 × 16 m | 260 chairs | Silent hall. No partition to C-1 |
| Hall C-1 | 45 × 25 m | 756 chairs | Silent hall. No partitions to C-2 / C-3 |
| Hall C-3 | 45 × 16 m | 260 chairs | Silent hall. No partition to C-1 |

## Hall A (Hall-1, 88 × 58 m)
| Room | Size | Seating | Notes |
|---|---|---|---|
| Normal acoustic hall | main hall | approx. 2,448 chairs | Stage 60 × 20 × 4 ft |
| Open passage (Hall A) | 25 × 22 m | – | |
| Preview Room | 18 × 18 m | – | Round-table cluster |
| Faculty Lounge | 18 × 18 m | – | Sofas, tea/coffee |
| Tea lounges | 7 × 13 m and 7 × 5 m | – | |
| Pantry | – | – | |

## Hall F (Hall-7, 114 × 58 m) – Dining
- Dining area with 46 round tables (count from plan; 8 chairs per table assumed) and 5 buffet lines.
- Faculty Dining Area: 65 × 20 m.

## Hall E (Hall-8, 114 × 58 m) – Workshops and Exhibition Hall 2
- Workshop Halls E-1 to E-6: 17 × 20 m each, 112 chairs each, silent halls, stage 40 × 16 ft.
- Exhibition Hall 2 stalls on the west and east sides (201–286).
- Tea/coffee lounge 6 × 3 m in the central passage.

## Hall D (Hall-2, 114 × 58 m) – Exhibition Hall 1
- Stalls 101–118, B1, B2, S1, S2, T1, T2, G1, G2, P1–P4, D1–D4 (sizes as printed).

## Other halls and facilities
- Entertainment Hall (Hall-5): 114 × 70 m, 18 m high, 4,368 chairs.
- Hall-6: 114 × 58 m, empty.
- Hall-11: 114 × 58 m, empty.
- Hall-12: 88 × 58 m, empty.
- Registration Hall (Hall 12-A): 74 × 28 m.
- Hall-4: 68 × 31 m.
- Hall-3 (food court dome): 54.05 m diameter.
- Tunnels: three, at the gaps between Hall 8 and Hall 2 (west), Hall 9 and Hall 10 (east), and Hall 10 and Hall 1 (east).

## Still to do
- Apply the above to `src/data.js` and `src/halls.js`.
- Re-check the building positions against the plan.
- Build, verify, publish, and write the Next.js wrapper.
