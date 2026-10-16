/**
 * Paste refusals for the preview. Display only: maps each error `code` to the sentence to show
 * and the TVD fields to highlight. Types come straight from `@/lib/calc/paste`.
 */
import { depthFieldSentence } from "@/components/depth-block";
import type { PastePreviewError, PasteTvdField } from "@/lib/calc/paste";

export const TVD_NAME: Record<PasteTvdField, string> = {
  anchorTvd: "Anchor",
  casingTvd: "Shoe",
  spotTvd: "Spot",
};

export interface UiPasteError {
  code: string;
  /** TVD field keys to highlight in the preview. */
  highlight: PasteTvdField[];
  /** One sentence per line to show. */
  lines: string[];
}

export function tvdDeeperThanMd(field: PasteTvdField): string {
  return `${TVD_NAME[field]} TVD is deeper than its MD. Check the TVD cell in the sheet; TVD can equal MD but not exceed it.`;
}

export function tvdOutOfOrder(a: PasteTvdField, b: PasteTvdField): string {
  return `${TVD_NAME[a]} and ${TVD_NAME[b]} are out of order: ${TVD_NAME[b]} is deeper in MD but shallower in TVD. Check both rows in the sheet.`;
}

export function toUiError(error: PastePreviewError): UiPasteError {
  switch (error.code) {
    case "TVD_DEEPER_THAN_MD":
      return { code: error.code, highlight: [...error.fields], lines: error.fields.map(tvdDeeperThanMd) };
    case "TVD_OUT_OF_ORDER": {
      const [shallow, deep] = error.fields;
      return { code: error.code, highlight: [shallow, deep], lines: [tvdOutOfOrder(shallow, deep)] };
    }
    case "DEPTH_BEYOND_TD":
      return { code: error.code, highlight: [], lines: error.fields.length ? error.fields.map(depthFieldSentence) : [error.message] };
    default: {
      // BAD_NUMBER, and any code added later: show the server's message.
      const other = error as { code: string; message?: string };
      return { code: other.code, highlight: [], lines: [other.message ?? other.code] };
    }
  }
}

export function toUiErrors(errors: readonly PastePreviewError[] | undefined): UiPasteError[] {
  return (errors ?? []).map(toUiError);
}
