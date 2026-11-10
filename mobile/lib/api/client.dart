import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Thrown for any non-2xx answer. [code] carries the API's stable error code
/// (e.g. `account_required`), [status] 0 means no network.
class ApiException implements Exception {
  ApiException(this.status, this.message, {this.code});
  final int status;
  final String message;
  final String? code;
  bool get isNetwork => status == 0;
  @override
  String toString() => message;
}

/// Thin client for the Simulizi API: bearer token, one refresh on 401,
/// anonymous reader id for signed-out reads, and envelope unwrapping.
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  static const baseUrl = String.fromEnvironment('SIMULIZI_API', defaultValue: 'https://simulizi-api.tzcom.cloud/api');
  static const _kAccess = 'access';
  static const _kRefresh = 'refresh';
  static const _kAnon = 'anon_id';

  final _secure = const FlutterSecureStorage(aOptions: AndroidOptions());
  String? _access;
  String? _refresh;
  String? _anon;
  Future<bool>? _refreshing;

  Future<void> init() async {
    _access = await _secure.read(key: _kAccess);
    _refresh = await _secure.read(key: _kRefresh);
    final prefs = await SharedPreferences.getInstance();
    _anon = prefs.getString(_kAnon);
    if (_anon == null) {
      _anon = DateTime.now().microsecondsSinceEpoch.toRadixString(36) + (1e9 * (DateTime.now().millisecond / 1000)).toInt().toRadixString(36);
      await prefs.setString(_kAnon, _anon!);
    }
  }

  bool get signedIn => _access != null;

  Future<void> setTokens(String access, String refresh) async {
    _access = access;
    _refresh = refresh;
    await _secure.write(key: _kAccess, value: access);
    await _secure.write(key: _kRefresh, value: refresh);
  }

  Future<void> clearTokens() async {
    _access = null;
    _refresh = null;
    await _secure.delete(key: _kAccess);
    await _secure.delete(key: _kRefresh);
  }

  String? get refreshToken => _refresh;

  Future<bool> _tryRefresh() {
    if (_refresh == null) return Future.value(false);
    return _refreshing ??= () async {
      try {
        final res = await http.post(Uri.parse('$baseUrl/auth/refresh'),
            headers: {'Content-Type': 'application/json'}, body: jsonEncode({'refreshToken': _refresh}));
        if (res.statusCode != 200) return false;
        final data = jsonDecode(res.body)['data'] as Map<String, dynamic>;
        await setTokens(data['accessToken'] as String, data['refreshToken'] as String);
        return true;
      } catch (_) {
        return false;
      } finally {
        _refreshing = null;
      }
    }();
  }

  Future<dynamic> get(String path) => _send('GET', path);
  Future<dynamic> post(String path, [Object? body]) => _send('POST', path, body);
  Future<dynamic> put(String path, [Object? body]) => _send('PUT', path, body);
  Future<dynamic> patch(String path, [Object? body]) => _send('PATCH', path, body);
  Future<dynamic> delete(String path) => _send('DELETE', path);

  Future<dynamic> _send(String method, String path, [Object? body, bool retry = true]) async {
    final headers = <String, String>{'Accept': 'application/json', 'X-Anon-Id': _anon ?? 'app'};
    if (body != null) headers['Content-Type'] = 'application/json';
    if (_access != null) headers['Authorization'] = 'Bearer $_access';
    http.Response res;
    try {
      final req = http.Request(method, Uri.parse('$baseUrl$path'))..headers.addAll(headers);
      if (body != null) req.body = jsonEncode(body);
      res = await http.Response.fromStream(await req.send().timeout(const Duration(seconds: 25)));
    } catch (_) {
      throw ApiException(0, 'network');
    }
    if (res.statusCode == 401 && retry && _refresh != null && await _tryRefresh()) {
      return _send(method, path, body, false);
    }
    final decoded = res.body.isEmpty ? null : jsonDecode(res.body);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      if (res.statusCode == 401) await clearTokens();
      final err = decoded is Map ? decoded['error'] : null;
      final msg = err is Map ? err['message'] : null;
      throw ApiException(res.statusCode, msg is List ? msg.join(', ') : (msg?.toString() ?? 'HTTP ${res.statusCode}'),
          code: err is Map ? err['code']?.toString() : null);
    }
    return decoded is Map && decoded.containsKey('data') ? decoded['data'] : decoded;
  }
}
