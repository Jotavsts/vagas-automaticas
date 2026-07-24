# Design

## Tema

Claro (branco predominante), acento roxo "lavanda empoeirado" — dessaturado, calmo, nada de roxo vibrante/gradiente. Personalidade: direta e eficiente (ver PRODUCT.md).

## Paleta

| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#FAF9FC` | Fundo da página |
| `--surface` | `#FFFFFF` | Cards, modais, inputs |
| `--border` | `#E3E0EC` | Borda padrão de card/input (repouso) |
| `--border-hover` | `#C9BAF0` | Borda de card no hover |
| `--primary` | `#6B5F94` | Botão primário, badge de match alto, links de ação |
| `--primary-hover` | `#5A4F80` | Hover do botão primário |
| `--text-primary` | `#2E2A3D` | Títulos, texto principal |
| `--text-secondary` | `#615A78` | Metadados (empresa, local, timestamps) |
| `--tag-bg` | `#EAE7F2` | Fundo de tag/skill relevante |
| `--tag-text` | `#544A73` | Texto de tag/skill relevante |
| `--muted-bg` | `#F0F0F3` | Fundo de tag neutra (fonte da vaga, metadado secundário) |
| `--muted-text` | `#5C5C68` | Texto de tag neutra |
| `--success-bg` / `--success-text` | `#E3F3E6` / `#227A3B` | Estado "✓ Adaptado" |
| `--warning-bg` / `--warning-text` | `#FBF8EF` / `#6B5A26` | Nota honesta da IA (gap de compatibilidade) |
| `--danger-bg` / `--danger-text` | `#FBEAEA` / `#A23838` | Tag "Sênior" (sinaliza rebaixamento no ranking) |

**Regra de contraste (WCAG AA), já verificada e ajustada nas iterações anteriores:** nenhum texto secundário/tag usa cinza claro sobre fundo claro sem checar 4.5:1. `--text-secondary` e `--tag-text`/`--muted-text` foram escurecidos especificamente para passar nisso — não reverter para tons mais claros "por estética".

## Tipografia

- **Fonte única**: [Sora](https://fonts.google.com/specimen/Sora) (400/500/600/700) para tudo — títulos, corpo, UI. Evita deliberadamente Inter/Roboto/Arial/system-ui (clichê reconhecido de interface gerada por IA).
- **Contraste proposital**: [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) (peso 500) **só** para números de score/match (ex: badge "72%"). Não usar em mais nada — é um destaque funcional pra dado, não decoração.

## Componentes

### Job card
- `border-radius: 12px`, `border: 1px solid var(--border)` em repouso — **nunca** combinar borda + sombra ao mesmo tempo em repouso (isso é o padrão "ghost card" genérico de IA)
- Hover: `border-color: var(--border-hover)` + `box-shadow` leve + `translateY(-2px)`, com transição ~160ms
- Badge de score é **funcional, não decorativo**: sólido roxo (`--primary`) para match alto, claro (`--tag-bg`/`--tag-text`) para médio, neutro (`--muted-bg`/`--muted-text`) para baixo/sênior rebaixado — a cor comunica prioridade real
- Nunca usar opacidade pra "apagar" cards de baixa prioridade (quebra contraste de texto) — a despriorização já é comunicada pelo badge e pela ordenação

### Botões
- Primário: fundo `--primary` sólido, texto branco, hover escurece pra `--primary-hover`
- Secundário: transparente, borda `--border`, hover troca borda/texto pra `--primary`

### Modal de adaptação de CV
- Sem "eyebrows" (rotulozinhos maiúsculos com letter-spacing) repetidos acima de cada bloco — conteúdo direto, sem essa camada de rótulo decorativo
- Nota honesta da IA usa ícone (💬) + fundo `--warning-bg`, não rótulo maiúsculo

## Referência de mockups aprovados

Iterações visuais estão salvas em `.superpowers/brainstorm/134-1783434007/content/` (histórico do processo, não gitado). A versão final aprovada é `dashboard-refined-v3.html` (estrutura/tipografia) + tom de cor B de `purple-tone.html` (paleta final acima).
