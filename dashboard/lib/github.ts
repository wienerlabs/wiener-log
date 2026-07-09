const API = "https://api.github.com";

function token(): string {
  return process.env.GITHUB_TOKEN || "";
}

function baseHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${token()}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "wienerlog-dashboard",
  };
}

async function ghJson<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: baseHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}

async function ghPaginate<T = Record<string, unknown>>(
  path: string,
  maxPages = 10,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const batch = await ghJson<T[]>(`${path}${sep}per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

export const listOrgRepos = (org: string) =>
  ghPaginate<Record<string, unknown>>(`/orgs/${org}/repos?type=all`);
export const listOpenPulls = (repo: string) =>
  ghPaginate<Record<string, unknown>>(`/repos/${repo}/pulls?state=open`);
export const listOpenIssues = (repo: string) =>
  ghPaginate<Record<string, unknown>>(`/repos/${repo}/issues?state=open`);
export const getPull = (repo: string, n: number) =>
  ghJson<Record<string, unknown>>(`/repos/${repo}/pulls/${n}`);
export const getCommitStatus = (repo: string, sha: string) =>
  ghJson<{ state: string; total_count: number }>(
    `/repos/${repo}/commits/${sha}/status`,
  );

export async function createIssue(
  repo: string,
  input: { title: string; body?: string; assignees?: string[]; labels?: string[] },
): Promise<{ html_url: string; number: number }> {
  const res = await fetch(`${API}/repos/${repo}/issues`, {
    method: "POST",
    headers: { ...baseHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GitHub ${res.status} creating issue in ${repo}`);
  }
  return res.json();
}

export async function pool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        results[i] = await fn(items[i], i);
      } catch {
        results[i] = undefined as R;
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}
