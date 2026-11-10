import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../app_state.dart';
import '../l10n/strings.dart';
import '../models.dart';
import '../services/repo.dart';
import '../widgets/common.dart';
import 'auth.dart';
import 'reader.dart';

class WorkScreen extends StatefulWidget {
  const WorkScreen({super.key, required this.slug, this.openPosition});
  final String slug;
  final int? openPosition;
  @override
  State<WorkScreen> createState() => _WorkScreenState();
}

class _WorkScreenState extends State<WorkScreen> {
  WorkPage? page;
  bool offline = false;
  String? error;
  int downloaded = 0;
  String? downloading;

  @override
  void initState() {
    super.initState();
    load().then((_) {
      if (widget.openPosition != null && page != null && mounted) openPart(widget.openPosition!);
    });
  }

  Repo get repo {
    final app = context.read<AppState>();
    return Repo(app.api, app.db);
  }

  Future<void> load() async {
    try {
      final r = await repo.work(widget.slug);
      page = r.page;
      offline = r.offline;
      error = null;
      if (!mounted) return;
      downloaded = await context.read<AppState>().db.downloadedCount(page!.work.id);
    } on ApiException catch (e) {
      error = e.isNetwork ? 'errors.network' : e.status == 404 ? 'errors.notFound' : 'common.error';
    }
    if (mounted) setState(() {});
  }

  Future<void> toggle(String what, bool on) async {
    final app = context.read<AppState>();
    if (!app.signedIn) {
      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AuthScreen()));
      if (!mounted || !context.read<AppState>().signedIn) return;
    }
    try {
      await (on ? app.api.put('/works/${widget.slug}/$what') : app.api.delete('/works/${widget.slug}/$what'));
      if (what == 'follow' && on) app.sync.sync();
      await load();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> download() async {
    final p = page!;
    setState(() => downloading = '0');
    final n = await repo.download(p, (d, t) => mounted ? setState(() => downloading = '$d/$t') : null);
    if (!mounted) return;
    setState(() {
      downloading = null;
      downloaded = n;
    });
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(S.of(context)('work.downloaded', {'n': n}))));
  }

  void openPart(int position) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => ReaderScreen(slug: widget.slug, position: position))).then((_) => load());
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final theme = Theme.of(context);
    final app = context.watch<AppState>();
    if (page == null) {
      return Scaffold(
        appBar: AppBar(),
        body: error == null
            ? const Center(child: CircularProgressIndicator())
            : EmptyState(icon: Icons.error_outline, title: s(error!), action: OutlinedButton(onPressed: load, child: Text(s('common.retry')))),
      );
    }
    final w = page!.work;
    final parts = page!.parts;
    final public = parts.where((p) => p.state == 'public').toList();
    final current = parts.cast<PartSummary?>().firstWhere((p) => p!.progress != null && !p.progress!.finished, orElse: () => null) ?? public.cast<PartSummary?>().firstWhere((p) => !(p!.progress?.finished ?? false), orElse: () => null);
    final startPos = current?.position ?? (public.isNotEmpty ? public.first.position : null);
    final stars = page!.stars;

    return Scaffold(
      appBar: AppBar(title: Text(w.title, maxLines: 1, overflow: TextOverflow.ellipsis)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 40),
        children: [
          if (offline) const Padding(padding: EdgeInsets.only(bottom: 10), child: OfflineBanner()),
          Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
            Cover(work: w, width: 96, height: 132),
            const SizedBox(width: 16),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Eyebrow('${s('common.language.${w.language}')}${w.genre != null ? ' · ${w.genre}' : ''} · ${s('work.status.${w.status}')}'),
                const SizedBox(height: 4),
                Text(w.title, style: theme.textTheme.headlineMedium!.copyWith(fontSize: 23)),
                Text(s('work.by', {'name': w.ownerName}), style: theme.textTheme.bodySmall),
                const SizedBox(height: 6),
                Wrap(spacing: 6, runSpacing: 4, children: [
                  Chip(label: Text(s('work.kind.${w.kind}')), visualDensity: VisualDensity.compact),
                  if (w.rating != 'general') Chip(label: Text(s('work.rating.${w.rating}')), visualDensity: VisualDensity.compact),
                  if (w.access != 'public') Chip(avatar: const Icon(Icons.lock_outline, size: 14), label: Text(w.access == 'members' ? s('work.access.members') : s('work.access.preview', {'n': w.previewParts})), visualDensity: VisualDensity.compact),
                  if (parts.any((p) => p.hasAudio)) Chip(avatar: const Icon(Icons.headphones, size: 14), label: Text(s('work.hasAudio')), visualDensity: VisualDensity.compact),
                ]),
              ]),
            ),
          ]),
          if (!offline) ...[
            const SizedBox(height: 10),
            Text(
              '${stars['average'] != null ? '★ ${stars['average']} · ${s('work.ratingCount', {'count': countLabel(context, stars['count'])})}' : s('work.noRatings')} · ${s('work.readers', {'count': countLabel(context, page!.readers)})} · ${s('work.followers', {'count': countLabel(context, page!.followers)})} · ♡ ${countLabel(context, page!.likes)}',
              style: theme.textTheme.bodySmall,
            ),
          ],
          const SizedBox(height: 14),
          Wrap(spacing: 8, runSpacing: 8, children: [
            if (startPos != null)
              FilledButton.icon(onPressed: () => openPart(startPos), icon: const Icon(Icons.menu_book_outlined, size: 18), label: Text(current?.progress != null ? s('work.continueReading', {'n': startPos}) : s('work.startReading'))),
            if (!offline)
              OutlinedButton.icon(
                onPressed: () => toggle('follow', !page!.following),
                icon: Icon(page!.following ? Icons.check : Icons.add, size: 18),
                label: Text(page!.following ? s('work.following') : s('work.follow')),
                style: page!.following ? OutlinedButton.styleFrom(backgroundColor: theme.colorScheme.primaryContainer) : null,
              ),
            if (!offline)
              OutlinedButton.icon(
                onPressed: () => toggle('like', !page!.liked),
                icon: Icon(page!.liked ? Icons.favorite : Icons.favorite_border, size: 18),
                label: Text(page!.liked ? s('work.liked') : s('work.like')),
              ),
            if (!offline && public.isNotEmpty)
              OutlinedButton.icon(
                onPressed: downloading == null ? download : null,
                icon: Icon(downloaded >= public.where((p) => !p.locked).length && downloaded > 0 ? Icons.offline_pin : Icons.download_outlined, size: 18),
                label: Text(downloading != null ? downloading! : downloaded > 0 ? s('work.downloaded', {'n': downloaded}) : s('work.download')),
              ),
          ]),
          if (w.synopsis.isNotEmpty) ...[const SizedBox(height: 16), Text(w.synopsis, style: theme.textTheme.bodyMedium!.copyWith(color: theme.colorScheme.onSurfaceVariant))],
          const SizedBox(height: 20),
          Row(children: [
            Text(s('work.parts'), style: theme.textTheme.titleLarge),
            const Spacer(),
            Text(s('work.released', {'public': public.length, 'total': parts.length}), style: theme.textTheme.bodySmall),
          ]),
          const SizedBox(height: 4),
          for (var i = 0; i < parts.length; i++) ...[
            if (w.isCollection && (i == 0 || parts[i - 1].volume != parts[i].volume))
              Padding(
                padding: const EdgeInsets.only(top: 14, bottom: 4),
                child: Eyebrow('${s('work.volume', {'n': parts[i].volume})}${parts[i].volume - 1 < w.volumes.length ? ' · ${w.volumes[parts[i].volume - 1]}' : ''}'),
              ),
            _PartTile(part: parts[i], signedIn: app.signedIn, onOpen: () => openPart(parts[i].position), onSignIn: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AuthScreen())).then((_) => load())),
          ],
        ],
      ),
    );
  }
}

class _PartTile extends StatelessWidget {
  const _PartTile({required this.part, required this.signedIn, required this.onOpen, required this.onSignIn});
  final PartSummary part;
  final bool signedIn;
  final VoidCallback onOpen, onSignIn;
  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodySmall;
    final notPublic = part.state != 'public';
    final done = part.progress?.finished ?? false;
    Widget trailing;
    if (notPublic) {
      trailing = Icon(Icons.schedule, size: 18, color: theme.colorScheme.onSurfaceVariant);
    } else if (part.locked) {
      trailing = Icon(Icons.lock_outline, size: 18, color: theme.colorScheme.onSurfaceVariant);
    } else if (done) {
      trailing = Icon(Icons.check_circle, size: 18, color: theme.colorScheme.primary);
    } else if (part.progress != null) {
      trailing = Text('${(part.progress!.fraction * 100).round()}%', style: muted);
    } else {
      trailing = Icon(Icons.chevron_right, color: theme.colorScheme.onSurfaceVariant);
    }
    return ListTile(
      contentPadding: EdgeInsets.zero,
      enabled: !notPublic,
      onTap: notPublic ? null : part.locked ? onSignIn : onOpen,
      title: Text('${part.position}. ${part.title}', style: theme.textTheme.titleMedium!.copyWith(color: notPublic ? theme.colorScheme.onSurfaceVariant : null)),
      subtitle: Row(children: [
        if (part.hasAudio) ...[Icon(Icons.headphones, size: 13, color: theme.colorScheme.onSurfaceVariant), const SizedBox(width: 4)],
        Expanded(
          child: Text(
            notPublic
                ? s('work.scheduled', {'when': formatWhen(context, part.publicAt)})
                : part.locked
                    ? s('work.locked')
                    : '${s('common.readMinutes', {'count': part.readMinutes})}${part.likes != null ? ' · ♡ ${countLabel(context, part.likes)}' : ''}',
            style: muted,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ]),
      trailing: trailing,
    );
  }
}
