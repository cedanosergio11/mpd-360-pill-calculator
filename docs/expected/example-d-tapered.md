# EXAMPLE D (tapered)

EXAMPLE D is EXAMPLE C with a two-section drill string. The legacy `stringOd_in` / `stringId_in` stay the top pipe. Capacity is ID² / 1029.4 bbl/ft. Closed-pipe displacement is OD² / 1029.4 bbl/ft. Annular friction is RP 13D Herschel-Bulkley at 300 gpm, one piece per hole interval, string section, and fluid.

## Inputs

| Input              | Value                                             |
| ------------------ | ------------------------------------------------- |
| Preset             | EXAMPLE D (tapered)                               |
| Mode               | noDP                                              |
| Bit MD             | 10480 ft                                          |
| TD                 | 10530 ft MD / 10516 ft TVD                        |
| Shoe               | 8045 ft MD / 8033 ft TVD                          |
| Anchor             | 10480 ft MD / 10466 ft TVD                        |
| Casing             | 0–8045 ft, 12.515 in ID                           |
| Open hole          | 12.25 in ID                                       |
| FIT                | 12.6 ppg                                          |
| Connection SBP     | 550 psi                                           |
| Circulating SBP    | 0 psi                                             |
| Flow               | 300 gpm                                           |
| Mud                | 11.4 ppg, 0–8060 ft MD                            |
| Pill               | 14 ppg, 8060–10480 ft MD                          |
| Fann (both fluids) | 80 / 48 / 36 / 24 / 9.2 / 8.2                     |
| Pump               | 6 in liner, 12 in stroke, 0.97 efficiency, 40 spm |
| Pump output        | 0.10182672 bbl/stk                                |
| Top string         | 8480 ft, 5.5 in OD / 4.778 in ID                  |
| Bottom string      | 2000 ft, 4.0 in OD / 3.34 in ID                   |
| Crossover MD       | 8480 ft                                           |

## String sections

| Section | MD, ft     | Length, ft | OD, in | ID, in | Capacity, bbl/ft     | Capacity, bbl      | Closed displacement, bbl/ft | Closed displacement, bbl |
| ------- | ---------- | ---------- | ------ | ------ | -------------------- | ------------------ | --------------------------- | ------------------------ |
| Top     | 0–8480     | 8480       | 5.5    | 4.778  | 0.022177272197396538 | 188.06326823392263 | 0.029386050126287155        | 249.19370507091506       |
| Bottom  | 8480–10480 | 2000       | 4.0    | 3.34   | 0.010836992422770544 | 21.67398484554109  | 0.015543034777540314        | 31.086069555080627       |
| Total   | 0–10480    | 10480      |        |        |                      | 209.73725307946373 |                             | 280.2797746259957        |

Pill capacity from 8060 ft to the bit is 30.988439168447634 bbl: 420 ft of the 4.778 in ID plus 2,000 ft of the 3.34 in ID.

## Annular segments (pill in place, 300 gpm)

| MD, ft     | Length, ft | Hole ID, in | Pipe OD, in | Pipe ID, in | Fluid | Density, ppg | Velocity, ft/min  | Regime  | Friction, psi       |
| ---------- | ---------- | ----------- | ----------- | ----------- | ----- | ------------ | ----------------- | ------- | ------------------- |
| 0–8045     | 8045       | 12.515      | 5.5         | 4.778       | mud   | 11.4         | 58.18387266966291 | laminar | 52.8794547665897    |
| 8045–8060  | 15         | 12.25       | 5.5         | 4.778       | mud   | 11.4         | 61.37089201877935 | laminar | 0.10426928980901387 |
| 8060–8480  | 420        | 12.25       | 5.5         | 4.778       | pill  | 14           | 61.37089201877935 | laminar | 2.9195401146523885  |
| 8480–10480 | 2000       | 12.25       | 4.0         | 3.34        | pill  | 14           | 54.84755244755245 | laminar | 10.761507934622033  |

Annular volume is continuous at 8480 ft: 1038.281642340198 bbl above the crossover plus 260.4672624829998 bbl below it equals 1298.7489048231978 bbl from surface to the bit. Friction at 8480 ft is 55.903264171051106 psi. Adding the 8480–10480 piece reaches the bit without a jump.

## Totals

| Quantity                                 | Value                                              |
| ---------------------------------------- | -------------------------------------------------- |
| String capacity, surface to bit          | 209.73725307946373 bbl                             |
| Closed-pipe displacement, surface to bit | 280.2797746259957 bbl                              |
| Shoe friction (8045 ft MD)               | 52.8794547665897 psi                               |
| Crossover friction (8480 ft MD)          | 55.903264171051106 psi                             |
| Bit friction (10480 ft MD)               | 66.66477210567314 psi                              |
| Pill pumped to the bit                   | 30.988439168447634 bbl                             |
| Strokes to the bit                       | 304.3252219893524                                  |
| Spotted pill top                         | 7705.472909148134 ft MD / 7693.472909148134 ft TVD |

The shoe is above the crossover, so in-place shoe friction and the in-place shoe-check rows match EXAMPLE C. The spotted pill rises less than on C because the 4.0 in pipe displaces less steel.

## Shoe check

FIT is 12.6 ppg. Margin psi is (FIT − EMW) × 0.052 × 8033 ft TVD.

| Pill state | Line      | EMW, ppg           | Margin, ppg          | Margin, psi        | Over FIT |
| ---------- | --------- | ------------------ | -------------------- | ------------------ | -------- |
| inPlace    | static    | 11.4               | 1.1999999999999993   | 501.2591999999997  | no       |
| inPlace    | staticSbp | 12.716684062856103 | -0.11668406285610367 | -48.7408000000002  | yes      |
| inPlace    | ecd       | 11.526591882443071 | 1.0734081175569283   | 448.3797452334099  | no       |
| spotted    | static    | 11.509892995918692 | 1.0901070040813075   | 455.35513731682744 | no       |
| spotted    | staticSbp | 12.826577058774795 | -0.2265770587747955  | -94.64486268317248 | yes      |
| spotted    | ecd       | 11.636484878361763 | 0.9635151216382365   | 402.4756825502376  | no       |
