import axios from 'axios';

export async function fetchJobs() {
  try {
    const { data } = await axios.get('https://remoteok.com/api', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      },
      timeout: 10000,
    });
    if (!Array.isArray(data)) return [];
    // RemoteOK historicamente retorna um primeiro elemento de aviso legal sem os campos de vaga —
    // filtrar defensivamente por presença de campo real de vaga (`id` e `position`), não assumir índice fixo
    return data
      .filter(job => job && job.id && job.position)
      .map(job => ({
        source: 'remoteok',
        externalId: String(job.id),
        title: job.position,
        company: job.company || null,
        location: job.location || 'Remote',
        description: job.description || '',
        tags: job.tags || [],
        url: job.url || `https://remoteok.com/remote-jobs/${job.id}`,
        postedAt: job.date ? new Date(job.date) : null,
      }));
  } catch (err) {
    console.error('[remoteok] falha ao coletar (best-effort, ignorando):', err.message);
    return [];
  }
}
