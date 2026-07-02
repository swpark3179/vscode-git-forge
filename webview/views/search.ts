import { esc } from "../dom";
import { highlight } from "../util";
import { registerBody } from "../render";
import type { State } from "../state";
import type { SearchResult } from "../../src/shared/protocol";

const MODES: Array<{ id: State["searchMode"]; label: string; hint: string }> = [
  { id: "message", label: "메시지", hint: "커밋 메시지" },
  { id: "author", label: "작성자", hint: "작성자 이름" },
  { id: "file", label: "파일 경로", hint: "변경된 파일 경로" },
  { id: "code", label: "코드 내용", hint: "git log -S · 추가/삭제된 코드" },
];

registerBody("search", (state) => {
  const cur = MODES.find((m) => m.id === state.searchMode) || MODES[0];
  const tabs = MODES.map(
    (m) => `<div data-click="searchMode" data-arg="${m.id}" style="padding:7px 16px;border-radius:6px;font-size:13px;cursor:pointer;background:${m.id === state.searchMode ? "#0098ff" : "transparent"};color:${m.id === state.searchMode ? "#fff" : "#9d9d9d"};white-space:nowrap;">${m.label}</div>`
  ).join("");

  const payload = state.data.searchResults as { results: SearchResult[] } | null;
  const results = payload?.results ?? [];
  const hasQuery = state.searchQuery.trim().length > 0;

  let body: string;
  if (!hasQuery) {
    body = "";
  } else if (results.length === 0 && payload) {
    body = `<div style="margin-top:30px;text-align:center;color:#6e6e6e;font-size:13px;line-height:1.7;">
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#3a3a3a" stroke-width="1.5" style="margin-bottom:10px;"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <div>일치하는 이력이 없습니다.<br>다른 검색 모드나 검색어를 시도해 보세요.</div></div>`;
  } else {
    body = results.map((r) => renderResult(r)).join("");
  }

  const countLine = hasQuery
    ? `<div style="margin-top:11px;font-size:12px;color:#7d7d7d;">결과 <b style="color:#cdcdcd;">${results.length}</b>건</div>`
    : "";

  return `<div style="max-width:940px;margin:0 auto;padding:24px 30px 60px;">
    <div style="font-size:21px;font-weight:600;color:#f3f3f3;">이력 검색</div>
    <div style="font-size:13px;color:#9d9d9d;margin-top:4px;line-height:1.5;">커밋 메시지·작성자·파일은 물론, 코드 한 줄이 <b style="color:#ccc;">언제</b> 들어오고 사라졌는지까지 추적합니다(pickaxe).</div>
    <div style="margin-top:18px;display:flex;gap:4px;background:#181818;border:1px solid #2b2b2b;border-radius:8px;padding:4px;width:fit-content;">${tabs}</div>
    <div style="margin-top:14px;display:flex;align-items:center;gap:11px;background:#3c3c3c;border:1px solid #4a4a4a;border-radius:8px;padding:11px 14px;">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9d9d9d" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input id="gf-search" data-input="searchInput" value="${esc(state.searchQuery)}" placeholder="검색어를 입력하세요…" style="flex:1;background:transparent;border:none;outline:none;color:#e8e8e8;font-size:14px;font-family:ui-monospace,'SF Mono',Consolas,monospace;" />
      <span style="font-size:11px;color:#8a8a8a;white-space:nowrap;">${esc(cur.hint)}</span>
    </div>
    ${countLine}
    <div style="margin-top:10px;">${body}</div>
  </div>`;
});

function renderResult(r: SearchResult): string {
  const fileLabel = r.fileHit
    ? `<div style="margin-top:9px;display:flex;align-items:center;gap:8px;font-family:ui-monospace,monospace;font-size:12px;color:#9fc7e8;background:#12222e;border:1px solid #1d3a4d;border-radius:6px;padding:7px 10px;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5a8db0" stroke-width="1.6"><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4"/></svg>
        ${highlight(r.fileHit, r.fileMatch)}</div>`
    : "";
  const hunks =
    r.hunks && r.hunks.length
      ? `<div style="margin-top:9px;display:flex;flex-direction:column;gap:5px;">${r.hunks
          .map(
            (h) => `<div style="background:${h.sign === "+" ? "#13261a" : "#2a1715"};border-radius:6px;padding:7px 10px;">
          <div style="font-family:ui-monospace,monospace;font-size:10.5px;color:#7d7d7d;margin-bottom:3px;">${esc(h.file)}</div>
          <div style="display:flex;gap:8px;font-family:ui-monospace,'SF Mono',Consolas,monospace;font-size:12px;line-height:1.5;">
            <span style="color:${h.sign === "+" ? "#89d185" : "#f48771"};font-weight:700;flex:none;">${h.sign}</span>
            <span style="color:#cdcdcd;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${highlight(h.line, h.matchStart !== undefined ? [h.matchStart, h.matchEnd!] : undefined)}</span>
          </div></div>`
          )
          .join("")}</div>`
      : "";
  return `<div style="border:1px solid #2b2b2b;background:#181818;border-radius:8px;padding:13px 15px;margin-bottom:9px;">
    <div style="display:flex;align-items:center;gap:11px;">
      <span style="font-family:ui-monospace,monospace;font-size:11.5px;color:#e2c08d;background:#2d2a20;padding:2px 6px;border-radius:4px;flex:none;">${esc(r.hash)}</span>
      <span style="flex:1;font-size:13.5px;color:#e2e2e2;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${highlight(r.message, r.msgMatch)}</span>
      <span style="font-size:11.5px;color:#7d7d7d;white-space:nowrap;flex:none;">${highlight(r.author, r.authorMatch)} · ${esc(r.time)}</span>
    </div>
    ${fileLabel}${hunks}
  </div>`;
}
