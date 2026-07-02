import { esc } from "../dom";
import { registerBody } from "../render";
import type { BranchInfo } from "../../src/shared/protocol";

const BADGE: Record<BranchInfo["kind"], { text: string; color: string; bg: string }> = {
  merged: { text: "병합됨", color: "#89d185", bg: "#16291d" },
  stale: { text: "오래된", color: "#e2c08d", bg: "#2e2716" },
  active: { text: "활성", color: "#9d9d9d", bg: "#202020" },
  protected: { text: "보호됨", color: "#7d7d7d", bg: "#202020" },
  current: { text: "현재", color: "#4cc2ff", bg: "#0d2b40" },
};

registerBody("cleanup", (state) => {
  const branches = state.data.branches as BranchInfo[] | null;
  if (!branches) return `<div style="padding:40px;color:#9d9d9d;font-size:13px;">브랜치를 불러오는 중…</div>`;

  const selCount = Object.keys(state.branchSel).filter((n) => state.branchSel[n]).length;
  const doneBanner =
    state.cleanupPhase === "done"
      ? `<div style="margin-bottom:16px;background:#13261c;border:1px solid #2a4a36;border-radius:8px;padding:13px 16px;display:flex;align-items:center;gap:11px;animation:gf-rise .4s ease;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#89d185" stroke-width="2.2"><path d="M5 13l4 4L19 7"/></svg>
          <div style="font-size:13.5px;color:#a9c9b6;"><b style="color:#cfe9d8;">${state.cleanupDeletedCount}개 브랜치 삭제됨.</b> 30일간 reflog로 복구 가능.</div>
        </div>`
      : "";

  const rows = branches
    .map((b) => {
      const badge = BADGE[b.kind];
      const selectable = b.kind !== "current" && b.kind !== "protected";
      const sel = !!state.branchSel[b.name];
      const checkbox = selectable
        ? `<div style="width:17px;height:17px;flex:none;border-radius:4px;border:1.5px solid ${sel ? "#0098ff" : "#5a5a5a"};background:${sel ? "#0098ff" : "transparent"};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;">${sel ? "✓" : ""}</div>`
        : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5a5a5a" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
      const click = selectable ? `data-click="cleanupToggle" data-arg="${esc(b.name)}"` : "";
      return `<div ${click} style="display:flex;align-items:center;gap:13px;padding:12px 14px;border:1px solid #2b2b2b;border-radius:8px;margin-bottom:8px;background:#191919;cursor:${selectable ? "pointer" : "default"};">
        ${checkbox}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="#7d7d7d"><path d="M5 3.5a2 2 0 1 0-2.4 1.96v5.08a2 2 0 1 0 1 0V8.7c.4.2.86.3 1.4.3h1.7a2 2 0 0 0 2-2V5.46a2 2 0 1 0-1 0V7a1 1 0 0 1-1 1H5.6c-.36 0-.6-.13-.6-.5V5.46c.6-.34 1-.98 1-1.96z"/></svg>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13.5px;color:#e2e2e2;font-weight:500;">${esc(b.name)}</div>
          <div style="font-size:11.5px;color:#7d7d7d;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(b.subject || b.track || "")}</div>
        </div>
        <span style="font-size:10.5px;font-weight:600;color:${badge.color};background:${badge.bg};padding:3px 9px;border-radius:10px;white-space:nowrap;">${badge.text}</span>
        <span style="font-size:11.5px;color:#6e6e6e;white-space:nowrap;min-width:84px;text-align:right;">${esc(b.ageRelative)}</span>
      </div>`;
    })
    .join("");

  const running = state.cleanupPhase === "running";
  return `<div style="height:100%;display:flex;flex-direction:column;min-height:0;">
    <div style="flex:none;padding:22px 28px 16px;border-bottom:1px solid #242424;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;">
      <div>
        <div style="font-size:21px;font-weight:600;color:#f3f3f3;">브랜치 정리</div>
        <div style="font-size:13px;color:#9d9d9d;margin-top:4px;">삭제할 브랜치를 선택하세요. <b style="color:#89d185;">병합됨</b>은 안전하고, <b style="color:#e2c08d;">오래된</b> 항목은 미병합 작업이 있으니 다시 확인하세요.</div>
      </div>
      <div data-click="cleanupSelectMerged" style="flex:none;background:#3c3c3c;border:1px solid #4a4a4a;color:#e8e8e8;font-size:12.5px;font-weight:600;padding:8px 13px;border-radius:6px;cursor:pointer;white-space:nowrap;" data-hover="background:#464646;">병합된 항목 모두 선택</div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:18px 28px;">${doneBanner}${rows}</div>
    <div style="flex:none;border-top:1px solid #242424;padding:14px 28px;display:flex;align-items:center;justify-content:space-between;background:#181818;">
      <div style="font-size:12.5px;color:#9d9d9d;"><b style="color:#e2e2e2;">${selCount}</b>개 삭제 예정</div>
      <div data-click="runCleanup" style="display:flex;align-items:center;gap:8px;background:${selCount > 0 && !running ? "#c74e39" : "#3a2a28"};color:#fff;font-weight:600;font-size:13px;padding:10px 18px;border-radius:7px;cursor:${selCount > 0 && !running ? "pointer" : "default"};opacity:${selCount > 0 && !running ? "1" : "0.6"};">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M4 7h16M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        ${running ? "삭제 중…" : `${selCount}개 브랜치 삭제`}
      </div>
    </div>
  </div>`;
});
