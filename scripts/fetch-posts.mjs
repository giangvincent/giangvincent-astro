#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { constants as fsConstants } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const cacheDir = path.join(projectRoot, '.astro');

const apiBaseUrl = process.env.BLOG_API_BASE_URL ?? 'https://gvlog.ddev.site';
const tasks = [
	{
		label: 'blog posts',
		endpoint: '/api/v1/posts',
		cacheName: 'remote-posts.json',
		fallback: [],
	},
	{
		label: 'portfolio projects',
		endpoint: '/api/v1/portfolio',
		cacheName: 'remote-portfolios.json',
		fallback: [],
	},
	{
		label: 'about content',
		endpoint: '/api/v1/content/about?slug=default',
		cacheName: 'content-about-default.json',
		fallback: { title: 'About Me', summary: '', body: '' },
	},
	{
		label: 'homepage content',
		endpoint: '/api/v1/content/homepage',
		cacheName: 'content-homepage.json',
		fallback: { portfolios: [], services: [], blogs: [] },
	},
];

const apiHost = new URL(apiBaseUrl).hostname;
if (apiHost.endsWith('.ddev.site')) {
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

async function writePayload(cacheFile, payload) {
	await writeFile(cacheFile, JSON.stringify(payload, null, 2), 'utf-8');
}

async function safeRead(cacheFile) {
	try {
		await access(cacheFile, fsConstants.R_OK);
		const raw = await readFile(cacheFile, 'utf-8');
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

async function fetchAndCache({ label, endpoint, cacheName, fallback }) {
	const url = new URL(endpoint, apiBaseUrl);
	console.log(`[prebuild] Fetching ${label} from ${url.href}`);

	try {
		const response = await fetch(url, {
			headers: {
				Accept: 'application/json',
			},
		});

		if (!response.ok) {
			throw new Error(`${response.status} ${response.statusText}`);
		}

		const payload = await response.json();
		const cacheFile = path.join(cacheDir, cacheName);
		await writePayload(cacheFile, payload);
		const size = Array.isArray(payload)
			? payload.length
			: typeof payload === 'object' && payload !== null
				? Object.keys(payload).length
				: 1;
		console.log(
			`[prebuild] Cached ${size} ${label} to ${path.relative(projectRoot, cacheFile)}`,
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const cacheFile = path.join(cacheDir, cacheName);
		const existing = await safeRead(cacheFile);
		if (existing) {
			console.warn(
				`[prebuild] Warning: Failed to refresh ${label} (${message}). Using cached data.`,
			);
			return;
		}
		console.warn(
			`[prebuild] Warning: Failed to fetch ${label} (${message}). Using fallback.`,
		);
		await writePayload(cacheFile, fallback);
	}
}

await mkdir(cacheDir, { recursive: true });
for (const task of tasks) {
	// eslint-disable-next-line no-await-in-loop
	await fetchAndCache(task);
}
