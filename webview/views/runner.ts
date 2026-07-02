import { esc } from "../dom";
import type { State, StageView, LogView } from "../state";

const LOG_STYLE: Record<LogView["kind"], { sym: string; symColor: string; color: string }> = {
  cmd: { sym: "$", symColor: "#89d185", color: "#cdcdcd" },
  out: { sym: "", symColor: "#7d7d7d", color: "#9d9d9d" },
  pick: { sym: "·", symColor: "#7ec8e8", color: "#cdcdcd" },
  ok: { sym: "✓", symColor: "#89d185", color: "#89d185" },
  err: { sym: "✗", symColor: "#f48771", color: "#f48771" },
};

function stageDot(s: StageView, accent: string): string {
  if (s.status === "done") {
    return `<div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#1e3a28;border:1.5px solid #2e7d4f;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#89d185" stroke-width="2.6"><path d="M5 13l4 4L19 7"/></svg></div>`;
  }
  if (s.status === "running") {
    return `<div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#0d2233;border:1.5px solid ${accent};"><div style="width:14px;height:14px;border:2px solid ${accent};border-top-color:transparent;border-radius:50%;animation:gf-spin .7s linear infinite;"></div></div>`;
  }
  if (s.status === "error" || s.status === "conflict") {
    return `<div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#2a1715;border:1.5px solid #c74e39;color:#f48771;font-weight:700;">!</div>`;
  }
  return `<div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#1f1f1f;border:1.5px solid #3a3a3a;"><div style="width:7px;height:7px;border-radius:50%;background:#555;"></div></div>`;
}

export function renderStageTimeline(state: State, accent: string): string {
  return state.stages
    .map((s) => {
      const labelColor =
        s.status === "pending" ? "#7d7d7d" : s.status === "error" || s.status === "conflict" ? "#f48771" : "#e8e8e8";
      const lineBg = s.status === "done" ? "#2e7d4f" : "#2b2b2b";
      const progress =
        s.total && s.status !== "pending"
          ? (() => {
              const pct = s.total ? Math.round(((s.current ?? 0) / s.total) * 100) : 0;
              return `<div style="margin-top:9px;">
                <div style="height:6px;background:#2b2b2b;border-radius:3px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${accent};border-radius:3px;transition:width .3s ease;"></div></div>
                <div style="display:flex;justify-content:space-between;margin-top:5px;font-size:11px;"><span style="color:#9d9d9d;font-family:ui-monospace,monospace;">${esc(s.detail)}</span><span style="color:#7d7d7d;">${s.current ?? 0}/${s.total}</span></div>
              </div>`;
            })()
          : `<div style="font-family:ui-monospace,'SF Mono',Consolas,monospace;font-size:11.5px;color:#7d7d7d;margin-top:3px;">${esc(s.detail)}</div>`;
      return `<div style="display:flex;gap:14px;padding-bottom:6px;">
        <div style="display:flex;flex-direction:column;align-items:center;flex:none;">
          ${stageDot(s, accent)}
          <div style="width:2px;flex:1;min-height:22px;background:${lineBg};margin:2px 0;"></div>
        </div>
        <div style="flex:1;padding-bottom:14px;">
          <div style="font-size:14px;font-weight:600;color:${labelColor};">${esc(s.label)}</div>
          ${s.total && s.status !== "pending" ? progress : `<div style="font-family:ui-monospace,'SF Mono',Consolas,monospace;font-size:11.5px;color:#7d7d7d;margin-top:3px;">${esc(s.detail)}</div>`}
        </div>
      </div>`;
    })
    .join("");
}

export function renderTerminal(state: State, channel: string, running: boolean): string {
  const lines = state.log
    .map((l) => {
      const st = LOG_STYLE[l.kind];
      const skip = l.skip ? `<span style="color:#f48771;">${esc(l.skip)}</span>` : "";
      return `<div style="display:flex;gap:8px;"><span style="color:${st.symColor};flex:none;width:10px;">${st.sym}</span><span style="color:${st.color};word-break:break-all;">${esc(l.text)}${skip}</span></div>`;
    })
    .join("");
  const cursor = running
    ? `<div style="display:flex;gap:8px;"><span style="color:#89d185;width:10px;">$</span><span style="width:8px;height:15px;background:#cccccc;display:inline-block;animation:gf-blink 1s step-end infinite;"></span></div>`
    : "";
  return `<div style="flex:1.2;display:flex;flex-direction:column;min-width:0;background:#141414;">
    <div style="flex:none;height:32px;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid #242424;background:#181818;">
      <span style="width:9px;height:9px;border-radius:50%;background:#f14c4c;"></span><span style="width:9px;height:9px;border-radius:50%;background:#e2c08d;"></span><span style="width:9px;height:9px;border-radius:50%;background:#89d185;"></span>
      <span style="margin-left:6px;font-size:11.5px;color:#9d9d9d;">git-forge · ${esc(channel)}</span>
    </div>
    <div style="flex:1;overflow-y:auto;padding:14px 16px;font-family:ui-monospace,'SF Mono',Consolas,monospace;font-size:12.5px;line-height:1.85;min-height:0;">
      ${lines}${cursor}
    </div>
  </div>`;
}

export interface ActiveOpOpts {
  phase: "running" | "done" | "error" | "conflict";
  accent: string;
  channel: string;
  runningTitle: string;
  doneTitle: string;
  doneSub: string;
  doneFooter?: string;
  errorActions?: string;
}

export function renderActiveOp(state: State, o: ActiveOpOpts): string {
  const done = o.phase === "done";
  const failed = o.phase === "error" || o.phase === "conflict";
  const header = done
    ? `<div style="display:flex;align-items:center;gap:13px;margin-bottom:22px;animation:gf-rise .4s ease;">
        <div style="width:42px;height:42px;border-radius:50%;background:#1e3a28;border:1.5px solid #2e7d4f;display:flex;align-items:center;justify-content:center;animation:gf-pop .4s ease;"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#89d185" stroke-width="2.5"><path d="M5 13l4 4L19 7"/></svg></div>
        <div><div style="font-size:18px;font-weight:600;color:#f3f3f3;">${esc(o.doneTitle)}</div><div style="font-size:12.5px;color:#9d9d9d;margin-top:2px;">${esc(o.doneSub)}</div></div>
      </div>`
    : failed
    ? `<div style="display:flex;align-items:center;gap:13px;margin-bottom:22px;">
        <div style="width:42px;height:42px;border-radius:50%;background:#2a1715;border:1.5px solid #c74e39;display:flex;align-items:center;justify-content:center;color:#f48771;font-size:22px;font-weight:700;">!</div>
        <div><div style="font-size:18px;font-weight:600;color:#f3f3f3;">${o.phase === "conflict" ? "충돌이 발생했습니다" : "작업 중 오류"}</div><div style="font-size:12.5px;color:#9d9d9d;margin-top:2px;">아래 로그를 확인하세요.</div></div>
      </div>`
    : `<div style="font-size:18px;font-weight:600;color:#f3f3f3;margin-bottom:22px;">${esc(o.runningTitle)}</div>`;

  const footer = done && o.doneFooter ? o.doneFooter : failed && o.errorActions ? o.errorActions : "";

  return `<div style="flex:1;display:flex;min-height:0;">
    <div style="flex:1;max-width:480px;overflow-y:auto;padding:26px 30px;border-right:1px solid #242424;">
      ${header}
      ${renderStageTimeline(state, o.accent)}
      ${footer}
    </div>
    ${renderTerminal(state, o.channel, o.phase === "running")}
  </div>`;
}
