# Product

## Register

product

## Users

João Vitor, desenvolvedor júnior (backend/IA, com leque em frontend/fullstack) baseado em Aracaju/SE, buscando vagas remotas de tecnologia. É o único usuário na Fase 1 (ferramenta pessoal), com plano de abrir pra outras pessoas depois. Usa a ferramenta em sessões curtas e frequentes: abre o dashboard, revisa vagas novas coletadas automaticamente, decide quais adaptar e aprovar. Não é um usuário casual explorando — é alguém em busca ativa de emprego, então cada sessão tem intenção e urgência real por trás.

## Product Purpose

Automatiza a parte repetitiva de procurar emprego: coleta vagas de tecnologia remota de múltiplas fontes (7 hoje), rankeia por relevância ao perfil júnior do usuário, adapta o currículo por IA pra cada vaga especificamente (mantendo veracidade via validação anti-alucinação), gera o PDF final, e deixa pronto pra candidatura com um clique. Sucesso é medido em tempo economizado e em candidaturas de qualidade que realmente combinam com o perfil — não em volume bruto de vagas.

## Brand Personality

Direta e eficiente. A ferramenta é um instrumento de trabalho, não uma vitrine — o usuário está numa busca de emprego real, então cada tela deve priorizar clareza e velocidade de ação sobre estética decorativa. Tom baixo-key, sem gamificação nem urgência artificial. Confiança vem de precisão (mostrar exatamente por que uma vaga rankeou daquele jeito, nunca inflar o nível de senioridade do candidato) e não de flourish visual.

## Anti-references

Especificamente evitar a estética "gerada por IA" genérica de dashboards SaaS 2024-2026:
- Grids de cards idênticos com sombra difusa + borda 1px combinadas (o "ghost card") e cantos excessivamente arredondados
- Cor usada decorativamente sem significado (gradientes, texto com gradiente) em vez de comunicar estado/hierarquia
- Espaçamento uniforme e sem ritmo — tudo com o mesmo respiro, sem hierarquia visual clara entre o que importa mais e o que é secundário
- Falta de acabamento: sem hover states, sem microinteração, botões que não comunicam clicabilidade
- Eyebrows/kickers em uppercase tracked acima de cada seção, numeração decorativa (01/02/03) sem significado real

## Design Principles

1. **Clareza de decisão antes de estética** — cada tela existe pra ajudar o usuário a decidir rápido (adaptar essa vaga? aprovar esse CV?); hierarquia visual deve gritar a ação certa, não decorar.
2. **Honestidade visual sobre nível** — nunca usar tratamento visual que sugira mais confiança/senioridade do que o dado real suporta (ex: uma vaga sênior rankeada baixo deve *parecer* menos prioritária, não só ter um número menor).
3. **Roxo com intenção, não decoração** — a paleta lavanda suave (#FAF9FF fundo, #6E4FC9 destaque) marca estado e ação (score, botão primário), nunca é usada "porque fica bonito".
4. **Acabamento é parte do produto** — hover states, transições sutis e microinteração não são polimento opcional; são o que diferencia "ferramenta feita à mão" de "protótipo genérico".
5. **Densidade útil, não vazio decorativo** — como é uma ferramenta de trabalho usada em sessões curtas e frequentes, prefira mostrar mais informação relevante por tela a espaços em branco decorativos sem função.

## Accessibility & Inclusion

WCAG AA como padrão: contraste mínimo 4.5:1 para texto de corpo (inclusive placeholder), 3:1 para texto grande/negrito ≥14px. Sem necessidades de acessibilidade adicionais reportadas pelo usuário nesta fase.
