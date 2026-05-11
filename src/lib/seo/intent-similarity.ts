/**
 * Jaccard similarity over keyword + tag sets — used to gap-fill related
 * intent landings when an editor hasn't manually curated `relatedClusters`.
 */

export interface SimilarityCandidate {
  slug: string;
  title: string;
  tokens: string[];
}

const NORMALIZE = (s: string) => s.trim().toLowerCase();

export function tokenize(
  ...lists: ReadonlyArray<readonly string[] | undefined | null>
): string[] {
  const set = new Set<string>();
  for (const list of lists) {
    if (!list) continue;
    for (const item of list) {
      const norm = NORMALIZE(item);
      if (norm) set.add(norm);
    }
  }
  return Array.from(set);
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function rankBySimilarity(
  target: readonly string[],
  candidates: readonly SimilarityCandidate[],
  excludeSlugs: ReadonlySet<string>,
  topN: number,
): SimilarityCandidate[] {
  const targetSet = new Set(target.map(NORMALIZE).filter(Boolean));
  if (targetSet.size === 0) return [];
  return candidates
    .filter((c) => !excludeSlugs.has(c.slug))
    .map((c) => ({ c, score: jaccard(targetSet, new Set(c.tokens)) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((s) => s.c);
}
