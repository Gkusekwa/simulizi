import 'package:flutter/material.dart';

/// Native renderer for the ProseMirror JSON the API stores (doc 14 §7):
/// paragraph, heading, blockquote, horizontal_rule, hard_break, lists and the
/// poem > stanza > line family, with bold/italic/underline/strike/link marks.
/// Every paragraph, heading and poem line gets a reading-position key so the
/// reader can restore and report "paragraph index".
class PartRenderer extends StatelessWidget {
  const PartRenderer({super.key, required this.doc, required this.fontSize, this.paragraphKeys});
  final Map<String, dynamic>? doc;
  final double fontSize;
  final Map<int, GlobalKey>? paragraphKeys;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final body = TextStyle(fontFamily: 'serif', fontSize: fontSize, height: 1.7, color: theme.colorScheme.onSurface);
    var index = 0;

    GlobalKey keyFor(int i) {
      final k = GlobalKey();
      paragraphKeys?[i] = k;
      return k;
    }

    InlineSpan inline(List<dynamic>? nodes, TextStyle base) {
      return TextSpan(
        children: (nodes ?? const []).map<InlineSpan>((n) {
          final node = n as Map<String, dynamic>;
          final type = node['type'] as String?;
          if (type == 'text') {
            var style = base;
            for (final m in (node['marks'] as List?) ?? const []) {
              switch ((m as Map)['type']) {
                case 'bold':
                case 'strong':
                  style = style.copyWith(fontWeight: FontWeight.w600);
                case 'italic':
                case 'em':
                  style = style.copyWith(fontStyle: FontStyle.italic);
                case 'underline':
                  style = style.copyWith(decoration: TextDecoration.underline);
                case 'strike':
                  style = style.copyWith(decoration: TextDecoration.lineThrough);
                case 'link':
                  style = style.copyWith(color: theme.colorScheme.primary, decoration: TextDecoration.underline);
              }
            }
            return TextSpan(text: node['text'] as String? ?? '', style: style);
          }
          if (type == 'hard_break' || type == 'hardBreak') return const TextSpan(text: '\n');
          return inline(node['content'] as List?, base);
        }).toList(),
      );
    }

    List<Widget> blocks(List<dynamic>? nodes, {bool quoted = false}) {
      final out = <Widget>[];
      for (final raw in nodes ?? const []) {
        final node = raw as Map<String, dynamic>;
        final type = node['type'] as String?;
        switch (type) {
          case 'paragraph':
            final i = index++;
            out.add(Padding(
              key: keyFor(i),
              padding: EdgeInsets.only(bottom: fontSize * 0.9, left: quoted ? 14 : 0),
              child: Text.rich(inline(node['content'] as List?, quoted ? body.copyWith(fontStyle: FontStyle.italic) : body)),
            ));
          case 'heading':
            final i = index++;
            final level = (node['attrs']?['level'] as int?) ?? 2;
            out.add(Padding(
              key: keyFor(i),
              padding: EdgeInsets.only(top: fontSize * 0.8, bottom: fontSize * 0.5),
              child: Text.rich(inline(node['content'] as List?, body.copyWith(fontSize: fontSize * (level == 2 ? 1.35 : 1.15), fontWeight: FontWeight.w500, height: 1.25))),
            ));
          case 'blockquote':
            out.add(Container(
              margin: EdgeInsets.only(bottom: fontSize * 0.6),
              decoration: BoxDecoration(border: Border(left: BorderSide(color: theme.dividerColor, width: 3))),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: blocks(node['content'] as List?, quoted: true)),
            ));
          case 'horizontal_rule':
          case 'horizontalRule':
            out.add(Divider(height: fontSize * 2));
          case 'bullet_list':
          case 'bulletList':
          case 'ordered_list':
          case 'orderedList':
            var n = 1;
            for (final li in (node['content'] as List?) ?? const []) {
              final i = index++;
              final marker = type!.startsWith('bullet') ? '\u2022' : '${n++}.';
              out.add(Padding(
                key: keyFor(i),
                padding: EdgeInsets.only(bottom: fontSize * 0.4, left: 8),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  SizedBox(width: 24, child: Text(marker, style: body)),
                  Expanded(child: Text.rich(inline(((li as Map)['content'] as List?)?.expand((c) => (c as Map)['content'] as List? ?? const []).toList(), body))),
                ]),
              ));
            }
          case 'poem':
            var stanzaNo = 1;
            for (final st in (node['content'] as List?) ?? const []) {
              final stanza = st as Map<String, dynamic>;
              if (stanza['type'] != 'stanza') continue;
              final lines = <Widget>[];
              for (final ln in (stanza['content'] as List?) ?? const []) {
                final line = ln as Map<String, dynamic>;
                final i = index++;
                final indent = ((line['attrs']?['indent'] as num?) ?? 0).toDouble();
                final center = line['attrs']?['align'] == 'center';
                lines.add(Padding(
                  key: keyFor(i),
                  padding: EdgeInsets.only(left: indent * fontSize * 1.5),
                  child: Text.rich(inline(line['content'] as List?, body.copyWith(height: 1.55)), textAlign: center ? TextAlign.center : TextAlign.start),
                ));
              }
              out.add(Semantics(
                container: true,
                label: 'Stanza ${stanzaNo++}',
                child: Padding(padding: EdgeInsets.only(bottom: fontSize * 1.1), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: lines)),
              ));
            }
          default:
            if (node['content'] is List) {
              final i = index++;
              out.add(Padding(key: keyFor(i), padding: EdgeInsets.only(bottom: fontSize * 0.9), child: Text.rich(inline(node['content'] as List?, body))));
            }
        }
      }
      return out;
    }

    final widgets = doc == null ? <Widget>[] : (doc!['type'] == 'doc' ? blocks(doc!['content'] as List?) : blocks([doc]));
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: widgets);
  }
}
/// Number of reading-position blocks in a document (for progress maths).
int countParagraphs(Map<String, dynamic>? doc) {
  var n = 0;
  void walk(Map<String, dynamic> node) {
    final t = node['type'];
    if (t == 'paragraph' || t == 'heading' || t == 'line' || t == 'list_item' || t == 'listItem') n++;
    for (final c in (node['content'] as List?) ?? const []) {
      if (c is Map<String, dynamic> && c['type'] != 'text') walk(c);
    }
  }
  if (doc != null) walk(doc);
  return n;
}
