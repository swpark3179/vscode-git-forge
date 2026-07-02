import { esc } from "../dom";
import { statusColor } from "../util";
import { registerBody } from "../render";
import type { State } from "../state";
import type { GraphCommit, GraphRef, FileChange } from "../../src/shared/protocol";

const LANE_COLORS = ["#0098ff", "#89d185", "#d6a0d0", "#e0b56b", "#7ec8e8", "#f48771", "#9a8cff"];
const laneColor = (l: number) => LANE_COLORS[l % LANE_COLORS.length];

const G = { rowH: 56, padTop: 8, x0: 22, laneGap: 26, r: 6 };
const laneX = (l: number) => G.x0 + l * G.laneGap;
const yMid = (row: number) => G.padTop + row * G.rowH + G.rowH / 2;

const REF_STYLE: Record<GraphRef["t"], { bg: string; fg: string }> = {
  head: { bg: "#0098ff", fg: "#fff" },
  branch: { bg: "#1e3a28", fg: "#89d185" },
  remote: { bg: "#3a2f12", fg: "#e2c08d" },
  tag: { bg: "#2a1f30", fg: "#c5a3ff" },
};

function reachable(nodes: GraphCommit[], tipId: string): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const stack = [tipId];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id) || !byId.has(id)) continue;
    seen.add(id);
    for (const p of byId.get(id)!.parents) stack.push(p);
  }
  return seen;
}

registerBody("graph", (state) => {
  const data = state.data.graph as { nodes: GraphCommit[]; laneCount: number } | null;
  if (!data) return `<div style="padding:40px;color:#9d9d9d;font-size:13px;">그래프를 불러오는 중…</div>`;
  const nodes = data.nodes;
  const idToRow = new Map(nodes.map((n, i) => [n.id, i]));

  // filter
  const filter = state.graphFilter;
  let dimSet: Set<string> | null = null;
  if (filter !== "all") {
    const tip = nodes.find((n) => n.refs.some((r) => r.name === filter));
    if (tip) dimSet = reachable(nodes, tip.id);
  }
  const dimmed = (id: string) => (dimSet ? !dimSet.has(id) : false);

  // filter chips
  const branchNames = new Set<string>();
  nodes.forEach((n) => n.refs.forEach((r) => { if (r.t === "head" || r.t === "branch") branchNames.add(r.name); }));
  const chips = ["all", ...branchNames]
    .map((id, i) => {
      const active = filter === id;
      const color = id === "all" ? "#9d9d9d" : laneColor(i - 1 >= 0 ? i - 1 : 0);
      return `<div data-click="graphFilter" data-arg="${esc(id)}" style="display:flex;align-items:center;gap:7px;padding:5px 12px;border-radius:16px;background:${active ? "#04324f" : "#202020"};border:1px solid ${active ? "#0098ff" : "#2b2b2b"};cursor:pointer;font-size:12px;color:#dcdcdc;white-space:nowrap;">
        <span style="width:9px;height:9px;border-radius:50%;background:${color};"></span>${id === "all" ? "모든 브랜치" : esc(id)}</div>`;
    })
    .join("");

  // svg edges + nodes
  const edges: string[] = [];
  nodes.forEach((c, i) => {
    c.parents.forEach((pid, pi) => {
      const pr = idToRow.get(pid);
      if (pr === undefined) return;
      const pLane = nodes[pr].lane;
      const x1 = laneX(c.lane), y1 = yMid(i), x2 = laneX(pLane), y2 = yMid(pr);
      const colorLane = pi === 0 ? c.lane : pLane;
      const dim = dimSet ? dimmed(c.id) && dimmed(pid) : false;
      let d: string;
      if (x1 === x2) d = `M ${x1} ${y1} L ${x2} ${y2}`;
      else { const cy = (y1 + y2) / 2; d = `M ${x1} ${y1} C ${x1} ${cy} ${x2} ${cy} ${x2} ${y2}`; }
      edges.push(`<path d="${d}" fill="none" stroke="${laneColor(colorLane)}" stroke-width="2" stroke-opacity="${dim ? "0.12" : "0.9"}" stroke-linecap="round"></path>`);
    });
  });
  const circles = nodes
    .map((c, i) => {
      const dim = dimmed(c.id);
      return `<circle cx="${laneX(c.lane)}" cy="${yMid(i)}" r="${c.merge ? 7 : 6}" fill="${c.merge ? "#1f1f1f" : laneColor(c.lane)}" stroke="${laneColor(c.lane)}" stroke-width="2.5" opacity="${dim ? "0.2" : "1"}"></circle>`;
    })
    .join("");

  const railW = G.x0 + Math.max(1, data.laneCount) * G.laneGap + G.r + 10;
  const graphHeight = G.padTop * 2 + nodes.length * G.rowH;

  const rows = nodes
    .map((c) => {
      const sel = c.id === state.graphSel;
      const dim = dimmed(c.id);
      const refs = c.refs
        .map((r) => {
          const st = REF_STYLE[r.t];
          const label = r.t === "tag" ? "⌖ " + r.name : r.name;
          return `<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:9px;background:${st.bg};color:${st.fg};white-space:nowrap;flex:none;">${esc(label)}</span>`;
        })
        .join("");
      return `<div data-click="graphSelect" data-arg="${esc(c.id)}" style="display:flex;align-items:stretch;height:${G.rowH}px;cursor:pointer;opacity:${dim ? "0.35" : "1"};">
        <div style="width:${railW}px;flex:none;"></div>
        <div style="flex:1;display:flex;align-items:center;gap:10px;padding-right:16px;background:${sel ? "#04324f" : "transparent"};border-left:2px solid ${sel ? "#0098ff" : "transparent"};min-width:0;" data-hover="background:#202020;">
          <span style="font-family:ui-monospace,'SF Mono',Consolas,monospace;font-size:11.5px;color:#e2c08d;background:#2d2a20;padding:2px 6px;border-radius:4px;flex:none;">${esc(c.hash)}</span>
          <span style="flex:1;font-size:13px;color:${sel ? "#ffffff" : "#dcdcdc"};min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(c.msg)}</span>
          ${refs}
          <span style="font-size:11px;color:#7d7d7d;white-space:nowrap;flex:none;">${esc(c.author)} · ${esc(c.time)}</span>
        </div>
      </div>`;
    })
    .join("");

  const detail = renderDetail(state, nodes);

  return `<div style="height:100%;display:flex;flex-direction:column;min-height:0;">
    <div style="flex:none;padding:18px 26px 14px;border-bottom:1px solid #242424;">
      <div style="font-size:21px;font-weight:600;color:#f3f3f3;">커밋 그래프</div>
      <div style="font-size:13px;color:#9d9d9d;margin-top:3px;">브랜치가 어떻게 갈라지고 합쳐졌는지 한눈에. 커밋을 클릭해 변경 파일·부모·태그를 확인하세요.</div>
      <div style="margin-top:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">${chips}</div>
    </div>
    <div style="flex:1;display:flex;min-height:0;">
      <div style="flex:1.7;overflow:auto;min-width:0;">
        <div style="position:relative;height:${graphHeight}px;min-width:560px;">
          <svg width="${railW}" height="${graphHeight}" style="position:absolute;top:0;left:0;overflow:visible;">${edges.join("")}${circles}</svg>
          <div style="position:absolute;top:0;left:0;right:0;padding-top:8px;">${rows}</div>
        </div>
      </div>
      <div style="flex:1;max-width:368px;min-width:300px;border-left:1px solid #242424;background:#181818;overflow-y:auto;">${detail}</div>
    </div>
  </div>`;
});

function renderDetail(state: State, nodes: GraphCommit[]): string {
  const sel = nodes.find((n) => n.id === state.graphSel) || nodes[0];
  if (!sel) return "";
  const files = (state.data.graphFiles[sel.id] as { files: FileChange[] } | undefined)?.files;
  const parentLabels = sel.parents.map((p) => nodes.find((n) => n.id === p)?.hash ?? p.slice(0, 7)).join(", ");
  const refsHtml = sel.refs.length
    ? `<div style="margin-top:11px;display:flex;gap:6px;flex-wrap:wrap;">${sel.refs
        .map((r) => { const st = REF_STYLE[r.t]; return `<span style="font-size:10.5px;font-weight:600;padding:3px 9px;border-radius:9px;background:${st.bg};color:${st.fg};">${esc(r.t === "tag" ? "⌖ " + r.name : r.name)}</span>`; })
        .join("")}</div>`
    : "";
  let filesHtml: string;
  if (!files) {
    filesHtml = `<div style="margin-top:10px;font-size:12px;color:#7d7d7d;">변경 파일을 불러오는 중…</div>`;
  } else {
    const totalAdd = files.reduce((a, f) => a + f.add, 0);
    const totalDel = files.reduce((a, f) => a + f.del, 0);
    filesHtml = `<div style="margin-top:18px;display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:12px;color:#9d9d9d;font-weight:600;">변경된 파일 ${files.length}개</span>
        <span style="font-family:ui-monospace,monospace;font-size:11.5px;"><span style="color:#89d185;">+${totalAdd}</span> <span style="color:#f48771;">&#8722;${totalDel}</span></span>
      </div>${files
        .map(
          (f) => `<div style="display:flex;align-items:center;gap:9px;padding:8px 10px;margin-top:7px;background:#1c1c1c;border:1px solid #2b2b2b;border-radius:6px;">
        <span style="font-family:ui-monospace,monospace;font-size:12px;color:${statusColor(f.status)};font-weight:700;width:14px;text-align:center;flex:none;">${esc(f.status)}</span>
        <span style="flex:1;font-family:ui-monospace,monospace;font-size:12px;color:#cccccc;min-width:0;overflow:hidden;text-overflow:ellipsis;">${esc(f.path)}</span>
        <span style="font-family:ui-monospace,monospace;font-size:11px;color:#89d185;flex:none;">+${f.add}</span>
        <span style="font-family:ui-monospace,monospace;font-size:11px;color:#f48771;flex:none;">&#8722;${f.del}</span>
      </div>`
        )
        .join("")}`;
  }
  return `<div style="padding:20px 22px;">
    <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;">
      <span style="width:11px;height:11px;border-radius:50%;background:${laneColor(sel.lane)};flex:none;"></span>
      <span style="font-family:ui-monospace,monospace;font-size:13.5px;color:#e2c08d;background:#2d2a20;padding:3px 8px;border-radius:5px;">${esc(sel.hash)}</span>
      ${sel.merge ? `<span style="font-size:10px;font-weight:700;color:#c5a3ff;background:#2a1f30;padding:2px 8px;border-radius:9px;">머지 커밋</span>` : ""}
    </div>
    <div style="font-size:15px;color:#f3f3f3;font-weight:600;margin-top:13px;line-height:1.45;">${esc(sel.msg)}</div>
    ${refsHtml}
    <div style="margin-top:16px;border-top:1px solid #2b2b2b;padding-top:14px;display:flex;flex-direction:column;gap:10px;font-size:12.5px;">
      <div style="display:flex;gap:10px;"><span style="color:#7d7d7d;width:48px;flex:none;">작성자</span><span style="color:#dcdcdc;">${esc(sel.author)} · ${esc(sel.time)}</span></div>
      <div style="display:flex;gap:10px;"><span style="color:#7d7d7d;width:48px;flex:none;">부모</span><span style="font-family:ui-monospace,monospace;color:#9fc7e8;">${esc(parentLabels || "(루트)")}</span></div>
    </div>
    ${filesHtml}
  </div>`;
}
