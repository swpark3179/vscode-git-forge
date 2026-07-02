import { GitRunner, type RunResult } from "../GitRunner";
import type { StageUpdate, LogLine } from "../../shared/protocol";

export interface OpEmitter {
  stage(s: StageUpdate): void;
  log(l: LogLine): void;
}

export interface RunLoggedOpts {
  allowNonZero?: boolean;
  onLine?: (line: string) => void;
}

/** Run a git command, echoing the command + its output into the op log. */
export async function runLogged(
  git: GitRunner,
  args: string[],
  emit: OpEmitter,
  opts: RunLoggedOpts = {}
): Promise<RunResult> {
  emit.log({ kind: "cmd", text: "git " + args.join(" ") });
  return git.run(args, {
    allowNonZero: opts.allowNonZero,
    onLine: (l) => {
      emit.log({ kind: "out", text: l });
      opts.onLine?.(l);
    },
    onErrLine: (l) => {
      emit.log({ kind: "out", text: l });
      opts.onLine?.(l);
    },
  });
}

export class OpError extends Error {
  constructor(message: string, public readonly conflict = false) {
    super(message);
    this.name = "OpError";
  }
}
