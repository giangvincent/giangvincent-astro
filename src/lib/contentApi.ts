import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { buildApiUrl, resolveCacheFile } from './remoteApi';

type ApiAboutContent = {
	id?: number | string;
	title?: string;
	summary?: string | null;
	excerpt?: string | null;
	body?: string | null;
	content?: string | null;
	hero_image_url?: string | null;
};

type ApiHomepageService = {
	slug?: string | null;
	title?: string | null;
	subtitle?: string | null;
	excerpt?: string | null;
	body?: string | null;
	cover_image_url?: string | null;
	is_featured?: boolean;
	sort_order?: number | null;
	meta?: Record<string, unknown> | unknown[];
};

type ApiHomepagePortfolio = {
	id?: number;
	title?: string | null;
	slug?: string | null;
	tagline?: string | null;
	summary?: string | null;
	body?: string | null;
	thumbnail_url?: string | null;
	hero_image_url?: string | null;
	project_url?: string | null;
	source_url?: string | null;
	tags?: string[];
	is_featured?: boolean;
	sort_order?: number | null;
	published_at?: string | null;
};

type ApiHomepagePost = {
	id?: number;
	title?: string | null;
	slug?: string | null;
	excerpt?: string | null;
	body?: string | null;
	cover_image_url?: string | null;
	published_at?: string | null;
	status?: string | null;
};

type ApiHomepageContent = {
	about?: ApiAboutContent | null;
	services?: ApiHomepageService[] | null;
	portfolios?: ApiHomepagePortfolio[] | null;
	posts?: ApiHomepagePost[] | null;
	blogs?: ApiHomepagePost[] | null;
};

export type AboutContent = {
	title: string;
	summary: string;
	body: string;
	heroImageUrl?: string;
};

export type HomepageCard = {
	id: string;
	title: string;
	description: string;
	coverImageUrl?: string;
	href?: string;
	tags?: string[];
	isFeatured?: boolean;
};

export type HomepageContent = {
	portfolios: HomepageCard[];
	services: HomepageCard[];
	blogs: HomepageCard[];
};

const aboutCache = new Map<string, Promise<AboutContent>>();
let cachedHomepagePromise: Promise<HomepageContent> | null = null;

const HOMEPAGE_CACHE_FILE = resolveCacheFile('content-homepage.json');

function aboutCacheFile(slug: string) {
	return resolveCacheFile(`content-about-${slug}.json`);
}

function normalizeAboutContent(payload: ApiAboutContent | null | undefined): AboutContent {
	if (!payload) {
		return {
			title: 'About Me',
			summary: 'Story coming soon.',
			body: '<p>Content is on the way.</p>',
		};
	}

	return {
		title: payload.title ?? 'About Me',
		summary: payload.summary ?? payload.excerpt ?? '',
		body: payload.body ?? payload.content ?? '',
		heroImageUrl: payload.hero_image_url ?? undefined,
	};
}

function toServiceCard(service: ApiHomepageService | null | undefined): HomepageCard {
	const slug = service?.slug ?? null;
	const id = slug ?? cryptoRandomId();
	const title = service?.title ?? service?.subtitle ?? (service?.slug ? humanizeSlug(service.slug) : 'Service');
	const description = fallbackDescription(service?.excerpt, service?.body);
	const tags = normalizeMetaTags(service?.meta);

	return {
		id: String(id),
		title,
		description,
		coverImageUrl: service?.cover_image_url ?? undefined,
		href: slug ? `/services/${slug}` : '/services',
		tags,
		isFeatured: Boolean(service?.is_featured),
	};
}

function toPortfolioCard(portfolio: ApiHomepagePortfolio | null | undefined): HomepageCard {
	const slug = portfolio?.slug ?? null;
	const id = slug ?? cryptoRandomId();
	const title = portfolio?.title ?? portfolio?.tagline ?? 'Portfolio';
	const description = fallbackDescription(portfolio?.summary, portfolio?.body);
	const coverImageUrl = portfolio?.thumbnail_url ?? portfolio?.hero_image_url ?? undefined;

	return {
		id: `${portfolio?.id ?? id}`,
		title,
		description,
		coverImageUrl,
		href: slug ? `/portfolio/${slug}` : '/portfolio',
		tags: portfolio?.tags ?? [],
		isFeatured: Boolean(portfolio?.is_featured),
	};
}

function toBlogCard(post: ApiHomepagePost | null | undefined): HomepageCard {
	const slug = post?.slug ?? null;
	const id = slug ?? cryptoRandomId();
	const title = post?.title ?? 'Blog post';
	const description = fallbackDescription(post?.excerpt, post?.body);

	return {
		id: `${post?.id ?? id}`,
		title,
		description,
		coverImageUrl: post?.cover_image_url ?? undefined,
		href: slug ? `/blog/${slug}` : '/blog',
	};
}

function normalizeHomepageContent(payload: ApiHomepageContent | null | undefined): HomepageContent {
	return {
		portfolios: (payload?.portfolios ?? []).map(toPortfolioCard),
		services: (payload?.services ?? []).map(toServiceCard),
		blogs: (payload?.posts ?? payload?.blogs ?? []).map(toBlogCard),
	};
}

function cryptoRandomId() {
	if (typeof globalThis.crypto?.randomUUID === 'function') {
		return globalThis.crypto.randomUUID();
	}

	return Math.random().toString(36).slice(2, 11);
}

function humanizeSlug(slug: string) {
	return slug
		.replace(/[-_]/g, ' ')
		.replace(/\b\w/g, (char) => char.toUpperCase());
}

function stripHtml(input?: string | null) {
	if (!input) {
		return '';
	}
	return input.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function fallbackDescription(primary?: string | null, secondary?: string | null) {
	const first = stripHtml(primary);
	if (first.length > 0) {
		return first.slice(0, 280);
	}
	const fallback = stripHtml(secondary).slice(0, 280);
	return fallback.length > 0 ? fallback : 'Details coming soon.';
}

function normalizeMetaTags(meta?: Record<string, unknown> | unknown[] | null) {
	if (!meta) {
		return [];
	}

	if (Array.isArray(meta)) {
		return meta.map((value) => String(value)).filter(Boolean);
	}

	return Object.entries(meta).map(([key, value]) => `${key}: ${String(value)}`);
}

async function readJsonFromDisk<T>(filePath: string, normalizer: (payload: unknown) => T): Promise<T | null> {
	try {
		await access(filePath, fsConstants.R_OK);
		const raw = await readFile(filePath, 'utf-8');
		const parsed = JSON.parse(raw) as unknown;
		return normalizer(parsed);
	} catch {
		return null;
	}
}

async function requestJson<T>(endpoint: string, normalizer: (payload: unknown) => T, fetcher = globalThis.fetch) {
	const response = await fetcher(buildApiUrl(endpoint), {
		headers: {
			Accept: 'application/json',
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch ${endpoint} (${response.status} ${response.statusText})`);
	}

	const payload = (await response.json()) as unknown;
	return normalizer(payload);
}

export async function fetchAboutContent(slug = 'default', fetcher = globalThis.fetch) {
	if (typeof window !== 'undefined' && !import.meta.env.SSR) {
		throw new Error('fetchAboutContent is only available on the server.');
	}

	if (!aboutCache.has(slug)) {
		const cacheFile = aboutCacheFile(slug);
		const diskContent = await readJsonFromDisk(cacheFile, normalizeAboutContent);
		const promise = diskContent
			? Promise.resolve(diskContent)
			: requestJson(`/api/v1/content/about?slug=${slug}`, normalizeAboutContent, fetcher);
		aboutCache.set(slug, promise);
	}

	return structuredClone(await aboutCache.get(slug)!);
}

export async function fetchHomepageContent(fetcher = globalThis.fetch) {
	if (typeof window !== 'undefined' && !import.meta.env.SSR) {
		throw new Error('fetchHomepageContent is only available on the server.');
	}

	if (!cachedHomepagePromise) {
		const diskContent = await readJsonFromDisk(HOMEPAGE_CACHE_FILE, normalizeHomepageContent);
		cachedHomepagePromise = diskContent
			? Promise.resolve(diskContent)
			: requestJson('/api/v1/content/homepage', normalizeHomepageContent, fetcher);
	}

	return structuredClone(await cachedHomepagePromise);
}
