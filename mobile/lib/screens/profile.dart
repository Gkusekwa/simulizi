import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../app_state.dart';
import '../l10n/strings.dart';
import '../widgets/common.dart';
import 'auth.dart';

/// Profile + settings: language, text size, notification and privacy toggles,
/// offline copies, sign out. Writer tools stay on the web (doc 03).
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? raw;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    final app = context.read<AppState>();
    if (app.signedIn) raw = await app.loadMeRaw();
    if (mounted) setState(() {});
  }

  Future<void> patch(String key, bool v) async {
    final app = context.read<AppState>();
    setState(() => raw = {...?raw, key: v});
    try {
      await app.updateMe({key: v});
      raw = app.meRaw;
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      await load();
    }
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final app = context.watch<AppState>();
    final theme = Theme.of(context);
    final me = app.me;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
      children: [
        Row(children: [
          CircleAvatar(radius: 28, backgroundColor: theme.colorScheme.primaryContainer, child: Text((me?.displayName ?? '?').characters.first.toUpperCase(), style: TextStyle(fontSize: 22, color: theme.colorScheme.onPrimaryContainer, fontFamily: 'serif'))),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(me?.displayName ?? s('profile.guest'), style: theme.textTheme.headlineMedium!.copyWith(fontSize: 22)),
              Text(me != null ? '@${me.handle}${me.role != 'reader' ? ' · ${me.role}' : ''}' : s('profile.guestHint'), style: theme.textTheme.bodySmall),
            ]),
          ),
        ]),
        const SizedBox(height: 16),
        if (me == null) FilledButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AuthScreen())).then((_) => load()), child: Text(s('auth.signin'))),
        const SizedBox(height: 20),
        Eyebrow(s('settings.title')),
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(s('settings.language')),
          trailing: SegmentedButton<String>(
            segments: [ButtonSegment(value: 'sw', label: Text(s('common.language.sw'))), ButtonSegment(value: 'en', label: Text(s('common.language.en')))],
            selected: {app.lang},
            onSelectionChanged: (v) => app.setLang(v.first),
            showSelectedIcon: false,
          ),
        ),
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(s('settings.textSize')),
          subtitle: Slider(min: 14, max: 26, divisions: 6, value: app.fontSize, label: '${app.fontSize.round()}', onChanged: (v) => app.setFontSize(v)),
        ),
        if (me != null && raw != null) ...[
          SwitchListTile(contentPadding: EdgeInsets.zero, title: Text(s('settings.emailOnRelease')), value: raw!['emailOnRelease'] == true, onChanged: (v) => patch('emailOnRelease', v)),
          SwitchListTile(contentPadding: EdgeInsets.zero, title: Text(s('settings.pushOnRelease')), value: raw!['pushOnRelease'] == true, onChanged: (v) => patch('pushOnRelease', v)),
          SwitchListTile(contentPadding: EdgeInsets.zero, title: Text(s('settings.mature')), value: raw!['mature'] == true, onChanged: (v) => patch('mature', v)),
          SwitchListTile(contentPadding: EdgeInsets.zero, title: Text(s('settings.analyticsOptOut')), value: raw!['analyticsOptOut'] == true, onChanged: (v) => patch('analyticsOptOut', v)),
        ],
        const SizedBox(height: 16),
        Eyebrow(s('settings.offline')),
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.delete_outline),
          title: Text(s('settings.clearOffline')),
          onTap: () async {
            await app.db.wipe();
            if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s('settings.clearOffline'))));
          },
        ),
        const SizedBox(height: 16),
        Eyebrow(s('settings.about')),
        ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.public), title: Text(s('settings.web')), onTap: () => launchUrl(Uri.parse('https://simulizi.tzcom.cloud'), mode: LaunchMode.externalApplication)),
        ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.info_outline), title: Text(s('settings.version', {'v': '0.1.0'}))),
        if (me != null) ...[
          const SizedBox(height: 20),
          OutlinedButton.icon(onPressed: () => app.logout(), icon: const Icon(Icons.logout, size: 18), label: Text(s('auth.signout'))),
        ],
      ],
    );
  }
}
