import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { fetchBlogPosts } from '../lib/blogApi';

export async function GET(context) {
	const posts = await fetchBlogPosts();
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: posts.map((post) => ({
			title: post.title,
			description: post.excerpt,
			pubDate: post.publishedAt,
			link: `/blog/${post.slug}/`,
			content: post.body,
		})),
	});
}
