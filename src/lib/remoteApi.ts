import process from 'node:process';
import { fileURLToPath } from 'node:url';

const API_BASE_URL = typeof import.meta !== 'undefined' && import.meta.env?.BLOG_API_BASE_URL;

export function getApiBaseUrl() {
	return API_BASE_URL;
}

export function buildApiUrl(pathname: string) {
	if (!API_BASE_URL) {
		throw new Error('BLOG_API_BASE_URL is not defined');
	}

	return new URL(pathname, API_BASE_URL).toString();
}

export function resolveCacheFile(fileName: string) {
	return fileURLToPath(new URL(`../../.astro/${fileName}`, import.meta.url));
}
