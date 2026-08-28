import { useEffect } from "react";
import config from "@/config/config";

const SITE_NAME = config.APP_NAME;
const DEFAULT_TITLE = "Cashus — Split Expenses, Track Debts";
const DEFAULT_DESCRIPTION =
  "Cashus makes splitting bills and tracking debts with friends effortless. Never forget who owes what.";
const DEFAULT_IMAGE = "/screenshot-desktop.png";

const siteUrl = config.SITE_URL.replace(/\/$/, "");

const toAbsolute = (value: string) =>
  value.startsWith("http") ? value : `${siteUrl}${value}`;

interface SeoProps {
  /** Page-specific title. Suffixed with the site name. Omit for the default. */
  readonly title?: string;
  readonly description?: string;
  /** Absolute route path (e.g. "/privacy-policy") used to build the canonical URL. */
  readonly path?: string;
  readonly image?: string;
  readonly type?: "website" | "article";
  /** When true, discourage indexing (private/app/user-specific pages). */
  readonly noindex?: boolean;
}

/**
 * Per-route document metadata. Relies on React 19's native hoisting of
 * <title>/<meta>/<link> into <head>. Static defaults for non-JS crawlers and
 * social scrapers live in index.html; this augments them for rendered routes.
 *
 * The app is rendered client-side only (no hydration), so React never sees
 * the static tags in index.html and would otherwise leave them in place
 * alongside the ones rendered here — e.g. two conflicting `robots` or
 * `canonical` tags. Those static tags are marked with `data-default-seo` so
 * they can be removed once a route takes over.
 */
export function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  image = DEFAULT_IMAGE,
  type = "website",
  noindex = false,
}: SeoProps) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : DEFAULT_TITLE;
  const canonical = path ? `${siteUrl}${path}` : undefined;
  const imageUrl = toAbsolute(image);

  useEffect(() => {
    document
      .querySelectorAll("[data-default-seo]")
      .forEach((element) => element.remove());
  }, []);

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta
        name="robots"
        content={noindex ? "noindex, nofollow" : "index, follow"}
      />
      {canonical && <link rel="canonical" href={canonical} />}

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      {canonical && <meta property="og:url" content={canonical} />}
      <meta property="og:image" content={imageUrl} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </>
  );
}
