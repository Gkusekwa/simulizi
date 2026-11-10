import { docFromText, poemFromText, render } from './prosemirror';

describe('prosemirror render', () => {
  it('renders paragraphs with reading-position indexes', () => {
    const out = render(docFromText('Habari ya dunia.\n\nSura ya pili.'));
    expect(out.html).toBe('<p data-p="0">Habari ya dunia.</p>\n<p data-p="1">Sura ya pili.</p>');
    expect(out.wordCount).toBe(6);
    expect(out.paragraphs).toBe(2);
  });

  it('keeps stanzas and lines, announcing stanza boundaries', () => {
    const out = render(poemFromText('Mto huanza kimya,\nchini ya mlima.\n\n  Ukinywa maji yake.'));
    expect(out.html).toContain('aria-label="Stanza 1"');
    expect(out.html).toContain('aria-label="Stanza 2"');
    expect(out.html).toContain('<p class="line" data-p="2" style="--indent:1">Ukinywa maji yake.</p>');
  });

  it('escapes text and drops unsafe links', () => {
    const out = render({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '<b>x</b>', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
          ],
        },
      ],
    });
    expect(out.html).toBe('<p data-p="0">&lt;b&gt;x&lt;/b&gt;</p>');
  });
});
