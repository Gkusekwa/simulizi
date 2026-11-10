import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../l10n/strings.dart';
import '../models.dart';
import '../widgets/common.dart';
import 'auth.dart';
import 'work.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<AppNotification>? items;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    final app = context.read<AppState>();
    if (!app.signedIn) {
      setState(() => items = const []);
      return;
    }
    try {
      final j = await app.api.get('/notifications') as Map<String, dynamic>;
      items = (j['items'] as List).map((n) => AppNotification.fromJson(n as Map<String, dynamic>)).toList();
      app.unread = (j['unread'] as int?) ?? 0;
      error = null;
    } catch (_) {
      error = 'common.error';
    }
    if (mounted) setState(() {});
  }

  void open(AppNotification n) async {
    final app = context.read<AppState>();
    if (n.readAt == null) {
      try {
        await app.api.post('/notifications/${n.id}/read');
      } catch (_) {}
    }
    final m = RegExp(r'^/w/([^/]+)(?:/(\d+))?').firstMatch(n.link ?? '');
    if (m != null && mounted) {
      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => WorkScreen(slug: m.group(1)!, openPosition: m.group(2) != null ? int.parse(m.group(2)!) : null)));
    }
    load();
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final app = context.watch<AppState>();
    final theme = Theme.of(context);
    return RefreshIndicator(
      onRefresh: load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
        children: [
          Row(children: [
            Expanded(child: Text(s('notifications.title'), style: theme.textTheme.headlineMedium)),
            if (app.signedIn && app.unread > 0)
              TextButton(
                onPressed: () async {
                  await app.api.post('/notifications/read');
                  load();
                },
                child: Text(s('notifications.markAll')),
              ),
          ]),
          if (!app.signedIn)
            EmptyState(icon: Icons.notifications_none, title: s('profile.guest'), body: s('profile.guestHint'), action: FilledButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AuthScreen())).then((_) => load()), child: Text(s('auth.signin'))))
          else if (items == null)
            const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))
          else if (error != null)
            EmptyState(icon: Icons.error_outline, title: s(error!), action: OutlinedButton(onPressed: load, child: Text(s('common.retry'))))
          else if (items!.isEmpty)
            EmptyState(icon: Icons.notifications_none, title: s('notifications.empty'))
          else
            for (final n in items!)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(n.kind == 'release' ? Icons.auto_stories_outlined : Icons.info_outline, color: n.readAt == null ? theme.colorScheme.primary : theme.colorScheme.onSurfaceVariant),
                title: Text(n.title, style: theme.textTheme.titleMedium!.copyWith(fontWeight: n.readAt == null ? FontWeight.w600 : FontWeight.w400)),
                subtitle: Text('${n.body} · ${formatWhen(context, n.createdAt)}', style: theme.textTheme.bodySmall),
                onTap: () => open(n),
              ),
        ],
      ),
    );
  }
}
