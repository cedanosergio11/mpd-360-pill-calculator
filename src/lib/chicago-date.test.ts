import { describe, expect, it } from "vitest";
import { calculate } from "@/lib/calc/engine";
import { EXAMPLE_8_5 } from "@/lib/calc/examples";
import { chicagoDate } from "./chicago-date";

describe("chicagoDate", () => {
  it("uses the America/Chicago calendar day", () => {
    const beforeMidnight = new Date("2026-10-16T03:30:00.000Z");
    expect(beforeMidnight.toISOString().slice(0, 10)).toBe("2026-10-16");
    expect(chicagoDate(beforeMidnight)).toBe("2026-10-15");

    const winter = new Date("2026-01-16T05:30:00.000Z");
    expect(winter.toISOString().slice(0, 10)).toBe("2026-01-16");
    expect(chicagoDate(winter)).toBe("2026-01-15");

    expect(chicagoDate(new Date("2026-10-16T18:00:00.000Z"))).toBe("2026-10-16");
  });

  it("is not read by calculate", () => {
    const printed = chicagoDate(new Date("2026-10-16T18:00:00.000Z"));
    const withPrinted = calculate({ ...EXAMPLE_8_5, date: printed });
    const withOther = calculate({ ...EXAMPLE_8_5, date: "1999-01-01" });
    expect(JSON.stringify(withPrinted)).toBe(JSON.stringify(withOther));
  });
});
