import { esc } from "../dom";
import { statusColor } from "../util";
import { registerBody } from "../render";
import { renderActiveOp } from "./runner";
import type { State } from "../state";
import type { Commit } from "../../src/shared/protocol";

function setupView(state: State): string {
  const commits = (state.data.restructCommits as Commit[] | null) ?? [];
  const isSquash = state.restructMode === "squash";

  const modeTab = (squash: boolean) => {
    const on = isSquash === squash;
    return `<div data-click="${squash ? "restructSetSquash" : "restructSetSplit"}" style="display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;padding:7px 14px;border-radius:6px;cursor:pointer;background:${on ? "#9a5cb4" : "transparent"};color:${on ? "#fff" : "#9d9d9d"};">${squash ? "합치기" : "나누기"}</div>`;
  };

  const list = commits
    .map((c) => {
      const sel = isSquash ? !!state.restructSel[c.hash] : state.restructSplitTarget === c.hash;
      const marker = isSquash
        ? `<div style="width:17px;height:17px;flex:none;border-radius:4px;border:1.5px solid ${sel ? "#9a5cb4" : "#5a5a5a"};background:${sel ? "#9a5cb4" : "transparent"};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;">${sel ? "✓" : ""}</div>`
        : `<div style="width:17px;height:17px;flex:none;border-radius:50%;border:1.5px solid ${sel ? "#9a5cb4" : "#5a5a5a"};display:flex;align-items:center;justify-content:center;"><div style="width:8px;height:8px;border-radius:50%;background:${sel ? "#9a5cb4" : "transparent"};"></div></div>`;
      return `<div data-click="${isSquash ? "restructToggleSel" : "restructSetSplitTarget"}" data-arg="${esc(c.hash)}" style="margin-bottom:7px;border:1px solid ${sel ? "#3a2b44" : "#242424"};border-radius:8px;background:${sel ? "#1c1622" : "#191919"};overflow:hidden;cursor:pointer;">
        <div style="display:flex;align-items:center;gap:11px;padding:11px 13px;">
          ${marker}
          <span style="font-family:ui-monospace,Consolas,monospace;font-size:12px;color:#e2c08d;background:#2d2a20;padding:2px 6px;border-radius:4px;">${esc(c.hash)}</span>
          <span style="flex:1;font-size:13px;color:#e2e2e2;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(c.message)}</span>
          <span style="font-size:11px;color:#7d7d7d;white-space:nowrap;">${esc(c.author)} · ${esc(c.time)}</span>
          <span style="font-size:11px;color:#6e6e6e;white-space:nowrap;">파일 ${c.files.length}개</span>
        </div>
      </div>`;
    })
    .join("");

  const panel = isSquash ? squashPanel(state, commits) : splitPanel(state, commits);

  return `<div style="height:100%;display:flex;flex-direction:column;min-height:0;">
    <div style="flex:none;padding:22px 28px 14px;border-bottom:1px solid #242424;">
      <div style="font-size:21px;font-weight:600;color:#f3f3f3;">커밋 재정비</div>
      <div style="font-size:13px;color:#9d9d9d;margin-top:4px;max-width:620px;line-height:1.5;">여러 커밋을 하나로 <b style="color:#ccc;">합치거나(squash)</b>, 한 커밋의 파일 일부를 떼어 <b style="color:#ccc;">새 커밋으로 분리(split)</b>합니다. 실행 전까지 히스토리는 그대로입니다.</div>
      <div style="margin-top:14px;display:inline-flex;background:#202020;border:1px solid #2b2b2b;border-radius:8px;padding:3px;gap:3px;">${modeTab(true)}${modeTab(false)}</div>
    </div>
    <div style="flex:1;display:flex;min-height:0;">
      <div style="flex:1.6;overflow-y:auto;padding:16px 22px;min-width:0;">
        <div style="font-size:11px;letter-spacing:.5px;color:#7d7d7d;font-weight:600;margin-bottom:10px;">${isSquash ? "합칠 커밋을 2개 이상 선택" : "나눌 커밋을 하나 선택"}</div>
        ${list || `<div style="color:#6e6e6e;font-size:13px;padding:20px;text-align:center;">재정비할 커밋이 없습니다.</div>`}
      </div>
      <div style="flex:1;max-width:360px;min-width:300px;border-left:1px solid #242424;background:#181818;display:flex;flex-direction:column;min-height:0;">${panel}</div>
    </div>
  </div>`;
}

function squashPanel(state: State, commits: Commit[]): string {
  const selected = commits.filter((c) => state.restructSel[c.hash]);
  const count = selected.length;
  const oldestFirst = [...selected].reverse();
  const defaultMsg = oldestFirst.map((c) => c.message).join("\n");
  const msgVal = state.restructMsgDirty ? state.restructMsg : defaultMsg;
  const ok = count >= 2;
  const selList = count
    ? `<div style="font-size:11px;color:#7d7d7d;margin-bottom:6px;">합쳐질 커밋 (오래된 → 최신)</div>
      ${oldestFirst.map((s) => `<div style="display:flex;align-items:center;gap:8px;padding:7px 9px;margin-bottom:5px;background:#211b26;border:1px solid #3a2b44;border-radius:6px;"><span style="font-family:ui-monospace,monospace;font-size:11px;color:#d6a0d0;">${esc(s.hash)}</span><span style="flex:1;font-size:12px;color:#d8cfe0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(s.message)}</span></div>`).join("")}
      <div style="margin-top:14px;font-size:11px;color:#7d7d7d;margin-bottom:6px;">합쳐진 커밋 메시지</div>
      <textarea id="gf-squash-msg" data-input="restructMsgInput" rows="4" style="width:100%;resize:vertical;background:#202020;border:1px solid #3a3a3a;border-radius:7px;padding:9px 11px;color:#e2e2e2;font-family:'Segoe UI',sans-serif;font-size:12.5px;line-height:1.5;outline:none;">${esc(msgVal)}</textarea>`
    : `<div style="margin-top:18px;text-align:center;color:#6e6e6e;font-size:12px;line-height:1.6;padding:0 8px;">왼쪽에서 합칠 커밋을<br>2개 이상 선택하세요.</div>`;
  return `<div style="padding:16px 18px 10px;flex:none;font-size:13px;font-weight:600;color:#e8e8e8;display:flex;align-items:center;gap:8px;">하나로 합치기 <span style="font-size:11px;font-weight:700;color:#fff;background:#9a5cb4;border-radius:9px;min-width:18px;height:18px;padding:0 5px;display:inline-flex;align-items:center;justify-content:center;">${count}</span></div>
    <div style="flex:1;overflow-y:auto;padding:0 18px;min-height:0;">${selList}</div>
    <div style="flex:none;border-top:1px solid #242424;padding:14px 18px;">
      <div data-click="runRestruct" style="display:flex;align-items:center;justify-content:center;gap:9px;background:${ok ? "#9a5cb4" : "#3a2f40"};color:#fff;font-weight:600;font-size:13.5px;padding:11px;border-radius:7px;cursor:${ok ? "pointer" : "default"};opacity:${ok ? "1" : "0.55"};">${count}개 커밋 합치기</div>
    </div>`;
}

function splitPanel(state: State, commits: Commit[]): string {
  const target = commits.find((c) => c.hash === state.restructSplitTarget);
  if (!target) {
    return `<div style="padding:16px 18px 10px;flex:none;font-size:13px;font-weight:600;color:#e8e8e8;">커밋 나누기</div>
      <div style="flex:1;overflow-y:auto;padding:0 18px;min-height:0;"><div style="margin-top:18px;text-align:center;color:#6e6e6e;font-size:12px;line-height:1.6;padding:0 8px;">왼쪽에서 나눌 커밋을<br>하나 선택하세요.</div></div>`;
  }
  const outFiles = target.files.filter((f) => state.restructSplitFiles[f.path]);
  const remainCount = target.files.length - outFiles.length;
  const ok = outFiles.length > 0 && remainCount > 0;
  const newVal = state.restructNewDirty ? state.restructNew : "";
  const origVal = state.restructOrigDirty ? state.restructOrig : target.message;
  const filesView = target.files
    .map((f) => {
      const on = !!state.restructSplitFiles[f.path];
      return `<div data-click="restructToggleSplitFile" data-arg="${esc(f.path)}" style="display:flex;align-items:center;gap:9px;padding:8px 9px;margin-bottom:5px;border:1px solid ${on ? "#3a2b44" : "#2b2b2b"};background:${on ? "#1c1622" : "transparent"};border-radius:6px;cursor:pointer;">
        <div style="width:16px;height:16px;flex:none;border-radius:4px;border:1.5px solid ${on ? "#9a5cb4" : "#5a5a5a"};background:${on ? "#9a5cb4" : "transparent"};display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;">${on ? "✓" : ""}</div>
        <span style="width:14px;text-align:center;font-family:ui-monospace,monospace;font-size:12px;color:${statusColor(f.status)};font-weight:700;">${esc(f.status)}</span>
        <span style="flex:1;font-family:ui-monospace,Consolas,monospace;font-size:12px;color:#cccccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(f.path)}</span>
      </div>`;
    })
    .join("");
  return `<div style="padding:16px 18px 10px;flex:none;font-size:13px;font-weight:600;color:#e8e8e8;">커밋 나누기</div>
    <div style="flex:1;overflow-y:auto;padding:0 18px;min-height:0;">
      <div style="font-size:11px;color:#7d7d7d;margin-bottom:6px;">새 커밋으로 분리할 파일 선택</div>
      ${filesView}
      <div style="margin-top:14px;font-size:11px;color:#d6a0d0;margin-bottom:5px;">새 커밋 메시지 (${outFiles.length}개 파일)</div>
      <input id="gf-split-new" data-input="restructNewInput" value="${esc(newVal)}" placeholder="예: refactor: extract config" style="width:100%;background:#202020;border:1px solid #3a3a3a;border-radius:7px;padding:9px 11px;color:#e2e2e2;font-family:'Segoe UI',sans-serif;font-size:12.5px;outline:none;" />
      <div style="margin-top:10px;font-size:11px;color:#7d7d7d;margin-bottom:5px;">남는 커밋 메시지 (${remainCount}개 파일)</div>
      <input id="gf-split-orig" data-input="restructOrigInput" value="${esc(origVal)}" style="width:100%;background:#202020;border:1px solid #3a3a3a;border-radius:7px;padding:9px 11px;color:#e2e2e2;font-family:'Segoe UI',sans-serif;font-size:12.5px;outline:none;" />
    </div>
    <div style="flex:none;border-top:1px solid #242424;padding:14px 18px;">
      <div data-click="runRestruct" style="display:flex;align-items:center;justify-content:center;gap:9px;background:${ok ? "#9a5cb4" : "#3a2f40"};color:#fff;font-weight:600;font-size:13.5px;padding:11px;border-radius:7px;cursor:${ok ? "pointer" : "default"};opacity:${ok ? "1" : "0.55"};">커밋 2개로 나누기</div>
    </div>`;
}

registerBody("restruct", (state) => {
  if (state.restructPhase === "setup") {
    if (state.data.restructCommits === null) return `<div style="padding:40px;color:#9d9d9d;font-size:13px;">커밋을 불러오는 중…</div>`;
    return setupView(state);
  }
  const isSquash = state.restructResultMode === "squash";
  return `<div style="height:100%;display:flex;flex-direction:column;min-height:0;">${renderActiveOp(state, {
    phase: state.restructPhase as any,
    accent: "#9a5cb4",
    channel: "restructure",
    runningTitle: isSquash ? "커밋 합치는 중…" : "커밋 나누는 중…",
    doneTitle: isSquash ? "커밋 합치기 완료" : "커밋 나누기 완료",
    doneSub: isSquash ? "선택한 커밋이 하나로 합쳐졌습니다." : "한 커밋이 두 개로 분리되었습니다.",
    doneFooter: `<div style="margin-top:18px;display:flex;gap:10px;">
        <div data-click="undoLast" style="flex:1;text-align:center;background:#3c3c3c;border:1px solid #4a4a4a;color:#e8e8e8;font-size:13px;font-weight:600;padding:10px;border-radius:7px;cursor:pointer;" data-hover="background:#464646;">되돌리기</div>
        <div data-click="restructReset" style="flex:1;text-align:center;background:#0098ff;color:#fff;font-size:13px;font-weight:600;padding:10px;border-radius:7px;cursor:pointer;" data-hover="background:#1aa3ff;">완료</div>
      </div>`,
    errorActions: `<div style="margin-top:18px;display:flex;gap:10px;">
        <div data-click="restructReset" style="flex:1;text-align:center;background:#3c3c3c;border:1px solid #4a4a4a;color:#e8e8e8;font-size:13px;font-weight:600;padding:10px;border-radius:7px;cursor:pointer;">설정으로</div>
        <div data-click="undoLast" style="flex:1;text-align:center;background:#c74e39;color:#fff;font-size:13px;font-weight:600;padding:10px;border-radius:7px;cursor:pointer;">백업 복원</div>
      </div>`,
  })}</div>`;
});
