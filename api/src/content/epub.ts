/**
 * EPUB -> Simulizi chapters (owner request, 2026-11-10).
 *
 * Reads the OPF package (title, language, creator, description, spine), maps
 * each spine document to one chapter in ProseMirror JSON using the same node
 * set the editor and renderer understand: heading, paragraph, blockquote,
 * hard_break, bold/italic marks. Images are dropped in the MVP (media comes
 * with RustFS in 1b). Front matter with almost no text is skipped. Chapter
 * titles come from the TOC when it names the file, else the first heading,
 * else "Sura N".
 */
import AdmZip from 'adm-zip';
import { Parser } from 'htmlparser2';
import type { PMNode } from './prosemirror';

export interface EpubChapter {
  title: string;
  doc: PMNode;
  wordCount: number;
}

export interface EpubBook {
  title: string;
  language: string | null; // raw dc:language, e.g. "sw", "en-GB"
  author: string | null;
  description: string | null;
  chapters: EpubChapter[];
  skipped: number;
}

const MIN_WORDS = 30;
const MAX_CHAPTERS = 200;

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i')) ?? tag.match(new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, 'i'));
  return m ? m[1] : null;
}

function decodeEntities(s: string) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function textOf(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<(?:[a-z]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[a-z]+:)?${tag}>`, 'i'));
  return m ? decodeEntities(m[1].replace(/<[^>]+>/g, '').trim()) : null;
}

function resolvePath(base: string, href: string) {
  const parts = (base ? base + '/' : '').split('/').filter(Boolean);
  for (const seg of href.replace(/#.*$/, '').split('/')) {
    if (seg === '..') parts.pop();
    else if (seg && seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

/** XHTML chapter -> ProseMirror doc. Tolerant of real-world EPUB markup. */
export function chapterToDoc(html: string): { doc: PMNode; wordCount: number; firstHeading: string | null } {
  const blocks: PMNode[] = [];
  let inline: PMNode[] = [];
  let marks: string[] = [];
  let blockType: 'paragraph' | 'heading' = 'paragraph';
  let headingLevel = 2;
  let quoteDepth = 0;
  let skipDepth = 0; // inside <head>, <script>, <style>, <svg>
  let firstHeading: string | null = null;
  let words = 0;

  const flush = () => {
    const content = inline.filter((n) => n.type !== 'text' || (n.text ?? '').trim().length > 0 || inline.length > 1);
    // trim leading/trailing whitespace-only text and hard breaks
    while (content.length && (content[0].type === 'hard_break' || !(content[0].text ?? 'x').trim())) content.shift();
    while (content.length && (content[content.length - 1].type === 'hard_break' || !(content[content.length - 1].text ?? 'x').trim())) content.pop();
    if (content.length) {
      const text = content.map((n) => n.text ?? '').join('');
      words += text.split(/\s+/).filter(Boolean).length;
      const node: PMNode = blockType === 'heading' ? { type: 'heading', attrs: { level: headingLevel }, content } : { type: 'paragraph', content };
      if (blockType === 'heading' && !firstHeading) firstHeading = text.trim();
      if (quoteDepth > 0) blocks.push({ type: 'blockquote', content: [node] });
      else blocks.push(node);
    }
    inline = [];
    blockType = 'paragraph';
  };
  const pushText = (t: string) => {
    if (!t) return;
    const last = inline[inline.length - 1];
    const sameMarks = last?.type === 'text' && JSON.stringify(last.marks?.map((m) => m.type) ?? []) === JSON.stringify(marks);
    if (sameMarks && last) last.text = (last.text ?? '') + t;
    else inline.push({ type: 'text', text: t, marks: marks.length ? marks.map((type) => ({ type })) : undefined });
  };

  const parser = new Parser(
    {
      onopentag(name) {
        const n = name.toLowerCase();
        if (['head', 'script', 'style', 'svg', 'nav'].includes(n)) skipDepth++;
        if (skipDepth) return;
        if (/^h[1-6]$/.test(n)) {
          flush();
          blockType = 'heading';
          headingLevel = Math.min(4, Math.max(2, Number(n[1])));
        } else if (['p', 'div', 'li', 'section', 'article', 'tr', 'dd', 'dt', 'figcaption', 'pre'].includes(n)) {
          flush();
        } else if (n === 'blockquote') {
          flush();
          quoteDepth++;
        } else if (n === 'br') {
          inline.push({ type: 'hard_break' });
        } else if (['b', 'strong'].includes(n)) marks = [...marks, 'bold'];
        else if (['i', 'em', 'cite'].includes(n)) marks = [...marks, 'italic'];
        else if (n === 'hr') {
          flush();
          blocks.push({ type: 'horizontal_rule' });
        }
      },
      ontext(data) {
        if (skipDepth) return;
        pushText(data.replace(/\s+/g, ' '));
      },
      onclosetag(name) {
        const n = name.toLowerCase();
        if (['head', 'script', 'style', 'svg', 'nav'].includes(n)) {
          skipDepth = Math.max(0, skipDepth - 1);
          return;
        }
        if (skipDepth) return;
        if (/^h[1-6]$/.test(n) || ['p', 'div', 'li', 'section', 'article', 'tr', 'dd', 'dt', 'figcaption', 'pre', 'body'].includes(n)) flush();
        else if (n === 'blockquote') {
          flush();
          quoteDepth = Math.max(0, quoteDepth - 1);
        } else if (['b', 'strong'].includes(n)) marks = marks.filter((m, i) => !(m === 'bold' && i === marks.lastIndexOf('bold')));
        else if (['i', 'em', 'cite'].includes(n)) marks = marks.filter((m, i) => !(m === 'italic' && i === marks.lastIndexOf('italic')));
      },
    },
    { decodeEntities: true, xmlMode: false, lowerCaseTags: true },
  );
  parser.write(html);
  parser.end();
  flush();
  return { doc: { type: 'doc', content: blocks }, wordCount: words, firstHeading };
}

export function parseEpub(buffer: Buffer): EpubBook {
  const zip = new AdmZip(buffer);
  const read = (path: string) => {
    const entry = zip.getEntry(path) ?? zip.getEntry(decodeURIComponent(path));
    return entry ? entry.getData().toString('utf8') : null;
  };
  const container = read('META-INF/container.xml');
  if (!container) throw new Error('Not an EPUB: META-INF/container.xml missing');
  const opfPath = attr(container.match(/<rootfile\b[^>]*>/i)?.[0] ?? '', 'full-path');
  if (!opfPath) throw new Error('EPUB has no rootfile');
  const opf = read(opfPath);
  if (!opf) throw new Error('EPUB package file missing');
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';

  // manifest id -> href
  const manifest = new Map<string, { href: string; type: string }>();
  for (const item of opf.match(/<item\b[^>]*>/gi) ?? []) {
    const id = attr(item, 'id');
    const href = attr(item, 'href');
    if (id && href) manifest.set(id, { href, type: attr(item, 'media-type') ?? '' });
  }
  const spine = (opf.match(/<itemref\b[^>]*>/gi) ?? [])
    .map((ref) => attr(ref, 'idref'))
    .filter((id): id is string => !!id && manifest.has(id))
    .filter((id) => attr((opf.match(new RegExp(`<itemref\\b[^>]*idref="${id}"[^>]*>`, 'i')) ?? [''])[0], 'linear') !== 'no');

  // TOC titles by file (nav.xhtml for EPUB3, toc.ncx for EPUB2)
  const titles = new Map<string, string>();
  const navItem = [...manifest.values()].find((m) => /nav/i.test(m.href) && /xhtml|html/.test(m.type));
  const ncxItem = [...manifest.values()].find((m) => /ncx/.test(m.type));
  if (navItem) {
    const nav = read(resolvePath(base, navItem.href)) ?? '';
    for (const a of nav.match(/<a\b[^>]*href="[^"]+"[^>]*>[\s\S]*?<\/a>/gi) ?? []) {
      const href = attr(a, 'href');
      const text = decodeEntities(a.replace(/<[^>]+>/g, '').trim());
      if (href && text) titles.set(resolvePath(navItem.href.includes('/') ? resolvePath(base, navItem.href.slice(0, navItem.href.lastIndexOf('/'))) : base, href), text);
    }
  } else if (ncxItem) {
    const ncx = read(resolvePath(base, ncxItem.href)) ?? '';
    for (const np of ncx.match(/<navPoint\b[\s\S]*?<\/navPoint>/gi) ?? []) {
      const text = textOf(np, 'text');
      const src = attr(np.match(/<content\b[^>]*>/i)?.[0] ?? '', 'src');
      if (text && src) titles.set(resolvePath(base, src), text);
    }
  }

  const chapters: EpubChapter[] = [];
  let skipped = 0;
  for (const id of spine) {
    if (chapters.length >= MAX_CHAPTERS) break;
    const item = manifest.get(id)!;
    const path = resolvePath(base, item.href);
    const html = read(path);
    if (!html) continue;
    const { doc, wordCount, firstHeading } = chapterToDoc(html);
    if (wordCount < MIN_WORDS) {
      skipped++;
      continue;
    }
    const title = titles.get(path) ?? firstHeading ?? `Sura ${chapters.length + 1}`;
    chapters.push({ title: title.slice(0, 160), doc, wordCount });
  }

  const meta = opf.match(/<metadata[\s\S]*?<\/metadata>/i)?.[0] ?? opf;
  return {
    title: (textOf(meta, 'title') ?? 'Untitled').slice(0, 120),
    language: textOf(meta, 'language'),
    author: textOf(meta, 'creator'),
    description: textOf(meta, 'description'),
    chapters,
    skipped,
  };
}
