/**
 * Levenshtein distance-based text similarity (0.0 ~ 1.0).
 */
export function textSimilarity(a: string, b: string): number {
  const s1 = normalize(a);
  const s2 = normalize(b);

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const maxLen = Math.max(s1.length, s2.length);
  const dist = levenshtein(s1, s2);
  return 1 - dist / maxLen;
}

function normalize(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:'"()]/g, '');
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

/**
 * Char-by-char match status for typing highlight.
 * Returns array of booleans: true = correct at that position.
 */
export function charMatchStatus(
  typed: string,
  original: string
): boolean[] {
  return typed.split('').map((ch, i) => ch === original[i]);
}
