/** Swab tables from Inputs sheet (SafeVision-derived). Speeds in ft/min. */
export const TRIP_TABLES: Record<"6.75" | "7.875" | "8.5" | "other", [number, number][]> = {
  "6.75": [
    [40, 0.16],
    [80, 0.26],
    [100, 0.34],
    [150, 0.49],
    [200, 0.6],
    [250, 0.64],
    [300, 0.69],
  ],
  "7.875": [
    [40, 0.12],
    [80, 0.19],
    [100, 0.26],
    [150, 0.41],
    [200, 0.47],
    [250, 0.53],
    [300, 0.6],
  ],
  "8.5": [
    [40, 0.07],
    [80, 0.12],
    [100, 0.18],
    [150, 0.25],
    [200, 0.33],
    [250, 0.39],
    [300, 0.46],
  ],
  other: [
    [40, 0.05],
    [80, 0.1],
    [100, 0.16],
    [150, 0.23],
    [200, 0.31],
    [250, 0.37],
    [300, 0.44],
  ],
};

export const DEFAULT_CUSTOM_SWAB = [0.05, 0.1, 0.16, 0.23, 0.31, 0.37, 0.44];

/** Steel-displacement surge tables (hidden Automation Inputs sheet). */
export interface SurgePoint {
  depth: number;
  tripSpeed: number;
  surgePpg: number;
}

function fillFrom(start: number, trip: number, surge: number, until = 24500): SurgePoint[] {
  const rows: SurgePoint[] = [];
  for (let d = start; d <= until; d += 500) {
    rows.push({ depth: d, tripSpeed: trip, surgePpg: surge });
  }
  return rows;
}

export const SURGE_6_75_WIDE: SurgePoint[] = [
  { depth: 6500, tripSpeed: 120, surgePpg: 0.355 },
  { depth: 7000, tripSpeed: 120, surgePpg: 0.375 },
  { depth: 7500, tripSpeed: 120, surgePpg: 0.375 },
  { depth: 8000, tripSpeed: 120, surgePpg: 0.395 },
  { depth: 8500, tripSpeed: 120, surgePpg: 0.395 },
  { depth: 9000, tripSpeed: 120, surgePpg: 0.395 },
  { depth: 9500, tripSpeed: 120, surgePpg: 0.425 },
  { depth: 10000, tripSpeed: 120, surgePpg: 0.425 },
  { depth: 10500, tripSpeed: 120, surgePpg: 0.435 },
  { depth: 11000, tripSpeed: 120, surgePpg: 0.455 },
  { depth: 11500, tripSpeed: 120, surgePpg: 0.475 },
  ...fillFrom(12000, 120, 0.475),
];

export const SURGE_6_75_TIGHT: SurgePoint[] = [
  { depth: 6500, tripSpeed: 60, surgePpg: 0.14 },
  { depth: 7000, tripSpeed: 60, surgePpg: 0.16 },
  { depth: 7500, tripSpeed: 90, surgePpg: 0.23 },
  { depth: 8000, tripSpeed: 90, surgePpg: 0.24 },
  { depth: 8500, tripSpeed: 90, surgePpg: 0.26 },
  { depth: 9000, tripSpeed: 120, surgePpg: 0.36 },
  { depth: 9500, tripSpeed: 120, surgePpg: 0.39 },
  { depth: 10000, tripSpeed: 120, surgePpg: 0.39 },
  { depth: 10500, tripSpeed: 120, surgePpg: 0.4 },
  { depth: 11000, tripSpeed: 120, surgePpg: 0.42 },
  { depth: 11500, tripSpeed: 120, surgePpg: 0.44 },
  ...fillFrom(12000, 120, 0.44),
];

export const SURGE_8_5_WIDE: SurgePoint[] = [
  { depth: 6500, tripSpeed: 120, surgePpg: 0.23 },
  { depth: 7000, tripSpeed: 120, surgePpg: 0.23 },
  { depth: 7500, tripSpeed: 120, surgePpg: 0.24 },
  { depth: 8000, tripSpeed: 120, surgePpg: 0.25 },
  { depth: 8500, tripSpeed: 120, surgePpg: 0.26 },
  { depth: 9000, tripSpeed: 120, surgePpg: 0.27 },
  { depth: 9500, tripSpeed: 120, surgePpg: 0.29 },
  { depth: 10000, tripSpeed: 120, surgePpg: 0.3 },
  { depth: 10500, tripSpeed: 120, surgePpg: 0.31 },
  { depth: 11000, tripSpeed: 120, surgePpg: 0.32 },
  { depth: 11500, tripSpeed: 120, surgePpg: 0.34 },
  { depth: 12000, tripSpeed: 120, surgePpg: 0.35 },
  { depth: 12500, tripSpeed: 120, surgePpg: 0.36 },
  ...fillFrom(13000, 120, 0.38),
];

export const SURGE_8_5_TIGHT: SurgePoint[] = [
  { depth: 6500, tripSpeed: 60, surgePpg: 0.1 },
  { depth: 7000, tripSpeed: 60, surgePpg: 0.11 },
  { depth: 7500, tripSpeed: 90, surgePpg: 0.17 },
  { depth: 8000, tripSpeed: 90, surgePpg: 0.18 },
  { depth: 8500, tripSpeed: 90, surgePpg: 0.19 },
  { depth: 9000, tripSpeed: 120, surgePpg: 0.27 },
  { depth: 9500, tripSpeed: 120, surgePpg: 0.29 },
  { depth: 10000, tripSpeed: 120, surgePpg: 0.3 },
  { depth: 10500, tripSpeed: 120, surgePpg: 0.31 },
  { depth: 11000, tripSpeed: 120, surgePpg: 0.32 },
  { depth: 11500, tripSpeed: 120, surgePpg: 0.34 },
  { depth: 12000, tripSpeed: 120, surgePpg: 0.35 },
  { depth: 12500, tripSpeed: 120, surgePpg: 0.36 },
  ...fillFrom(13000, 120, 0.38),
];

export function tripTableKey(diameter: number): "6.75" | "7.875" | "8.5" | "other" {
  if (Math.abs(diameter - 6.75) < 0.001) return "6.75";
  if (Math.abs(diameter - 7.875) < 0.001) return "7.875";
  if (Math.abs(diameter - 8.5) < 0.001) return "8.5";
  return "other";
}

export function pickSurgeTable(hole: number, windowPpg: number): SurgePoint[] | null {
  if (!(windowPpg >= 0.6)) return null;
  const wide = windowPpg >= 1;
  if (Math.abs(hole - 6.75) < 0.05) return wide ? SURGE_6_75_WIDE : SURGE_6_75_TIGHT;
  if (Math.abs(hole - 8.5) < 0.05) return wide ? SURGE_8_5_WIDE : SURGE_8_5_TIGHT;
  return null;
}

export function lookupSurge(table: SurgePoint[], depth: number): SurgePoint {
  if (!table.length) return { depth, tripSpeed: 60, surgePpg: 0 };
  let best = table[0];
  for (const row of table) {
    if (row.depth <= depth) best = row;
    else break;
  }
  return best;
}
