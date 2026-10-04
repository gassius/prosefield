import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("P5b ship scripts (bash only, WSL2 for Windows)", () => {
  it("ships check/start/stop bash scripts and no PowerShell", () => {
    expect(existsSync(path.join(root, "scripts/check.sh"))).toBe(true);
    expect(existsSync(path.join(root, "scripts/start.sh"))).toBe(true);
    expect(existsSync(path.join(root, "scripts/stop.sh"))).toBe(true);
    const scripts = readdirSync(path.join(root, "scripts"));
    expect(scripts.some((name) => name.endsWith(".ps1"))).toBe(false);
  });

  it("check.sh refuses native Windows shells and never installs system-wide", () => {
    const text = read("scripts/check.sh");
    expect(text).toMatch(/WSL2/);
    expect(text).toMatch(/learn\.microsoft\.com\/en-us\/windows\/wsl\/install/);
    expect(text).toMatch(/MINGW|MSYS|MSYSTEM/);
    expect(text).not.toMatch(/\b(apt-get|brew install|choco)\b/);
    expect(text).toMatch(/docs\.docker\.com\/get-docker/);
    expect(text).toMatch(/nvm-sh\/nvm/);
    for (const port of ["3000", "4000", "8080", "9099", "9150"]) {
      expect(text).toContain(port);
    }
  });

  it("start.sh is idempotent-shaped: check → install → compose → host dev", () => {
    const text = read("scripts/start.sh");
    expect(text).toMatch(/scripts\/check\.sh/);
    expect(text).toMatch(/pnpm install --frozen-lockfile/);
    expect(text).toMatch(/require-docker\.sh/);
    expect(text).toMatch(/pnpm dev/);
    expect(text).toMatch(/wait-for-url\.sh/);
    expect(text).toMatch(/scripts\/stop\.sh/);
    expect(text).toMatch(/Compose only/);
    // Only invoke nvm when active Node mismatches .nvmrc (CI may have nvm without that version).
    expect(text).toMatch(/actual_node.*required_node|required_node.*actual_node/s);
    expect(text).not.toMatch(/firebase emulators:(start|exec)/i);
  });


  it("AGENT_SETUP.md stops before system installs and covers verify + Stripe mock", () => {
    const text = read("AGENT_SETUP.md");
    expect(text).toMatch(/STOP/);
    expect(text).toMatch(/system-wide/i);
    expect(text).toMatch(/scripts\/check\.sh/);
    expect(text).toMatch(/scripts\/start\.sh/);
    expect(text).toMatch(/200/);
    expect(text).toMatch(/mocked/i);
    expect(text).toMatch(/WSL2/);
  });

  it("write-up answers the three take-home questions; time log is a template", () => {
    const writeUp = read("docs/write-up.md");
    expect(writeUp).toMatch(/active subscriber/i);
    expect(writeUp).toMatch(/webhook is delayed/i);
    expect(writeUp).toMatch(/security decision/i);
    expect(writeUp).toMatch(/session-sync/i);

    const timeLog = read("docs/time-log.md");
    expect(timeLog).toMatch(/must \*\*not\*\* invent times|must not invent/i);
    expect(timeLog).toMatch(/_—_|YYYY-MM-DD/);
    // No invented numeric hour totals.
    expect(timeLog).not.toMatch(/\|\s*\d+(\.\d+)?\s*\|/);
  });

  it("check.sh compares .nvmrc and exits non-zero on failures; bash -n is clean", () => {
    const text = read("scripts/check.sh");
    expect(text).toMatch(/\.nvmrc/);
    expect(text).toMatch(/exit 1/);
    expect(text).toMatch(/FAIL=/);

    try {
      execFileSync("bash", ["-n", path.join(root, "scripts/check.sh")]);
      execFileSync("bash", ["-n", path.join(root, "scripts/start.sh")]);
      execFileSync("bash", ["-n", path.join(root, "scripts/stop.sh")]);
      execFileSync("bash", ["-n", path.join(root, "scripts/demo-gifs.sh")]);
    } catch (error) {
      expect.fail(`bash -n failed: ${String(error)}`);
    }
  });
});

