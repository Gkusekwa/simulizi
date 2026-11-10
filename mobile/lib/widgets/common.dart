import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../models.dart';
import '../theme.dart';

class Cover extends StatelessWidget {
  const Cover({super.key, required this.work, this.width = 64, this.height = 88});
  final WorkCard work;
  final double width, height;
  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final c = coverColor(work.slug, Theme.of(context).brightness);
    return Container(
      width: width,
      height: height,
      padding: const EdgeInsets.all(7),
      decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(8)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(s('work.kind.${work.kind}').toUpperCase(), style: const TextStyle(color: Colors.white70, fontSize: 7, letterSpacing: 1, fontWeight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis),
        const SizedBox(height: 4),
        Expanded(child: Text(work.title, style: TextStyle(color: Colors.white, fontFamily: 'serif', fontSize: width > 80 ? 14 : 10.5, height: 1.15), maxLines: 4, overflow: TextOverflow.ellipsis)),
      ]),
    );
  }
}

class WorkRow extends StatelessWidget {
  const WorkRow({super.key, required this.work, this.note, required this.onTap});
  final WorkCard work;
  final String? note;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(children: [
          Cover(work: work, width: 52, height: 72),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(work.title, style: theme.textTheme.titleMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 2),
              Text('${work.ownerName} · ${s('common.language.${work.language}')}', style: theme.textTheme.bodySmall),
              if (note != null) Text(note!, style: theme.textTheme.bodySmall!.copyWith(color: theme.colorScheme.primary)),
            ]),
          ),
          Icon(Icons.chevron_right, color: theme.colorScheme.onSurfaceVariant),
        ]),
      ),
    );
  }
}

class Eyebrow extends StatelessWidget {
  const Eyebrow(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Text(text.toUpperCase(), style: Theme.of(context).textTheme.labelSmall);
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, this.body, this.action});
  final IconData icon;
  final String title;
  final String? body;
  final Widget? action;
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 40, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(height: 12),
          Text(title, style: theme.textTheme.titleLarge, textAlign: TextAlign.center),
          if (body != null) ...[const SizedBox(height: 6), Text(body!, style: theme.textTheme.bodySmall, textAlign: TextAlign.center)],
          if (action != null) ...[const SizedBox(height: 16), action!],
        ]),
      ),
    );
  }
}

class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      color: scheme.primaryContainer,
      child: Row(children: [
        Icon(Icons.wifi_off, size: 16, color: scheme.onPrimaryContainer),
        const SizedBox(width: 8),
        Expanded(child: Text(S.of(context)('common.offline'), style: TextStyle(fontSize: 12.5, color: scheme.onPrimaryContainer))),
      ]),
    );
  }
}

String formatWhen(BuildContext context, DateTime? d) {
  if (d == null) return '';
  final l = d.toLocal();
  final now = DateTime.now();
  final sameDay = l.year == now.year && l.month == now.month && l.day == now.day;
  final hm = '${l.hour.toString().padLeft(2, '0')}:${l.minute.toString().padLeft(2, '0')}';
  if (sameDay) return hm;
  const swM = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des'];
  const enM = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  final m = (S.of(context).lang == 'en' ? enM : swM)[l.month - 1];
  return '${l.day} $m${l.year != now.year ? ' ${l.year}' : ''} · $hm';
}

String countLabel(BuildContext context, Object? v) {
  if (v == null) return '';
  final str = v.toString();
  return str == 'fewer than 5' ? S.of(context)('common.fewerThanFive') : str;
}
