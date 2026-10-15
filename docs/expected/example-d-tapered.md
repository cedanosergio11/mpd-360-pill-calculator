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

`emwProfile` returns these sections and the crossover already in MD and TVD. The label is display text.

| label                   | top MD | bottom MD | top TVD | bottom TVD | ID, in | OD, in |
| ----------------------- | ------ | --------- | ------- | ---------- | ------ | ------ |
| 5.5 in OD / 4.778 in ID | 0      | 8480      | 0       | 8466       | 4.778  | 5.5    |
| 4 in OD / 3.34 in ID    | 8480   | 10480     | 8466    | 10466      | 3.34   | 4      |

| Crossover MD, ft | Crossover TVD, ft |
| ---------------- | ----------------- |
| 8480             | 8466              |

Pill capacity from 8060 ft to the bit is 30.988439168447634 bbl: 420 ft of the 4.778 in ID plus 2,000 ft of the 3.34 in ID.

## Annular segments (pill in place, 300 gpm)

| MD, ft     | Length, ft | Hole ID, in | Pipe OD, in | Pipe ID, in | Fluid | Density, ppg | Velocity, ft/min  | Regime  | Friction, psi       |
| ---------- | ---------- | ----------- | ----------- | ----------- | ----- | ------------ | ----------------- | ------- | ------------------- |
| 0–8045     | 8045       | 12.515      | 5.5         | 4.778       | mud   | 11.4         | 58.18387266966291 | laminar | 52.8794547665897    |
| 8045–8060  | 15         | 12.25       | 5.5         | 4.778       | mud   | 11.4         | 61.37089201877935 | laminar | 0.10426928980901387 |
| 8060–8480  | 420        | 12.25       | 5.5         | 4.778       | pill  | 14           | 61.37089201877935 | laminar | 2.9195401146523885  |
| 8480–10480 | 2000       | 12.25       | 4.0         | 3.34        | pill  | 14           | 54.84755244755245 | laminar | 10.761507934622033  |

Every in-place annulus segment is laminar. None is transitional/turbulent. Velocity is `24.51 × gpm / (hole ID² − pipe OD²)` for that segment's own diameters.

Annular volume is continuous at 8480 ft: 1038.281642340198 bbl above the crossover plus 260.4672624829998 bbl below it equals 1298.7489048231978 bbl from surface to the bit. Friction at 8480 ft is 55.903264171051106 psi. Adding the 8480–10480 piece reaches the bit without a jump.

## After RIH

Closed-pipe displacement uses each section's own OD. It is the steel volume removed from the top of the pipe-out column.

| Section             | OD, in | Length, ft | OD² / 1029.4, bbl/ft | Displaced, bbl     |
| ------------------- | ------ | ---------- | -------------------- | ------------------ |
| Above the crossover | 5.5    | 8480       | 0.029386050126287155 | 249.19370507091506 |
| Below the crossover | 4.0    | 2000       | 0.015543034777540314 | 31.086069555080627 |
| Total removed       |        | 10480      |                      | 280.2797746259957  |

The pill's own full-hole volume does not change: 12.25² / 1029.4 × 2420 ft = 352.7795317660773 bbl. That volume is packed from the bit upward in the annulus.

| Annulus                                     | bbl/ft              | Length, ft        | Volume, bbl        |
| ------------------------------------------- | ------------------- | ----------------- | ------------------ |
| 12.25 in hole, 4.0 in OD (10480–8480)       | 0.1302336312414999  | 2000              | 260.4672624829998  |
| 12.25 in hole, 5.5 in OD (8480–8045)        | 0.11639061589275305 | 435               | 50.629917913347576 |
| 12.515 in casing, 5.5 in OD (the remainder) | 0.12276590732465513 | 339.5270908518659 | 41.682351369729936 |

352.7795317660773 − 260.4672624829998 − 50.629917913347576 = 41.682351369729936 bbl left for the casing annulus. 41.682351369729936 / 0.12276590732465513 = 339.5270908518659 ft. Pill top MD = 8045 − 339.5270908518659 = 7705.472909148134 ft. On this survey TVD = MD − 12, so pill top TVD = 7693.472909148134 ft.

After RIH the annulus segments, each with its own velocity and regime:

| MD, ft                 | Length, ft        | Hole ID, in | Pipe OD, in | Fluid | Velocity, ft/min  | Regime  | Friction, psi      |
| ---------------------- | ----------------- | ----------- | ----------- | ----- | ----------------- | ------- | ------------------ |
| 0–7705.472909148134    | 7705.472909148134 | 12.515      | 5.5         | mud   | 58.18387266966291 | laminar | 50.64775713542338  |
| 7705.472909148134–8045 | 339.527090851866  | 12.515      | 5.5         | pill  | 58.18387266966291 | laminar | 2.2316976311663197 |
| 8045–8480              | 435               | 12.25       | 5.5         | pill  | 61.37089201877935 | laminar | 3.0238094044614026 |
| 8480–10480             | 2000              | 12.25       | 4.0         | pill  | 54.84755244755245 | laminar | 10.761507934622033 |

All four are laminar. None is transitional/turbulent.

## Crossover check

The only crossover is at 8480 ft MD / 8466 ft TVD. Samples are 0.01 ft above that depth, at it, and 0.01 ft below it. Static, static plus connection SBP, and ECD are continuous: each line moves by less than 0.00001 ppg across the 0.02 ft. ECD changes slope because the friction gradient changes with pipe OD, and it does not jump.

Friction gradient in place: 0.006951286 psi/ft on the 5.5 in side (2.9195401146523885 psi / 420 ft) and 0.005380754 psi/ft on the 4.0 in side (10.761507934622033 psi / 2000 ft).

| Pill state | Line      | 0.01 ft above      | At 8480 ft MD      | 0.01 ft below      |
| ---------- | --------- | ------------------ | ------------------ | ------------------ |
| inPlace    | static    | 11.528983615619675 | 11.528986534372788 | 11.528989453119003 |
| inPlace    | staticSbp | 12.778326347765955 | 12.778327790801216 | 12.778329233833068 |
| inPlace    | ecd       | 11.65596952461962  | 11.655972451278082 | 11.65597534225457  |
| spotted    | static    | 11.63724861902918  | 11.637251409900173 | 11.63725420076457  |
| spotted    | staticSbp | 12.886591351175458 | 12.886592666328601 | 12.886593981478635 |
| spotted    | ecd       | 11.764234528029125 | 11.764237326805468 | 11.764240089900136 |

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
