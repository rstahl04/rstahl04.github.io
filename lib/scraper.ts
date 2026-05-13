import * as cheerio from "cheerio";

export type ScrapedPage = {
  url: string;
  title: string;
  text: string;
};

export type ScrapeResult = {
  pages: ScrapedPage[];
  warnings: string[];
};

const MAX_PAGES = 10;
const MAX_TEXT_PER_PAGE = 9000;
const REQUEST_TIMEOUT_MS = 12000;

const importantPageTerms = [
  "about",
  "service",
  "services",
  "contact",
  "faq",
  "faqs",
  "appointment",
  "appointments",
  "booking",
  "book",
  "pricing",
  "price",
  "hours",
  "location",
  "locations",
  "team",
  "staff",
  "policy",
  "policies"
];

const blockedPathTerms = [
  "login",
  "signin",
  "sign-in",
  "account",
  "portal",
  "checkout",
  "cart",
  "payment",
  "pay",
  "privacy",
  "terms",
  "wp-admin",
  "admin",
  "dashboard",
  "register",
  "reset-password"
];

export async function scrapeBusinessWebsite(inputUrl: string): Promise<ScrapeResult> {
  const startUrl = normalizeStartUrl(inputUrl);
  const origin = startUrl.origin;
  const warnings: string[] = [];
  const candidates = new Map<string, number>();
  const visited = new Set<string>();
  const pages: ScrapedPage[] = [];
  candidates.set(startUrl.href, 100);

  const sitemapUrls = await discoverSitemapUrls(startUrl).catch(() => []);
  for (const sitemapUrl of sitemapUrls) {
    if (isAllowedPublicPage(sitemapUrl, origin)) {
      candidates.set(sitemapUrl.href, scoreUrl(sitemapUrl));
    }
  }

  while (pages.length < MAX_PAGES && candidates.size > 0) {
    const next = [...candidates.entries()]
      .sort((a, b) => b[1] - a[1])
      .find(([url]) => !visited.has(url));

    if (!next) break;

    const [url] = next;
    candidates.delete(url);
    visited.add(url);

    const fetched = await fetchPage(url);
    if (!fetched.ok) {
      if (pages.length === 0) warnings.push(`Could not scrape ${url}: ${fetched.error}`);
      continue;
    }

    const parsed = parsePage(fetched.url, fetched.html);
    if (parsed.text.length < 120) continue;

    pages.push(parsed);

    for (const link of parsed.links) {
      if (!visited.has(link.href) && isAllowedPublicPage(link, origin)) {
        candidates.set(link.href, Math.max(candidates.get(link.href) ?? 0, scoreUrl(link)));
      }
    }
  }

  if (pages.length === 0) {
    warnings.push("No usable public website text was collected. The generated output should mark website facts as missing.");
  }

  if (pages.length < 3) {
    warnings.push("Only limited public website content was found. Review Missing Info to Confirm carefully.");
  }

  return { pages, warnings };
}

function normalizeStartUrl(inputUrl: string) {
  const trimmed = inputUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  url.hash = "";
  return url;
}

async function discoverSitemapUrls(startUrl: URL) {
  const sitemapUrl = new URL("/sitemap.xml", startUrl.origin);
  const response = await fetchWithTimeout(sitemapUrl.href);
  if (!response.ok) return [];

  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)]
    .map((match) => {
      try {
        return new URL(decodeHtml(match[1].trim()));
      } catch {
        return null;
      }
    })
    .filter((url): url is URL => Boolean(url));

  return urls.slice(0, 40);
}

async function fetchPage(url: string): Promise<
  | { ok: true; url: string; html: string }
  | { ok: false; error: string }
> {
  try {
    const response = await fetchWithTimeout(url);
    const contentType = response.headers.get("content-type") ?? "";

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return { ok: false, error: "URL did not return HTML" };
    }

    return { ok: true, url: response.url, html: await response.text() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Request failed" };
  }
}

function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  return fetch(url, {
    signal: controller.signal,
    headers: {
      "User-Agent": "PrompterCom/0.1 (+public website information crawler)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    },
    redirect: "follow"
  }).finally(() => clearTimeout(timeout));
}

function parsePage(url: string, html: string): ScrapedPage & { links: URL[] } {
  const $ = cheerio.load(html);

  $("script, style, noscript, svg, canvas, iframe, form [type='password']").remove();

  const title =
    cleanText($("title").first().text()) ||
    cleanText($("h1").first().text()) ||
    new URL(url).hostname;

  const metaDescription = cleanText($("meta[name='description']").attr("content") ?? "");
  const headings = $("h1,h2,h3")
    .map((_, element) => cleanText($(element).text()))
    .get()
    .filter(Boolean)
    .slice(0, 40);

  const bodyText = cleanText($("body").text());
  const emails = uniqueMatches(html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []);
  const phones = uniqueMatches(html.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g) ?? []);
  const schemaText = extractJsonLdText($);
  const formFields = extractFormFields($);

  const text = [
    `Source URL: ${url}`,
    `Page title: ${title}`,
    metaDescription ? `Meta description: ${metaDescription}` : "",
    headings.length ? `Headings: ${headings.join(" | ")}` : "",
    emails.length ? `Emails found: ${emails.join(", ")}` : "",
    phones.length ? `Phone numbers found: ${phones.join(", ")}` : "",
    formFields.length ? `Form fields found: ${formFields.join(", ")}` : "",
    schemaText,
    bodyText
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_TEXT_PER_PAGE);

  const links: URL[] = [];
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;

    try {
      const link = new URL(href, url);
      link.hash = "";
      links.push(link);
    } catch {
      // Ignore malformed links.
    }
  });

  return { url, title, text, links };
}

function extractJsonLdText($: cheerio.CheerioAPI) {
  const snippets: string[] = [];

  $("script[type='application/ld+json']").each((_, element) => {
    const raw = $(element).contents().text();
    if (!raw) return;

    try {
      snippets.push(JSON.stringify(JSON.parse(raw)).slice(0, 3000));
    } catch {
      snippets.push(cleanText(raw).slice(0, 1000));
    }
  });

  return snippets.length ? `Structured data: ${snippets.join("\n")}` : "";
}

function extractFormFields($: cheerio.CheerioAPI) {
  const fields: string[] = [];

  $("input, textarea, select").each((_, element) => {
    const name =
      $(element).attr("aria-label") ||
      $(element).attr("name") ||
      $(element).attr("placeholder") ||
      $(element).attr("id");
    const cleaned = cleanText(name ?? "");

    if (cleaned && !/captcha|honeypot|csrf|token/i.test(cleaned)) {
      fields.push(cleaned);
    }
  });

  return uniqueMatches(fields).slice(0, 60);
}

function scoreUrl(url: URL) {
  const path = `${url.pathname} ${url.search}`.toLowerCase();
  const termScore = importantPageTerms.reduce((score, term) => (path.includes(term) ? score + 12 : score), 0);
  const depthPenalty = url.pathname.split("/").filter(Boolean).length * 2;
  return termScore - depthPenalty;
}

function isAllowedPublicPage(url: URL, origin: string) {
  if (url.origin !== origin) return false;
  if (!["http:", "https:"].includes(url.protocol)) return false;

  const path = decodeURIComponent(`${url.pathname} ${url.search}`).toLowerCase();
  if (blockedPathTerms.some((term) => path.includes(term))) return false;
  if (/\.(pdf|jpg|jpeg|png|gif|webp|svg|zip|doc|docx|xls|xlsx|mp4|mov|avi)$/i.test(url.pathname)) return false;

  return true;
}

function cleanText(value: string) {
  return decodeHtml(value)
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function uniqueMatches(values: string[]) {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
