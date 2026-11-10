import 'dart:convert';

import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

import '../models.dart';

/// Offline store (doc 06): followed works, their public parts with text, the
/// reader's positions (with an outbox flag for unsent changes) and the sync cursor.
class LocalDb {
  LocalDb._();
  static final LocalDb instance = LocalDb._();
  Database? _db;

  Future<Database> get db async {
    if (_db != null) return _db!;
    final path = p.join(await getDatabasesPath(), 'simulizi.db');
    _db = await openDatabase(path, version: 1, onCreate: (d, _) async {
      await d.execute('CREATE TABLE works (id TEXT PRIMARY KEY, slug TEXT UNIQUE, json TEXT NOT NULL, partIds TEXT NOT NULL, updatedAt TEXT)');
      await d.execute('CREATE TABLE parts (id TEXT PRIMARY KEY, workId TEXT NOT NULL, position INTEGER NOT NULL, title TEXT NOT NULL, kind TEXT, readMinutes INTEGER, version INTEGER, publicAt TEXT, bodyJson TEXT, downloadedAt TEXT)');
      await d.execute('CREATE INDEX parts_work ON parts(workId, position)');
      await d.execute('CREATE TABLE progress (partId TEXT PRIMARY KEY, paragraphIndex INTEGER NOT NULL, fraction REAL NOT NULL, finished INTEGER NOT NULL, updatedAt TEXT NOT NULL, dirty INTEGER NOT NULL DEFAULT 0)');
      await d.execute('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT)');
    });
    return _db!;
  }

  Future<String?> meta(String key) async {
    final rows = await (await db).query('meta', where: 'key = ?', whereArgs: [key]);
    return rows.isEmpty ? null : rows.first['value'] as String?;
  }

  Future<void> setMeta(String key, String? value) async {
    final d = await db;
    if (value == null) {
      await d.delete('meta', where: 'key = ?', whereArgs: [key]);
    } else {
      await d.insert('meta', {'key': key, 'value': value}, conflictAlgorithm: ConflictAlgorithm.replace);
    }
  }

  // ------------------------------------------------------------------ works

  Future<void> upsertWork(Map<String, dynamic> work, List<String> partIds) async {
    await (await db).insert(
      'works',
      {'id': work['id'], 'slug': work['slug'], 'json': jsonEncode(work), 'partIds': jsonEncode(partIds), 'updatedAt': work['updatedAt']},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<WorkCard>> works() async {
    final rows = await (await db).query('works');
    return rows.map((r) => WorkCard.fromJson(jsonDecode(r['json'] as String) as Map<String, dynamic>)).toList();
  }

  Future<WorkCard?> work(String slug) async {
    final rows = await (await db).query('works', where: 'slug = ?', whereArgs: [slug]);
    return rows.isEmpty ? null : WorkCard.fromJson(jsonDecode(rows.first['json'] as String) as Map<String, dynamic>);
  }

  /// Drop works no longer followed and parts no longer readable.
  Future<void> reconcile(List<String> keepWorkIds, Map<String, List<String>> partIdsByWork) async {
    final d = await db;
    final batch = d.batch();
    if (keepWorkIds.isEmpty) {
      batch.delete('works');
      batch.delete('parts');
    } else {
      final q = List.filled(keepWorkIds.length, '?').join(',');
      batch.delete('works', where: 'id NOT IN ($q)', whereArgs: keepWorkIds);
      batch.delete('parts', where: 'workId NOT IN ($q)', whereArgs: keepWorkIds);
    }
    for (final e in partIdsByWork.entries) {
      if (e.value.isEmpty) {
        batch.delete('parts', where: 'workId = ?', whereArgs: [e.key]);
      } else {
        final q = List.filled(e.value.length, '?').join(',');
        batch.delete('parts', where: 'workId = ? AND id NOT IN ($q)', whereArgs: [e.key, ...e.value]);
      }
    }
    await batch.commit(noResult: true);
  }

  // ------------------------------------------------------------------ parts

  Future<void> upsertPart(Map<String, dynamic> part) async {
    await (await db).insert(
      'parts',
      {
        'id': part['id'],
        'workId': part['workId'],
        'position': part['position'],
        'title': part['title'],
        'kind': part['kind'],
        'readMinutes': part['readMinutes'],
        'version': part['version'],
        'publicAt': part['publicAt'],
        'bodyJson': part['bodyJson'] == null ? null : jsonEncode(part['bodyJson']),
        'downloadedAt': DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<Map<String, dynamic>>> partsOf(String workId) async {
    return (await db).query('parts', where: 'workId = ?', whereArgs: [workId], orderBy: 'position');
  }

  Future<Map<String, dynamic>?> part(String workId, int position) async {
    final rows = await (await db).query('parts', where: 'workId = ? AND position = ?', whereArgs: [workId, position]);
    return rows.isEmpty ? null : rows.first;
  }

  Future<int> downloadedCount(String workId) async {
    final r = await (await db).rawQuery('SELECT COUNT(*) c FROM parts WHERE workId = ? AND bodyJson IS NOT NULL', [workId]);
    return (r.first['c'] as int?) ?? 0;
  }

  // --------------------------------------------------------------- progress

  Future<void> saveProgress(String partId, int paragraphIndex, double fraction, bool finished, {bool dirty = true, DateTime? at}) async {
    await (await db).insert(
      'progress',
      {'partId': partId, 'paragraphIndex': paragraphIndex, 'fraction': fraction, 'finished': finished ? 1 : 0, 'updatedAt': (at ?? DateTime.now()).toUtc().toIso8601String(), 'dirty': dirty ? 1 : 0},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<Progress?> progress(String partId) async {
    final rows = await (await db).query('progress', where: 'partId = ?', whereArgs: [partId]);
    if (rows.isEmpty) return null;
    final r = rows.first;
    return Progress(paragraphIndex: r['paragraphIndex'] as int, fraction: (r['fraction'] as num).toDouble(), finished: (r['finished'] as int) == 1, updatedAt: DateTime.tryParse(r['updatedAt'] as String));
  }

  Future<Map<String, Progress>> progressOf(String workId) async {
    final rows = await (await db).rawQuery('SELECT p.* FROM progress p JOIN parts x ON x.id = p.partId WHERE x.workId = ?', [workId]);
    return {for (final r in rows) r['partId'] as String: Progress(paragraphIndex: r['paragraphIndex'] as int, fraction: (r['fraction'] as num).toDouble(), finished: (r['finished'] as int) == 1, updatedAt: DateTime.tryParse(r['updatedAt'] as String))};
  }

  Future<List<Map<String, dynamic>>> outbox() async {
    return (await db).query('progress', where: 'dirty = 1');
  }

  Future<void> markSent(List<String> partIds) async {
    if (partIds.isEmpty) return;
    final q = List.filled(partIds.length, '?').join(',');
    await (await db).update('progress', {'dirty': 0}, where: 'partId IN ($q)', whereArgs: partIds);
  }

  Future<void> wipe() async {
    final d = await db;
    await d.delete('works');
    await d.delete('parts');
    await d.delete('progress');
    await d.delete('meta');
  }
}
