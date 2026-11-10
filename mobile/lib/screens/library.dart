import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../app_state.dart';
import '../l10n/strings.dart';
import '../models.dart';
import '../widgets/common.dart';
import 'auth.dart';
import 'work.dart';

class LibraryScreen extends StatefulWidget {
  const LibraryScreen({super.key});
  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> {
  List<LibraryItem>? items;
  bool offline = false;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    final app = context.read<AppState>();
    if (!app.signedIn) {
      // Guests still see what they saved for offline.
      final works = await app.db.works();
      items = works.map((w) => LibraryItem(work: w)).toList();
      offline = false;
      if (mounted) setState(() {});
      return;
    }
    try {
      final j = await app.api.get('/library') as List;
      items = j.map((i) => LibraryItem.fromJson(i as Map<String, dynamic>)).toList();
      offline = false;
    } on ApiException catch (e) {
      if (!e.isNetwork) rethrow;
      final works = await app.db.works();
      final list = <LibraryItem>[];
      for (final w in works) {
        final progress = await app.db.progressOf(w.id);
        final parts = await app.db.partsOf(w.id);
        final finished = progress.values.where((p) => p.finished).length;
        list.add(LibraryItem(work: w, finishedParts: finished, totalParts: parts.length, done: parts.isNotEmpty && finished >= parts.length));
      }
      items = list;
      offline = true;
    }
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final app = context.watch<AppState>();
    final theme = Theme.of(context);
    if (items == null) return const Center(child: CircularProgressIndicator());
    final reading = items!.where((i) => !i.done).toList();
    final finished = items!.where((i) => i.done).toList();
    return RefreshIndicator(
      onRefresh: () async {
        await app.sync.sync();
        await load();
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
        children: [
          Row(children: [
            Expanded(child: Text(s('library.title'), style: theme.textTheme.headlineMedium)),
            if (app.signedIn)
              IconButton(
                tooltip: s('library.syncNow'),
                onPressed: app.sync.running
                    ? null
                    : () async {
                        await app.sync.sync();
                        await load();
                      },
                icon: app.sync.running ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.sync),
              ),
          ]),
          if (app.sync.lastSync != null) Text(s('library.synced', {'when': formatWhen(context, app.sync.lastSync)}), style: theme.textTheme.bodySmall),
          if (offline) const Padding(padding: EdgeInsets.only(top: 8), child: OfflineBanner()),
          if (!app.signedIn)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(s('library.signin'), style: theme.textTheme.bodyMedium),
                    const SizedBox(height: 10),
                    FilledButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AuthScreen())).then((_) => load()), child: Text(s('auth.signin'))),
                  ]),
                ),
              ),
            ),
          if (items!.isEmpty && app.signedIn) EmptyState(icon: Icons.local_library_outlined, title: s('library.empty')),
          if (reading.isNotEmpty) ...[
            const SizedBox(height: 16),
            Eyebrow(s('library.reading')),
            for (final i in reading)
              WorkRow(
                work: i.work,
                note: i.currentPosition != null
                    ? '${s('work.continueReading', {'n': i.currentPosition})}${i.unread > 0 ? ' · ${s('library.unread', {'count': i.unread})}' : ''}'
                    : i.unread > 0
                        ? s('library.unread', {'count': i.unread})
                        : null,
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => WorkScreen(slug: i.work.slug))).then((_) => load()),
              ),
          ],
          if (finished.isNotEmpty) ...[
            const SizedBox(height: 16),
            Eyebrow(s('library.finished')),
            for (final i in finished) WorkRow(work: i.work, onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => WorkScreen(slug: i.work.slug))).then((_) => load())),
          ],
        ],
      ),
    );
  }
}
