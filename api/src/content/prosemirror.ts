/**
 * ProseMirror JSON -> HTML, server side (doc 14 §7).
 *
 * Supported nodes: doc, paragraph, heading, blockquote, horizontal_rule,
 * hard_break, image, bullet_list, ordered_list, list_item, text, and the poem
 * family: poem > stanza > line. Marks: bold, italic, underline, strike, link.
 * Anything else renders its children as a paragraph so no content is lost.
 *
 * Paragraph index (reading position) = the order of block elements that get a
 * data-p attribute: paragraphs, headings and poem lines.
 */

export interface PMNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

export interface Rendered {
  html: string;
  wordCount: number;
  paragraphs: number;
  plainText: string;
}

const WORDS_PER_MINUTE = 200;

export function readMinutes(wordCount: number) {
  return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
}

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeHref(href: unknown): string | null {
  if (typeof href !== 'string') return null;
  const h = href.trim();
  return /^(https?:\/\/|mailto:|\/)/i.test(h) ? h : null;
}

function renderMarks(text: string, marks: PMNode['marks'] = []) {
  let out = escapeHtml(text);
  for (const m of marks) {
    switch (m.type) {
      case 'bold':
      case 'strong':
        out = `<strong>${out}</strong>`;
        break;
      case 'italic':
      case 'em':
        out = `<em>${out}</em>`;
        break;
      case 'underline':
        out = `<u>${out}</u>`;
        break;
      case 'strike':
        out = `<s>${out}</s>`;
        break;
      case 'link': {
        const href = safeHref(m.attrs?.href);
        if (href) out = `<a href="${escapeHtml(href)}" rel="noopener nofollow">${out}</a>`;
        break;
      }
      default:
        break;
    }
  }
  return out;
}

export function render(doc: PMNode | null | undefined): Rendered {
  const parts: string[] = [];
  const words: string[] = [];
  let p = 0;

  const inline = (nodes: PMNode[] = []): string =>
    nodes
      .map((n) => {
        if (n.type === 'text') {
          words.push(...(n.text ?? '').split(/\s+/).filter(Boolean));
          return renderMarks(n.text ?? '', n.marks);
        }
        if (n.type === 'hard_break' || n.type === 'hardBreak') return '<br>';
        if (n.type === 'image') return image(n);
        return inline(n.content);
      })
      .join('');

  const image = (n: PMNode) => {
    const src = safeHref(n.attrs?.src);
    if (!src) return '';
    const alt = escapeHtml(String(n.attrs?.alt ?? ''));
    return `<img src="${escapeHtml(src)}" alt="${alt}" loading="lazy">`;
  };

  const block = (n: PMNode) => {
    switch (n.type) {
      case 'paragraph':
        parts.push(`<p data-p="${p++}">${inline(n.content)}</p>`);
        break;
      case 'heading': {
        const level = Math.min(4, Math.max(2, Number(n.attrs?.level ?? 2)));
        parts.push(`<h${level} data-p="${p++}">${inline(n.content)}</h${level}>`);
        break;
      }
      case 'blockquote':
        parts.push('<blockquote>');
        (n.content ?? []).forEach(block);
        parts.push('</blockquote>');
        break;
      case 'horizontal_rule':
      case 'horizontalRule':
        parts.push('<hr>');
        break;
      case 'image':
        parts.push(`<figure data-p="${p++}">${image(n)}</figure>`);
        break;
      case 'bullet_list':
      case 'bulletList':
      case 'ordered_list':
      case 'orderedList': {
        const tag = n.type.startsWith('bullet') ? 'ul' : 'ol';
        parts.push(`<${tag}>`);
        for (const li of n.content ?? []) {
          parts.push(`<li data-p="${p++}">${(li.content ?? []).map((c) => inline(c.content)).join('<br>')}</li>`);
        }
        parts.push(`</${tag}>`);
        break;
      }
      case 'poem': {
        parts.push('<div class="poem">');
        let s = 1;
        for (const stanza of n.content ?? []) {
          if (stanza.type !== 'stanza') continue;
          parts.push(`<div class="stanza" role="group" aria-label="Stanza ${s++}">`);
          for (const line of stanza.content ?? []) {
            const indent = Number(line.attrs?.indent ?? 0);
            const align = line.attrs?.align === 'center' ? ' center' : '';
            const style = indent > 0 ? ` style="--indent:${indent}"` : '';
            parts.push(`<p class="line${align}" data-p="${p++}"${style}>${inline(line.content)}</p>`);
          }
          parts.push('</div>');
        }
        parts.push('</div>');
        break;
      }
      case 'doc':
        (n.content ?? []).forEach(block);
        break;
      default:
        if (n.content?.length) parts.push(`<p data-p="${p++}">${inline(n.content)}</p>`);
    }
  };

  if (doc) block(doc);
  return {
    html: parts.join('\n'),
    wordCount: words.length,
    paragraphs: p,
    plainText: words.join(' '),
  };
}

/** Plain text -> doc: blank lines separate paragraphs. */
export function docFromText(text: string): PMNode {
  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean);
  return {
    type: 'doc',
    content: paragraphs.map((t) => ({
      type: 'paragraph',
      content: t.split('\n').flatMap((line, i) =>
        i === 0 ? [{ type: 'text', text: line }] : [{ type: 'hard_break' }, { type: 'text', text: line }],
      ),
    })),
  };
}

/** Poem text -> doc: blank lines separate stanzas, every line is a line node. */
export function poemFromText(text: string): PMNode {
  const stanzas = text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((s) => s.split('\n').filter((l) => l.trim().length > 0))
    .filter((s) => s.length > 0);
  return {
    type: 'doc',
    content: [
      {
        type: 'poem',
        content: stanzas.map((lines) => ({
          type: 'stanza',
          content: lines.map((line) => {
            const indent = Math.min(6, Math.floor((line.match(/^\s*/)?.[0].length ?? 0) / 2));
            return {
              type: 'line',
              attrs: indent ? { indent } : undefined,
              content: [{ type: 'text', text: line.trim() }],
            };
          }),
        })),
      },
    ],
  };
}
