import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { buildApiUrl, resolveCacheFile } from './remoteApi';

type ApiService = {
	slug: string;
	title?: string | null;
	subtitle?: string | null;
	excerpt?: string | null;
	body?: string | null;
	cover_image_url?: string | null;
	is_featured?: boolean;
	sort_order?: number | null;
};

export type Service = {
	slug: string;
	title: string;
	subtitle?: string;
	excerpt?: string;
	body: string;
	coverImageUrl?: string;
	isFeatured: boolean;
	sortOrder: number;
};

const SERVICES_ENDPOINT = '/api/v1/services';
const CACHE_FILE_PATH = resolveCacheFile('remote-services.json');

let cachedServicesPromise: Promise<Service[]> | null = null;

function normalizeMeta(meta?: unknown[] | Record<string, unknown> | null) {
	if (!meta) {
		return [];
	}

	if (Array.isArray(meta)) {
		return meta.map((item) => String(item)).filter(Boolean);
	}

	return Object.entries(meta).map(([key, value]) => `${key}: ${String(value)}`);
}

function normalizeService(service: ApiService): Service {
	return {
		slug: service.slug,
		title: service.title ?? service.subtitle ?? service.slug.replace(/[-_]/g, ' '),
		subtitle: service.subtitle ?? undefined,
		excerpt: service.excerpt ?? undefined,
		body: service.body ?? '',
		coverImageUrl: service.cover_image_url ?? undefined,
		isFeatured: Boolean(service.is_featured),
		sortOrder: typeof service.sort_order === 'number' ? service.sort_order : Number.MAX_SAFE_INTEGER
	};
}

async function readServicesFromDisk(): Promise<Service[] | null> {
	try {
		await access(CACHE_FILE_PATH, fsConstants.R_OK);
		const raw = await readFile(CACHE_FILE_PATH, 'utf-8');
		const data = JSON.parse(raw) as ApiService[];
		return data.map(normalizeService);
	} catch {
		return null;
	}
}

async function requestServices(fetcher: typeof globalThis.fetch) {
	const response = await fetcher(buildApiUrl(SERVICES_ENDPOINT), {
		headers: {
			Accept: 'application/json',
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch services (${response.status} ${response.statusText})`);
	}

	const payload = (await response.json()) as ApiService[];
	return payload.map(normalizeService);
}

export async function fetchServices(fetcher = globalThis.fetch) {
	if (typeof window !== 'undefined' && !import.meta.env.SSR) {
		throw new Error('fetchServices can only run on the server.');
	}

	if (!cachedServicesPromise) {
		const disk = await readServicesFromDisk();
		cachedServicesPromise = disk ? Promise.resolve(disk) : requestServices(fetcher);
	}

	return structuredClone(await cachedServicesPromise);
}

export async function fetchService(slug: string, fetcher = globalThis.fetch) {
	const services = await fetchServices(fetcher);
	return services.find((service) => service.slug === slug) ?? null;
}

export function sortServices(services: Service[]) {
	return [...services].sort((a, b) => {
		if (a.isFeatured !== b.isFeatured) {
			return a.isFeatured ? -1 : 1;
		}

		if (a.sortOrder !== b.sortOrder) {
			return a.sortOrder - b.sortOrder;
		}

		return a.title.localeCompare(b.title);
	});
}
