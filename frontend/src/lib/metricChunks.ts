/** Split metric ids into fixed-size API batches (serverless-safe). */
export function chunkMetricIds(ids: readonly string[], chunkSize: number): string[][] {
  const size = Math.max(1, Math.floor(chunkSize));
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(ids.slice(i, i + size) as string[]);
  }
  return out;
}

/** Recommended batch size for GET /api/country/:cca3/series on serverless (~60s cap). */
export const COUNTRY_SERIES_CHUNK_SIZE = 4;
