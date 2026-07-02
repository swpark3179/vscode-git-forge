import { esc } from "../dom";
import { statusColor } from "../util";
import { registerBody } from "../render";
import { renderActiveOp } from "./runner";
import type { State } from "../state";
import type { Commit } from "../../src/shared/protocol";

function setupView(state: State): string {
  const commits = (state.data.reforgeCommits as Commit[] | null) ?? [];
  const cur = esc(state.snapshot?.currentBranch ?? "—");
  const base = state.baseBranch || state.snapshot?.baseBranch || "—";
  const excluded = state.excluded;
  const excludedPaths = Object.keys(excluded).filter((p) => excluded[p]);
  const excludeCount = excludedPaths.length;

  // commits touching each excluded path
  const countByPath: Record<string, number> = {};
  let affected = 0;
  for (const c of commits) {
    const hit = c.files.some((f) => excluded[f.path]);
    if (hit) affected++;
    for (const f of c.files) if (excluded[f.path]) countByPath[f.path] = (countByPath[f.path] || 0) + 1;
  }

  const branchOptions = (state.snapshot?.branches ?? [])
    .map((b) => {
      const sel = b === base;
      return `<div data-click="reforgeChooseBase" data-arg="${esc(b)}" style="padding:8px 11px;font-size:13px;color:#dcdcdc;cursor:pointer;display:flex;align-items:center;gap:8px;background:${sel ? "#04395e" : "transparent"};" data-hover="background:#04395e;">
        <span style="width:12px;color:#0098ff;">${sel ? "✓" : ""}</span>${esc(b)}</div>`;
    })
    .join("");

  const commitRows = commits
    .map((c) => {
      const expanded = !!state.expanded[c.hash];
      const exCount = c.files.filter((f) => excluded[f.path]).length;
      const filesView = expanded
        ? c.files
            .map((f) => {
              const isEx = !!excluded[f.path];
              return `<div data-click="reforgeToggleFile" data-arg="${esc(f.path)}" style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:5px;cursor:pointer;opacity:${isEx ? "0.6" : "1"};" data-hover="background:#202020;">
                <div style="width:16px;height:16px;flex:none;border-radius:4px;border:1.5px solid ${isEx ? "#c74e39" : "#5a5a5a"};background:${isEx ? "#c74e39" : "transparent"};display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;">${isEx ? "✓" : ""}</div>
                <span style="width:15px;text-align:center;font-family:ui-monospace,monospace;font-size:12px;color:${statusColor(f.status)};font-weight:700;">${esc(f.status)}</span>
                <span style="flex:1;font-family:ui-monospace,'SF Mono',Consolas,monospace;font-size:12.5px;color:${isEx ? "#9d7d77" : "#cccccc"};text-decoration:${isEx ? "line-through" : "none"};min-width:0;overflow:hidden;text-overflow:ellipsis;">${esc(f.path)}</span>
                <span style="font-family:ui-monospace,monospace;font-size:11px;color:#89d185;">+${f.add}</span>
                <span style="font-family:ui-monospace,monospace;font-size:11px;color:#f48771;">&#8722;${f.del}</span>
              </div>`;
            })
            .join("")
        : "";
      return `<div style="margin-bottom:8px;border:1px solid ${exCount ? "#50312c" : "#242424"};border-radius:8px;background:#191919;overflow:hidden;">
        <div data-click="reforgeToggleExpand" data-arg="${esc(c.hash)}" style="display:flex;align-items:center;gap:11px;padding:11px 13px;cursor:pointer;" data-hover="background:#202020;">
          <span style="color:#9d9d9d;font-size:11px;transition:transform .15s;transform:rotate(${expanded ? "90" : "0"}deg);">&#9654;</span>
          <div style="width:9px;height:9px;flex:none;border-radius:50%;border:2px solid #5a8db0;background:#1f1f1f;"></div>
          <span style="font-family:ui-monospace,'SF Mono',Consolas,monospace;font-size:12px;color:#e2c08d;background:#2d2a20;padding:2px 6px;border-radius:4px;">${esc(c.hash)}</span>
          <span style="flex:1;font-size:13px;color:#e2e2e2;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(c.message)}</span>
          ${exCount ? `<span style="font-size:10px;color:#f48771;background:#3a2421;padding:2px 7px;border-radius:9px;white-space:nowrap;">&#8722;${exCount}개 제외</span>` : ""}
          <span style="font-size:11px;color:#7d7d7d;white-space:nowrap;">${esc(c.author)} · ${esc(c.time)}</span>
          <span style="font-size:11px;color:#6e6e6e;white-space:nowrap;">파일 ${c.files.length}개</span>
        </div>
        ${expanded ? `<div style="border-top:1px solid #242424;padding:5px 13px 9px 40px;">${filesView}</div>` : ""}
      </div>`;
    })
    .join("");

  const excludeListHtml = excludeCount
    ? excludedPaths
        .map(
          (p) => `<div style="display:flex;align-items:center;gap:9px;padding:9px 11px;margin-bottom:7px;background:#241b1a;border:1px solid #50312c;border-radius:7px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f48771" stroke-width="2"><path d="M4 7h16M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12"/></svg>
        <div style="flex:1;min-width:0;"><div style="font-family:ui-monospace,monospace;font-size:12px;color:#f3d6cf;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p)}</div><div style="font-size:10.5px;color:#9d7d77;margin-top:1px;">${countByPath[p] || 0}개 커밋에 포함</div></div>
        <span data-click="reforgeToggleFile" data-arg="${esc(p)}" style="cursor:pointer;color:#9d7d77;width:18px;height:18px;display:flex;align-items:center;justify-content:center;border-radius:4px;" data-hover="background:#3a2421;color:#f48771;">&#x2715;</span>
      </div>`
        )
        .join("")
    : `<div style="margin-top:18px;text-align:center;color:#6e6e6e;font-size:12px;line-height:1.6;padding:0 10px;">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#3a3a3a" stroke-width="1.5" style="margin-bottom:8px;"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <div>커밋을 펼쳐 히스토리에서<br>지울 파일을 체크하세요.</div></div>`;

  const canRun = excludeCount > 0;
  return `<div style="height:100%;display:flex;flex-direction:column;min-height:0;">
    <div style="flex:none;padding:22px 28px 16px;border-bottom:1px solid #242424;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px;">
        <div>
          <div style="font-size:21px;font-weight:600;color:#f3f3f3;">브랜치 리포지</div>
          <div style="font-size:13px;color:#9d9d9d;margin-top:4px;max-width:560px;line-height:1.5;">기준 브랜치를 선택한 뒤, 히스토리에서 지울 파일을 체크하세요. Git Forge가 <b style="color:#ccc;">${cur}</b>을(를) 그 파일들 없이 커밋 단위로 다시 쌓습니다.</div>
        </div>
        <div style="position:relative;flex:none;">
          <div style="font-size:11px;color:#7d7d7d;margin-bottom:5px;letter-spacing:.4px;">기준 브랜치와 비교</div>
          <div data-click="toggleBaseDropdown" style="display:flex;align-items:center;gap:10px;min-width:190px;background:#3c3c3c;border:1px solid #4a4a4a;border-radius:6px;padding:8px 11px;cursor:pointer;">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="#0098ff"><path d="M5 3.5a2 2 0 1 0-2.4 1.96v5.08a2 2 0 1 0 1 0V8.7c.4.2.86.3 1.4.3h1.7a2 2 0 0 0 2-2V5.46a2 2 0 1 0-1 0V7a1 1 0 0 1-1 1H5.6c-.36 0-.6-.13-.6-.5V5.46c.6-.34 1-.98 1-1.96z"/></svg>
            <span style="flex:1;font-size:13px;color:#e8e8e8;font-weight:600;">${esc(base)}</span>
            <span style="color:#9d9d9d;font-size:10px;">&#9660;</span>
          </div>
          ${state.baseDropdownOpen ? `<div style="position:absolute;top:100%;left:0;right:0;margin-top:4px;background:#252526;border:1px solid #454545;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.5);z-index:20;overflow:hidden;">${branchOptions}</div>` : ""}
        </div>
      </div>
      <div style="margin-top:14px;font-size:12.5px;color:#9d9d9d;"><b style="color:#89d185;">${commits.length}개 커밋</b>이 ${cur}에만 있고 ${esc(base)}엔 없습니다. 오래된 순서대로 재적용됩니다.</div>
    </div>
    <div style="flex:1;display:flex;min-height:0;">
      <div style="flex:1.7;overflow-y:auto;padding:16px 22px;min-width:0;">${commitRows || `<div style="color:#6e6e6e;font-size:13px;padding:20px;text-align:center;">${esc(base)} 기준으로 ${cur}에만 있는 커밋이 없습니다.</div>`}</div>
      <div style="flex:1;max-width:340px;min-width:280px;border-left:1px solid #242424;background:#181818;display:flex;flex-direction:column;min-height:0;">
        <div style="padding:16px 18px 10px;flex:none;">
          <div style="font-size:13px;font-weight:600;color:#e8e8e8;display:flex;align-items:center;gap:8px;">제거할 파일 <span style="font-size:11px;font-weight:700;color:#fff;background:#c74e39;border-radius:9px;min-width:18px;height:18px;padding:0 5px;display:inline-flex;align-items:center;justify-content:center;">${excludeCount}</span></div>
        </div>
        <div style="flex:1;overflow-y:auto;padding:0 18px;min-height:0;">${excludeListHtml}</div>
        <div style="flex:none;border-top:1px solid #242424;padding:14px 18px;">
          <div style="background:#202020;border:1px solid #2b2b2b;border-radius:7px;padding:11px 12px;font-size:11.5px;color:#9d9d9d;line-height:1.7;">
            <div style="display:flex;justify-content:space-between;"><span>재적용 커밋</span><b style="color:#cdcdcd;">${commits.length}</b></div>
            <div style="display:flex;justify-content:space-between;"><span>영향받는 커밋</span><b style="color:#cdcdcd;">${affected}</b></div>
            <div style="display:flex;justify-content:space-between;"><span>reflog 백업</span><b style="color:#89d185;">자동</b></div>
          </div>
          <div data-click="runReforge" style="margin-top:12px;display:flex;align-items:center;justify-content:center;gap:9px;background:${canRun ? "#0098ff" : "#1e3a52"};color:#fff;font-weight:600;font-size:13.5px;padding:11px;border-radius:7px;cursor:${canRun ? "pointer" : "default"};opacity:${canRun ? "1" : "0.55"};">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="12" r="2.4"/><path d="M6 8.4v7.2M8.4 6H14M8.4 18H14M15.6 12H8.4"/></svg>
            ${cur} 리포지 실행
          </div>
          <div style="text-align:center;font-size:10.5px;color:#6e6e6e;margin-top:7px;">완전 되돌리기 가능 · 원본은 reflog에 저장</div>
        </div>
      </div>
    </div>
  </div>`;
}

registerBody("reforge", (state) => {
  if (state.reforgePhase === "setup") {
    if (state.data.reforgeCommits === null) {
      return `<div style="padding:40px;color:#9d9d9d;font-size:13px;">커밋을 불러오는 중…</div>`;
    }
    return setupView(state);
  }
  const cur = esc(state.snapshot?.currentBranch ?? "—");
  const exCount = Object.keys(state.excluded).filter((p) => state.excluded[p]).length;
  return `<div style="height:100%;display:flex;flex-direction:column;min-height:0;">${renderActiveOp(state, {
    phase: state.reforgePhase as any,
    accent: "#0098ff",
    channel: "reforge",
    runningTitle: `${cur} 리포지 진행 중…`,
    doneTitle: "브랜치 리포지 완료",
    doneSub: `커밋 재적용 · ${exCount}개 파일 히스토리에서 제거`,
    doneFooter: `<div style="margin-top:14px;background:#13261c;border:1px solid #2a4a36;border-radius:8px;padding:13px 15px;font-size:12px;color:#a9c9b6;line-height:1.6;">원본 tip은 백업 ref에 저장됨. 되돌리기로 언제든 복원할 수 있습니다.</div>
      <div style="margin-top:18px;display:flex;gap:10px;">
        <div data-click="undoLast" style="flex:1;text-align:center;background:#3c3c3c;border:1px solid #4a4a4a;color:#e8e8e8;font-size:13px;font-weight:600;padding:10px;border-radius:7px;cursor:pointer;" data-hover="background:#464646;">되돌리기 (tip 복원)</div>
        <div data-click="reforgeBackToSetup" style="flex:1;text-align:center;background:#0098ff;color:#fff;font-size:13px;font-weight:600;padding:10px;border-radius:7px;cursor:pointer;" data-hover="background:#1aa3ff;">완료</div>
      </div>`,
    errorActions: `<div style="margin-top:18px;display:flex;gap:10px;">
        <div data-click="reforgeBackToSetup" style="flex:1;text-align:center;background:#3c3c3c;border:1px solid #4a4a4a;color:#e8e8e8;font-size:13px;font-weight:600;padding:10px;border-radius:7px;cursor:pointer;">설정으로</div>
        <div data-click="undoLast" style="flex:1;text-align:center;background:#c74e39;color:#fff;font-size:13px;font-weight:600;padding:10px;border-radius:7px;cursor:pointer;">백업 복원</div>
      </div>`,
  })}</div>`;
});
