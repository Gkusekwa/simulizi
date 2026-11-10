import 'package:flutter/foundation.dart';

import '../api/client.dart';
import '../store/local_db.dart';

/// Delta sync (doc 06): push the outbox of reading positions, then pull what
/// changed for followed works since the last cursor and store it for offline
/// reading. Best-effort: any failure leaves the local copy as it was.
class SyncService extends ChangeNotifier {
  SyncService(this._api, this._db);
  final ApiClient _api;
  final LocalDb _db;
  bool _running = false;
  DateTime? lastSync;
  String? lastError;

  bool get running => _running;

  Future<void> sync() async {
    if (_running || !_api.signedIn) return;
    _running = true;
    lastError = null;
    notifyListeners();
    try {
      await _pushOutbox();
      final since = await _db.meta('cursor');
      final data = await _api.get(since == null ? '/sync' : '/sync?since=${Uri.encodeComponent(since)}') as Map<String, dynamic>;
      final works = (data['works'] as List).cast<Map<String, dynamic>>();
      final partIdsByWork = <String, List<String>>{};
      for (final w in works) {
        final ids = (w['partIds'] as List).cast<String>();
        partIdsByWork[w['id'] as String] = ids;
        await _db.upsertWork(w, ids);
      }
      for (final p in (data['parts'] as List).cast<Map<String, dynamic>>()) {
        await _db.upsertPart(p);
      }
      for (final pr in (data['progress'] as List).cast<Map<String, dynamic>>()) {
        final local = await _db.progress(pr['partId'] as String);
        final remoteAt = DateTime.tryParse(pr['updatedAt'] as String);
        // Most recent wins (doc 06 conflicts).
        if (local == null || (remoteAt != null && (local.updatedAt == null || remoteAt.isAfter(local.updatedAt!)))) {
          await _db.saveProgress(pr['partId'] as String, pr['paragraphIndex'] as int, (pr['fraction'] as num).toDouble(), pr['finished'] as bool, dirty: false, at: remoteAt);
        }
      }
      await _db.reconcile(works.map((w) => w['id'] as String).toList(), partIdsByWork);
      await _db.setMeta('cursor', data['cursor'] as String);
      lastSync = DateTime.now();
    } on ApiException catch (e) {
      lastError = e.isNetwork ? 'network' : e.message;
    } catch (e) {
      lastError = e.toString();
    } finally {
      _running = false;
      notifyListeners();
    }
  }

  Future<void> _pushOutbox() async {
    final items = await _db.outbox();
    if (items.isEmpty) return;
    await _api.post('/sync/progress', {
      'items': items
          .map((r) => {
                'partId': r['partId'],
                'paragraphIndex': r['paragraphIndex'],
                'fraction': r['fraction'],
                'finished': (r['finished'] as int) == 1,
                'updatedAt': r['updatedAt'],
              })
          .toList(),
    });
    await _db.markSent(items.map((r) => r['partId'] as String).toList());
  }
}
