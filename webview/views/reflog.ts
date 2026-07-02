import { esc } from "../dom";
import { registerBody } from "../render";
import type { ReflogEntry } from "../../src/shared/protocol";

const actionColor = (a: string): string => {
  if (a === "commit") return "#89d185";
  if (a === "reset") return "#e2c08d";
  if (a === "rebase") return "#d6a0d0";
  if (a === "checkout") return "#7ec8e8";
  if (a === "git-forge-backup") return "#4cc2ff";
  return "#9d9d9d";
};

registerBody("reflog", (state) => {
  const entries = state.data.reflog as ReflogEntry[] | null;
  if (!entries) return `<div style="padding:40px;color:#9d9d9d;font-size:13px;">reflog를 불러오는 중…</div>`;

  const moving = state.reflogMovingTo
    ? `<div style="margin-top:16px;background:#13283d;border:1px solid #2a5a8a;border-radius:8px;padding:11px 15px;display:flex;align-items:center;gap:10px;"><div style="width:15px;height:15px;border:2px solid #4cc2ff;border-top-color:transparent;border-radius:50%;animation:gf-spin .7s linear infinite;"></div><span style="font-size:12.5px;color:#9fc7e8;">HEAD 이동 중…</span></div>`
    : "";

  const rows = entries
    .map((r, i) => {
      const isCurrent = (r as any).isCurrent || (i === 0 && !r.isBackup);
      const isMoving = state.reflogMovingTo === r.fullHash;
      const canRestore = !isCurrent;
      const ac = actionColor(r.action);
      const dot = isMoving
        ? `<div style="width:11px;height:11px;border:2px solid #4cc2ff;border-top-color:transparent;border-radius:50%;animation:gf-spin .7s linear infinite;"></div>`
        : isCurrent
        ? `<div style="width:8px;height:8px;border-radius:50%;background:#fff;"></div>`
        : "";
      return `<div style="display:flex;gap:14px;">
        <div style="display:flex;flex-direction:column;align-items:center;flex:none;">
          <div style="width:26px;height:26px;border-radius:50%;background:${isCurrent ? "#0d2b40" : "#1f1f1f"};border:1.5px solid ${isCurrent ? "#0098ff" : "#3a3a3a"};display:flex;align-items:center;justify-content:center;">${dot}</div>
          <div style="width:2px;flex:1;min-height:20px;background:#2b2b2b;"></div>
        </div>
        <div style="flex:1;padding-bottom:14px;min-width:0;">
          <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;">
            <span style="font-family:ui-monospace,Consolas,monospace;font-size:12px;color:#9d9d9d;">${esc(r.ref)}</span>
            <span style="font-family:ui-monospace,Consolas,monospace;font-size:10.5px;font-weight:700;text-transform:uppercase;color:${ac};border:1px solid ${ac};border-radius:4px;padding:1px 6px;">${esc(r.action)}</span>
            <span style="font-family:ui-monospace,Consolas,monospace;font-size:12px;color:#e2c08d;">${esc(r.hash)}</span>
            ${isCurrent ? `<span style="font-size:10px;color:#4cc2ff;background:#0d2b40;padding:2px 8px;border-radius:9px;">현재 HEAD</span>` : ""}
            ${r.isBackup ? `<span style="font-size:10px;color:#e2c08d;background:#2e2716;padding:2px 8px;border-radius:9px;">Git Forge 백업</span>` : ""}
            ${r.when ? `<span style="margin-left:auto;font-size:11px;color:#6e6e6e;">${esc(r.when)}</span>` : `<span style="margin-left:auto;"></span>`}
            ${canRestore ? `<span data-click="reflogRestore" data-arg="${esc(r.fullHash)}" style="font-size:11.5px;color:#4cc2ff;cursor:pointer;border:1px solid #2a5a8a;background:#0d2b40;padding:4px 10px;border-radius:6px;white-space:nowrap;" data-hover="background:#14344f;">여기로 복원</span>` : ""}
          </div>
          <div style="font-size:12.5px;color:#cdcdcd;margin-top:5px;">${esc(r.desc)}</div>
        </div>
      </div>`;
    })
    .join("");

  return `<div style="max-width:760px;margin:0 auto;padding:24px 30px 50px;">
    <div style="font-size:21px;font-weight:600;color:#f3f3f3;">Reflog 복구</div>
    <div style="font-size:13px;color:#9d9d9d;margin-top:4px;line-height:1.5;">HEAD가 거쳐온 모든 이동 — reset과 rebase 포함. 가리키는 브랜치가 없는 상태로도 되돌아갈 수 있습니다.</div>
    ${moving}
    <div style="margin-top:18px;">${rows}</div>
  </div>`;
});
