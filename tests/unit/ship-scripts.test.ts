import { execFileSync, spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = process.cwd();
/** Physical repo root (matches stop.sh / start.sh `pwd -P`). */
const rootPhysical = execFileSync("bash", ["-c", "pwd -P"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const checkSh = path.join(root, "scripts/check.sh");
const stopSh = path.join(root, "scripts/stop.sh");
const startSh = path.join(root, "scripts/start.sh");

function hasSetsid(): boolean {
  return existsSync("/usr/bin/setsid") || existsSync("/bin/setsid");
}

/** Spawn a pnpm-named sleep leader (+ child) in its own process group. */
function spawnDevGroupLeader(
  childPidFile: string,
  cwd: string,
): ReturnType<typeof spawn> {
  const inner = `sleep 300 & echo $! >'${childPidFile}'; exec -a 'pnpm dev --hostname 127.0.0.1 --port 3000' sleep 300`;
  if (hasSetsid()) {
    return spawn("setsid", ["bash", "-c", inner], {
      cwd,
      stdio: "ignore",
      detached: false,
    });
  }
  // macOS: match start.sh — perl setpgrp so pgid == pid. Bare `set -m` + a
  // foreground `exec` keeps the parent shell's pgid (not a group leader).
  return spawn(
    "perl",
    ["-e", "setpgrp(0,0); exec @ARGV", "bash", "-c", inner],
    {
      cwd,
      stdio: "ignore",
      detached: false,
    },
  );
}

function waitForPnpmArgs(pid: number, childPidFile: string): void {
  for (let i = 0; i < 50; i++) {
    if (!existsSync(childPidFile)) {
      execFileSync("sleep", ["0.1"]);
      continue;
    }
    try {
      const args = execFileSync("ps", ["-o", "args=", "-p", String(pid)], {
        encoding: "utf8",
      });
      if (/pnpm/.test(args)) return;
    } catch {
      // not ready
    }
    execFileSync("sleep", ["0.1"]);
  }
}

function processAlive(pid: number): boolean {
  try {
    const stat = execFileSync("ps", ["-o", "stat=", "-p", String(pid)], {
      encoding: "utf8",
    }).trim();
    // Zombies still pass kill(pid, 0); treat them as stopped.
    if (!stat || stat.includes("Z")) return false;
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

/** Non-comment source lines (ST3/ST5 must fail if only comments/banner match). */
function codeWithoutComments(src: string): string {
  return src
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
}

function requiredNode(): string {
  return readFileSync(path.join(root, ".nvmrc"), "utf8")
    .trim()
    .replace(/^v/, "");
}

function writeStub(dir: string, name: string, body: string): void {
  const file = path.join(dir, name);
  writeFileSync(file, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`);
  chmodSync(file, 0o755);
}

/** Symlink host tools into dir; never include setsid (macOS PATH simulation). */
function linkBins(dir: string, names: string[]): void {
  for (const bin of names) {
    if (bin === "setsid") continue;
    const src = existsSync(`/usr/bin/${bin}`)
      ? `/usr/bin/${bin}`
      : `/bin/${bin}`;
    if (existsSync(src)) {
      execFileSync("ln", ["-sf", src, path.join(dir, bin)]);
    }
  }
}

type StubOpts = {
  nodeVersion?: string;
  /** "ok" | "daemon-down" | "missing" */
  docker?: "ok" | "daemon-down" | "missing";
  portBusy?: number;
  /** When port busy + FOR_START, whether curl health succeeds (ours) */
  busyLooksLikeOurs?: boolean;
};

type EnvMap = Record<string, string | undefined>;

function makeStubs(opts: StubOpts = {}): {
  stubDir: string;
  env: EnvMap;
} {
  const stubDir = mkdtempSync(path.join(tmpdir(), "pf-ship-stubs-"));
  const nodeVer = opts.nodeVersion ?? requiredNode();
  const docker = opts.docker ?? "ok";

  writeStub(stubDir, "git", 'echo "git version 2.43.0"');
  writeStub(stubDir, "node", `echo "v${nodeVer}"`);
  writeStub(stubDir, "pnpm", 'echo "10.32.1"');
  writeStub(stubDir, "corepack", "exit 0");

  if (docker === "ok") {
    writeStub(
      stubDir,
      "docker",
      `case "\${1:-}" in
         info) exit 0 ;;
         compose)
           if [[ "\${2:-}" == "version" ]]; then
             if [[ "\${3:-}" == "--short" ]]; then echo "2.38.2"; else echo "Docker Compose version 2.38.2"; fi
             exit 0
           fi
           exit 0
           ;;
         *) exit 0 ;;
       esac`,
    );
  } else if (docker === "daemon-down") {
    writeStub(
      stubDir,
      "docker",
      'if [[ "${1:-}" == "info" ]]; then echo "Cannot connect" >&2; exit 1; fi; exit 0',
    );
  }

  if (opts.portBusy != null) {
    const port = opts.portBusy;
    writeStub(
      stubDir,
      "ss",
      `if printf '%s\\n' "$*" | grep -q ":${port}"; then
         echo "LISTEN 0 0 127.0.0.1:${port} 0.0.0.0:*"
       fi
       exit 0`,
    );
    if (opts.busyLooksLikeOurs) {
      writeStub(stubDir, "curl", "exit 0");
    } else {
      writeStub(stubDir, "curl", "exit 1");
    }
  } else {
    writeStub(stubDir, "ss", "exit 0");
    writeStub(stubDir, "curl", "exit 0");
  }

  let pathValue = `${stubDir}:/bin:/usr/bin`;
  if (docker === "missing") {
    for (const bin of [
      "grep",
      "sed",
      "head",
      "tr",
      "uname",
      "cat",
      "rm",
      "ls",
      "basename",
      "dirname",
      "mktemp",
      "sleep",
      "ps",
      "kill",
      "readlink",
      "env",
      "bash",
    ]) {
      const src = `/usr/bin/${bin}`;
      const alt = `/bin/${bin}`;
      const target = existsSync(src) ? src : alt;
      if (existsSync(target)) {
        execFileSync("ln", ["-sf", target, path.join(stubDir, bin)]);
      }
    }
    pathValue = `${stubDir}:/bin`;
  }

  const env: EnvMap = {
    ...process.env,
    PATH: pathValue,
  };
  delete env.MSYSTEM;
  env.OSTYPE = "linux-gnu";

  return { stubDir, env };
}

function asProcessEnv(env: EnvMap): NodeJS.ProcessEnv {
  return env as unknown as NodeJS.ProcessEnv;
}

function runCheck(
  env: EnvMap,
  extra: EnvMap = {},
): { status: number; out: string } {
  try {
    const stdout = execFileSync("bash", [checkSh], {
      env: asProcessEnv({ ...env, ...extra }),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, out: stdout };
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: err.status ?? 1,
      out: `${err.stdout ?? ""}${err.stderr ?? ""}`,
    };
  }
}

const junk: string[] = [];
afterEach(() => {
  while (junk.length > 0) {
    const p = junk.pop();
    if (p) rmSync(p, { recursive: true, force: true });
  }
});

describe("P5b ship scripts inventory", () => {
  it("ships check/start/stop bash only (no PowerShell)", () => {
    expect(existsSync(checkSh)).toBe(true);
    expect(existsSync(startSh)).toBe(true);
    expect(existsSync(stopSh)).toBe(true);
    expect(
      readdirSync(path.join(root, "scripts")).some((n) => n.endsWith(".ps1")),
    ).toBe(false);
  });

  it("start.sh launch binds --hostname 127.0.0.1 (not only Emulator UI banner)", () => {
    const code = codeWithoutComments(read("scripts/start.sh"));
    // ST3: binding to 0.0.0.0 must fail — banner 127.0.0.1:4000 alone is insufficient.
    expect(code).toMatch(/pnpm dev --hostname 127\.0\.0\.1 --port 3000/);
    const weakened = code.replace(
      /pnpm dev --hostname 127\.0\.0\.1 --port 3000/g,
      "pnpm dev --hostname 0.0.0.0 --port 3000",
    );
    expect(weakened).not.toMatch(/--hostname 127\.0\.0\.1/);
  });

  it("start.sh process-group launch is real code (setsid + fallbacks; not only comments)", () => {
    const code = codeWithoutComments(read("scripts/start.sh"));
    // ST5: removing setsid from the launch must fail this assert.
    expect(code).toMatch(/\bsetsid\b/);
    expect(code).toMatch(/setpgrp/);
    expect(code).toMatch(/\bset -m\b/);
    expect(code).toMatch(/prosefield_launch_dev_server/);
    const withoutSetsidLaunch = code.replace(
      /setsid nohup pnpm dev --hostname 127\.0\.0\.1 --port 3000[^\n]*/g,
      "nohup pnpm dev --hostname 127.0.0.1 --port 3000 >\"$log_file\" 2>&1 </dev/null &",
    );
    // Comment-only mention would still leave \bsetsid\b from the command -v check —
    // require the actual setsid launch form.
    expect(code).toMatch(/setsid nohup pnpm dev --hostname 127\.0\.0\.1/);
    expect(withoutSetsidLaunch).not.toMatch(/setsid nohup pnpm dev/);
  });

  it("stop.sh verifies ownership before signalling; group only when pgid==pid", () => {
    const stop = codeWithoutComments(read("scripts/stop.sh"));
    expect(stop).toMatch(/is_our_dev_server/);
    expect(stop).toMatch(/lsof -a -p/);
    expect(stop).toMatch(/pwd -P/);
    expect(stop).toMatch(/pgid" == "\$pid"/);
    expect(stop.indexOf("is_our_dev_server")).toBeLessThan(
      stop.indexOf("kill -TERM"),
    );
    // Must not accept bare "dev" as ownership on macOS fallback.
    expect(stop).not.toMatch(/grep -Eqi 'dev'/);
  });

  it("docs contracts: AGENT_SETUP WSL home, write-up active-only, time-log template", () => {
    expect(read("AGENT_SETUP.md")).toMatch(/STOP/);
    expect(read("AGENT_SETUP.md")).toMatch(/~\//);
    expect(read("docs/write-up.md")).toMatch(/status` is `active`/);
    expect(read("docs/write-up.md")).not.toMatch(/equivalent allowed statuses/i);
    expect(read("docs/time-log.md")).not.toMatch(/\|\s*\d+(\.\d+)?\s*\|/);
  });
});

describe("check.sh executable behaviour (stubbed PATH)", () => {
  it("exits 0 on all-pass stubs", () => {
    const { stubDir, env } = makeStubs({ docker: "ok" });
    junk.push(stubDir);
    const result = runCheck(env);
    expect(result.status).toBe(0);
    expect(result.out).toMatch(/PASS {2}Node\.js/);
    expect(result.out).toMatch(/PASS {2}Docker/);
    expect(result.out).toMatch(/PASS {2}Dev-server process group:/);
    expect(result.out).toMatch(/0 failed/);
  });

  it("exits non-zero on Node version mismatch", () => {
    const { stubDir, env } = makeStubs({
      nodeVersion: "20.0.0",
      docker: "ok",
    });
    junk.push(stubDir);
    const result = runCheck(env);
    expect(result.status).not.toBe(0);
    expect(result.out).toMatch(/FAIL {2}Node\.js/);
  });

  it("exits non-zero when MSYSTEM is set (Git Bash / MSYS)", () => {
    const { stubDir, env } = makeStubs({ docker: "ok" });
    junk.push(stubDir);
    const result = runCheck(env, { MSYSTEM: "MINGW64" });
    expect(result.status).not.toBe(0);
    expect(result.out).toMatch(/FAIL {2}Environment/);
    expect(result.out).toMatch(/WSL2/);
  });

  it("exits non-zero when repo root is under /mnt/*", () => {
    const { stubDir, env } = makeStubs({ docker: "ok" });
    junk.push(stubDir);
    const result = runCheck(env, {
      PROSEFIELD_CHECK_ROOT: "/mnt/c/Users/demo/prosefield",
    });
    expect(result.status).not.toBe(0);
    expect(result.out).toMatch(/FAIL {2}Repo path on \/mnt/);
  });

  it("exits non-zero when Docker daemon is down", () => {
    const { stubDir, env } = makeStubs({ docker: "daemon-down" });
    junk.push(stubDir);
    const result = runCheck(env);
    expect(result.status).not.toBe(0);
    expect(result.out).toMatch(/FAIL {2}Docker/);
  });

  it("exits non-zero when Docker CLI is missing", () => {
    const { stubDir, env } = makeStubs({ docker: "ok" });
    junk.push(stubDir);
    const wrapper = `
      command() {
        if [[ "\$1" == "-v" && "\$2" == "docker" ]]; then
          return 1
        fi
        builtin command "\$@"
      }
      source "${checkSh}"
    `;
    let status = 0;
    let out = "";
    try {
      out = execFileSync("bash", ["-c", wrapper], {
        env: asProcessEnv(env),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      const err = error as { status?: number; stdout?: string; stderr?: string };
      status = err.status ?? 1;
      out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    }
    expect(status).not.toBe(0);
    expect(out).toMatch(/FAIL {2}Docker/);
    expect(out).toMatch(/get-docker|Install Docker/i);
  });

  it("exits non-zero when port 3000 is busy (foreign)", () => {
    const { stubDir, env } = makeStubs({
      docker: "ok",
      portBusy: 3000,
      busyLooksLikeOurs: false,
    });
    junk.push(stubDir);
    const result = runCheck(env, { PROSEFIELD_CHECK_FOR_START: "0" });
    expect(result.status).not.toBe(0);
    expect(result.out).toMatch(/FAIL {2}Port 3000/);
  });

  it("exits non-zero for foreign busy port even with FOR_START=1", () => {
    const { stubDir, env } = makeStubs({
      docker: "ok",
      portBusy: 3000,
      busyLooksLikeOurs: false,
    });
    junk.push(stubDir);
    const result = runCheck(env, { PROSEFIELD_CHECK_FOR_START: "1" });
    expect(result.status).not.toBe(0);
    expect(result.out).toMatch(/FAIL {2}Port 3000/);
  });

  it("reports perl setpgrp path when setsid is absent from PATH", () => {
    const stubDir = mkdtempSync(path.join(tmpdir(), "pf-check-nosetsid-"));
    junk.push(stubDir);
    const nodeVer = requiredNode();
    writeStub(stubDir, "git", 'echo "git version 2.43.0"');
    writeStub(stubDir, "node", `echo "v${nodeVer}"`);
    writeStub(stubDir, "pnpm", 'echo "10.32.1"');
    writeStub(
      stubDir,
      "docker",
      'case "${1:-}" in info) exit 0 ;; compose) echo "2.38.2"; exit 0 ;; *) exit 0 ;; esac',
    );
    writeStub(stubDir, "ss", "exit 0");
    writeStub(stubDir, "curl", "exit 0");
    // Private PATH only — host setsid may live in /bin and /usr/bin on this runner.
    linkBins(stubDir, [
      "grep",
      "sed",
      "head",
      "tr",
      "uname",
      "cat",
      "bash",
      "perl",
      "printf",
      "rm",
      "ls",
      "dirname",
      "basename",
      "mktemp",
      "sleep",
      "ps",
      "kill",
      "readlink",
      "env",
      "cd",
      "true",
      "false",
      "test",
      "[",
      "echo",
      "cut",
      "sort",
      "wc",
      "tee",
      "date",
      "chmod",
      "ln",
      "cp",
      "mv",
      "which",
      "command",
    ]);
    const result = runCheck({
      ...process.env,
      PATH: stubDir,
      OSTYPE: "linux-gnu",
    });
    expect(result.status).toBe(0);
    expect(result.out).toMatch(/Dev-server process group: set -m \+ perl setpgrp/);
    expect(result.out).not.toMatch(/Dev-server process group: setsid$/m);
  });
});

describe("stop.sh executable behaviour", () => {
  /** Avoid `docker compose down` tearing down CI/local emulators during unit runs. */
  const stopEnv = (): NodeJS.ProcessEnv => ({
    ...process.env,
    PROSEFIELD_STOP_SKIP_COMPOSE: "1",
  });

  it("drops stale pid file without signalling", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "pf-stop-stale-"));
    junk.push(dir);
    const pidFile = path.join(dir, "dev.pid");
    writeFileSync(pidFile, "999999");
    const out = execFileSync("bash", [stopSh], {
      env: { ...stopEnv(), PROSEFIELD_DEV_PID_FILE: pidFile },
      encoding: "utf8",
    });
    expect(out).toMatch(/Stale pid file/);
    expect(existsSync(pidFile)).toBe(false);
  });

  it("does not kill an unrelated live PID", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "pf-stop-foreign-"));
    junk.push(dir);
    const pidFile = path.join(dir, "dev.pid");
    const victim = spawn("sleep", ["120"], { stdio: "ignore", detached: true });
    writeFileSync(pidFile, String(victim.pid));
    try {
      const out = execFileSync("bash", [stopSh], {
        env: { ...stopEnv(), PROSEFIELD_DEV_PID_FILE: pidFile },
        encoding: "utf8",
      });
      expect(out).toMatch(/not this repo's frontend|mismatch/);
      expect(existsSync(pidFile)).toBe(false);
      expect(() => process.kill(victim.pid!, 0)).not.toThrow();
    } finally {
      try {
        process.kill(victim.pid!, "SIGKILL");
      } catch {
        // already gone
      }
    }
  });

  it("invokes compose down when skip flag is unset (stubbed docker)", () => {
    const stubDir = mkdtempSync(path.join(tmpdir(), "pf-stop-compose-"));
    junk.push(stubDir);
    const marker = path.join(stubDir, "compose-down.marker");
    // Match both `compose down` and `compose --env-file … down` (no .env in CI).
    writeStub(
      stubDir,
      "docker",
      `if [[ "\${1:-}" == "info" ]]; then exit 0; fi
       if [[ "\${1:-}" == "compose" ]]; then
         for arg in "\$@"; do
           if [[ "\$arg" == "down" ]]; then
             echo down >'${marker}'
             exit 0
           fi
         done
         exit 0
       fi
       exit 0`,
    );
    const env = {
      ...process.env,
      PATH: `${stubDir}:${process.env.PATH ?? ""}`,
      PROSEFIELD_DEV_PID_FILE: path.join(stubDir, "missing.pid"),
    } as NodeJS.ProcessEnv;
    delete env.PROSEFIELD_STOP_SKIP_COMPOSE;
    const out = execFileSync("bash", [stopSh], {
      env,
      encoding: "utf8",
    });
    expect(out).toMatch(/Stopped Docker Compose services/);
    expect(existsSync(marker)).toBe(true);
  });

  it("stops the whole verified process group (leader + child)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "pf-stop-group-"));
    junk.push(dir);
    const pidFile = path.join(dir, "dev.pid");
    const childPidFile = path.join(dir, "child.pid");

    const leader = spawnDevGroupLeader(childPidFile, rootPhysical);
    writeFileSync(pidFile, String(leader.pid));
    waitForPnpmArgs(leader.pid!, childPidFile);
    const childPid = Number(readFileSync(childPidFile, "utf8").trim());

    try {
      const out = execFileSync("bash", [stopSh], {
        env: { ...stopEnv(), PROSEFIELD_DEV_PID_FILE: pidFile },
        encoding: "utf8",
      });
      expect(out).toMatch(/Stopped frontend process group/);
      expect(existsSync(pidFile)).toBe(false);
      const leaderStat = (() => {
        try {
          return execFileSync("ps", ["-o", "stat=", "-p", String(leader.pid)], {
            encoding: "utf8",
          }).trim();
        } catch {
          return "";
        }
      })();
      expect(leaderStat === "" || leaderStat.includes("Z")).toBe(true);
      expect(processAlive(childPid)).toBe(false);
    } finally {
      try {
        leader.kill("SIGKILL");
      } catch {
        // gone
      }
      for (const pid of [leader.pid, childPid]) {
        if (!pid) continue;
        try {
          process.kill(-pid, "SIGKILL");
        } catch {
          try {
            process.kill(pid, "SIGKILL");
          } catch {
            // gone
          }
        }
      }
    }
  });

  it("does not kill pnpm-named process in a foreign cwd (SP7)", () => {
    const foreignDir = mkdtempSync(path.join(tmpdir(), "pf-stop-foreign-cwd-"));
    junk.push(foreignDir);
    const dir = mkdtempSync(path.join(tmpdir(), "pf-stop-sp7-"));
    junk.push(dir);
    const pidFile = path.join(dir, "dev.pid");
    const victim = spawn(
      "bash",
      [
        "-c",
        "exec -a 'pnpm dev --hostname 127.0.0.1 --port 3000' sleep 120",
      ],
      { cwd: foreignDir, stdio: "ignore", detached: true },
    );
    writeFileSync(pidFile, String(victim.pid));
    try {
      // Ensure cmdline looks like pnpm before stop runs.
      for (let i = 0; i < 30; i++) {
        try {
          const args = execFileSync(
            "ps",
            ["-o", "args=", "-p", String(victim.pid)],
            { encoding: "utf8" },
          );
          if (/pnpm/.test(args)) break;
        } catch {
          // retry
        }
        execFileSync("sleep", ["0.05"]);
      }
      const out = execFileSync("bash", [stopSh], {
        env: { ...stopEnv(), PROSEFIELD_DEV_PID_FILE: pidFile },
        encoding: "utf8",
      });
      expect(out).toMatch(/cwd mismatch|not this repo's frontend/);
      expect(existsSync(pidFile)).toBe(false);
      expect(processAlive(victim.pid!)).toBe(true);
    } finally {
      try {
        process.kill(victim.pid!, "SIGKILL");
      } catch {
        // already gone
      }
    }
  });

  it("lsof cwd path: stops ours and refuses foreign (SP8)", () => {
    const foreignDir = mkdtempSync(path.join(tmpdir(), "pf-stop-sp8-foreign-"));
    junk.push(foreignDir);
    const stubDir = mkdtempSync(path.join(tmpdir(), "pf-stop-sp8-stubs-"));
    junk.push(stubDir);
    const pidFileOurs = path.join(stubDir, "ours.pid");
    const pidFileForeign = path.join(stubDir, "foreign.pid");

    const ours = spawn(
      "bash",
      [
        "-c",
        "exec -a 'pnpm dev --hostname 127.0.0.1 --port 3000' sleep 120",
      ],
      { cwd: rootPhysical, stdio: "ignore", detached: true },
    );
    const foreign = spawn(
      "bash",
      [
        "-c",
        "exec -a 'pnpm dev --hostname 127.0.0.1 --port 3000' sleep 120",
      ],
      { cwd: foreignDir, stdio: "ignore", detached: true },
    );
    writeFileSync(pidFileOurs, String(ours.pid));
    writeFileSync(pidFileForeign, String(foreign.pid));

    // lsof -Fn stub: n<path> for cwd. Broken s/^n// parse (SP8) would refuse ours.
    writeStub(
      stubDir,
      "lsof",
      `pid=""
       while [[ \$# -gt 0 ]]; do
         if [[ "\$1" == "-p" ]]; then pid="\$2"; shift 2; continue; fi
         shift
       done
       case "\$pid" in
         "${ours.pid}") printf 'n%s\\n' '${rootPhysical}' ;;
         "${foreign.pid}") printf 'n%s\\n' '${foreignDir}' ;;
         *) exit 1 ;;
       esac`,
    );

    try {
      const envBase = {
        ...stopEnv(),
        PATH: `${stubDir}:${process.env.PATH ?? ""}`,
        PROSEFIELD_STOP_DISABLE_PROC: "1",
      };

      const outOurs = execFileSync("bash", [stopSh], {
        env: { ...envBase, PROSEFIELD_DEV_PID_FILE: pidFileOurs },
        encoding: "utf8",
      });
      expect(outOurs).toMatch(/Stopped frontend/);
      expect(processAlive(ours.pid!)).toBe(false);

      const outForeign = execFileSync("bash", [stopSh], {
        env: { ...envBase, PROSEFIELD_DEV_PID_FILE: pidFileForeign },
        encoding: "utf8",
      });
      expect(outForeign).toMatch(/cwd mismatch|not this repo's frontend/);
      expect(processAlive(foreign.pid!)).toBe(true);
    } finally {
      for (const p of [ours.pid, foreign.pid]) {
        if (!p) continue;
        try {
          process.kill(p, "SIGKILL");
        } catch {
          // gone
        }
      }
    }
  });

  it("refuses to signal when cwd cannot be verified (SP9)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "pf-stop-sp9-"));
    junk.push(dir);
    const stubDir = mkdtempSync(path.join(tmpdir(), "pf-stop-sp9-stubs-"));
    junk.push(stubDir);
    const pidFile = path.join(dir, "dev.pid");

    // pnpm-named, cwd is ours, but no /proc and no lsof — must fail safe.
    const victim = spawn(
      "bash",
      [
        "-c",
        "exec -a 'pnpm dev --hostname 127.0.0.1 --port 3000' sleep 120",
      ],
      { cwd: rootPhysical, stdio: "ignore", detached: true },
    );
    writeFileSync(pidFile, String(victim.pid));

    // Private PATH without lsof (and DISABLE_PROC) so neither cwd tool works.
    linkBins(stubDir, [
      "bash",
      "ps",
      "tr",
      "kill",
      "sleep",
      "cat",
      "sed",
      "head",
      "grep",
      "rm",
      "printf",
      "echo",
      "true",
      "false",
      "test",
      "[",
      "env",
      "dirname",
      "basename",
      "readlink",
    ]);

    try {
      const out = execFileSync("bash", [stopSh], {
        env: {
          ...stopEnv(),
          PATH: stubDir,
          PROSEFIELD_STOP_DISABLE_PROC: "1",
          PROSEFIELD_STOP_DISABLE_LSOF: "1",
          PROSEFIELD_DEV_PID_FILE: pidFile,
        },
        encoding: "utf8",
      });
      expect(out).toMatch(/cannot verify cwd/);
      expect(out).toMatch(/not signalling/);
      expect(existsSync(pidFile)).toBe(false);
      expect(processAlive(victim.pid!)).toBe(true);
    } finally {
      try {
        process.kill(victim.pid!, "SIGKILL");
      } catch {
        // gone
      }
    }
  });

  it("matches physical paths when repo is reached via symlink (R5)", () => {
    const linkParent = mkdtempSync(path.join(tmpdir(), "pf-stop-r5-"));
    junk.push(linkParent);
    const link = path.join(linkParent, "prosefield");
    execFileSync("ln", ["-s", rootPhysical, link]);
    const stopViaLink = path.join(link, "scripts/stop.sh");
    const pidFile = path.join(linkParent, "dev.pid");
    const childPidFile = path.join(linkParent, "child.pid");

    const leader = spawnDevGroupLeader(childPidFile, rootPhysical);
    writeFileSync(pidFile, String(leader.pid));
    waitForPnpmArgs(leader.pid!, childPidFile);

    try {
      // Invoking stop.sh through the symlink must still resolve ROOT via pwd -P.
      const out = execFileSync("bash", [stopViaLink], {
        env: { ...stopEnv(), PROSEFIELD_DEV_PID_FILE: pidFile },
        encoding: "utf8",
      });
      expect(out).toMatch(/Stopped frontend/);
      expect(existsSync(pidFile)).toBe(false);
      expect(processAlive(leader.pid!)).toBe(false);
    } finally {
      try {
        process.kill(-(leader.pid!), "SIGKILL");
      } catch {
        try {
          process.kill(leader.pid!, "SIGKILL");
        } catch {
          // gone
        }
      }
    }
  });
});

describe("start.sh launch without setsid (macOS path)", () => {
  it("prosefield_launch_dev_server creates own process group when setsid is absent", () => {
    const stubDir = mkdtempSync(path.join(tmpdir(), "pf-launch-nosetsid-"));
    junk.push(stubDir);
    const pidFile = path.join(stubDir, "dev.pid");
    const logFile = path.join(stubDir, "dev.log");

    writeStub(
      stubDir,
      "pnpm",
      `if [[ "\${1:-}" == "dev" ]]; then
         exec -a 'pnpm dev --hostname 127.0.0.1 --port 3000' sleep 120
       fi
       exit 0`,
    );
    writeStub(stubDir, "nohup", 'exec "$@"');
    linkBins(stubDir, [
      "bash",
      "perl",
      "ps",
      "tr",
      "kill",
      "sleep",
      "cat",
      "sed",
      "head",
      "env",
      "true",
      "false",
      "test",
      "[",
      "echo",
      "printf",
      "rm",
      "chmod",
      "ln",
    ]);

    // Private PATH only — setsid may exist in both /bin and /usr/bin.
    const harness = `
      set -euo pipefail
      PATH='${stubDir}'
      hash -r
      if command -v setsid >/dev/null 2>&1; then
        echo "setsid unexpectedly on PATH: $(command -v setsid)" >&2
        exit 2
      fi
      eval "$(sed -n '/^prosefield_launch_dev_server()/,/^}/p' '${startSh}')"
      prosefield_launch_dev_server '${logFile}' '${pidFile}'
      sleep 0.2
      pid="$(tr -d '[:space:]' <'${pidFile}')"
      pgid="$(ps -o pgid= -p "$pid" | tr -d '[:space:]')"
      echo "pid=$pid pgid=$pgid"
      test -n "$pid"
      test "$pgid" = "$pid"
      kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
    `;

    // Keep a normal PATH for finding bash; the harness itself restricts PATH.
    const out = execFileSync("/bin/bash", ["-c", harness], {
      cwd: root,
      encoding: "utf8",
    });
    expect(out).toMatch(/pid=(\d+) pgid=\1/);
    expect(existsSync(pidFile)).toBe(true);
  });
});

describe("bash -n", () => {
  it("parses ship scripts", () => {
    for (const script of [
      "scripts/check.sh",
      "scripts/start.sh",
      "scripts/stop.sh",
      "scripts/demo-gifs.sh",
    ]) {
      execFileSync("bash", ["-n", path.join(root, script)]);
    }
  });
});

describe("demo-gifs.sh billing + encode", () => {
  const demoGifsSh = readFileSync(
    path.join(root, "scripts/demo-gifs.sh"),
    "utf8",
  );

  it("starts the loopback stripe-prices mock and sets demo GIF billing env", () => {
    expect(demoGifsSh).toMatch(/PROSEFIELD_DEMO_GIFS=1/);
    expect(demoGifsSh).toMatch(/stripe-prices-mock-server\.mjs/);
    expect(demoGifsSh).toMatch(/STRIPE_API_HOST='127\.0\.0\.1'/);
    expect(demoGifsSh).toMatch(/STRIPE_API_PORT='12111'/);
    expect(demoGifsSh).toMatch(/STRIPE_API_PROTOCOL='http'/);
    // Assembled fragments — no contiguous sk_test_/whsec_ token in source.
    expect(demoGifsSh).not.toMatch(/sk_test_[A-Za-z0-9]+/);
    expect(demoGifsSh).not.toMatch(/whsec_[A-Za-z0-9]+/);
    expect(demoGifsSh).toMatch(/SK_PREFIX='sk_test'/);
    expect(demoGifsSh).toMatch(/demogifsrecording01/);
  });

  it("encodes 800px-wide GIFs at real playback fps (no frame-duplication slowdown)", () => {
    expect(demoGifsSh).toMatch(/scale=800:-1/);
    expect(demoGifsSh).not.toMatch(/scale=540:-1/);
    expect(demoGifsSh).toMatch(/fps=8/);
    // Bite: setpts / minterpolate / frame-duplication tricks must stay out.
    expect(demoGifsSh).not.toMatch(/setpts/);
    expect(demoGifsSh).not.toMatch(/minterpolate/);
  });
});
