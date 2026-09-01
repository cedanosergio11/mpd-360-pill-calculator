const fmt0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const fmt2 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const fmt3 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
const fmt4 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

export function ft(n: number) {
  return `${fmt0.format(n)} ft`;
}

export function signedFt(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${fmt0.format(n)} ft`;
}

export function bbl(n: number, digits: 1 | 2 = 1) {
  return `${(digits === 1 ? fmt1 : fmt2).format(n)} bbl`;
}

export function ppg(n: number) {
  return `${fmt1.format(n)} ppg`;
}

export function ppg2(n: number) {
  return `${fmt2.format(n)} ppg`;
}

export function psi(n: number) {
  return `${fmt0.format(n)} psi`;
}

export function inches(n: number) {
  return fmt3.format(n);
}

export function bblFt(n: number) {
  return `${fmt4.format(n)} bbl/ft`;
}

export { fmt0, fmt1, fmt2, fmt3, fmt4 };
