import axios from 'axios';

export async function fetchJobs() {
  const { data } = await axios.get('https://www.arbeitnow.com/api/job-board-api');
  return data.data.map(job => ({
    source: 'arbeitnow',
    externalId: job.slug,
    title: job.title,
    company: job.company_name,
    location: job.location,
    description: job.description,
    tags: job.tags || [],
    url: job.url,
    postedAt: job.created_at ? new Date(job.created_at * 1000) : null,
  }));
}
