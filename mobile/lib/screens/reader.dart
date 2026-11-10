import 'dart:async';

import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../api/client.dart';
import '../app_state.dart';
import '../content/renderer.dart';
import '../l10n/strings.dart';
import '../models.dart';
import '../services/repo.dart';
import '../widgets/common.dart';
import 'auth.dart';

/// The chapter / poem reader: native ProseMirror rendering, reading position
/// (first visible paragraph + fraction) saved locally and to the API, optional
/// narration player for book parts, like, prev/next.
class ReaderScreen extends StatefulWidget {
  const ReaderScreen({super.key, required this.slug, required this.position});
  final String slug;
  final int position;
  @override
  State<ReaderScreen> createState() => _ReaderScreenState();
}

class _ReaderScreenState extends State<ReaderScreen> {
  PartPage? page;
  bool offline = false;
  ApiException? error;
  final scroll = ScrollController();
  final keys = <int, GlobalKey>{};
  Timer? debounce;
  String lastSaved = '';
  double fraction = 0;
  bool liked = false;
  AudioPlayer? player;
  String? audioError;

  Repo get repo {
    final app = context.read<AppState>();
    return Repo(app.api, app.db);
  }

  @override
  void initState() {
    super.initState();
    scroll.addListener(onScroll);
    load();
  }

  @override
  void dispose() {
    debounce?.cancel();
    scroll.dispose();
    player?.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final r = await repo.part(widget.slug, widget.position);
      page = r.page;
      offline = r.offline;
      liked = page!.liked;
      error = null;
      // Local progress may be newer than the server's (offline reading).
      if (!mounted) return;
      final local = await context.read<AppState>().db.progress(page!.part.id);
      final remote = page!.progress;
      final use = local != null && (remote == null || (local.updatedAt != null && remote.updatedAt != null && local.updatedAt!.isAfter(remote.updatedAt!))) ? local : remote;
      if (mounted) setState(() {});
      if (use != null && use.paragraphIndex > 0 && !use.finished) {
        WidgetsBinding.instance.addPostFrameCallback((_) => restore(use.paragraphIndex));
      }
      if (page!.hasAudio && !offline) unawaited(loadAudio());
    } on ApiException catch (e) {
      error = e;
      if (mounted) setState(() {});
    }
  }

  Future<void> loadAudio() async {
    try {
      final j = await context.read<AppState>().api.get('/works/${widget.slug}/parts/${widget.position}/audio') as Map<String, dynamic>;
      final p = AudioPlayer();
      await p.setUrl(j['url'] as String);
      player = p;
    } catch (e) {
      audioError = e.toString();
    }
    if (mounted) setState(() {});
  }

  void restore(int paragraph) {
    final k = keys[paragraph];
    final ctx = k?.currentContext;
    if (ctx != null) Scrollable.ensureVisible(ctx, alignment: 0.02);
  }

  void onScroll() {
    if (page == null || !scroll.hasClients) return;
    final max = scroll.position.maxScrollExtent;
    fraction = max > 0 ? (scroll.offset / max).clamp(0.0, 1.0) : 1.0;
    // First paragraph whose top is at or below the viewport top.
    var idx = 0;
    final topInset = MediaQuery.of(context).padding.top + kToolbarHeight;
    for (final e in keys.entries) {
      final ctx = e.value.currentContext;
      if (ctx == null) continue;
      final box = ctx.findRenderObject() as RenderBox?;
      if (box == null || !box.attached) continue;
      final y = box.localToGlobal(Offset.zero).dy;
      if (y <= topInset + 24) idx = e.key > idx ? e.key : idx;
    }
    final finished = fraction > 0.95;
    final key = '$idx:$finished';
    setState(() {});
    if (key == lastSaved) return;
    debounce?.cancel();
    debounce = Timer(const Duration(milliseconds: 1200), () {
      lastSaved = key;
      repo.saveProgress(page!.part.id, idx, fraction, finished);
    });
  }

  Future<void> toggleLike() async {
    final app = context.read<AppState>();
    if (!app.signedIn) {
      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AuthScreen()));
      return;
    }
    try {
      await (liked ? app.api.delete('/parts/${page!.part.id}/like') : app.api.put('/parts/${page!.part.id}/like'));
      setState(() => liked = !liked);
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  void go(int position) => Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => ReaderScreen(slug: widget.slug, position: position)));

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final app = context.watch<AppState>();
    final theme = Theme.of(context);
    if (page == null) {
      Widget body;
      if (error == null) {
        body = const Center(child: CircularProgressIndicator());
      } else if (error!.status == 401 && error!.code == 'account_required') {
        body = EmptyState(
          icon: Icons.lock_outline,
          title: s('reader.accountRequired'),
          body: s('reader.accountRequiredHint'),
          action: FilledButton(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AuthScreen())).then((_) => load()),
            child: Text(s('auth.signin')),
          ),
        );
      } else {
        body = EmptyState(icon: Icons.error_outline, title: error!.isNetwork ? s('errors.network') : error!.status == 404 || error!.status == 403 ? error!.message : s('common.error'), action: OutlinedButton(onPressed: load, child: Text(s('common.retry'))));
      }
      return Scaffold(appBar: AppBar(), body: body);
    }
    final p = page!;
    final isPoem = p.part.kind == 'poem';
    final next = p.next;
    return Scaffold(
      appBar: AppBar(
        title: Text(p.workTitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.textTheme.titleMedium),
        actions: [
          IconButton(
            tooltip: s('reader.textSize'),
            icon: const Icon(Icons.text_fields),
            onPressed: () {
              const sizes = [16.0, 18.0, 20.0, 23.0];
              final i = sizes.indexWhere((x) => x > app.fontSize);
              app.setFontSize(i < 0 ? sizes.first : sizes[i]);
            },
          ),
          IconButton(
            icon: const Icon(Icons.share_outlined),
            onPressed: () => SharePlus.instance.share(ShareParams(text: '${p.workTitle} · ${p.part.title}\nhttps://simulizi.tzcom.cloud/w/${widget.slug}/${widget.position}')),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(3),
          child: LinearProgressIndicator(value: fraction, minHeight: 3, backgroundColor: Colors.transparent, color: theme.colorScheme.primary),
        ),
      ),
      body: Column(children: [
        if (offline) const OfflineBanner(),
        Expanded(
          child: ListView(
            controller: scroll,
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 48),
            children: [
              Eyebrow('${p.ownerName}${p.workKind == 'book_collection' ? ' · ${s('work.volume', {'n': p.part.volume})}' : ''}'),
              const SizedBox(height: 6),
              Text(isPoem ? p.part.title : '${s('reader.part', {'n': p.part.position})} · ${p.part.title}', style: theme.textTheme.headlineMedium!.copyWith(fontSize: 24)),
              const SizedBox(height: 4),
              Text(isPoem ? s('reader.stanzas', {'count': _stanzas(p.bodyJson)}) : s('common.readMinutes', {'count': p.part.readMinutes}), style: theme.textTheme.bodySmall),
              if (p.hasAudio && !offline) ...[const SizedBox(height: 14), _AudioBar(player: player, error: audioError)],
              const SizedBox(height: 22),
              PartRenderer(doc: p.bodyJson, fontSize: app.fontSize, paragraphKeys: keys),
              const SizedBox(height: 24),
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                OutlinedButton.icon(onPressed: offline ? null : toggleLike, icon: Icon(liked ? Icons.favorite : Icons.favorite_border, size: 18), label: Text(liked ? s('work.liked') : s('work.like'))),
              ]),
              const SizedBox(height: 20),
              if (next != null)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  onTap: next['state'] == 'public' ? () => go(next['position'] as int) : null,
                  title: Text('${s('reader.nextPart')} · ${next['position']}. ${next['title']}', style: theme.textTheme.titleMedium),
                  subtitle: next['state'] != 'public' ? Text(s('reader.comesOut', {'when': formatWhen(context, DateTime.tryParse((next['publicAt'] as String?) ?? ''))}), style: theme.textTheme.bodySmall) : null,
                  trailing: const Icon(Icons.chevron_right),
                ),
              if (p.prevPosition != null)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  onTap: () => go(p.prevPosition!),
                  leading: const Icon(Icons.chevron_left),
                  title: Text('${s('reader.prevPart')} · ${p.prevPosition}', style: theme.textTheme.titleMedium),
                ),
              if (!app.signedIn) ...[
                const SizedBox(height: 16),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(children: [
                      Expanded(child: Text(s('reader.guestBar'), style: theme.textTheme.bodySmall)),
                      TextButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AuthScreen())), child: Text(s('auth.signin'))),
                    ]),
                  ),
                ),
              ],
            ],
          ),
        ),
      ]),
    );
  }

  int _stanzas(Map<String, dynamic>? doc) {
    var n = 0;
    for (final node in (doc?['content'] as List?) ?? const []) {
      if ((node as Map)['type'] == 'poem') n += ((node['content'] as List?) ?? const []).length;
    }
    return n;
  }
}

/// Play/pause, seek bar, speed. Streams from the presigned URL; nothing is
/// stored on the device.
class _AudioBar extends StatelessWidget {
  const _AudioBar({required this.player, required this.error});
  final AudioPlayer? player;
  final String? error;

  String fmt(Duration d) => '${d.inMinutes}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final theme = Theme.of(context);
    final p = player;
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 6, 12, 6),
        child: p == null
            ? Row(children: [
                const SizedBox(width: 8),
                Icon(Icons.headphones, size: 18, color: theme.colorScheme.onSurfaceVariant),
                const SizedBox(width: 10),
                Expanded(child: Text(error != null ? s('reader.audioUnavailable') : s('common.loading'), style: theme.textTheme.bodySmall)),
              ])
            : StreamBuilder<PlayerState>(
                stream: p.playerStateStream,
                builder: (_, st) {
                  final playing = st.data?.playing ?? false;
                  final done = st.data?.processingState == ProcessingState.completed;
                  return Row(children: [
                    IconButton(
                      iconSize: 32,
                      tooltip: s('reader.listen'),
                      icon: Icon(playing && !done ? Icons.pause_circle_filled : Icons.play_circle_fill, color: theme.colorScheme.primary),
                      onPressed: () => done ? p.seek(Duration.zero).then((_) => p.play()) : playing ? p.pause() : p.play(),
                    ),
                    Expanded(
                      child: StreamBuilder<Duration>(
                        stream: p.positionStream,
                        builder: (_, pos) {
                          final total = p.duration ?? Duration.zero;
                          final cur = pos.data ?? Duration.zero;
                          return Column(mainAxisSize: MainAxisSize.min, children: [
                            SliderTheme(
                              data: SliderTheme.of(context).copyWith(trackHeight: 2, thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6), overlayShape: SliderComponentShape.noOverlay),
                              child: Slider(
                                value: total.inMilliseconds > 0 ? cur.inMilliseconds.clamp(0, total.inMilliseconds).toDouble() : 0,
                                max: total.inMilliseconds > 0 ? total.inMilliseconds.toDouble() : 1,
                                onChanged: total.inMilliseconds > 0 ? (v) => p.seek(Duration(milliseconds: v.round())) : null,
                              ),
                            ),
                            Text('${fmt(cur)} / ${fmt(total)}', style: theme.textTheme.bodySmall),
                          ]);
                        },
                      ),
                    ),
                    StreamBuilder<double>(
                      stream: p.speedStream,
                      builder: (_, sp) => TextButton(
                        onPressed: () {
                          const speeds = [1.0, 1.25, 1.5, 0.8];
                          final i = speeds.indexOf(sp.data ?? 1.0);
                          p.setSpeed(speeds[(i + 1) % speeds.length]);
                        },
                        child: Text('${(sp.data ?? 1.0).toStringAsFixed(2).replaceAll(RegExp(r'0+$'), '').replaceAll(RegExp(r'\.$'), '')}×'),
                      ),
                    ),
                  ]);
                },
              ),
      ),
    );
  }
}
