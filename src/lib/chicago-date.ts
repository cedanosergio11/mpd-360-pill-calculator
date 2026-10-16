import { useEffect, useState } from "react";

/**
 * Calendar day in America/Chicago as `YYYY-MM-DD`.
 * This string is for display. Callers must not copy it onto well inputs.
 */
export function chicagoDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

/**
 * Empty during prerender and the hydration render. The Chicago day is set after mount.
 */
export function useChicagoDate(): string {
  const [value, setValue] = useState("");
  useEffect(() => {
    setValue(chicagoDate());
  }, []);
  return value;
}
