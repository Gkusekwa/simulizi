import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../app_state.dart';
import '../l10n/strings.dart';
import '../models.dart';
import '../widgets/common.dart';
import 'work.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<WorkCard>? latest;
  List<WorkCard>? trending;
  List<LibraryItem> reading = const [];
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    final app = context.read<AppState>();
    setState(() => error = null);
    try {
      final j = await app.api.get('/discover') as Map<String, dynamic>;
      latest = (j['latest'] as List).map((w) => WorkCard.fromJson(w as Map<String, dynamic>)).toList();
      trending = (j['trending'] as List).map((w) => WorkCard.fromJson(w as Map<String, dynamic>)).toList();
      if (app.signedIn) {
        final lib = await app.api.get('/library') as List;
        reading = lib.map((i) => LibraryItem.fromJson(i as Map<String, dynamic>)).where((i) => i.currentPosition != null && !i.done).take(5).toList();
      }
    } on ApiException catch (e) {
      error = e.isNetwork ? 'errors.network' : 'common.error';
      if (latest == null) {
        // Offline: show what is saved.
        final saved = await app.db.works();
        latest = saved;
        trending = const [];
      }
    }
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final app = context.watch<AppState>();
    final theme = Theme.of(context);
    void open(WorkCard w, [int? pos]) => Navigator.of(context).push(MaterialPageRoute(builder: (_) => pos == null ? WorkScreen(slug: w.slug) : WorkScreen(slug: w.slug, openPosition: pos)));
    return RefreshIndicator(
      onRefresh: load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
        children: [
          Eyebrow(app.me != null ? '${s('home.greeting')}, ${app.me!.displayName}' : s('app.tagline')),
          const SizedBox(height: 4),
          Text(s('app.name'), style: theme.textTheme.headlineMedium),
          if (error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(s(error!), style: theme.textTheme.bodySmall!.copyWith(color: theme.colorScheme.error))),
          if (latest == null) const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator())),
          if (reading.isNotEmpty) ...[
            const SizedBox(height: 18),
            Eyebrow(s('home.continue')),
            SizedBox(
              height: 150,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(vertical: 8),
                itemCount: reading.length,
                separatorBuilder: (_, _) => const SizedBox(width: 10),
                itemBuilder: (_, i) {
                  final it = reading[i];
                  return InkWell(
                    onTap: () => open(it.work, it.currentPosition),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      width: 240,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: theme.colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(12)),
                      child: Row(children: [
                        Cover(work: it.work, width: 56, height: 78),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                            Text(it.work.title, style: theme.textTheme.titleMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
                            const SizedBox(height: 4),
                            Text(s('work.continueReading', {'n': it.currentPosition}), style: theme.textTheme.bodySmall!.copyWith(color: theme.colorScheme.primary)),
                            if (it.unread > 0) Text(s('library.unread', {'count': it.unread}), style: theme.textTheme.bodySmall),
                          ]),
                        ),
                      ]),
                    ),
                  );
                },
              ),
            ),
          ],
          if (trending != null && trending!.isNotEmpty) ...[
            const SizedBox(height: 18),
            Eyebrow(s('home.trending')),
            SizedBox(
              height: 170,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(vertical: 8),
                itemCount: trending!.length,
                separatorBuilder: (_, _) => const SizedBox(width: 12),
                itemBuilder: (_, i) {
                  final w = trending![i];
                  return InkWell(
                    onTap: () => open(w),
                    child: SizedBox(
                      width: 96,
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Cover(work: w, width: 96, height: 128),
                        const SizedBox(height: 4),
                        Text(w.title, style: theme.textTheme.bodySmall!.copyWith(color: theme.colorScheme.onSurface), maxLines: 1, overflow: TextOverflow.ellipsis),
                      ]),
                    ),
                  );
                },
              ),
            ),
          ],
          if (latest != null) ...[
            const SizedBox(height: 18),
            Eyebrow(s('home.latest')),
            if (latest!.isEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Text(s('home.empty'), style: theme.textTheme.bodySmall)),
            for (final w in latest!) WorkRow(work: w, note: w.lastPublicAt != null ? formatWhen(context, w.lastPublicAt) : null, onTap: () => open(w)),
          ],
        ],
      ),
    );
  }
}
