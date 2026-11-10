import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../api/client.dart';
import '../models.dart';
import '../store/local_db.dart';

/// Reading data with an offline fallback: network first, saved copy second.
class Repo {
  Repo(this.api, this.db);
  final ApiClient api;
  final LocalDb db;

  Future<({WorkPage page, bool offline})> work(String slug) async {
    try {
      final j = await api.get('/works/$slug') as Map<String, dynamic>;
      return (page: WorkPage.fromJson(j), offline: false);
    } on ApiException catch (e) {
      if (!e.isNetwork) rethrow;
      final w = await db.work(slug);
      if (w == null) rethrow;
      final rows = await db.partsOf(w.id);
      final progress = await db.progressOf(w.id);
      final parts = rows
          .map((r) => PartSummary(
                id: r['id'] as String,
                workId: w.id,
                position: r['position'] as int,
                title: r['title'] as String,
                kind: (r['kind'] as String?) ?? 'chapter',
                state: 'public',
                readMinutes: (r['readMinutes'] as int?) ?? 1,
                version: (r['version'] as int?) ?? 0,
                publicAt: r['publicAt'] != null ? DateTime.tryParse(r['publicAt'] as String) : null,
                progress: progress[r['id']],
              ))
          .toList();
      return (page: WorkPage(work: w, parts: parts, following: true, liked: false, likes: '', readers: '', followers: '', stars: const {}, isOwner: false), offline: true);
    }
  }

  Future<({PartPage page, bool offline})> part(String slug, int position) async {
    try {
      final j = await api.get('/works/$slug/parts/$position') as Map<String, dynamic>;
      final page = PartPage.fromJson(j);
      // Keep a copy of what was read, so the chapter opens offline later.
      final w = await db.work(slug);
      if (w != null && page.bodyJson != null) {
        await db.upsertPart({
          'id': page.part.id,
          'workId': w.id,
          'position': page.part.position,
          'title': page.part.title,
          'kind': page.part.kind,
          'readMinutes': page.part.readMinutes,
          'version': page.part.version,
          'publicAt': page.part.publicAt?.toIso8601String(),
          'bodyJson': page.bodyJson,
        });
      }
      return (page: page, offline: false);
    } on ApiException catch (e) {
      if (!e.isNetwork) rethrow;
      final w = await db.work(slug);
      if (w == null) rethrow;
      final r = await db.part(w.id, position);
      if (r == null || r['bodyJson'] == null) rethrow;
      final rows = await db.partsOf(w.id);
      final idx = rows.indexWhere((x) => x['position'] == position);
      final next = idx >= 0 && idx + 1 < rows.length ? rows[idx + 1] : null;
      final prev = idx > 0 ? rows[idx - 1] : null;
      final part = PartSummary(
        id: r['id'] as String,
        workId: w.id,
        position: position,
        title: r['title'] as String,
        kind: (r['kind'] as String?) ?? 'chapter',
        state: 'public',
        readMinutes: (r['readMinutes'] as int?) ?? 1,
        version: (r['version'] as int?) ?? 0,
      );
      return (
        page: PartPage(
          part: part,
          workTitle: w.title,
          workSlug: w.slug,
          workKind: w.kind,
          ownerName: w.ownerName,
          language: w.language,
          bodyJson: _decode(r['bodyJson']),
          prevPosition: prev?['position'] as int?,
          next: next == null ? null : {'position': next['position'], 'title': next['title'], 'state': 'public'},
          progress: await db.progress(part.id),
        ),
        offline: true
      );
    }
  }

  Map<String, dynamic>? _decode(Object? v) {
    if (v == null) return null;
    if (v is Map<String, dynamic>) return v;
    try {
      return Map<String, dynamic>.from(jsonDecode(v as String) as Map);
    } catch (_) {
      return null;
    }
  }

  /// Record a reading position locally (outbox) and, when possible, remotely.
  Future<void> saveProgress(String partId, int paragraphIndex, double fraction, bool finished) async {
    await db.saveProgress(partId, paragraphIndex, fraction, finished);
    if (!api.signedIn) return;
    try {
      await api.put('/parts/$partId/progress', {'paragraphIndex': paragraphIndex, 'fraction': fraction, 'finished': finished});
      await db.markSent([partId]);
    } catch (e) {
      debugPrint('progress kept in outbox: $e');
    }
  }

  /// Download every readable public part of a work for offline reading.
  Future<int> download(WorkPage page, void Function(int done, int total) onStep) async {
    await db.upsertWork(page.work.toJson(), page.parts.where((p) => p.state == 'public').map((p) => p.id).toList());
    final readable = page.parts.where((p) => p.state == 'public' && !p.locked).toList();
    var done = 0;
    for (final p in readable) {
      try {
        final j = await api.get('/works/${page.work.slug}/parts/${p.position}') as Map<String, dynamic>;
        final body = (j['part'] as Map<String, dynamic>)['bodyJson'];
        await db.upsertPart({...(j['part'] as Map<String, dynamic>), 'workId': page.work.id, 'bodyJson': body});
        done++;
        onStep(done, readable.length);
      } catch (_) {}
    }
    return done;
  }
}
