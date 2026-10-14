# PillView calculation core

Pure TypeScript. No React. `calculate(job)` is the entry point (`index.ts`).

Job v1 carries an annulus `column` and a `pipeColumn` (fluids inside the string, surface to the bit). `withDP` balances those two with a float U-tube: dumped pill lengthens the annulus, and shoe ESD counts pill only where it stands above the shoe. A pill that never reaches the shoe adds no equalized pressure, and shoe ESD does not fall below mud weight. `noDP` is the pipe-out column; RIH stages run a dry closed pipe into that pill.

Pore pressure is the single entered value, repeated at shoe, anchor, and bit. v1 does not spread a pore or fracture gradient versus depth. That is a future enhancement.

`SHOE_ESD_AT_FIT` (error) fires when shoe ESD, shoe ECD, a displacement-stage shoe ESD, or shoe surge at a trip speed is at or above FIT. That is the SDS-FRM-087 not-issuable banner and it blocks release.

## RELEASE_BLOCKERS

These are not release-ready. `calculate` returns them as `error` issues with code `RELEASE_BLOCKER`.

1. **pumped_bbl** — circulated volume per RIH stage is not implemented. `displacement.stages[].pumped_bbl` is null, never a placeholder zero.
2. **Slug column shift** — a slug, or any non-pill fluid stacked above the pill, is not moved when the pipe is run in. Stages keep that column as given.

`EQUALIZE_PENDING` (error) is raised only when `withDP` has pill in the pipe and the U-tube cannot be balanced. A successful balance does not raise it.
