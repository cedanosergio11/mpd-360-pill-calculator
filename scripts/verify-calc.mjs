/** Standalone Auburnia regression — OH-honored no-DP pill (not casing ID for the whole height). */
const idDp = 3.826;
const odDp = 4.5;
const idCsg = 6.875;
const ohDia = 6.75;
const spot = 11681;
const csgMd = 10785;
const ancTvd = 11912;
const emw = 16.3;
const mw = 15.3;
const kmw = 18.5;
const fit = 17.5;
const sv = 15.91;
const pump = 0.0635;

const cap = (id) => id ** 2 / 1029.4;
const ceil10 = (v) => Math.ceil(v / 10 - 1e-12) * 10;
const round0 = (v) => Math.round(v);
const roundUp0 = (v) => Math.ceil(v - 1e-12);

const ds = cap(idDp);
const dsVol = round0(ds * spot);
const csg = cap(idCsg);
const ohFull = cap(ohDia);
const annCsg = (idCsg ** 2 - odDp ** 2) / 1029.4;
const annOh = (ohDia ** 2 - odDp ** 2) / 1029.4;
const stat = (emw - mw) * 0.052 * ancTvd;
const height = ceil10(stat / ((kmw - mw) * 0.052));
const ohLen = Math.max(0, spot - csgMd);
const heightInOh = ohLen > 0 ? Math.min(height, ohLen) : 0;
const heightInCsg = Math.max(0, height - heightInOh);
const pillRaw = ohLen > 0 ? heightInOh * ohFull + heightInCsg * csg : height * csg;
const pill = roundUp0(pillRaw);
const masp = (fit - mw) * 0.052 * ancTvd;
const dP = (emw - sv) * 0.052 * ancTvd;
const swab200 = ceil10(0.6 * 0.052 * ancTvd);
const slugP = stat + swab200 + 300;
const slugVol = (slugP / ((kmw - mw) * 0.052)) * ds;
const reqAnn = ohLen > 0 ? heightInOh * annOh + heightInCsg * annCsg : height * annCsg;
const chase = ds * spot - (pill - reqAnn);
const corrAnn = round0(reqAnn);
const kwmPlusChase = roundUp0(pill + chase);

const checks = [
  ["dsVol", dsVol, 166],
  ["height", height, 3730],
  ["pill", pill, 170],
  ["masp", +masp.toFixed(1), 1362.7],
  ["static", +stat.toFixed(3), 619.424],
  ["dP", +dP.toFixed(1), 241.6],
  ["slugVol", +slugVol.toFixed(1), 111.0],
  ["corrAnn", corrAnn, 96],
  ["kwmPlusChase", kwmPlusChase, 263],
  ["topNoDp", spot - height, 7951],
  ["csgTvdUnusedForMasp", +((fit - mw) * 0.052 * 10426).toFixed(1), 1192.7],
];

let failed = 0;
for (const [name, got, exp] of checks) {
  const ok = got === exp;
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}: got ${got} expected ${exp}`);
  }
}
if (failed) {
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, dsVol, height, pill, masp, stat, dP, slugVol, corrAnn, kwmPlusChase, pump }, null, 2));
