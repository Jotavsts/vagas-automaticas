import Parser from 'rss-parser';

const parser = new Parser({
  customFields: { item: ['region'] }, // WWR usa <region>, não é campo padrão RSS
});

export async function fetchJobs() {
  const feed = await parser.parseURL('https://weworkremotely.com/categories/remote-programming-jobs.rss');
  return feed.items.map(item => ({
    source: 'weworkremotely',
    externalId: item.guid,
    title: item.title,
    company: null, // WWR não separa empresa no título de forma consistente
    location: item.region || null,
    description: item.content || item.contentSnippet || '',
    tags: item.categories || [],
    url: item.link,
    postedAt: item.pubDate ? new Date(item.pubDate) : null,
  }));
}
