import { esc } from "../dom";
import { statusColor } from "../util";
import { registerBody } from "../render";
import type { State } from "../state";
import type { FileVersion, DiffLine } from "../../src/shared/protocol";

const statusLabel = (s: string) =>
  s === "A" ? "추가" : s === "D" ? "삭제" : s === "R" ? "이동" : "수정";

registerBody("filehist", (state) => {
  const fhPath = state.fhFile;
  const fileList = state.data.fileList as string[] | null;
  const versions = (state.data.fileHistory[fhPath] as FileVersion[] | undefined) ?? null;

  const picker = renderPicker(state, fileList);

  if (!fhPath) {
    return wrap(picker, `<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#6e6e6e;font-size:13px;">위에서 파일을 검색해 선택하세요.</div>`);
  }
  if (!versions) {
    return wrap(picker, `<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#9d9d9d;font-size:13px;">이력을 불러오는 중…</div>`);
  }

  const selHash = state.fhSel || versions[0]?.hash;
  const authors = [...new Set(versions.map((v) => v.author))];
  const stats = `<div style="margin-top:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
    ${chip("커밋", String(versions.length))}
    ${chip("기여자", `${authors.length}명`, authors.join(", "))}
    ${chip("최초", versions.length ? versions[versions.length - 1].time : "—")}
    ${chip("최근", versions.length ? versions[0].time : "—")}
  </div>`;

  const timeline = versions
    .map((v, i) => {
      const sel = v.hash === selHash;
      return `<div data-click="fhSelect" data-arg="${esc(v.hash)}" style="display:flex;gap:13px;cursor:pointer;">
        <div style="display:flex;flex-direction:column;align-items:center;flex:none;width:18px;">
          <div style="width:14px;height:14px;border-radius:50%;background:${sel ? "#0098ff" : "#1f1f1f"};border:2px solid ${sel ? "#0098ff" : "#3a6a8a"};margin-top:13px;"></div>
          <div style="width:2px;flex:1;min-height:18px;background:#2b2b2b;"></div>
        </div>
        <div style="flex:1;min-width:0;margin-bottom:6px;border:1px solid ${sel ? "#0098ff" : "#262626"};background:${sel ? "#0d2233" : "transparent"};border-radius:8px;padding:11px 13px;" data-hover="background:#202020;">
          <div style="display:flex;align-items:center;gap:9px;">
            <span style="font-family:ui-monospace,Consolas,monospace;font-size:11.5px;color:#e2c08d;background:#2d2a20;padding:2px 6px;border-radius:4px;flex:none;">${esc(v.hash)}</span>
            <span style="flex:1;font-size:13.5px;color:#e8e8e8;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(v.msg)}</span>
            <span style="font-size:10px;font-weight:700;color:${statusColor(v.status)};border:1px solid ${statusColor(v.status)};border-radius:4px;padding:1px 6px;flex:none;">${statusLabel(v.status)}</span>
          </div>
          <div style="margin-top:7px;display:flex;align-items:center;gap:10px;font-size:11.5px;color:#7d7d7d;">
            <span>${esc(v.author)} · ${esc(v.time)}</span>
            <span style="margin-left:auto;font-family:ui-monospace,monospace;"><span style="color:#89d185;">+${v.add}</span> <span style="color:#f48771;">&#8722;${v.del}</span></span>
            ${i === 0 ? `<span style="font-size:10px;color:#4cc2ff;background:#0d2b40;padding:1px 7px;border-radius:9px;">현재 버전</span>` : ""}
          </div>
        </div>
      </div>`;
    })
    .join("");

  const detail = renderDetail(state, versions, selHash);

  const body = `${stats}
    <div style="flex:1;display:flex;min-height:0;">
      <div style="flex:1.25;overflow-y:auto;min-width:0;padding:14px 8px 24px 18px;">${timeline}</div>
      <div style="flex:1;max-width:400px;min-width:320px;border-left:1px solid #242424;background:#181818;overflow-y:auto;">${detail}</div>
    </div>`;
  return wrap(picker, body);
});

function wrap(picker: string, body: string): string {
  return `<div style="height:100%;display:flex;flex-direction:column;min-height:0;">
    <div style="flex:none;padding:18px 26px 14px;border-bottom:1px solid #242424;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px;">
        <div style="min-width:0;">
          <div style="font-size:21px;font-weight:600;color:#f3f3f3;">파일 이력</div>
          <div style="font-size:13px;color:#9d9d9d;margin-top:3px;line-height:1.5;">한 파일이 거쳐온 모든 커밋을 시간순으로. 커밋을 클릭해 그 시점의 변경 내용을 확인하세요.</div>
        </div>
        ${picker}
      </div>
    </div>
    ${body}
  </div>`;
}

function renderPicker(state: State, fileList: string[] | null): string {
  const q = state.fhQuery.toLowerCase().trim();
  const matches = (fileList ?? []).filter((p) => !q || p.toLowerCase().includes(q)).slice(0, 60);
  const dropdown = state.fhFocus
    ? `<div style="position:absolute;top:62px;left:0;right:0;background:#252526;border:1px solid #454545;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.5);z-index:20;overflow:hidden;max-height:280px;overflow-y:auto;">
        ${matches.length
          ? matches
              .map(
                (p) => `<div data-mousedown="fhChoose" data-arg="${esc(p)}" style="padding:8px 11px;cursor:pointer;display:flex;align-items:center;gap:9px;background:${p === state.fhFile ? "#04395e" : "transparent"};" data-hover="background:#04395e;">
            <span style="width:12px;color:#0098ff;flex:none;">${p === state.fhFile ? "✓" : ""}</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7d7d7d" stroke-width="1.6" style="flex:none;"><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4"/></svg>
            <span style="flex:1;font-family:ui-monospace,Consolas,monospace;font-size:12px;color:#dcdcdc;min-width:0;overflow:hidden;text-overflow:ellipsis;">${esc(p)}</span>
          </div>`
              )
              .join("")
          : `<div style="padding:14px 12px;text-align:center;font-size:12px;color:#6e6e6e;">일치하는 파일이 없습니다.</div>`}
      </div>`
    : "";
  return `<div style="position:relative;flex:none;width:300px;">
    <div style="font-size:11px;color:#7d7d7d;margin-bottom:5px;letter-spacing:.4px;">파일 검색</div>
    <div style="display:flex;align-items:center;gap:9px;background:#3c3c3c;border:1px solid ${state.fhFocus ? "#0098ff" : "#4a4a4a"};border-radius:6px;padding:8px 11px;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9d9d9d" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input id="gf-fh" data-input="fhSearchInput" data-focus="fhFocusOn" data-blur="fhFocusOff" value="${esc(state.fhQuery)}" placeholder="파일명·경로로 검색…" style="flex:1;min-width:0;background:transparent;border:none;outline:none;color:#e8e8e8;font-size:12.5px;font-family:ui-monospace,Consolas,monospace;" />
    </div>
    <div style="margin-top:5px;display:flex;align-items:center;gap:6px;font-size:11px;color:#7d7d7d;">
      <span>현재</span>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#e0b56b" stroke-width="1.8"><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4"/></svg>
      <span style="font-family:ui-monospace,Consolas,monospace;color:#bdbdbd;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(state.fhFile || "—")}</span>
    </div>
    ${dropdown}
  </div>`;
}

function chip(label: string, value: string, extra?: string): string {
  return `<span style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:#dcdcdc;background:#181818;border:1px solid #2b2b2b;border-radius:16px;padding:4px 12px;"><span style="color:#7d7d7d;">${esc(label)}</span> <b style="color:#e8e8e8;">${esc(value)}</b>${extra ? ` <span style="color:#8a8a8a;">· ${esc(extra)}</span>` : ""}</span>`;
}

function renderDetail(state: State, versions: FileVersion[], selHash: string): string {
  const v = versions.find((x) => x.hash === selHash) || versions[0];
  if (!v) return "";
  const idx = versions.findIndex((x) => x.hash === selHash);
  const ordinal = `전체 ${versions.length}개 중 ${idx + 1}번째 변경`;
  const diffKey = `${state.fhFile}@${v.hash}`;
  const diffData = state.data.fileDiffs[diffKey] as
    | { hunkOld: number; hunkNew: number; diff: DiffLine[] }
    | undefined;

  let diffBlock: string;
  if (!diffData) {
    diffBlock = `<div style="margin-top:9px;font-size:12px;color:#7d7d7d;">변경 내용을 불러오는 중…</div>`;
  } else {
    let oldN = diffData.hunkOld;
    let newN = diffData.hunkNew;
    const oldCount = diffData.diff.filter((d) => d.sign !== "+").length;
    const newCount = diffData.diff.filter((d) => d.sign !== "-").length;
    const rows = diffData.diff
      .map((d) => {
        const isAdd = d.sign === "+";
        const isDel = d.sign === "-";
        const oldNo = isAdd ? "" : String(oldN++);
        const newNo = isDel ? "" : String(newN++);
        const bg = isAdd ? "#11281b" : isDel ? "#2c1614" : "transparent";
        const gutter = isAdd ? "#1e3a28" : isDel ? "#4a2420" : "transparent";
        const color = isAdd ? "#89d185" : isDel ? "#f48771" : "#6e6e6e";
        return `<div style="display:flex;align-items:stretch;background:${bg};font-family:ui-monospace,'SF Mono',Consolas,monospace;font-size:12px;line-height:1.85;">
          <span style="width:34px;flex:none;text-align:right;padding-right:7px;color:#5c5c5c;background:#191919;border-right:1px solid #262626;">${oldNo}</span>
          <span style="width:34px;flex:none;text-align:right;padding-right:7px;color:#5c5c5c;background:#191919;border-right:1px solid #262626;">${newNo}</span>
          <span style="width:18px;flex:none;text-align:center;color:${color};font-weight:700;background:${gutter};">${d.sign === " " ? "" : d.sign}</span>
          <span style="flex:1;padding:0 10px;color:#dcdcdc;white-space:pre;overflow:hidden;text-overflow:ellipsis;">${esc(d.line)}</span>
        </div>`;
      })
      .join("");
    diffBlock = `<div style="margin-top:9px;border:1px solid #2b2b2b;border-radius:8px;overflow:hidden;background:#1c1c1c;">
      <div style="display:flex;align-items:center;gap:8px;padding:8px 11px;background:#202020;border-bottom:1px solid #2b2b2b;font-family:ui-monospace,monospace;font-size:11.5px;color:#bdbdbd;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5a8db0" stroke-width="1.6"><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4"/></svg>
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;">${esc(state.fhFile)}</span>
      </div>
      <div style="display:flex;align-items:stretch;background:#1a2330;font-family:ui-monospace,'SF Mono',Consolas,monospace;font-size:11px;line-height:1.9;color:#6f9fc4;">
        <span style="width:78px;flex:none;text-align:center;border-right:1px solid #2b2b2b;">&#8230;</span>
        <span style="flex:1;padding:0 10px;">@@ -${diffData.hunkOld},${oldCount} +${diffData.hunkNew},${newCount} @@</span>
      </div>
      ${rows}
    </div>`;
  }

  const flash =
    state.fhOpenedAt === v.hash
      ? `<div style="margin-top:8px;display:flex;align-items:center;gap:7px;font-size:11.5px;color:#89d185;background:#16291d;border:1px solid #2e5a3f;border-radius:6px;padding:7px 10px;"><span>&#x2713;</span><span style="font-family:ui-monospace,monospace;">${esc(v.hash)} 버전을 읽기 전용으로 열었습니다</span></div>`
      : "";

  return `<div style="padding:20px 22px;">
    <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;">
      <span style="font-family:ui-monospace,monospace;font-size:13.5px;color:#e2c08d;background:#2d2a20;padding:3px 8px;border-radius:5px;">${esc(v.hash)}</span>
      <span style="font-size:10.5px;font-weight:700;color:${statusColor(v.status)};border:1px solid ${statusColor(v.status)};border-radius:5px;padding:2px 8px;">${statusLabel(v.status)}</span>
    </div>
    <div style="font-size:15px;color:#f3f3f3;font-weight:600;margin-top:13px;line-height:1.45;">${esc(v.msg)}</div>
    <div style="margin-top:14px;border-top:1px solid #2b2b2b;padding-top:14px;display:flex;flex-direction:column;gap:10px;font-size:12.5px;">
      <div style="display:flex;gap:10px;"><span style="color:#7d7d7d;width:56px;flex:none;">작성자</span><span style="color:#dcdcdc;">${esc(v.author)} · ${esc(v.time)}</span></div>
      <div style="display:flex;gap:10px;"><span style="color:#7d7d7d;width:56px;flex:none;">파일</span><span style="font-family:ui-monospace,monospace;color:#9fc7e8;min-width:0;overflow:hidden;text-overflow:ellipsis;">${esc(state.fhFile)}</span></div>
      <div style="display:flex;gap:10px;"><span style="color:#7d7d7d;width:56px;flex:none;">순서</span><span style="color:#dcdcdc;">${esc(ordinal)}</span></div>
    </div>
    <div data-click="fhOpenVersion" style="margin-top:16px;display:flex;align-items:center;justify-content:center;gap:8px;background:#0098ff;color:#fff;font-size:13.5px;font-weight:600;padding:11px;border-radius:7px;cursor:pointer;" data-hover="background:#1aa3ff;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4"/></svg>이 시점 버전 열기
      <span style="font-family:ui-monospace,monospace;font-size:11px;opacity:.85;">${esc(v.hash)}</span>
    </div>
    ${flash}
    <div style="margin-top:20px;display:flex;align-items:center;justify-content:space-between;">
      <span style="font-size:13px;color:#e8e8e8;font-weight:600;">이 버전의 변경 내용</span>
      <span style="font-family:ui-monospace,monospace;font-size:11.5px;"><span style="color:#89d185;">+${v.add}</span> <span style="color:#f48771;">&#8722;${v.del}</span></span>
    </div>
    ${diffBlock}
  </div>`;
}
