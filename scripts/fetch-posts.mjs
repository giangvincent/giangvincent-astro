#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const cacheDir = path.join(projectRoot, '.astro');

const apiBaseUrl = process.env.BLOG_API_BASE_URL ?? 'https://gvlog.ddev.site';
const tasks = [
	{ label: 'blog posts', endpoint: '/api/v1/posts', cacheName: 'remote-posts.json' },
	{ label: 'portfolio projects', endpoint: '/api/v1/portfolio', cacheName: 'remote-portfolios.json' },
];

const apiHost = new URL(apiBaseUrl).hostname;
if (apiHost.endsWith('.ddev.site')) {
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

async function fetchAndCache({ label, endpoint, cacheName }) {
	const url = new URL(endpoint, apiBaseUrl);
	console.log(`[prebuild] Fetching ${label} from ${url.href}`);

	const response = await fetch(url, {
		headers: {
			Accept: 'application/json',
		},
	});

	if (!response.ok) {
		console.error(`[prebuild] Failed to fetch ${label} (${response.status} ${response.statusText})`);
		process.exit(1);
	}

	const payload = await response.json();
	const cacheFile = path.join(cacheDir, cacheName);
	await writeFile(cacheFile, JSON.stringify(payload, null, 2), 'utf-8');
	console.log(`[prebuild] Cached ${payload.length ?? 0} ${label} to ${path.relative(projectRoot, cacheFile)}`);
}

await mkdir(cacheDir, { recursive: true });
for (const task of tasks) {
	// eslint-disable-next-line no-await-in-loop
	await fetchAndCache(task);
}
