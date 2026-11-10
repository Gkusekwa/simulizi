import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api/client.dart';
import 'models.dart';
import 'services/sync.dart';
import 'store/local_db.dart';

/// Session, UI language, reader font size and the sync service.
class AppState extends ChangeNotifier {
  AppState(this.api, this.db) : sync = SyncService(api, db);
  final ApiClient api;
  final LocalDb db;
  final SyncService sync;

  Me? me;
  String lang = 'sw';
  double fontSize = 18;
  int unread = 0;
  bool booted = false;

  bool get signedIn => me != null;

  Future<void> boot() async {
    await api.init();
    final prefs = await SharedPreferences.getInstance();
    lang = prefs.getString('lang') ?? 'sw';
    fontSize = prefs.getDouble('fontSize') ?? 18;
    if (api.signedIn) {
      await refreshMe();
      // Fire and forget: offline copies refresh in the background.
      unawaited(sync.sync());
    }
    booted = true;
    notifyListeners();
  }

  Future<void> refreshMe() async {
    try {
      final j = await api.get('/me') as Map<String, dynamic>;
      me = Me.fromJson(j);
      final prefs = await SharedPreferences.getInstance();
      if (prefs.getString('lang') == null && me!.uiLanguage != lang) {
        lang = me!.uiLanguage;
      }
      unawaited(refreshUnread());
    } on ApiException catch (e) {
      if (!e.isNetwork) me = null;
    }
    notifyListeners();
  }

  Future<void> refreshUnread() async {
    if (!api.signedIn) return;
    try {
      final j = await api.get('/notifications') as Map<String, dynamic>;
      unread = (j['unread'] as int?) ?? 0;
      notifyListeners();
    } catch (_) {}
  }

  Future<void> login(String email, String password) async {
    final j = await api.post('/auth/login', {'email': email, 'password': password}) as Map<String, dynamic>;
    await api.setTokens(j['accessToken'] as String, j['refreshToken'] as String);
    me = Me.fromJson(j['user'] as Map<String, dynamic>);
    notifyListeners();
    unawaited(sync.sync());
    unawaited(refreshUnread());
  }

  Future<void> register({required String email, required String password, required String handle, required String displayName, required int birthYear}) async {
    final j = await api.post('/auth/register', {'email': email, 'password': password, 'handle': handle, 'displayName': displayName, 'birthYear': birthYear, 'uiLanguage': lang}) as Map<String, dynamic>;
    await api.setTokens(j['accessToken'] as String, j['refreshToken'] as String);
    me = Me.fromJson(j['user'] as Map<String, dynamic>);
    notifyListeners();
  }

  Future<void> logout() async {
    final rt = api.refreshToken;
    if (rt != null) {
      try {
        await api.post('/auth/logout', {'refreshToken': rt});
      } catch (_) {}
    }
    await api.clearTokens();
    await db.wipe();
    me = null;
    unread = 0;
    notifyListeners();
  }

  Future<void> setLang(String l) async {
    lang = l;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('lang', l);
    if (signedIn) {
      try {
        await api.patch('/me', {'uiLanguage': l});
      } catch (_) {}
    }
  }

  Future<void> setFontSize(double v) async {
    fontSize = v;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble('fontSize', v);
  }

  Future<void> updateMe(Map<String, dynamic> patch) async {
    final j = await api.patch('/me', patch) as Map<String, dynamic>;
    me = Me.fromJson(j);
    _meRaw = j;
    notifyListeners();
  }

  Map<String, dynamic>? _meRaw;
  Map<String, dynamic>? get meRaw => _meRaw;
  Future<Map<String, dynamic>?> loadMeRaw() async {
    try {
      _meRaw = await api.get('/me') as Map<String, dynamic>;
    } catch (_) {}
    return _meRaw;
  }
}

void unawaited(Future<void> f) {}
