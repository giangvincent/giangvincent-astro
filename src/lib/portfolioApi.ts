import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { buildApiUrl, resolveCacheFile } from './remoteApi';

const PORTFOLIO_ENDPOINT = '/api/v1/portfolio';
const CACHE_FILE_PATH = resolveCacheFile('remote-portfolios.json');

type ApiPortfolioProject = {
	id: number;
	title: string;
	slug: string;
	tagline: string;
	summary: string | null;
	body: string;
	thumbnail_url?: string | null;
	hero_image_url?: string | null;
	project_url?: string | null;
	source_url?: string | null;
	tags?: string[];
	is_featured?: boolean;
	sort_order?: number | null;
	published_at?: string | null;
};

export type PortfolioProject = {
	id: number;
	title: string;
	slug: string;
	tagline: string;
	summary: string;
	body: string;
	thumbnailUrl?: string;
	heroImageUrl?: string;
	projectUrl?: string;
	sourceUrl?: string;
	tags: string[];
	isFeatured: boolean;
	sortOrder: number;
	publishedAt: Date;
};

let cachedProjectsPromise: Promise<PortfolioProject[]> | null = null;

function normalizeProject(project: ApiPortfolioProject): PortfolioProject {
	const publishedAt = project.published_at ? new Date(project.published_at) : new Date();
	return {
		id: project.id,
		title: project.title,
		slug: project.slug || String(project.id),
		tagline: project.tagline || '',
		summary: project.summary ?? '',
		body: project.body,
		thumbnailUrl: project.thumbnail_url ?? undefined,
		heroImageUrl: project.hero_image_url ?? undefined,
		projectUrl: project.project_url ?? undefined,
		sourceUrl: project.source_url ?? undefined,
		tags: project.tags ?? [],
		isFeatured: Boolean(project.is_featured),
		sortOrder: typeof project.sort_order === 'number' ? project.sort_order : Number.MAX_SAFE_INTEGER,
		publishedAt: Number.isNaN(publishedAt.valueOf()) ? new Date() : publishedAt,
	};
}

async function readProjectsFromDisk(): Promise<PortfolioProject[] | null> {
	try {
		await access(CACHE_FILE_PATH, fsConstants.R_OK);
		const raw = await readFile(CACHE_FILE_PATH, 'utf-8');
		const payload = JSON.parse(raw) as ApiPortfolioProject[];
		return payload.map(normalizeProject);
	} catch {
		return null;
	}
}

async function requestProjects(fetcher: typeof globalThis.fetch) {
	const endpoint = buildApiUrl(PORTFOLIO_ENDPOINT);
	const response = await fetcher(endpoint, {
		headers: {
			Accept: 'application/json',
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch portfolio projects (${response.status} ${response.statusText})`);
	}

	const payload = (await response.json()) as ApiPortfolioProject[];
	return payload.map(normalizeProject);
}

export async function fetchPortfolioProjects(fetcher = globalThis.fetch) {
	if (typeof window !== 'undefined' && !import.meta.env.SSR) {
		throw new Error('fetchPortfolioProjects can only run on the server.');
	}

	if (!cachedProjectsPromise) {
		const diskProjects = await readProjectsFromDisk();
		cachedProjectsPromise = diskProjects
			? Promise.resolve(diskProjects)
			: requestProjects(fetcher);
	}

	return structuredClone(await cachedProjectsPromise);
}

export async function fetchPortfolioProject(slugOrId: string, fetcher = globalThis.fetch) {
	const projects = await fetchPortfolioProjects(fetcher);
	return (
		projects.find((project) => project.slug === slugOrId || String(project.id) === slugOrId) ??
		null
	);
}

export function sortProjectsForListing(projects: PortfolioProject[]) {
	return [...projects].sort((a, b) => {
		if (a.isFeatured !== b.isFeatured) {
			return a.isFeatured ? -1 : 1;
		}

		if (a.sortOrder !== b.sortOrder) {
			return a.sortOrder - b.sortOrder;
		}

		return b.publishedAt.valueOf() - a.publishedAt.valueOf();
	});
}
