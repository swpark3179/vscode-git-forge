import { GitRunner } from "../GitRunner";
import { detectDefaultBranch } from "../repo";
import { createBackup, ensureCanMutate } from "../safety";
import { runLogged, OpError, type OpEmitter } from "./opbase";

export interface RestructArgs {
  mode: "squash" | "split";
  base?: string;
  // squash
  hashes?: string[];
  message?: string;
  // split
  target?: string;
  outFiles?: string[];
  newMsg?: string;
  origMsg?: string;
}

async function orderedRange(git: GitRunner, base: string): Promise<string[]> {
  const t = await git.text(["rev-list", "--reverse", "--no-merges", "--topo-order", `${base}..HEAD`]);
  return t.split("\n").filter(Boolean);
}

const toFull = (ordered: string[], short: string) =>
  ordered.find((f) => f.startsWith(short)) || short;

export async function runRestructure(
  git: GitRunner,
  args: RestructArgs,
  emit: OpEmitter
): Promise<{ mode: string }> {
  const pre = await ensureCanMutate(git, { requireClean: true });
  if (!pre.ok) throw new OpError(pre.reason || "사전 조건 미충족");
  const base = args.base || (await detectDefaultBranch(git));
  const ordered = await orderedRange(git, base);

  emit.stage({ id: "backup", label: "백업 ref 생성", status: "running", detail: "update-ref" });
  await createBackup(git, "restructure");
  emit.stage({ id: "backup", status: "done" });

  if (args.mode === "squash") {
    const selected = new Set((args.hashes || []).map((h) => toFull(ordered, h)));
    if (selected.size < 2) throw new OpError("합칠 커밋을 2개 이상 선택하세요.");
    const firstIdx = ordered.findIndex((h) => selected.has(h));
    const lastIdx = ordered.map((h) => selected.has(h)).lastIndexOf(true);
    const parent = firstIdx === 0 ? base : ordered[firstIdx - 1];

    emit.stage({ id: "rebuild", label: `${selected.size}개 커밋 합치기`, status: "running", total: ordered.length - firstIdx, current: 0, detail: `git reset --hard ${parent.slice(0, 7)}` });
    await runLogged(git, ["reset", "--hard", parent], emit);

    let done = 0;
    for (let i = firstIdx; i < ordered.length; i++) {
      const sha = ordered[i];
      if (selected.has(sha)) {
        const cp = await runLogged(git, ["cherry-pick", "--no-commit", "--allow-empty", sha], emit, { allowNonZero: true });
        if (cp.code !== 0) { await git.tryRun(["cherry-pick", "--abort"]); throw new OpError("합치는 중 충돌이 발생했습니다.", true); }
        if (i === lastIdx) {
          await runLogged(git, ["commit", "--no-edit", "-m", args.message || "squashed commit"], emit);
        }
      } else {
        const cp = await runLogged(git, ["cherry-pick", sha], emit, { allowNonZero: true });
        if (cp.code !== 0) { await git.tryRun(["cherry-pick", "--abort"]); throw new OpError("재적용 중 충돌이 발생했습니다.", true); }
      }
      emit.stage({ id: "rebuild", current: ++done });
    }
    emit.stage({ id: "rebuild", status: "done" });
    emit.log({ kind: "ok", text: `${selected.size}개 커밋을 하나로 합쳤습니다.` });
    return { mode: "squash" };
  }

  // split
  const target = toFull(ordered, args.target || "");
  const targetIdx = ordered.indexOf(target);
  if (targetIdx === -1) throw new OpError("나눌 커밋을 찾을 수 없습니다.");
  const outFiles = args.outFiles || [];
  if (!outFiles.length) throw new OpError("분리할 파일을 선택하세요.");
  const children = ordered.slice(targetIdx + 1);
  const author = await git.text(["show", "-s", "--format=%an <%ae>", target]);
  const adate = await git.text(["show", "-s", "--format=%aI", target]);

  emit.stage({ id: "split", label: "대상 커밋 분해", status: "running", detail: `git reset ${target.slice(0, 7)}` });
  await runLogged(git, ["reset", "--hard", target], emit);
  await runLogged(git, ["reset", "--soft", "HEAD^"], emit);
  await runLogged(git, ["reset", "-q", "HEAD"], emit); // unstage all
  emit.stage({ id: "split", status: "done" });

  emit.stage({ id: "commitA", label: "분리 파일 새 커밋", status: "running", detail: "git add <files> && commit" });
  await runLogged(git, ["add", "--", ...outFiles], emit);
  await runLogged(git, ["commit", "-m", args.newMsg || "refactor: split out files"], emit);
  emit.stage({ id: "commitA", status: "done" });

  emit.stage({ id: "commitB", label: "나머지 파일 재커밋", status: "running", detail: "git add -A && commit" });
  await runLogged(git, ["add", "-A"], emit);
  await git.run(["commit", "-m", args.origMsg || "remainder", `--author=${author}`], {
    env: { GIT_AUTHOR_DATE: adate },
  });
  emit.log({ kind: "cmd", text: `git commit -m "${args.origMsg || "remainder"}"` });
  emit.stage({ id: "commitB", status: "done" });

  if (children.length) {
    emit.stage({ id: "replay", label: "이후 커밋 재적용", status: "running", total: children.length, current: 0 });
    let c = 0;
    for (const ch of children) {
      const cp = await runLogged(git, ["cherry-pick", ch], emit, { allowNonZero: true });
      if (cp.code !== 0) { await git.tryRun(["cherry-pick", "--abort"]); throw new OpError("이후 커밋 재적용 중 충돌이 발생했습니다.", true); }
      emit.stage({ id: "replay", current: ++c });
    }
    emit.stage({ id: "replay", status: "done" });
  }
  emit.log({ kind: "ok", text: `커밋을 2개로 나눴습니다.` });
  return { mode: "split" };
}
