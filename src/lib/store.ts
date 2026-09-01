import { create } from "zustand";
import { persist } from "zustand/middleware";
import { EMPTY_INPUTS } from "@/lib/calc/examples";
import type { WellInputs } from "@/lib/calc/types";

export type WorkspaceTab =
  | "simulator"
  | "procedure"
  | "schedule"
  | "displacement"
  | "cement"
  | "audit";

interface ScenarioRecord {
  id: string;
  name: string;
  savedAt: string;
  inputs: WellInputs;
}

interface AppState {
  inputs: WellInputs;
  tab: WorkspaceTab;
  hydrated: boolean;
  scenarios: ScenarioRecord[];
  setField: <K extends keyof WellInputs>(key: K, value: WellInputs[K]) => void;
  setInputs: (inputs: WellInputs) => void;
  reset: () => void;
  loadPreset: (inputs: WellInputs) => void;
  setTab: (tab: WorkspaceTab) => void;
  saveScenario: (name?: string) => string;
  loadScenario: (id: string) => void;
  deleteScenario: (id: string) => void;
}

function blankWell(): WellInputs {
  return { ...EMPTY_INPUTS, date: new Date().toISOString().slice(0, 10) };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      inputs: blankWell(),
      tab: "simulator",
      hydrated: false,
      scenarios: [],
      setField: (key, value) =>
        set((s) => ({ inputs: { ...s.inputs, [key]: value } })),
      setInputs: (inputs) => set({ inputs }),
      reset: () => set({ inputs: blankWell() }),
      loadPreset: (inputs) => set({ inputs: { ...inputs } }),
      setTab: (tab) => set({ tab }),
      saveScenario: (name) => {
        const { inputs, scenarios } = get();
        const label = (name || inputs.wellName || "Untitled well").trim();
        const now = new Date().toISOString();
        const existing = scenarios.find((s) => s.name.toLowerCase() === label.toLowerCase());
        if (existing) {
          set({
            scenarios: scenarios.map((s) =>
              s.id === existing.id ? { ...s, name: label, savedAt: now, inputs: { ...inputs } } : s,
            ),
          });
          return existing.id;
        }
        const id = crypto.randomUUID();
        const record: ScenarioRecord = {
          id,
          name: label,
          savedAt: now,
          inputs: { ...inputs },
        };
        set({ scenarios: [record, ...scenarios].slice(0, 24) });
        return id;
      },
      loadScenario: (id) => {
        const found = get().scenarios.find((s) => s.id === id);
        if (found) set({ inputs: { ...found.inputs } });
      },
      deleteScenario: (id) =>
        set((s) => ({ scenarios: s.scenarios.filter((x) => x.id !== id) })),
    }),
    {
      name: "pillview.v1",
      version: 2,
      partialize: (s) => ({ inputs: s.inputs, scenarios: s.scenarios, tab: s.tab }),
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as {
          inputs?: WellInputs;
          scenarios?: ScenarioRecord[];
          tab?: WorkspaceTab;
        };
        if (version < 2) {
          return {
            scenarios: state.scenarios ?? [],
            tab: "simulator" as WorkspaceTab,
            inputs: blankWell(),
          };
        }
        return {
          scenarios: state.scenarios ?? [],
          tab: state.tab ?? "simulator",
          inputs: state.inputs ?? blankWell(),
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);
