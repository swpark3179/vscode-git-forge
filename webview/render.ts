import { esc } from "./dom";
import { buildViewModel, LABELS, type ViewModel } from "./viewModel";
import type { State } from "./state";
import type { ViewName } from "../src/shared/protocol";

// Feature body renderers are registered here; Phase 1 ships Welcome + placeholders.
type BodyRenderer = (state: State, vm: ViewModel) => string;
const bodies: Partial<Record<ViewName, BodyRenderer>> = {};

export function registerBody(view: ViewName, fn: BodyRenderer): void {
  bodies[view] = fn;
}

/** Renders the editor-region chrome (tab strip + breadcrumb + body + status bar). */
export function renderPanel(state: State): string {
  const vm = buildViewModel(state);

  if (!vm.hasRepo) {
    return renderNoRepo(vm);
  }

  const tabStrip = vm.tabs
    .map((t) => {
      const bg = t.active ? "#1f1f1f" : "#2d2d2d";
      const fg = t.active ? "#ffffff" : "#9d9d9d";
      const topbar = t.active ? "inset 0 1.5px 0 #0098ff" : "none";
      const close = t.closable
        ? `<span data-click="closeTab" data-arg="${t.id}" style="margin-left:4px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;border-radius:4px;color:#9d9d9d;" data-hover="background:#333;">&#x2715;</span>`
        : "";
      return `<div data-click="activateTab" data-arg="${t.id}" style="display:flex;align-items:center;gap:8px;padding:0 12px;cursor:pointer;border-right:1px solid #2b2b2b;font-size:13px;white-space:nowrap;background:${bg};color:${fg};box-shadow:${topbar};">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 4l9 16 9-16" stroke="#0098ff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        ${esc(t.label)}${close}
      </div>`;
    })
    .join("");

  const body = (bodies[state.activeTab] ?? renderPlaceholder)(state, vm);

  return `
  <div style="position:fixed;inset:0;display:flex;flex-direction:column;height:100vh;width:100vw;background:#1f1f1f;color:#cccccc;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;font-size:13px;overflow:hidden;-webkit-font-smoothing:antialiased;">
    <div style="height:35px;flex:none;background:#181818;display:flex;align-items:stretch;overflow-x:auto;">${tabStrip}</div>
    <div style="height:24px;flex:none;display:flex;align-items:center;gap:6px;padding:0 16px;font-size:12px;color:#8a8a8a;border-bottom:1px solid #242424;background:#1f1f1f;">
      <span style="color:#0098ff;">Git Forge</span><span>&#8250;</span><span>${esc(vm.crumb)}</span>
    </div>
    <div style="flex:1;overflow-y:auto;min-height:0;">${body}</div>
    <div style="height:24px;flex:none;background:#0098ff;display:flex;align-items:center;padding:0 10px;font-size:11.5px;color:#fff;gap:14px;">
      <span style="display:flex;align-items:center;gap:5px;"><svg width="12" height="12" viewBox="0 0 16 16" fill="#fff"><path d="M5 3.5a2 2 0 1 0-2.4 1.96v5.08a2 2 0 1 0 1 0V8.7c.4.2.86.3 1.4.3h1.7a2 2 0 0 0 2-2V5.46a2 2 0 1 0-1 0V7a1 1 0 0 1-1 1H5.6c-.36 0-.6-.13-.6-.5V5.46c.6-.34 1-.98 1-1.96z"/></svg>${esc(vm.currentBranch)}</span>
      <span style="display:flex;align-items:center;gap:4px;">&#8593;${vm.aheadCount} &#8595;${vm.behind}</span>
      <span style="display:flex;align-items:center;gap:4px;">&#x2713; Git Forge 준비됨</span>
      <span style="margin-left:auto;">${esc(vm.repoName)}</span>
    </div>
  </div>`;
}

function renderNoRepo(vm: ViewModel): string {
  const msg = vm.repoError
    ? esc(vm.repoError)
    : "현재 작업 폴더에서 git 저장소를 찾을 수 없습니다. 저장소가 있는 폴더를 여세요.";
  return `<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#1f1f1f;color:#cccccc;font-family:'Segoe UI',system-ui,sans-serif;">
    <div style="text-align:center;max-width:460px;padding:30px;">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" style="margin-bottom:14px;"><path d="M3 4l9 16 9-16" stroke="#0098ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="9" r="2.4" fill="#0098ff"/></svg>
      <div style="font-size:20px;font-weight:300;color:#f3f3f3;margin-bottom:8px;">Git <b style="font-weight:600;">Forge</b></div>
      <div style="font-size:13px;color:#9d9d9d;line-height:1.6;">${msg}</div>
    </div>
  </div>`;
}

function renderPlaceholder(_state: State, vm: ViewModel): string {
  return `<div style="max-width:760px;margin:0 auto;padding:44px 40px;">
    <div style="font-size:21px;font-weight:600;color:#f3f3f3;">${esc(LABELS[vm.activeTab])}</div>
    <div style="margin-top:14px;font-size:13px;color:#9d9d9d;line-height:1.6;">이 기능은 곧 제공됩니다.</div>
  </div>`;
}

// ---- WELCOME (design lines 172-250) ----
registerBody("welcome", (_state, vm) => {
  const { currentBranch, aheadCount, baseBranch, dirtyCount } = vm;
  return `
  <div style="max-width:860px;margin:0 auto;padding:44px 40px 64px;">
    <div style="display:flex;align-items:center;gap:14px;">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M3 4l9 16 9-16" stroke="#0098ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="9" r="2.4" fill="#0098ff"/></svg>
      <div>
        <div style="font-size:30px;font-weight:300;letter-spacing:-.5px;color:#f3f3f3;">Git <span style="font-weight:600;">Forge</span></div>
        <div style="font-size:14px;color:#9d9d9d;margin-top:1px;">고급 Git 작업 — 안전하고, 시각적이며, 되돌릴 수 있게.</div>
      </div>
    </div>

    <div style="margin-top:26px;display:flex;align-items:center;gap:0;background:#181818;border:1px solid #2b2b2b;border-radius:8px;overflow:hidden;">
      <div style="flex:1;padding:14px 18px;border-right:1px solid #2b2b2b;"><div style="font-size:11px;color:#7d7d7d;letter-spacing:.5px;">현재 브랜치</div><div style="font-size:14px;color:#e8e8e8;margin-top:3px;font-weight:600;">${esc(currentBranch)}</div></div>
      <div style="flex:1;padding:14px 18px;border-right:1px solid #2b2b2b;"><div style="font-size:11px;color:#7d7d7d;letter-spacing:.5px;">기준 대비</div><div style="font-size:14px;margin-top:3px;"><span style="color:#89d185;font-weight:600;">${aheadCount}개 앞섬</span> <span style="color:#7d7d7d;">/ 뒤처짐 ${vm.behind} (${esc(baseBranch)} 기준)</span></div></div>
      <div style="flex:1;padding:14px 18px;"><div style="font-size:11px;color:#7d7d7d;letter-spacing:.5px;">작업 트리</div><div style="font-size:14px;color:#e2c08d;margin-top:3px;font-weight:600;">커밋 안 된 변경 ${dirtyCount}개</div></div>
    </div>

    <div data-click="openReforge" style="margin-top:24px;border:1px solid #0098ff;border-radius:10px;background:linear-gradient(135deg,#0e2c42 0%,#15212e 60%,#1a1d24 100%);padding:22px 24px;cursor:pointer;display:flex;align-items:center;gap:20px;">
      <div style="width:54px;height:54px;flex:none;border-radius:12px;background:#0098ff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(0,152,255,.35);">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7"><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="12" r="2.4"/><path d="M6 8.4v7.2M8.4 6H14M8.4 18H14M15.6 12H8.4"/></svg>
      </div>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:8px;"><span style="font-size:18px;font-weight:600;color:#fff;">브랜치 리포지</span><span style="font-size:9px;font-weight:700;letter-spacing:.5px;color:#0d2b40;background:#4cc2ff;padding:2px 7px;border-radius:5px;">대표 기능</span></div>
        <div style="font-size:13.5px;color:#a9cce6;margin-top:5px;line-height:1.5;max-width:560px;">기준 브랜치를 고르면 내 브랜치에만 있는 커밋과 파일이 정확히 보입니다. 원치 않는 파일을 골라내면 stash · reset · 재적용 · 복원이 하나의 안전한 작업으로 실행됩니다.</div>
      </div>
      <div style="flex:none;display:flex;align-items:center;gap:7px;background:#0098ff;color:#fff;font-weight:600;font-size:13px;padding:9px 16px;border-radius:7px;">열기<span style="font-size:15px;">&#8594;</span></div>
    </div>

    <div style="margin-top:30px;font-size:11px;letter-spacing:.6px;color:#7d7d7d;font-weight:600;">더 많은 작업</div>
    <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div data-click="openRestruct" style="border:1px solid #2b2b2b;background:#181818;border-radius:8px;padding:16px;cursor:pointer;" data-hover="border-color:#444;background:#1d1d1d;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d6a0d0" stroke-width="1.6"><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 8v8M8 6.6c5 .6 4 4.4 8 5.4M8 17.4c5-.6 4-4.4 8-5.4"/></svg>
        <div style="font-size:14px;color:#e8e8e8;margin-top:10px;font-weight:600;">커밋 재정비</div>
        <div style="font-size:12px;color:#8a8a8a;margin-top:4px;line-height:1.5;">여러 커밋을 하나로 합치거나, 한 커밋의 파일 일부를 새 커밋으로 분리.</div>
      </div>
      <div data-click="openSync" style="border:1px solid #2b2b2b;background:#181818;border-radius:8px;padding:16px;cursor:pointer;" data-hover="border-color:#444;background:#1d1d1d;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7ec8e8" stroke-width="1.6"><path d="M20 11a8 8 0 0 0-14-4.5L3 9"/><path d="M3 4v5h5"/><path d="M4 13a8 8 0 0 0 14 4.5L21 15"/><path d="M21 20v-5h-5"/></svg>
        <div style="font-size:14px;color:#e8e8e8;margin-top:10px;font-weight:600;">브랜치 최신화</div>
        <div style="font-size:12px;color:#8a8a8a;margin-top:4px;line-height:1.5;">origin/${esc(baseBranch)}를 로컬로 받아 작업 브랜치에 rebase로 최신화.</div>
      </div>
      <div data-click="openCleanup" style="border:1px solid #2b2b2b;background:#181818;border-radius:8px;padding:16px;cursor:pointer;" data-hover="border-color:#444;background:#1d1d1d;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7fc8a9" stroke-width="1.6"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12"/></svg>
        <div style="font-size:14px;color:#e8e8e8;margin-top:10px;font-weight:600;">브랜치 정리</div>
        <div style="font-size:12px;color:#8a8a8a;margin-top:4px;line-height:1.5;">병합·오래된 로컬 브랜치를 한 번의 확인으로 일괄 정리.</div>
      </div>
      <div data-click="openReflog" style="border:1px solid #2b2b2b;background:#181818;border-radius:8px;padding:16px;cursor:pointer;grid-column:span 2;" data-hover="border-color:#444;background:#1d1d1d;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#86b8e8" stroke-width="1.6"><path d="M3 12a9 9 0 1 0 3-6.7L3 7"/><path d="M3 3v4h4"/><path d="M12 8v4l3 2"/></svg>
        <div style="font-size:14px;color:#e8e8e8;margin-top:10px;font-weight:600;">Reflog 복구</div>
        <div style="font-size:12px;color:#8a8a8a;margin-top:4px;line-height:1.5;">모든 작업이 기록됩니다 — reset 후에도 이전 상태로 HEAD를 되돌리세요.</div>
      </div>
    </div>

    <div style="margin-top:30px;display:flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.6px;color:#7d7d7d;font-weight:600;">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7d7d7d" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>이력 탐색 · 이해
    </div>
    <div data-click="openGraph" style="margin-top:12px;border:1px solid #235a78;border-radius:10px;background:linear-gradient(135deg,#0c2535 0%,#15212e 60%,#1a1d24 100%);padding:20px 22px;cursor:pointer;display:flex;align-items:center;gap:18px;" data-hover="border-color:#0098ff;">
      <div style="width:48px;height:48px;flex:none;border-radius:11px;background:#0d2b40;border:1px solid #235a78;display:flex;align-items:center;justify-content:center;">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4cc2ff" stroke-width="1.7"><circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="18" r="2.2"/><circle cx="17" cy="12" r="2.2"/><path d="M6 8.2v7.6M8.1 6.6c5 .6 4.4 4.4 7 5.1M8.1 17.4c5-.6 4.4-4.4 7-5.1"/></svg>
      </div>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:8px;"><span style="font-size:17px;font-weight:600;color:#fff;">커밋 그래프</span><span style="font-size:9px;font-weight:700;letter-spacing:.5px;color:#0d2b40;background:#4cc2ff;padding:2px 7px;border-radius:5px;">추천</span></div>
        <div style="font-size:13px;color:#a9cce6;margin-top:4px;line-height:1.5;max-width:560px;">브랜치가 어떻게 갈라지고 합쳐졌는지 한눈에. 커밋을 클릭하면 변경 파일·부모·태그까지 바로 확인됩니다.</div>
      </div>
      <div style="flex:none;display:flex;align-items:center;gap:6px;background:#0098ff;color:#fff;font-weight:600;font-size:13px;padding:8px 15px;border-radius:7px;">열기<span style="font-size:15px;">&#8594;</span></div>
    </div>
    <div style="margin-top:12px;display:grid;grid-template-columns:1fr;gap:12px;">
      <div data-click="openSearch" style="border:1px solid #2b2b2b;background:#181818;border-radius:8px;padding:16px;cursor:pointer;" data-hover="border-color:#444;background:#1d1d1d;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#89d185" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <div style="font-size:14px;color:#e8e8e8;margin-top:10px;font-weight:600;">이력 검색</div>
        <div style="font-size:12px;color:#8a8a8a;margin-top:4px;line-height:1.5;">메시지·작성자·파일은 물론, 코드 한 줄이 언제 들어왔는지까지(pickaxe).</div>
      </div>
      <div data-click="openFileHist" style="border:1px solid #2b2b2b;background:#181818;border-radius:8px;padding:16px;cursor:pointer;" data-hover="border-color:#444;background:#1d1d1d;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e0b56b" stroke-width="1.6"><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4"/></svg>
        <div style="font-size:14px;color:#e8e8e8;margin-top:10px;font-weight:600;">파일 이력</div>
        <div style="font-size:12px;color:#8a8a8a;margin-top:4px;line-height:1.5;">파일 하나를 골라 그 파일을 건드린 모든 커밋과 변경 내용을 시간순으로 확인.</div>
      </div>
    </div>
  </div>`;
});
