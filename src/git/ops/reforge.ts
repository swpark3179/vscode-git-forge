import { GitRunner } from "../GitRunner";
import { currentBranch, detectDefaultBranch } from "../repo";
import { createBackup, isClean } from "../safety";
import { runLogged, OpError, type OpEmitter } from "./opbase";

export interface ReforgeArgs {
  base?: string;
  exclude: string[];
}

/**
 * Surgically remove the excluded paths from the current branch's unique history
 * (base..HEAD). Each commit's tree is rebuilt directly with plumbing
 * (read-tree -> rm --cached -> write-tree -> commit-tree), which is conflict-free
 * by construction (no 3-way merge). Commits that only touched excluded paths are
 * dropped. Reversible via a backup ref; the working tree is stashed/restored.
 */
export async function runReforge(
  git: GitRunner,
  args: ReforgeArgs,
  emit: OpEmitter
): Promise<{ excluded: number; replayed: number; dropped: number }> {
  const exclude = args.exclude || [];
  if (!exclude.length) throw new OpError("제거할 파일을 선택하세요.");
  const base = args.base || (await detectDefaultBranch(git));
  const cur = await currentBranch(git);

  const shas = (await git.text(["rev-list", "--reverse", "--no-merges", "--topo-order", `${base}..HEAD`]))
    .split("\n")
    .filter(Boolean);
  if (!shas.length) throw new OpError(`${base} 기준으로 재구성할 커밋이 없습니다.`);

  // ---- stash + backup ----
  emit.stage({ id: "stash", label: "작업 트리 백업 (stash)", status: "running", detail: "git stash push -u" });
  await createBackup(git, "reforge");
  const dirty = !(await isClean(git));
  let stashed = false;
  if (dirty) {
    const st = await runLogged(git, ["stash", "push", "-u", "-m", "git-forge-reforge"], emit, { allowNonZero: true });
    stashed = st.code === 0;
  }
  emit.stage({ id: "stash", status: "done" });

  // ---- prepare: filtered base tree (parent baseline) ----
  emit.stage({ id: "reset", label: `기준 브랜치 기준 준비: ${base}`, status: "running", detail: "read-tree / write-tree" });
  const baseSha = (await git.text(["rev-parse", base])).trim();
  const filterIndex = async (treeish: string): Promise<string> => {
    await git.run(["read-tree", treeish]);
    for (const p of exclude) {
      // -f: the index entry may differ from the working tree/HEAD during replay;
      // --cached keeps the working tree untouched.
      await git.tryRun(["rm", "--cached", "-f", "-q", "--ignore-unmatch", "-r", "--", p]);
    }
    return (await git.text(["write-tree"])).trim();
  };
  let prevTree = await filterIndex(`${base}^{tree}`);
  let newParent = baseSha;
  emit.stage({ id: "reset", status: "done" });

  // ---- replay: rebuild each commit's tree without excluded paths ----
  emit.stage({ id: "replay", label: "커밋 재적용 (제외 파일 건너뜀)", status: "running", total: shas.length, current: 0, detail: "commit-tree · filtered" });
  let replayed = 0;
  let dropped = 0;
  for (let i = 0; i < shas.length; i++) {
    const sha = shas[i];
    const short = sha.slice(0, 7);
    const tree = await filterIndex(`${sha}^{tree}`);
    const meta = (await git.text(["show", "-s", "--format=%an\x1f%ae\x1f%aI\x1f%cn\x1f%ce", sha])).split("\x1f");
    const subject = (await git.text(["show", "-s", "--format=%s", sha])).trim();
    const body = await git.text(["log", "-1", "--format=%B", sha]);

    if (tree === prevTree) {
      dropped++;
      emit.log({ kind: "pick", text: `${short} ${subject}`, skip: "  — 제외 파일만 포함, 커밋 제거됨" });
      emit.stage({ id: "replay", current: i + 1 });
      continue;
    }
    const newSha = (
      await git.run(["commit-tree", tree, "-p", newParent], {
        input: body,
        env: {
          GIT_AUTHOR_NAME: meta[0],
          GIT_AUTHOR_EMAIL: meta[1],
          GIT_AUTHOR_DATE: meta[2],
          GIT_COMMITTER_NAME: meta[3] || meta[0],
          GIT_COMMITTER_EMAIL: meta[4] || meta[1],
        },
      })
    ).stdout.trim();
    newParent = newSha;
    prevTree = tree;
    replayed++;
    const skippedNote = await commitTouchedExcluded(git, sha, exclude);
    emit.log({ kind: "pick", text: `${short} ${subject}`, skip: skippedNote ? `  — skipped ${skippedNote}` : "" });
    emit.stage({ id: "replay", current: i + 1 });
  }
  emit.stage({ id: "replay", status: "done" });

  // ---- finalize: move branch to the rebuilt tip, restore working tree ----
  emit.stage({ id: "restore", label: "브랜치 갱신 · 작업 트리 복원", status: "running", detail: `git reset --hard` });
  await git.run(["reset", "--hard", newParent]);
  await restoreStash(git, stashed, emit);
  emit.stage({ id: "restore", status: "done" });

  emit.log({ kind: "ok", text: `${cur} 리포지 완료 · ${exclude.length}개 파일 히스토리에서 제거 (커밋 ${replayed}개 재적용, ${dropped}개 제거)` });
  return { excluded: exclude.length, replayed, dropped };
}

/** Which excluded paths this commit actually touched (for the log "skipped" note). */
async function commitTouchedExcluded(git: GitRunner, sha: string, exclude: string[]): Promise<string> {
  const r = await git.tryRun(["show", "--no-patch", "--pretty=tformat:", "--name-only", sha]);
  const touched = new Set(r.stdout.split("\n").map((s) => s.trim()).filter(Boolean));
  return exclude.filter((p) => touched.has(p)).join(", ");
}

async function restoreStash(git: GitRunner, stashed: boolean, emit: OpEmitter): Promise<void> {
  if (!stashed) return;
  const pop = await runLogged(git, ["stash", "pop"], emit, { allowNonZero: true });
  if (pop.code !== 0) {
    emit.log({ kind: "err", text: "stash 복원 중 충돌. stash는 보존됩니다 (git stash list)." });
  }
}
