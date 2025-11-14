import process from 'node:process';
import { fileURLToPath } from 'node:url';

const DEFAULT_API_BASE_URL = 'http://gvlog.ddev.site';
const API_BASE_URL =
	(typeof import.meta !== 'undefined' && import.meta.env?.BLOG_API_BASE_URL) ||
	DEFAULT_API_BASE_URL;

allowSelfSignedIfNeeded(API_BASE_URL);

function allowSelfSignedIfNeeded(baseUrl: string) {
	try {
		const candidate = new URL(baseUrl);

	} catch {
		// Ignore parse errors.
	}
}

export function getApiBaseUrl() {
	return API_BASE_URL;
}

export function buildApiUrl(pathname: string) {
	return new URL(pathname, API_BASE_URL).toString();
}

export function resolveCacheFile(fileName: string) {
	return fileURLToPath(new URL(`../../.astro/${fileName}`, import.meta.url));
}
