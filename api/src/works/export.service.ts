import { Injectable } from '@nestjs/common';
import { escapeHtml } from '../content/prosemirror';
import { PrismaService } from '../prisma/prisma.service';
import { WorksService } from './works.service';

/**
 * "Download the whole work as HTML and plain text, any time" (doc 14 §1).
 * No exclusivity: the export is always available to the owner. EPUB/PDF come in 1b.
 */
@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly works: WorksService,
  ) {}

  async html(ownerId: string, workId: string) {
    const work = await this.works.owned(ownerId, workId);
    const owner = await this.prisma.user.findUniqueOrThrow({ where: { id: ownerId }, select: { displayName: true } });
    const parts = await this.prisma.part.findMany({
      where: { workId, bodyHtml: { not: '' } },
      orderBy: { position: 'asc' },
      select: { position: true, title: true, bodyHtml: true, kind: true },
    });
    const body = parts
      .map((p) => `<section><h2>${p.position}. ${escapeHtml(p.title)}</h2>\n${p.bodyHtml}</section>`)
      .join('\n');
    return `<!doctype html>
<html lang="${work.language}">
<head><meta charset="utf-8"><title>${escapeHtml(work.title)}</title>
<style>body{max-width:40em;margin:2em auto;font:17px/1.6 Georgia,serif;padding:0 1em}h1,h2{font-weight:500}.poem{text-align:center}.stanza{margin:0 0 1.2em}.line{margin:0;padding-left:calc(var(--indent,0)*1.5em)}</style>
</head>
<body>
<h1>${escapeHtml(work.title)}</h1>
<p><em>${escapeHtml(owner.displayName)}</em></p>
${work.synopsis ? `<p>${escapeHtml(work.synopsis)}</p>` : ''}
${body}
</body></html>`;
  }

  async text(ownerId: string, workId: string) {
    const work = await this.works.owned(ownerId, workId);
    const parts = await this.prisma.part.findMany({
      where: { workId, bodyHtml: { not: '' } },
      orderBy: { position: 'asc' },
      select: { position: true, title: true, bodyHtml: true },
    });
    const strip = (html: string) =>
      html
        .replace(/<\/(p|h[1-6]|li|div)>/g, '\n')
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return [`${work.title}\n${'='.repeat(work.title.length)}`, work.synopsis, ...parts.map((p) => `\n\n${p.position}. ${p.title}\n\n${strip(p.bodyHtml)}`)]
      .filter(Boolean)
      .join('\n');
  }
}
