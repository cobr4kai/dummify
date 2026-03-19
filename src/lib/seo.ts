import type { Metadata } from "next";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  getSiteUrl,
} from "@/lib/site";

type MetadataInput = {
  path: string;
  title: string;
  description: string;
  noIndex?: boolean;
  type?: "website" | "article";
};

type BreadcrumbItem = {
  name: string;
  path: string;
};

export function buildPageMetadata(input: MetadataInput): Metadata {
  const canonical = getSiteUrl(input.path);

  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical,
    },
    robots: input.noIndex
      ? {
          index: false,
          follow: true,
        }
      : undefined,
    openGraph: {
      title: input.title,
      description: input.description,
      url: canonical,
      siteName: SITE_NAME,
      type: input.type ?? "website",
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
    },
  };
}

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
  };
}

export function buildWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
  };
}

export function buildCollectionPageJsonLd(input: {
  name: string;
  description: string;
  path: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    description: input.description,
    url: getSiteUrl(input.path),
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

export function buildArticleJsonLd(input: {
  headline: string;
  description: string;
  path: string;
  authors: string[];
  datePublished: string;
  dateModified: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.headline,
    description: input.description,
    url: getSiteUrl(input.path),
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    author: input.authors.map((author) => ({
      "@type": "Person",
      name: author,
    })),
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: getSiteUrl(item.path),
    })),
  };
}
