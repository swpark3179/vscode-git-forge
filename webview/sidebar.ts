import { esc } from "./dom";
import type { State } from "./state";

// Ported from the Git Forge design sidebar (mockup lines 73-148).
// onClick -> data-click, style-hover -> data-hover, {{x}} -> live values.
export function renderSidebar(state: State): string {
  const s = state.snapshot;
  const currentBranch = esc(s?.currentBranch ?? "—");
  const aheadCount = s?.ahead ?? 0;
  const baseBranch = esc(s?.baseBranch ?? "—");
  const masterBehind = s?.masterBehind ?? 0;

  return `
  <div style="display:flex;flex-direction:column;min-height:0;background:#181818;color:#cccccc;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;font-size:13px;">
    <div style="height:35px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 8px 0 14px;">
      <span style="font-size:11px;letter-spacing:.7px;color:#bdbdbd;font-weight:600;">GIT FORGE</span>
      <div style="display:flex;gap:2px;color:#858585;">
        <span data-click="refresh" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:5px;" data-hover="background:#2a2d2e;">&#x21bb;</span>
      </div>
    </div>

    <!-- branch context -->
    <div style="margin:2px 10px 6px;padding:9px 11px;background:#202020;border:1px solid #2b2b2b;border-radius:6px;">
      <div style="display:flex;align-items:center;gap:7px;font-size:12.5px;color:#e8e8e8;">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="#0098ff"><path d="M5 3.5a2 2 0 1 0-2.4 1.96v5.08a2 2 0 1 0 1 0V8.7c.4.2.86.3 1.4.3h1.7a2 2 0 0 0 2-2V5.46a2 2 0 1 0-1 0V7a1 1 0 0 1-1 1H5.6c-.36 0-.6-.13-.6-.5V5.46c.6-.34 1-.98 1-1.96z"/></svg>
        <span style="font-weight:600;">${currentBranch}</span>
      </div>
      <div style="margin-top:6px;display:flex;align-items:center;gap:12px;font-size:11px;color:#9d9d9d;">
        <span style="display:flex;align-items:center;gap:3px;color:#89d185;">&#8593;${aheadCount}개 앞섬</span>
        <span style="display:flex;align-items:center;gap:3px;">&#8595;0 뒤처짐</span>
        <span style="color:#5a5a5a;">·</span>
        <span>기준 <b style="color:#bdbdbd;font-weight:600;">${baseBranch}</b></span>
      </div>
    </div>

    <div style="padding:8px 14px 4px;font-size:11px;letter-spacing:.6px;color:#7a7a7a;font-weight:600;">고급 작업</div>

    <div style="padding:0 8px 16px;">
      <!-- hero -->
      <div data-click="openReforge" style="position:relative;margin:2px 4px 8px;padding:11px 12px;border:1px solid #0098ff;background:linear-gradient(135deg,#0d2b40,#152433);border-radius:8px;cursor:pointer;overflow:hidden;">
        <div style="display:flex;align-items:center;gap:9px;">
          <div style="width:30px;height:30px;flex:none;border-radius:7px;background:#0098ff;display:flex;align-items:center;justify-content:center;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7"><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="12" r="2.4"/><path d="M6 8.4v7.2M8.4 6H14M8.4 18H14M15.6 12H8.4"/></svg>
          </div>
          <div style="min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;"><span style="font-weight:600;font-size:13px;color:#fff;">브랜치 리포지</span><span style="font-size:8.5px;font-weight:700;letter-spacing:.5px;color:#0d2b40;background:#4cc2ff;padding:1px 5px;border-radius:4px;">대표 기능</span></div>
            <div style="font-size:11px;color:#9fc7e8;margin-top:2px;line-height:1.35;">히스토리에서 특정 파일만 외과적으로 제거</div>
          </div>
        </div>
      </div>

      <div data-click="openRestruct" style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin:1px 4px;border-radius:6px;cursor:pointer;" data-hover="background:#2a2d2e;">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#d6a0d0" stroke-width="1.6"><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 8v8M8 6.6c5 .6 4 4.4 8 5.4M8 17.4c5-.6 4-4.4 8-5.4"/></svg>
        <div style="flex:1;min-width:0;"><div style="font-size:13px;color:#e2e2e2;">커밋 재정비</div><div style="font-size:11px;color:#7d7d7d;">커밋 합치기 · 파일 단위 분리</div></div>
      </div>
      <div data-click="openSync" style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin:1px 4px;border-radius:6px;cursor:pointer;" data-hover="background:#2a2d2e;">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#7ec8e8" stroke-width="1.6"><path d="M20 11a8 8 0 0 0-14-4.5L3 9"/><path d="M3 4v5h5"/><path d="M4 13a8 8 0 0 0 14 4.5L21 15"/><path d="M21 20v-5h-5"/></svg>
        <div style="flex:1;min-width:0;"><div style="font-size:13px;color:#e2e2e2;">브랜치 최신화</div><div style="font-size:11px;color:#7d7d7d;">origin/${baseBranch} pull · rebase</div></div>
        <span style="font-size:10px;color:#e2c08d;background:#2e2716;padding:1px 6px;border-radius:9px;">${masterBehind}</span>
      </div>
      <div data-click="openCleanup" style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin:1px 4px;border-radius:6px;cursor:pointer;" data-hover="background:#2a2d2e;">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#7fc8a9" stroke-width="1.6"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12"/></svg>
        <div style="flex:1;min-width:0;"><div style="font-size:13px;color:#e2e2e2;">브랜치 정리</div><div style="font-size:11px;color:#7d7d7d;">병합·오래된 브랜치 정리</div></div>
      </div>
      <div data-click="openReflog" style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin:1px 4px;border-radius:6px;cursor:pointer;" data-hover="background:#2a2d2e;">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#86b8e8" stroke-width="1.6"><path d="M3 12a9 9 0 1 0 3-6.7L3 7"/><path d="M3 3v4h4"/><path d="M12 8v4l3 2"/></svg>
        <div style="flex:1;min-width:0;"><div style="font-size:13px;color:#e2e2e2;">Reflog 복구</div><div style="font-size:11px;color:#7d7d7d;">무엇이든 되돌리기 · HEAD 복원</div></div>
      </div>

      <div style="padding:14px 12px 4px;font-size:11px;letter-spacing:.6px;color:#7a7a7a;font-weight:600;display:flex;align-items:center;gap:7px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7a7a7a" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>이력 탐색
      </div>
      <div data-click="openGraph" style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin:1px 4px;border-radius:6px;cursor:pointer;" data-hover="background:#2a2d2e;">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4cc2ff" stroke-width="1.6"><circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="18" r="2.2"/><circle cx="17" cy="12" r="2.2"/><path d="M6 8.2v7.6M8.1 6.6c5 .6 4.4 4.4 7 5.1M8.1 17.4c5-.6 4.4-4.4 7-5.1"/></svg>
        <div style="flex:1;min-width:0;"><div style="font-size:13px;color:#e2e2e2;">커밋 그래프</div><div style="font-size:11px;color:#7d7d7d;">브랜치·머지 시각화</div></div>
        <span style="font-size:8.5px;font-weight:700;letter-spacing:.4px;color:#0d2b40;background:#4cc2ff;padding:1px 5px;border-radius:4px;">추천</span>
      </div>
      <div data-click="openSearch" style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin:1px 4px;border-radius:6px;cursor:pointer;" data-hover="background:#2a2d2e;">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#89d185" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <div style="flex:1;min-width:0;"><div style="font-size:13px;color:#e2e2e2;">이력 검색</div><div style="font-size:11px;color:#7d7d7d;">메시지·작성자·코드 (pickaxe)</div></div>
      </div>
      <div data-click="openFileHist" style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin:1px 4px;border-radius:6px;cursor:pointer;" data-hover="background:#2a2d2e;">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#e0b56b" stroke-width="1.6"><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4"/><path d="M9 13h6M9 17h4"/></svg>
        <div style="flex:1;min-width:0;"><div style="font-size:13px;color:#e2e2e2;">파일 이력</div><div style="font-size:11px;color:#7d7d7d;">한 파일의 모든 변경 추적</div></div>
      </div>
    </div>
  </div>`;
}
