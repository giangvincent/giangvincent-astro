/// <reference types="astro/client" />

interface ImportMetaEnv {
	readonly BLOG_API_BASE_URL?: string;
	readonly PUBLIC_RECAPTCHA_SITE_KEY?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
