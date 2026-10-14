# PillView calculation core

Pure TypeScript. No React. `calculate(job)` is the entry point (`index.ts`).

Job v1 carries an annulus `column` and a `pipeColumn` (fluids inside the string, surface to the bit). `withDP` balances those two with a float U-tube: dumped pill lengthens the annulus, and shoe ESD counts pill only where it stands above the shoe. A pill that never reaches the shoe adds no equalized pressure, and shoe ESD does not fall below mud weight. `noDP` is the pipe-out column; RIH stages run a dry closed pipe into that pill.

Pore pressure is the single entered value, reported on `depths.td.pore_ppg` only. It is null at the shoe and the anchor. v1 does not spread a pore or fracture gradient versus depth. That is a future enhancement.

Displacement stages are numbered from 0. Stage 0 is the static column before trip-in.

`SHOE_ESD_AT_FIT` (error) fires when static shoe EMW — shoe ESD plus the pumps-off SBP that holds the anchor at target EMW — is at or above FIT. That includes each displacement stage. It is the SDS-FRM-087 not-issuable banner and it blocks release. `field` is the result path. `jobFields` lists the job inputs that drive it (shoe depth and TVD, FIT, anchor, target EMW, column, fluids, connection SBP).

A per-speed shoe surge that reaches FIT is not that error. The speed is dropped from the trip band and `maxSpeed` stays at the fastest speed that still passes. The result carries at most a `SHOE_SURGE_AT_FIT` warning. `NO_SAFE_TRIP_SPEED` (error) is the lock when a band has no passing speed and `maxSpeed` is null.

`displacement.stages[].pumped_bbl` is the pill volume pumped: the length of the deepest pill fluid the bit has covered, times pipe capacity (`stringId`² / 1029.4). It is 0 before the bit enters that fluid. It is null only when pipe capacity cannot be computed.

RIH into a dry pipe shifts the whole column. Closed-pipe displacement (OD capacity × bit depth) leaves at the surface, and the remaining fluids are packed from TD upward — full hole below the bit, annulus around the pipe above it. A slug and a multi-fluid pill move with that displacement. Stage 0 is the static column, before any pipe is in the hole.

`EQUALIZE_PENDING` (error) is raised only when `withDP` has pill in the pipe and the U-tube cannot be balanced. A successful balance does not raise it.
