import { esc } from "../dom";
import { registerBody } from "../render";
import { renderActiveOp } from "./runner";
import type { State } from "../state";

interface SyncPreview {
  def: string;
  incoming: Array<{ hash: string; msg: string; author: string }>;
}

function setupView(state: State): string {
  const cur = esc(state.snapshot?.currentBranch ?? "—");
  const def = state.baseBranch || state.snapshot?.baseBranch || "master";
  const preview = state.data.syncPreview as SyncPreview | null;
  const incoming = preview?.incoming ?? [];
  const masterBehind = state.snapshot?.masterBehind ?? incoming.length;
  const ahead = state.snapshot?.ahead ?? 0;
  const isRebase = state.syncMode === "rebase";

  const radio = (on: boolean, color: string) =>
    `<div style="width:18px;height:18px;flex:none;border-radius:50%;border:2px solid ${on ? color : "#5a5a5a"};display:flex;align-items:center;justify-content:center;"><div style="width:8px;height:8px;border-radius:50%;background:${on ? color : "transparent"};"></div></div>`;

  const incomingRows = incoming.length
    ? incoming
        .map(
          (c) => `<div style="display:flex;align-items:center;gap:11px;padding:10px 14px;border-bottom:1px solid #202020;">
        <span style="width:8px;height:8px;flex:none;border-radius:50%;background:#7ec8e8;"></span>
        <span style="font-family:ui-monospace,Consolas,monospace;font-size:12px;color:#e2c08d;background:#2d2a20;padding:2px 6px;border-radius:4px;">${esc(c.hash)}</span>
        <span style="flex:1;font-size:13px;color:#e2e2e2;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(c.msg)}</span>
        <span style="font-size:11px;color:#7d7d7d;white-space:nowrap;">${esc(c.author)}</span>
      </div>`
        )
        .join("")
    : `<div style="padding:14px;font-size:12.5px;color:#7d7d7d;text-align:center;">${preview ? `origin/${esc(def)}에 새 커밋이 없습니다.` : "원격 정보를 불러오는 중…"}</div>`;

  return `<div style="height:100%;display:flex;flex-direction:column;min-height:0;">
    <div style="max-width:880px;margin:0 auto;width:100%;padding:24px 30px 50px;">
      <div style="font-size:21px;font-weight:600;color:#f3f3f3;">브랜치 최신화</div>
      <div style="font-size:13px;color:#9d9d9d;margin-top:4px;line-height:1.5;max-width:620px;">지금 <b style="color:#ccc;">${cur}</b>에서 작업 중입니다. origin의 <b style="color:#ccc;">${esc(def)}</b>를 로컬로 받아온 뒤, 작업 브랜치를 그 위에 다시 올려 최신 상태로 맞춥니다.</div>

      <div style="margin-top:22px;display:flex;align-items:stretch;gap:0;background:#181818;border:1px solid #2b2b2b;border-radius:10px;overflow:hidden;">
        <div style="flex:1;padding:16px 18px;display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;gap:7px;font-size:11px;letter-spacing:.4px;color:#7d7d7d;font-weight:600;"><span style="width:7px;height:7px;border-radius:50%;background:#7ec8e8;"></span>ORIGIN/${esc(def.toUpperCase())}</div>
          <div style="font-size:13px;color:#e8e8e8;font-weight:600;">원격 최신</div>
          <div style="font-size:11.5px;color:#89d185;">새 커밋 ${masterBehind}개</div>
        </div>
        <div style="flex:none;display:flex;align-items:center;color:#5a5a5a;padding:0 4px;">&#8594;</div>
        <div style="flex:1;padding:16px 18px;border-left:1px solid #242424;display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;gap:7px;font-size:11px;letter-spacing:.4px;color:#7d7d7d;font-weight:600;"><span style="width:7px;height:7px;border-radius:50%;background:#9d9d9d;"></span>LOCAL ${esc(def.toUpperCase())}</div>
          <div style="font-size:13px;color:#e8e8e8;font-weight:600;">ff-only pull</div>
          <div style="font-size:11.5px;color:#e2c08d;">${masterBehind}개 뒤처짐</div>
        </div>
        <div style="flex:none;display:flex;align-items:center;color:#5a5a5a;padding:0 4px;">&#8594;</div>
        <div style="flex:1;padding:16px 18px;border-left:1px solid #242424;display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;gap:7px;font-size:11px;letter-spacing:.4px;color:#7d7d7d;font-weight:600;"><span style="width:7px;height:7px;border-radius:50%;background:#0098ff;"></span>${cur.toUpperCase()}</div>
          <div style="font-size:13px;color:#e8e8e8;font-weight:600;">${esc(def)} 위로 ${isRebase ? "rebase" : "merge"}</div>
          <div style="font-size:11.5px;color:#89d185;">내 커밋 ${ahead}개 ${isRebase ? "재적용" : "유지"}</div>
        </div>
      </div>

      <div style="margin-top:24px;font-size:12px;font-weight:600;color:#bdbdbd;letter-spacing:.4px;">${esc(def)}에 추가된 커밋</div>
      <div style="margin-top:10px;border:1px solid #2b2b2b;background:#181818;border-radius:9px;overflow:hidden;">${incomingRows}</div>

      <div style="margin-top:24px;font-size:12px;font-weight:600;color:#bdbdbd;letter-spacing:.4px;">최신화 방식</div>
      <div data-click="syncSetRebase" style="margin-top:10px;display:flex;gap:13px;padding:14px;border:1.5px solid ${isRebase ? "#0098ff" : "#2b2b2b"};background:${isRebase ? "#0d2233" : "#181818"};border-radius:9px;cursor:pointer;">
        ${radio(isRebase, "#0098ff")}
        <div style="flex:1;">
          <div style="font-size:13.5px;color:#e8e8e8;font-weight:600;display:flex;align-items:center;gap:8px;">rebase <span style="font-size:9px;font-weight:700;color:#0d2b40;background:#4cc2ff;padding:1px 6px;border-radius:4px;">권장</span></div>
          <div style="font-size:12px;color:#9d9d9d;margin-top:4px;line-height:1.5;">내 커밋을 최신 ${esc(def)} 위에 한 줄로 다시 쌓습니다. 병합 커밋 없이 히스토리가 깔끔하게 유지됩니다. <span style="font-family:ui-monospace,monospace;color:#cdcdcd;">git rebase ${esc(def)}</span></div>
        </div>
      </div>
      <div data-click="syncSetMerge" style="margin-top:9px;display:flex;gap:13px;padding:14px;border:1.5px solid ${!isRebase ? "#0098ff" : "#2b2b2b"};background:${!isRebase ? "#0d2233" : "#181818"};border-radius:9px;cursor:pointer;">
        ${radio(!isRebase, "#0098ff")}
        <div style="flex:1;">
          <div style="font-size:13.5px;color:#e8e8e8;font-weight:600;">merge</div>
          <div style="font-size:12px;color:#9d9d9d;margin-top:4px;line-height:1.5;">${esc(def)}를 작업 브랜치로 병합합니다. 병합 커밋이 하나 생기지만 기존 커밋 해시는 그대로 보존됩니다. <span style="font-family:ui-monospace,monospace;color:#cdcdcd;">git merge ${esc(def)}</span></div>
        </div>
      </div>

      <div data-click="runSync" style="margin-top:20px;display:flex;align-items:center;justify-content:center;gap:9px;background:#0098ff;color:#fff;font-weight:600;font-size:13.5px;padding:12px;border-radius:8px;cursor:pointer;" data-hover="background:#1aa3ff;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M20 11a8 8 0 0 0-14-4.5L3 9"/><path d="M3 4v5h5"/><path d="M4 13a8 8 0 0 0 14 4.5L21 15"/><path d="M21 20v-5h-5"/></svg>
        ${cur} 최신화 실행
      </div>
      <div style="text-align:center;font-size:10.5px;color:#6e6e6e;margin-top:7px;">${isRebase ? "병합 커밋 없음" : "병합 커밋 1개 생성"} · 실행 전 백업 ref 생성</div>
    </div>
  </div>`;
}

registerBody("sync", (state) => {
  if (state.syncPhase === "setup") return setupView(state);
  const cur = esc(state.snapshot?.currentBranch ?? "—");
  return `<div style="height:100%;display:flex;flex-direction:column;min-height:0;">${renderActiveOp(state, {
    phase: state.syncPhase as any,
    accent: "#0098ff",
    channel: "sync",
    runningTitle: `${cur} 최신화 진행 중…`,
    doneTitle: "최신화 완료",
    doneSub: `${cur}을(를) 최신 기준으로 정렬했습니다.`,
    doneFooter: `<div style="margin-top:14px;background:#13261c;border:1px solid #2a4a36;border-radius:8px;padding:13px 15px;font-size:12px;color:#a9c9b6;line-height:1.6;">이전 tip은 백업 ref에 저장됨.</div>
      <div style="margin-top:18px;display:flex;gap:10px;">
        <div data-click="undoLast" style="flex:1;text-align:center;background:#3c3c3c;border:1px solid #4a4a4a;color:#e8e8e8;font-size:13px;font-weight:600;padding:10px;border-radius:7px;cursor:pointer;" data-hover="background:#464646;">되돌리기 (tip 복원)</div>
        <div data-click="syncReset" style="flex:1;text-align:center;background:#0098ff;color:#fff;font-size:13px;font-weight:600;padding:10px;border-radius:7px;cursor:pointer;" data-hover="background:#1aa3ff;">완료</div>
      </div>`,
    errorActions: `<div style="margin-top:18px;display:flex;gap:10px;">
        <div data-click="syncReset" style="flex:1;text-align:center;background:#3c3c3c;border:1px solid #4a4a4a;color:#e8e8e8;font-size:13px;font-weight:600;padding:10px;border-radius:7px;cursor:pointer;">설정으로</div>
        <div data-click="undoLast" style="flex:1;text-align:center;background:#c74e39;color:#fff;font-size:13px;font-weight:600;padding:10px;border-radius:7px;cursor:pointer;">백업 복원</div>
      </div>`,
  })}</div>`;
});
