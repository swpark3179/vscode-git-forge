import { spawn } from "child_process";

export class GitError extends Error {
  constructor(
    message: string,
    public readonly code: number | null,
    public readonly stdout: string,
    public readonly stderr: string,
    public readonly args: string[]
  ) {
    super(message);
    this.name = "GitError";
  }
}

export interface RunOptions {
  cwd?: string;
  env?: Record<string, string>;
  input?: string;
  onLine?: (line: string) => void;
  onErrLine?: (line: string) => void;
  allowNonZero?: boolean;
}

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  lines: string[];
}

// Field/record separators for safe --pretty/--format parsing.
export const US = "\x1f"; // unit separator (between fields)
export const RS = "\x1e"; // record separator (between records)

/**
 * Single choke-point for every git invocation.
 * - argv array only (no shell), so Windows/PowerShell quoting never applies.
 * - stable, parseable output (LC_ALL=C, no pager, no color, no prompts).
 */
export class GitRunner {
  constructor(private readonly repoRoot: string, private readonly gitPath = "git") {}

  private baseArgs(): string[] {
    return [
      "-C",
      this.repoRoot,
      "-c",
      "core.pager=cat",
      "-c",
      "color.ui=false",
      "-c",
      "core.quotepath=false",
      "-c",
      "advice.detachedHead=false",
      "--no-optional-locks",
    ];
  }

  private baseEnv(extra?: Record<string, string>): NodeJS.ProcessEnv {
    return {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      GIT_OPTIONAL_LOCKS: "0",
      GIT_EDITOR: "true",
      GIT_PAGER: "cat",
      LC_ALL: "C",
      GCM_INTERACTIVE: "never",
      ...extra,
    };
  }

  run(args: string[], opts: RunOptions = {}): Promise<RunResult> {
    const fullArgs = [...this.baseArgs(), ...args];
    return new Promise((resolve, reject) => {
      const child = spawn(this.gitPath, fullArgs, {
        cwd: opts.cwd ?? this.repoRoot,
        env: this.baseEnv(opts.env),
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";
      let outBuf = "";
      let errBuf = "";
      const lines: string[] = [];

      const flush = (buf: string, isErr: boolean): string => {
        const parts = buf.split("\n");
        const rest = parts.pop() ?? "";
        for (const raw of parts) {
          const line = raw.replace(/\r$/, "");
          if (isErr) opts.onErrLine?.(line);
          else {
            lines.push(line);
            opts.onLine?.(line);
          }
        }
        return rest;
      };

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (d: string) => {
        stdout += d;
        outBuf = flush(outBuf + d, false);
      });
      child.stderr.on("data", (d: string) => {
        stderr += d;
        errBuf = flush(errBuf + d, true);
      });

      child.on("error", (err) => {
        reject(new GitError(err.message, null, stdout, stderr, fullArgs));
      });

      child.on("close", (code) => {
        if (outBuf) {
          const line = outBuf.replace(/\r$/, "");
          lines.push(line);
          opts.onLine?.(line);
        }
        if (errBuf) opts.onErrLine?.(errBuf.replace(/\r$/, ""));
        if (code !== 0 && !opts.allowNonZero) {
          reject(
            new GitError(
              `git ${args.join(" ")} exited with ${code}`,
              code,
              stdout,
              stderr,
              fullArgs
            )
          );
        } else {
          resolve({ code, stdout, stderr, lines });
        }
      });

      if (opts.input !== undefined) {
        child.stdin.write(opts.input);
        child.stdin.end();
      }
    });
  }

  /** Convenience: run and return trimmed stdout. */
  async text(args: string[], opts: RunOptions = {}): Promise<string> {
    const r = await this.run(args, opts);
    return r.stdout.replace(/\n$/, "");
  }

  /** Run allowing non-zero exit; returns the result for callers to inspect. */
  async tryRun(args: string[], opts: RunOptions = {}): Promise<RunResult> {
    return this.run(args, { ...opts, allowNonZero: true });
  }
}
