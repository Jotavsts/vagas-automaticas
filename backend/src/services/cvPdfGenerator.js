import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { slugify } from '../utils/slugify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// backend/src/services -> backend/generated-cvs
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'generated-cvs');
const ICONS_DIR = path.join(__dirname, '..', 'assets', 'icons');

const NAVY = '#1F2937';
const GRAY = '#555555';

let iconsDataUriPromise = null;
async function loadIcons() {
  if (!iconsDataUriPromise) {
    iconsDataUriPromise = (async () => {
      const names = ['email', 'phone', 'linkedin', 'github', 'location'];
      const entries = await Promise.all(
        names.map(async (n) => {
          const buf = await readFile(path.join(ICONS_DIR, `icon_${n}.png`));
          return [n, `data:image/png;base64,${buf.toString('base64')}`];
        })
      );
      return Object.fromEntries(entries);
    })();
  }
  return iconsDataUriPromise;
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

function iconRow(iconSrc, text) {
  if (!text) return '';
  return `<div class="icon-row"><img src="${iconSrc}" class="icon" /><span>${escapeHtml(text)}</span></div>`;
}

function renderContactGrid(contact = {}, icons) {
  return `
    <div class="phone-row">${iconRow(icons.phone, contact.phone)}</div>
    <div class="contact-grid">
      ${iconRow(icons.email, contact.email)}
      ${iconRow(icons.linkedin, contact.linkedin)}
      ${iconRow(icons.github, contact.github)}
      ${iconRow(icons.location, contact.location)}
    </div>
  `;
}

function renderSkillsSection(skills = {}) {
  const rows = [
    ['Linguagens', skills.languages],
    ['Inteligência Artificial', skills.ai],
    ['Cloud e Infraestrutura', skills.cloud],
    ['Ferramentas e Práticas', skills.tools],
  ];
  const lines = rows
    .filter(([, list]) => Array.isArray(list) && list.length > 0)
    .map(([label, list]) => `<p><strong>${escapeHtml(label)}:</strong> ${list.map(escapeHtml).join(', ')}</p>`)
    .join('\n');
  return lines ? `<h2>Habilidades</h2>${lines}` : '';
}

function renderExperience(experience = []) {
  return experience
    .map((item) => {
      const bullets = (item.bullets || []).map((b) => `<li>${escapeHtml(b)}</li>`).join('\n');
      const endDate = item.end_date ? escapeHtml(item.end_date) : 'Presente';
      return `
        <div class="entry">
          <div class="row">
            <span><strong>${escapeHtml(item.role)}</strong> &ndash; ${escapeHtml(item.company)}</span>
            <span class="period">${escapeHtml(item.start_date)} &ndash; ${endDate}</span>
          </div>
          <ul>${bullets}</ul>
        </div>
      `;
    })
    .join('\n');
}

function renderProjects(projects = []) {
  if (!Array.isArray(projects) || projects.length === 0) return '';
  const items = projects
    .map((p) => {
      const skillsLine = Array.isArray(p.skills) && p.skills.length
        ? `<p><strong>Habilidades:</strong> ${p.skills.map(escapeHtml).join(', ')}</p>` : '';
      const toolsLine = Array.isArray(p.tools) && p.tools.length
        ? `<p><strong>Ferramentas:</strong> ${p.tools.map(escapeHtml).join(', ')}</p>` : '';
      return `
        <div class="entry">
          <p class="project-name"><strong>${escapeHtml(p.name)}</strong></p>
          <p>${escapeHtml(p.body)}</p>
          ${skillsLine}
          ${toolsLine}
        </div>
      `;
    })
    .join('\n');
  return `<h2>Cursos e Experiências Adicionais</h2>${items}`;
}

function renderEducation(education = []) {
  return education
    .map((item) => `
        <div class="entry">
          <p><strong>${escapeHtml(item.degree)}</strong> &ndash; ${escapeHtml(item.institution)}</p>
          <p class="period">${escapeHtml(item.expected_completion)}</p>
        </div>
      `)
    .join('\n');
}

function renderLanguages(languages = []) {
  if (!Array.isArray(languages) || languages.length === 0) return '';
  const items = languages.map((l) => `<p>${escapeHtml(l.lang)}: ${escapeHtml(l.level)}</p>`).join('\n');
  return `<h2>Idiomas</h2>${items}`;
}

function renderHtml(content, icons) {
  const contact = content.contact || {};
  const titleLine = content.title ? `<span class="title">&nbsp;&ndash;&nbsp;${escapeHtml(content.title)}</span>` : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<style>
  @page { size: A4; margin: 1.6cm; }
  body {
    font-family: Calibri, 'Segoe UI', Arial, sans-serif;
    color: #1a1a1a;
    background: #ffffff;
    font-size: 10.5pt;
    line-height: 1.4;
  }
  h1 {
    font-size: 19pt;
    font-weight: bold;
    color: ${NAVY};
    margin: 0 0 6px 0;
  }
  h1 .title {
    font-size: 10pt;
    font-weight: bold;
    color: ${GRAY};
  }
  h2 {
    text-transform: uppercase;
    letter-spacing: 1px;
    font-size: 11.5pt;
    font-weight: bold;
    border-bottom: 1.5px solid ${NAVY};
    padding-bottom: 3px;
    margin-top: 16px;
    margin-bottom: 8px;
    color: ${NAVY};
  }
  .phone-row { margin-bottom: 6px; }
  .contact-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    row-gap: 4px;
    margin-bottom: 10px;
  }
  .icon-row { display: flex; align-items: center; gap: 6px; font-size: 9pt; color: ${GRAY}; font-weight: bold; }
  .icon { width: 14px; height: 14px; flex-shrink: 0; }
  .entry { margin-bottom: 10px; }
  .row { display: flex; justify-content: space-between; align-items: baseline; }
  .period { color: ${GRAY}; font-style: italic; font-size: 9.5pt; white-space: nowrap; }
  .project-name { margin-bottom: 2px; }
  ul { margin: 4px 0 0 0; padding-left: 18px; }
  li { margin-bottom: 2px; }
  p { margin: 3px 0; }
</style>
</head>
<body>
  <h1>${escapeHtml(content.full_name)}${titleLine}</h1>
  ${renderContactGrid(contact, icons)}

  ${renderSkillsSection(content.skills)}

  <h2>Experiência Profissional</h2>
  ${renderExperience(content.experience)}

  ${renderProjects(content.projects)}

  <h2>Formação Acadêmica</h2>
  ${renderEducation(content.education)}

  ${renderLanguages(content.languages)}
</body>
</html>`;
}

/**
 * Gera o PDF do CV adaptado e salva em backend/generated-cvs/{userId}/{jobTitle}-{empresaAbreviada}.pdf
 * @param {object} adaptedContent - mesma forma do cv_base (full_name, title, contact, summary, experience, education, skills, projects, languages)
 * @param {number|string} jobId - usado só como fallback caso jobTitle não seja informado
 * @param {string} [jobTitle] - título da vaga, usado para nomear o arquivo de forma legível
 * @param {string} [company] - empresa da vaga, abreviada no nome do arquivo
 * @param {number|string} userId - isola o arquivo por usuário (dois usuários aprovando a mesma vaga não colidem mais)
 * @returns {Promise<{filePath: string, fileName: string}>}
 */
export async function generatePdf(adaptedContent, jobId, jobTitle, company, userId) {
  const icons = await loadIcons();
  const html = renderHtml(adaptedContent, icons);

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

  const userDir = path.join(OUTPUT_DIR, String(userId));
  await mkdir(userDir, { recursive: true });

  const titleSlug = jobTitle ? slugify(jobTitle) : '';
  const companyAbbr = abbreviateCompany(company);
  const base = [titleSlug, companyAbbr].filter(Boolean).join('-');
  const fileName = base ? `${base}.pdf` : `cv-adaptado.pdf`;
  const filePath = path.join(userDir, fileName);

  await writeFile(filePath, pdfBuffer);

  return { filePath, fileName };
}
