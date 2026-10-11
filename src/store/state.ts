// App state: reducer, default state, and an actions type. Persistence is wired
// in AppContext.tsx so the reducer stays pure and testable.

import { AppState, SCHEMA_VERSION, ENGINE_VERSION } from "../types";
import { uid, todayISO } from "../util";

export function emptyState(): AppState {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    createdAt: now,
    updatedAt: now,
    owners: [{ id: "owner_self", label: "Me" }],
    preferences: {
      currency: "INR",
      dateFormat: "dd_mmm_yyyy",
      fiscalYearStartMonth: 4,
      privacyMaskBalances: false,
      defaultAnnualReturn: 0.11,
      defaultInflation: 0.06,
    },
    instruments: [],
    accounts: [],
    transactions: [],
    snapshots: [],
    prices: [],
    manualAssets: [],
    manualLiabilities: [],
    importBatches: [],
    issues: [],
    goals: [],
    contributionStreams: [],
    savedScenarios: [],
  };
}

export type Action =
  | { type: "REPLACE_STATE"; state: AppState }
  | { type: "SET_PREFERENCES"; patch: Partial<AppState["preferences"]> }
  | { type: "ADD_MANUAL_ASSET"; asset: AppState["manualAssets"][number] }
  | { type: "UPDATE_MANUAL_ASSET"; id: string; patch: Partial<AppState["manualAssets"][number]> }
  | { type: "REMOVE_MANUAL_ASSET"; id: string }
  | { type: "ADD_MANUAL_LIABILITY"; liability: AppState["manualLiabilities"][number] }
  | { type: "REMOVE_MANUAL_LIABILITY"; id: string }
  | { type: "COMMIT_IMPORT"; payload: CommitImportPayload }
  | { type: "REVERSE_IMPORT"; batchId: string }
  | { type: "ADD_PRICE"; price: AppState["prices"][number] }
  | { type: "SAVE_SCENARIO"; scenario: AppState["savedScenarios"][number] }
  | { type: "REMOVE_SCENARIO"; id: string }
  | { type: "ADD_GOAL"; goal: AppState["goals"][number] }
  | { type: "UPDATE_GOAL"; id: string; patch: Partial<AppState["goals"][number]> }
  | { type: "REMOVE_GOAL"; id: string }
  | { type: "ADD_CONTRIBUTION_STREAM"; stream: AppState["contributionStreams"][number] }
  | { type: "UPDATE_CONTRIBUTION_STREAM"; id: string; patch: Partial<AppState["contributionStreams"][number]> }
  | { type: "REMOVE_CONTRIBUTION_STREAM"; id: string }
  | { type: "RESOLVE_ISSUE"; id: string }
  | { type: "MARK_BACKUP"; at: string }
  | { type: "RESET_ALL" };

export interface CommitImportPayload {
  batch: AppState["importBatches"][number];
  instruments: AppState["instruments"];
  accounts: AppState["accounts"];
  transactions: AppState["transactions"];
  snapshots: AppState["snapshots"];
  prices: AppState["prices"];
  issues: AppState["issues"];
}

function touch(state: AppState): AppState {
  return { ...state, updatedAt: new Date().toISOString() };
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map(existing.map((e) => [e.id, e]));
  for (const item of incoming) map.set(item.id, item);
  return [...map.values()];
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "REPLACE_STATE":
      return action.state;

    case "SET_PREFERENCES":
      return touch({ ...state, preferences: { ...state.preferences, ...action.patch } });

    case "ADD_MANUAL_ASSET":
      return touch({ ...state, manualAssets: [...state.manualAssets, action.asset] });

    case "UPDATE_MANUAL_ASSET":
      return touch({
        ...state,
        manualAssets: state.manualAssets.map((a) =>
          a.id === action.id ? { ...a, ...action.patch } : a
        ),
      });

    case "REMOVE_MANUAL_ASSET":
      return touch({
        ...state,
        manualAssets: state.manualAssets.filter((a) => a.id !== action.id),
        // Drop allocations that referenced this asset to protect the ledger.
        goals: state.goals.map((g) => ({
          ...g,
          allocations: g.allocations.filter((al) => al.assetRef !== action.id),
        })),
      });

    case "ADD_MANUAL_LIABILITY":
      return touch({ ...state, manualLiabilities: [...state.manualLiabilities, action.liability] });

    case "REMOVE_MANUAL_LIABILITY":
      return touch({
        ...state,
        manualLiabilities: state.manualLiabilities.filter((l) => l.id !== action.id),
      });

    case "COMMIT_IMPORT": {
      const p = action.payload;
      return touch({
        ...state,
        instruments: mergeById(state.instruments, p.instruments),
        accounts: mergeById(state.accounts, p.accounts),
        transactions: mergeById(state.transactions, p.transactions),
        snapshots: mergeById(state.snapshots, p.snapshots),
        prices: mergeById(state.prices, p.prices),
        issues: [...state.issues, ...p.issues],
        importBatches: [...state.importBatches, p.batch],
      });
    }

    case "REVERSE_IMPORT": {
      const batch = state.importBatches.find((b) => b.id === action.batchId);
      if (!batch) return state;
      const txnIds = new Set(batch.addedTxnIds);
      const snapIds = new Set(batch.addedSnapshotIds);
      return touch({
        ...state,
        transactions: state.transactions.filter((t) => !txnIds.has(t.id)),
        snapshots: state.snapshots.filter((s) => !snapIds.has(s.id)),
        importBatches: state.importBatches.map((b) =>
          b.id === action.batchId ? { ...b, status: "reversed" } : b
        ),
        issues: state.issues.filter((i) => i.accountId == null || !batch.addedAccountIds.includes(i.accountId)),
      });
    }

    case "ADD_PRICE":
      return touch({ ...state, prices: [...state.prices, action.price] });

    case "SAVE_SCENARIO":
      return touch({ ...state, savedScenarios: [...state.savedScenarios, action.scenario] });

    case "REMOVE_SCENARIO":
      return touch({
        ...state,
        savedScenarios: state.savedScenarios.filter((s) => s.id !== action.id),
      });

    case "ADD_GOAL":
      return touch({ ...state, goals: [...state.goals, action.goal] });

    case "UPDATE_GOAL":
      return touch({
        ...state,
        goals: state.goals.map((g) => (g.id === action.id ? { ...g, ...action.patch } : g)),
      });

    case "REMOVE_GOAL":
      return touch({ ...state, goals: state.goals.filter((g) => g.id !== action.id) });

    case "ADD_CONTRIBUTION_STREAM":
      return touch({
        ...state,
        contributionStreams: [...state.contributionStreams, action.stream],
      });

    case "UPDATE_CONTRIBUTION_STREAM":
      return touch({
        ...state,
        contributionStreams: state.contributionStreams.map((s) =>
          s.id === action.id ? { ...s, ...action.patch } : s
        ),
      });

    case "REMOVE_CONTRIBUTION_STREAM":
      return touch({
        ...state,
        contributionStreams: state.contributionStreams.filter((s) => s.id !== action.id),
        goals: state.goals.map((g) => ({
          ...g,
          contributionStreamIds: g.contributionStreamIds.filter((id) => id !== action.id),
        })),
      });

    case "RESOLVE_ISSUE":
      return touch({
        ...state,
        issues: state.issues.map((i) => (i.id === action.id ? { ...i, resolved: true } : i)),
      });

    case "MARK_BACKUP":
      return touch({ ...state, lastBackupAt: action.at });

    case "RESET_ALL":
      return emptyState();

    default:
      return state;
  }
}

export const sampleScenarioId = () => uid("scn");
export const sampleToday = todayISO;
