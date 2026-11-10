import AdmZip from 'adm-zip';
import { chapterToDoc, parseEpub } from './epub';
import { render } from './prosemirror';

function makeEpub(): Buffer {
  const zip = new AdmZip();
  zip.addFile('mimetype', Buffer.from('application/epub+zip'));
  zip.addFile('META-INF/container.xml', Buffer.from(`<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`));
  zip.addFile('OEBPS/content.opf', Buffer.from(`<?xml version="1.0"?><package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>Bahari ya Siri</dc:title><dc:language>sw</dc:language><dc:creator>A. M. Kweka</dc:creator><dc:description>Zawadi anarudi kisiwani.</dc:description></metadata>
<manifest><item id="t" href="title.xhtml" media-type="application/xhtml+xml"/><item id="c1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest>
<spine toc="ncx"><itemref idref="t"/><itemref idref="c1"/><itemref idref="c2"/></spine></package>`));
  zip.addFile('OEBPS/toc.ncx', Buffer.from(`<ncx><navMap><navPoint><navLabel><text>Wimbi la kwanza</text></navLabel><content src="text/ch1.xhtml"/></navPoint></navMap></ncx>`));
  zip.addFile('OEBPS/title.xhtml', Buffer.from(`<html><body><h1>Bahari ya Siri</h1><p>A. M. Kweka</p></body></html>`));
  const para = 'Zawadi alisimama ukingoni mwa bahari akishikilia ramani iliyokunjwa mara nyingi sana. '.repeat(3);
  zip.addFile('OEBPS/text/ch1.xhtml', Buffer.from(`<html><head><style>p{}</style></head><body><h2>Sura ya Kwanza</h2><p>${para}</p><p>Upepo <em>ulikuwa</em> na <strong>chumvi</strong>.<br/>Na kumbukumbu.</p></body></html>`));
  zip.addFile('OEBPS/text/ch2.xhtml', Buffer.from(`<html><body><div class="x"><p>${para}</p></div><blockquote><p>Bahari haisahau.</p></blockquote></body></html>`));
  return zip.toBuffer();
}

describe('epub import', () => {
  it('reads metadata, spine order, TOC titles and skips front matter', () => {
    const book = parseEpub(makeEpub());
    expect(book.title).toBe('Bahari ya Siri');
    expect(book.language).toBe('sw');
    expect(book.author).toBe('A. M. Kweka');
    expect(book.skipped).toBe(1);
    expect(book.chapters.map((c) => c.title)).toEqual(['Wimbi la kwanza', 'Sura 2']);
  });

  it('maps chapter markup to our nodes and marks', () => {
    const { doc } = chapterToDoc('<body><h3>T</h3><p>Upepo <em>ulikuwa</em> na <strong>chumvi</strong>.<br/>Na.</p></body>');
    const out = render(doc);
    expect(out.html).toContain('<h3 data-p="0">T</h3>');
    expect(out.html).toContain('Upepo <em>ulikuwa</em> na <strong>chumvi</strong>.<br>Na.');
  });

  it('keeps blockquotes and ignores head/style', () => {
    const { doc, wordCount } = chapterToDoc('<html><head><style>p{color:red}</style></head><body><blockquote><p>Bahari haisahau.</p></blockquote></body></html>');
    expect(render(doc).html).toBe('<blockquote>\n<p data-p="0">Bahari haisahau.</p>\n</blockquote>');
    expect(wordCount).toBe(2);
  });
});
