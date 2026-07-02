import type { State } from "./state";
import type { ViewName } from "../src/shared/protocol";

export const LABELS: Record<ViewName, string> = {
  welcome: "시작",
  reforge: "브랜치 리포지",
  restruct: "커밋 재정비",
  sync: "브랜치 최신화",
  cleanup: "브랜치 정리",
  reflog: "Reflog 복구",
  graph: "커밋 그래프",
  search: "이력 검색",
  filehist: "파일 이력",
};

export interface TabVM {
  id: ViewName;
  label: string;
  active: boolean;
  closable: boolean;
}

export interface ViewModel {
  currentBranch: string;
  baseBranch: string;
  aheadCount: number;
  behind: number;
  dirtyCount: number;
  masterBehind: number;
  repoName: string;
  hasRepo: boolean;
  repoError?: string;
  crumb: string;
  activeTab: ViewName;
  tabs: TabVM[];
}

export function buildViewModel(state: State): ViewModel {
  const s = state.snapshot;
  const activeTab = state.activeTab;
  const tabs: TabVM[] = [
    { id: "welcome", label: LABELS.welcome, active: activeTab === "welcome", closable: false },
  ];
  if (state.featureTab) {
    tabs.push({
      id: state.featureTab,
      label: LABELS[state.featureTab],
      active: activeTab === state.featureTab,
      closable: true,
    });
  }
  return {
    currentBranch: s?.currentBranch ?? "—",
    baseBranch: state.baseBranch || s?.baseBranch || "—",
    aheadCount: s?.ahead ?? 0,
    behind: s?.behind ?? 0,
    dirtyCount: s?.dirtyCount ?? 0,
    masterBehind: s?.masterBehind ?? 0,
    repoName: s?.repoName ?? "",
    hasRepo: s?.hasRepo ?? false,
    repoError: s?.error,
    crumb: LABELS[activeTab] ?? "시작",
    activeTab,
    tabs,
  };
}
