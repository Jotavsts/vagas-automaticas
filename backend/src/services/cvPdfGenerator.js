import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// backend/src/services -> backend/generated-cvs
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'generated-cvs');

function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function abbreviateCompany(company) {
  if (!company || /não informada/i.test(company)) return '';
  const words = String(company)
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase()
    .match(/[a-z0-9]+/g);
  if (!words || words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 12);
  return words.map((word) => word[0]).join('');
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderContactLine(contact = {}) {
  const parts = [contact.phone, contact.email, contact.location]
    .filter(Boolean)
    .map(escapeHtml);
  return parts.join(' | ');
}

function renderLinksLine(contact = {}) {
  const parts = [];
  if (contact.linkedin) parts.push(`LinkedIn: ${escapeHtml(contact.linkedin)}`);
  if (contact.github) parts.push(`GitHub: ${escapeHtml(contact.github)}`);
  return parts.join(' | ');
}

function renderExperience(experience = []) {
  return experience
    .map((item) => {
      const bullets = (item.bullets || [])
        .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
        .join('\n');
      const endDate = item.end_date ? escapeHtml(item.end_date) : 'Presente';
      return `
        <div class="entry">
          <div class="row">
            <strong>${escapeHtml(item.company)}</strong>
            <span>${escapeHtml(item.location)}</span>
          </div>
          <div class="row">
            <em>${escapeHtml(item.role)}</em>
            <span>${escapeHtml(item.start_date)} &ndash; ${endDate}</span>
          </div>
          <ul>
            ${bullets}
          </ul>
        </div>
      `;
    })
    .join('\n');
}

function renderEducation(education = []) {
  return education
    .map((item) => {
      return `
        <div class="entry">
          <div class="row">
            <strong>${escapeHtml(item.institution)}</strong>
            <span>${escapeHtml(item.location)}</span>
          </div>
          <div class="row">
            <em>${escapeHtml(item.degree)}</em>
            <span>${escapeHtml(item.expected_completion)}</span>
          </div>
        </div>
      `;
    })
    .join('\n');
}

function renderSkillsLine(label, list = []) {
  return `<p><strong>${escapeHtml(label)}:</strong> ${(list || [])
    .map(escapeHtml)
    .join(', ')}</p>`;
}

function renderHtml(content) {
  const contact = content.contact || {};
  const skills = content.skills || {};

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<style>
  @page {
    size: A4;
    margin: 2cm;
  }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #1a1a1a;
    background: #ffffff;
    font-size: 11pt;
    line-height: 1.4;
  }
  h1 {
    text-align: center;
    font-size: 20pt;
    font-weight: bold;
    margin: 0 0 6px 0;
  }
  .contact-line {
    text-align: center;
    margin: 0 0 2px 0;
    font-size: 10pt;
    color: #333333;
  }
  h2 {
    text-transform: uppercase;
    letter-spacing: 1px;
    font-size: 12pt;
    border-bottom: 1px solid #333333;
    padding-bottom: 3px;
    margin-top: 18px;
    margin-bottom: 8px;
    color: #1a1a1a;
  }
  .entry {
    margin-bottom: 10px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  ul {
    margin: 4px 0 0 0;
    padding-left: 18px;
  }
  li {
    margin-bottom: 2px;
  }
  p {
    margin: 4px 0;
  }
</style>
</head>
<body>
  <h1>${escapeHtml(content.full_name)}</h1>
  <p class="contact-line">${renderContactLine(contact)}</p>
  <p class="contact-line">${renderLinksLine(contact)}</p>

  <h2>Resumo Profissional</h2>
  <p>${escapeHtml(content.summary)}</p>

  <h2>Experiência Profissional</h2>
  ${renderExperience(content.experience)}

  <h2>Formação Acadêmica</h2>
  ${renderEducation(content.education)}

  <h2>Competências e Tecnologias</h2>
  ${renderSkillsLine('Linguagens e Frameworks', skills.languages)}
  ${renderSkillsLine('Inteligência Artificial', skills.ai)}
  ${renderSkillsLine('Cloud e Infraestrutura', skills.cloud)}
  ${renderSkillsLine('Ferramentas e Práticas', skills.tools)}
</body>
</html>`;
}

/**
 * Gera o PDF do CV adaptado e salva em backend/generated-cvs/{jobTitle}-{empresaAbreviada}.pdf
 * @param {object} adaptedContent - mesma forma do cv_base (full_name, contact, summary, experience, education, skills)
 * @param {number|string} jobId - usado só como fallback caso jobTitle não seja informado
 * @param {string} [jobTitle] - título da vaga, usado para nomear o arquivo de forma legível
 * @param {string} [company] - empresa da vaga, abreviada no nome do arquivo
 * @returns {Promise<{filePath: string, fileName: string}>}
 */
export async function generatePdf(adaptedContent, jobId, jobTitle, company) {
  const html = renderHtml(adaptedContent);

  const browser = await chromium.launch();
  let pdfBuffer;
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '1.5cm', bottom: '1.5cm', left: '1.5cm', right: '1.5cm' },
    });
  } finally {
    await browser.close();
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  const titleSlug = jobTitle ? slugify(jobTitle) : '';
  const companyAbbr = abbreviateCompany(company);
  const base = [titleSlug, companyAbbr].filter(Boolean).join('-');
  const fileName = base ? `${base}.pdf` : `cv-adaptado.pdf`;
  const filePath = path.join(OUTPUT_DIR, fileName);

  await writeFile(filePath, pdfBuffer);

  return { filePath, fileName };
}
