import { GitRunner } from "../GitRunner";
import { createBackup, listBackups } from "../safety";
import { runLogged, OpError, type OpEmitter } from "./opbase";

/** Move HEAD to a previous state (reflog/backup), backing up current first. */
export async function restoreReflog(
  git: GitRunner,
  args: { hash: string },
  emit: OpEmitter
): Promise<{ hash: string }> {
  if (!args.hash) throw new OpError("복원할 대상이 없습니다.");
  emit.stage({ id: "backup", label: "현재 상태 백업", status: "running", detail: "update-ref" });
  await createBackup(git, "reflog-restore");
  emit.stage({ id: "backup", status: "done" });

  emit.stage({ id: "reset", label: `HEAD 이동: ${args.hash}`, status: "running", detail: `git reset --hard ${args.hash}` });
  await runLogged(git, ["reset", "--hard", args.hash], emit);
  emit.stage({ id: "reset", status: "done" });
  emit.log({ kind: "ok", text: `HEAD를 ${args.hash}(으)로 이동했습니다.` });
  return { hash: args.hash };
}

/** Undo the most recent git-forge operation by resetting to its backup ref. */
export async function undoLast(git: GitRunner, emit: OpEmitter): Promise<{ ref: string }> {
  const backups = await listBackups(git);
  if (!backups.length) throw new OpError("되돌릴 백업이 없습니다.");
  const target = backups[0];
  emit.stage({ id: "undo", label: `백업으로 복원: ${target.hash}`, status: "running", detail: `git reset --hard ${target.ref}` });
  await runLogged(git, ["reset", "--hard", target.ref], emit);
  emit.stage({ id: "undo", status: "done" });
  emit.log({ kind: "ok", text: `${target.ref} 백업으로 복원했습니다.` });
  return { ref: target.ref };
}
