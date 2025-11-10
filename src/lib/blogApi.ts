import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { buildApiUrl, resolveCacheFile } from './remoteApi';

const POSTS_ENDPOINT = '/api/v1/posts';
const CACHE_FILE_PATH = resolveCacheFile('remote-posts.json');

type ApiPost = {
	id: number;
	title: string;
	slug: string;
	excerpt: string | null;
	body: string;
	published_at: string;
	cover_image_url?: string | null;
};

export type BlogPost = {
	id: number;
	title: string;
	slug: string;
	excerpt: string;
	body: string;
	publishedAt: Date;
	coverImageUrl?: string;
};

let cachedPostsPromise: Promise<BlogPost[]> | null = null;

function buildPostsEndpoint() {
	return buildApiUrl(POSTS_ENDPOINT);
}

function normalizePost(post: ApiPost): BlogPost {
	const publishedAt = new Date(post.published_at);
	return {
		id: post.id,
		title: post.title,
		slug: post.slug || String(post.id),
		excerpt: post.excerpt ?? '',
		body: post.body,
		coverImageUrl: post.cover_image_url ?? undefined,
		publishedAt: Number.isNaN(publishedAt.valueOf()) ? new Date() : publishedAt,
	};
}

async function readPostsFromDisk(): Promise<BlogPost[] | null> {
	try {
		await access(CACHE_FILE_PATH, fsConstants.R_OK);
		const raw = await readFile(CACHE_FILE_PATH, 'utf-8');
		const payload = JSON.parse(raw) as ApiPost[];
		return payload.map(normalizePost);
	} catch {
		return null;
	}
}

async function requestPosts(fetcher: typeof globalThis.fetch) {
	const endpoint = buildPostsEndpoint();
	const response = await fetcher(endpoint, {
		headers: {
			Accept: 'application/json',
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch blog posts (${response.status} ${response.statusText})`);
	}

	const payload = (await response.json()) as ApiPost[];
	return payload.map(normalizePost);
}

export async function fetchBlogPosts(fetcher = globalThis.fetch): Promise<BlogPost[]> {
	if (typeof window !== 'undefined' && !import.meta.env.SSR) {
		throw new Error('fetchBlogPosts is only available on the server to avoid CORS issues.');
	}

	if (!cachedPostsPromise) {
		const diskPosts = await readPostsFromDisk();
		cachedPostsPromise = diskPosts ? Promise.resolve(diskPosts) : requestPosts(fetcher);
	}

	return structuredClone(await cachedPostsPromise);
}

export async function fetchBlogPost(slugOrId: string, fetcher = globalThis.fetch) {
	const posts = await fetchBlogPosts(fetcher);
	return (
		posts.find((post) => post.slug === slugOrId || String(post.id) === slugOrId) ?? null
	);
}

export function sortPostsByPublishedDate(posts: BlogPost[]) {
	return [...posts].sort((a, b) => b.publishedAt.valueOf() - a.publishedAt.valueOf());
}
