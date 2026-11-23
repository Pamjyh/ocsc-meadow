/**
 * Pure sanitization & lightweight Markdown utilities:
 * - normalizeDriveImageUrl: converts Google Drive share links to reliable thumbnail URLs (F4)
 * - sanitizeStudyHtml: strict allowlist sanitizer preventing XSS & stripping messy Docs inline styles
 * - renderQuestionMarkdown: safe Markdown renderer supporting bold, italic, line breaks, and tables
 */

const ALLOWED_TAGS = new Set([
  'article',
  'section',
  'h1',
  'h2',
  'h3',
  'h4',
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'blockquote',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'img',
  'code',
  'pre',
  'hr',
  'div',
  'span',
]);

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeDriveImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  // Reject dangerous protocols
  if (/^(javascript|vbscript|data:text\/html):/i.test(trimmed)) {
    return '';
  }
  const driveMatch =
    trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/drive\.google\.com\/(?:open|uc|thumbnail)\?[^#]*\bid=([a-zA-Z0-9_-]+)/);

  if (driveMatch?.[1]) {
    return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w1600`;
  }
  return trimmed;
}

export function sanitizeStudyHtml(rawHtml: string): string {
  if (!rawHtml) return '';

  // 1. Remove dangerous block elements along with their inner content
  let clean = rawHtml.replace(
    /<\s*(script|style|iframe|object|embed|form|input|button)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    '',
  );
  clean = clean.replace(/<\s*(script|style|iframe|object|embed|meta|link)\b[^>]*\/?>/gi, '');

  // 2. Process remaining tags against strict allowlist & strip event handlers / inline styles
  clean = clean.replace(/<\/?([a-zA-Z0-9-]+)([^>]*)>/g, (full, rawTag: string, rawAttrs: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';
    const isClosing = full.startsWith('</');
    if (isClosing) return `</${tag}>`;

    if (tag === 'img') {
      const srcMatch = rawAttrs.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const altMatch = rawAttrs.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const rawSrc = srcMatch?.[1] ?? srcMatch?.[2] ?? srcMatch?.[3] ?? '';
      const safeSrc = normalizeDriveImageUrl(rawSrc);
      if (!safeSrc) return '';
      const safeAlt = escapeHtml(altMatch?.[1] ?? altMatch?.[2] ?? '');
      return `<img src="${escapeHtml(safeSrc)}" alt="${safeAlt}" loading="lazy" />`;
    }

    if (tag === 'td' || tag === 'th') {
      const colspan = rawAttrs.match(/\bcolspan\s*=\s*"?(\d+)"?/i)?.[1];
      const rowspan = rawAttrs.match(/\browspan\s*=\s*"?(\d+)"?/i)?.[1];
      const attrs = [
        colspan ? `colspan="${colspan}"` : '',
        rowspan ? `rowspan="${rowspan}"` : '',
      ]
        .filter(Boolean)
        .join(' ');
      return attrs ? `<${tag} ${attrs}>` : `<${tag}>`;
    }

    return tag === 'br' || tag === 'hr' ? `<${tag} />` : `<${tag}>`;
  });

  return clean.trim();
}

function formatInlineMarkdown(escapedLine: string): string {
  // Allow single * math operators inside **bold** and require non-spaced boundaries for *italic* (F2)
  return escapedLine
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*(?!\s)([^*
]+?)(?<!\s)\*(?=[\s).,!?]|$)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function isTableSeparator(line: string): boolean {
  return /^\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?$/.test(line.trim());
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => formatInlineMarkdown(escapeHtml(cell.trim())));
}

/**
 * Renders exam prompt & explanation Markdown safely:
 * supports Markdown tables (for ก.พ. data analysis questions), bold, italic, and line breaks.
 */
export function renderQuestionMarkdown(markdown: string): string {
  if (!markdown) return '';
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const nextLine = lines[i + 1] ?? '';

    // Detect Markdown table block
    if (line.includes('|') && isTableSeparator(nextLine)) {
      const headers = splitTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] ?? '').includes('|') && (lines[i] ?? '').trim() !== '') {
        rows.push(splitTableRow(lines[i] ?? ''));
        i += 1;
      }
      const thead = `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
        .join('')}</tbody>`;
      blocks.push(`<div class="md-table-wrap"><table>${thead}${tbody}</table></div>`);
      continue;
    }

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // Collect contiguous paragraph lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() !== '' &&
      !((lines[i] ?? '').includes('|') && isTableSeparator(lines[i + 1] ?? ''))
    ) {
      paraLines.push(formatInlineMarkdown(escapeHtml(lines[i] ?? '')));
      i += 1;
    }
    blocks.push(`<p>${paraLines.join('<br />')}</p>`);
  }

  return blocks.join('\n');
}
