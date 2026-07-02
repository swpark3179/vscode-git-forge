import { GitRunner } from "../GitRunner";
import { detectDefaultBranch, currentBranch } from "../repo";
import { createBackup, ensureCanMutate } from "../safety";
import { runLogged, OpError, type OpEmitter } from "./opbase";

export interface SyncArgs {
  mode?: "rebase" | "merge";
  def?: string;
}

/** Fetch origin's default branch, ff-only local default, then rebase|merge current onto it. */
export async function runSync(
  git: GitRunner,
  args: SyncArgs,
  emit: OpEmitter
): Promise<{ mode: string }> {
  const pre = await ensureCanMutate(git, { requireClean: true });
  if (!pre.ok) throw new OpError(pre.reason || "사전 조건 미충족");

  const def = args.def || (await detectDefaultBranch(git));
  const mode = args.mode === "merge" ? "merge" : "rebase";
  const cur = await currentBranch(git);

  emit.stage({ id: "backup", label: "백업 ref 생성", status: "running", detail: "update-ref" });
  await createBackup(git, "sync");
  emit.stage({ id: "backup", status: "done" });

  emit.stage({ id: "fetch", label: `origin/${def} 가져오기`, status: "running", detail: `git fetch origin ${def}` });
  const fetch = await runLogged(git, ["fetch", "origin", def, "--prune"], emit, { allowNonZero: true });
  if (fetch.code !== 0) {
    emit.stage({ id: "fetch", status: "error" });
    throw new OpError(`origin/${def} 가져오기 실패. 원격이 설정되어 있는지 확인하세요.`);
  }
  emit.stage({ id: "fetch", status: "done" });

  emit.stage({ id: "ff", label: `로컬 ${def} 최신화 (ff-only)`, status: "running", detail: `git merge --ff-only` });
  await runLogged(git, ["checkout", def], emit);
  const ff = await runLogged(git, ["merge", "--ff-only", `origin/${def}`], emit, { allowNonZero: true });
  if (ff.code !== 0) {
    await runLogged(git, ["checkout", cur], emit, { allowNonZero: true });
    emit.stage({ id: "ff", status: "error" });
    throw new OpError(
      `로컬 ${def}이(가) origin/${def}와 분기되어 fast-forward할 수 없습니다.`
    );
  }
  emit.stage({ id: "ff", status: "done" });

  emit.stage({ id: "switch", label: "작업 브랜치로 전환", status: "running", detail: `git checkout ${cur}` });
  await runLogged(git, ["checkout", cur], emit);
  emit.stage({ id: "switch", status: "done" });

  const total = parseInt(await git.text(["rev-list", "--count", `${def}..${cur}`]), 10) || 0;
  emit.stage({
    id: "replay",
    label: mode === "rebase" ? `${def} 위로 내 커밋 rebase` : `${def}를 작업 브랜치에 merge`,
    status: "running",
    total,
    current: 0,
    detail: `git ${mode} ${def}`,
  });
  let current = 0;
  const onLine = (l: string) => {
    const m = /\((\d+)\/(\d+)\)/.exec(l);
    if (m) emit.stage({ id: "replay", current: parseInt(m[1], 10), total: parseInt(m[2], 10) });
    else if (/^Applying:/.test(l)) emit.stage({ id: "replay", current: ++current });
  };
  const replay = await runLogged(git, [mode, def], emit, { allowNonZero: true, onLine });
  if (replay.code !== 0) {
    emit.stage({ id: "replay", status: "conflict" });
    throw new OpError(
      `${mode} 도중 충돌이 발생했습니다. 터미널에서 해결 후 계속하거나, 백업 ref로 되돌리세요.`,
      true
    );
  }
  emit.stage({ id: "replay", status: "done", current: total, total });
  emit.log({
    kind: "ok",
    text:
      mode === "rebase"
        ? `${cur}을(를) 최신 ${def} 위로 재정렬했습니다.`
        : `${def}을(를) ${cur}에 병합했습니다.`,
  });
  return { mode };
}
