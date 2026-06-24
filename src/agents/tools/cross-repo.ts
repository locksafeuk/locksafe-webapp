/**
 * Cross-repo platform awareness (read-only).
 *
 * The agents live in the webapp but LockSafe is 4 sibling repos. This gives the
 * CTO a single read-only snapshot of the whole platform — mobile version/drift,
 * social-automation health, and per-repo git freshness — so the orchestration
 * is platform-aware, not webapp-only. It SENSES and FLAGS; it never builds,
 * submits, posts, or mutates a sibling repo (those stay human / gated).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AgentTool, ToolResult } from "@/agents/core/types";

const execFileP = promisify(execFile);
const REPO_ROOT = path.resolve(process.cwd(), "..");
const SIBLING_REPOS = ["locksafe-mobile", "locksafe-social-automation", "locksafe-social-media"];

const STALE_REPO_DAYS = 30;

export interface RepoGit {
  repo: string;
  hash: string | null;
  subject: string | null;
  ageDays: number | null;
  error?: string;
}

export interface PlatformSnapshot {
  checkedAt: string;
  repos: RepoGit[];
  mobile: {
    configVersion: string | null;
    iosBuild: string | null;
    androidVersionCode: string | null;
    packageVersion: string | null;
    statusDocVersion: string | null;
    versionDrift: boolean;
    distinctVersions: string[];
  };
  socialAutomation: {
    totalPostsMade: number | null;
    lastPostDate: string | null;
    dormant: boolean;
  };
}

async function gitOneLine(repo: string): Promise<RepoGit> {
  const repoPath = path.resolve(REPO_ROOT, repo);
  try {
    // execFile (no shell) with fixed args + allowlisted repo — no injection surface.
    const { stdout } = await execFileP("git", ["-C", repoPath, "log", "-1", "--format=%h|%s|%ct"], {
      timeout: 8000,
    });
    const [hash, subject, ct] = stdout.trim().split("|");
    const ageDays = ct ? Math.floor((Date.now() - Number(ct) * 1000) / 86_400_000) : null;
    return { repo, hash: hash || null, subject: subject || null, ageDays };
  } catch (e) {
    return { repo, hash: null, subject: null, ageDays: null, error: e instanceof Error ? e.message : "git failed" };
  }
}

async function readFileSafe(...parts: string[]): Promise<string | null> {
  try {
    return await fs.readFile(path.resolve(REPO_ROOT, ...parts), "utf-8");
  } catch {
    return null;
  }
}

function match1(text: string | null, re: RegExp): string | null {
  if (!text) return null;
  const m = text.match(re);
  return m ? m[1] : null;
}

/** Pure: derive operator-facing flags from a snapshot. Unit-tested. */
export function derivePlatformFlags(snap: PlatformSnapshot): string[] {
  const flags: string[] = [];
  if (snap.mobile.versionDrift) {
    flags.push(
      `Mobile version drift: config=${snap.mobile.configVersion} package.json=${snap.mobile.packageVersion} statusDoc=${snap.mobile.statusDocVersion} — reconcile before the next release.`,
    );
  }
  if (snap.socialAutomation.dormant) {
    flags.push(
      "social-automation has never posted (dormant) — the webapp publish-organic pipeline is the live publisher; treat the Python repo as content-gen only.",
    );
  }
  for (const r of snap.repos) {
    if (r.ageDays != null && r.ageDays > STALE_REPO_DAYS) {
      flags.push(`${r.repo} has had no commit in ${r.ageDays} days.`);
    }
    if (r.error) flags.push(`${r.repo}: git read failed (${r.error}).`);
  }
  return flags;
}

export const getPlatformStatusTool: AgentTool = {
  name: "getPlatformStatus",
  description:
    "Read-only snapshot of the whole LockSafe platform across all repos: per-repo git freshness, mobile app version + drift across config/package/status-doc, and social-automation posting health. Use to spot cross-repo issues (mobile version drift, stale repos, a release needed). Does NOT build, submit, or post — flag findings for a human.",
  category: "analytics",
  permissions: ["cto", "devops", "system", "ceo"],
  parameters: [],
  async execute(): Promise<ToolResult> {
    try {
      const repos = await Promise.all(SIBLING_REPOS.map(gitOneLine));

      const appConfig = await readFileSafe("locksafe-mobile", "app.config.js");
      const pkg = await readFileSafe("locksafe-mobile", "package.json");
      const statusDoc = await readFileSafe("locksafe-mobile", "docs/builds/STATUS_CURRENT.md");
      const tracker = await readFileSafe("locksafe-social-automation", "data/post_tracker.json");

      const configVersion = match1(appConfig, /version:\s*["']([\d.]+)["']/);
      const iosBuild = match1(appConfig, /buildNumber:\s*["']?(\d+)["']?/);
      const androidVersionCode = match1(appConfig, /versionCode:\s*["']?(\d+)["']?/);
      const packageVersion = match1(pkg, /"version":\s*"([\d.]+)"/);
      const statusDocVersion = match1(statusDoc, /v?(\d+\.\d+\.\d+)/);

      const distinctVersions = [...new Set(
        [configVersion, packageVersion, statusDocVersion].filter((v): v is string => !!v),
      )];

      let totalPostsMade: number | null = null;
      let lastPostDate: string | null = null;
      if (tracker) {
        try {
          const t = JSON.parse(tracker) as { total_posts_made?: number; last_post_date?: string | null };
          totalPostsMade = typeof t.total_posts_made === "number" ? t.total_posts_made : null;
          lastPostDate = t.last_post_date ?? null;
        } catch {
          /* malformed tracker */
        }
      }

      const snapshot: PlatformSnapshot = {
        checkedAt: new Date().toISOString(),
        repos,
        mobile: {
          configVersion,
          iosBuild,
          androidVersionCode,
          packageVersion,
          statusDocVersion,
          versionDrift: distinctVersions.length > 1,
          distinctVersions,
        },
        socialAutomation: {
          totalPostsMade,
          lastPostDate,
          dormant: totalPostsMade === 0 || totalPostsMade === null,
        },
      };

      return { success: true, data: { ...snapshot, flags: derivePlatformFlags(snapshot) } };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "platform status failed" };
    }
  },
};

export const crossRepoTools: AgentTool[] = [getPlatformStatusTool];
