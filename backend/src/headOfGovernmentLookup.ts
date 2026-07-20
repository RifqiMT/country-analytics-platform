import { getCache, setCache } from "./cache.js";
import { groqChatWithFallbackForUseCase, tavilySearchWithMeta } from "./llm.js";
import { fetchWikidataHeadOfGovernmentName } from "./wikidataCountryProfile.js";

export type HeadOfGovernmentResolution = {
  name: string;
  source: "wikidata" | "tavily_groq";
};

function cleanPersonName(raw: string): string | null {
  const t = raw
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\([^)]{0,80}\)/g, "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ");
  if (!t || t.length < 3 || t.length > 80) return null;
  if (/^(unknown|not reported|n\/a|null|none)$/i.test(t)) return null;
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(t)) return null;
  return t;
}

function parseGroqHeadName(text: string): string | null {
  const trimmed = text.trim();
  try {
    const j = JSON.parse(trimmed) as { name?: unknown; headOfGovernmentName?: unknown };
    const candidate =
      typeof j.name === "string" ? j.name : typeof j.headOfGovernmentName === "string" ? j.headOfGovernmentName : "";
    return cleanPersonName(candidate);
  } catch {
    const m = trimmed.match(/"name"\s*:\s*"([^"]+)"/i);
    if (m?.[1]) return cleanPersonName(m[1]);
    return cleanPersonName(trimmed);
  }
}

async function fetchHeadOfGovernmentFromWeb(args: {
  countryName: string;
  cca3: string;
  roleTitle?: string;
  tavilyApiKey?: string;
  groqApiKey?: string;
}): Promise<string | null> {
  const role = args.roleTitle?.trim() || "head of government";
  const year = new Date().getUTCFullYear();
  const query = `${args.countryName} current ${role} ${year} incumbent name official`;
  const { formattedBlock, synthesizedAnswer } = await tavilySearchWithMeta(query, 5, {
    searchDepth: "advanced",
    includeAnswer: "advanced",
    timeRange: "year",
    topic: "news",
    apiKey: args.tavilyApiKey,
  });
  const context = [synthesizedAnswer?.trim(), formattedBlock.trim()].filter(Boolean).join("\n\n");
  if (!context.trim()) return null;

  const system = `You extract the current officeholder's personal name from web excerpts.
Return ONLY valid JSON: {"name":"<Full Name>"}.
Rules:
- Name must be the person currently serving as ${role} of ${args.countryName}.
- Use the most recent, clearly current incumbent only.
- If excerpts disagree or none name a current officeholder, return {"name":""}.
- Do not include titles, honorifics, or country names in the name field.`;

  const user = `Country: ${args.countryName} (${args.cca3})
Office sought: ${role}

Web excerpts:
${context.slice(0, 12_000)}`;

  const { text } = await groqChatWithFallbackForUseCase("assistant", system, user, {
    jsonObject: true,
    temperature: 0.1,
    topP: 0.85,
    maxTokens: 120,
    timeoutMs: 18_000,
    apiKey: args.groqApiKey,
  });
  return parseGroqHeadName(text);
}

/**
 * Resolve the current head-of-government personal name.
 * Prefers Tavily+Groq when configured (fresh web grounding); falls back to Wikidata P6.
 */
export async function resolveHeadOfGovernmentName(args: {
  cca3: string;
  countryName: string;
  roleTitle?: string;
  tavilyApiKey?: string;
  groqApiKey?: string;
}): Promise<HeadOfGovernmentResolution | null> {
  const iso = String(args.cca3 ?? "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(iso)) return null;

  const cacheKey = `head-gov-person:${iso}`;
  const cached = getCache<HeadOfGovernmentResolution | null>(cacheKey);
  if (cached !== undefined) return cached;

  const tavilyKey = args.tavilyApiKey?.trim() || process.env.TAVILY_API_KEY?.trim();
  const groqKey = args.groqApiKey?.trim() || process.env.GROQ_API_KEY?.trim();
  const webConfigured = Boolean(tavilyKey && groqKey);

  let resolved: HeadOfGovernmentResolution | null = null;

  if (webConfigured) {
    try {
      const webName = await fetchHeadOfGovernmentFromWeb({
        countryName: args.countryName,
        cca3: iso,
        roleTitle: args.roleTitle,
        tavilyApiKey: tavilyKey,
        groqApiKey: groqKey,
      });
      if (webName) resolved = { name: webName, source: "tavily_groq" };
    } catch {
      /* fall through to Wikidata */
    }
  }

  if (!resolved) {
    const wdName = await fetchWikidataHeadOfGovernmentName(iso);
    if (wdName) resolved = { name: wdName, source: "wikidata" };
  }

  setCache(cacheKey, resolved, 1000 * 60 * 60 * 6);
  return resolved;
}
