import { GitRunner } from "../GitRunner";
import { currentBranch } from "../repo";
import { runLogged, OpError, type OpEmitter } from "./opbase";

export interface CleanupArgs {
  branches: Array<{ name: string; merged: boolean }>;
}

/** Delete the selected branches (-d for merged, -D for unmerged), recording recovery sha. */
export async function runCleanup(
  git: GitRunner,
  args: CleanupArgs,
  emit: OpEmitter
): Promise<{ deleted: string[]; recovery: Record<string, string> }> {
  const cur = await currentBranch(git);
  const recovery: Record<string, string> = {};
  const deleted: string[] = [];
  emit.stage({ id: "delete", label: "브랜치 삭제", status: "running", total: args.branches.length, current: 0 });

  let i = 0;
  for (const b of args.branches) {
    i++;
    if (b.name === cur) {
      emit.log({ kind: "err", text: `현재 브랜치 ${b.name}은(는) 삭제할 수 없습니다.` });
      emit.stage({ id: "delete", current: i });
      continue;
    }
    let res = await runLogged(git, ["branch", b.merged ? "-d" : "-D", b.name], emit, { allowNonZero: true });
    if (res.code !== 0 && b.merged) {
      // `-d` checks merge status against the current HEAD, not the default branch.
      // We already classified this as merged into the default, so force-delete.
      res = await runLogged(git, ["branch", "-D", b.name], emit, { allowNonZero: true });
    }
    if (res.code === 0) {
      deleted.push(b.name);
      const m = /\(was ([0-9a-f]+)\)/.exec(res.stdout);
      if (m) recovery[b.name] = m[1];
    } else {
      emit.log({ kind: "err", text: `${b.name} 삭제 실패` });
    }
    emit.stage({ id: "delete", current: i });
  }
  if (!deleted.length && args.branches.length) throw new OpError("삭제된 브랜치가 없습니다.");
  emit.stage({ id: "delete", status: "done" });
  emit.log({ kind: "ok", text: `${deleted.length}개 브랜치 삭제됨. 30일간 reflog로 복구 가능.` });
  return { deleted, recovery };
}
