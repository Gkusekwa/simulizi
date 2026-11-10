import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'api/client.dart';
import 'app_state.dart';
import 'l10n/strings.dart';
import 'screens/home.dart';
import 'screens/library.dart';
import 'screens/notifications.dart';
import 'screens/profile.dart';
import 'screens/search.dart';
import 'screens/work.dart';
import 'store/local_db.dart';
import 'theme.dart';
import 'widgets/orbit_nav.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final app = AppState(ApiClient.instance, LocalDb.instance);
  runApp(ChangeNotifierProvider.value(value: app, child: const SimuliziApp()));
  app.boot();
}

class SimuliziApp extends StatelessWidget {
  const SimuliziApp({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    return MaterialApp(
      title: 'Simulizi',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      locale: Locale(app.lang),
      supportedLocales: const [Locale('sw'), Locale('en')],
      localizationsDelegates: const [SDelegate(), GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
      onGenerateRoute: (settings) {
        // Deep links: /w/<slug>[/<position>] (same paths as the web).
        final m = RegExp(r'^/w/([^/]+)(?:/(\d+))?$').firstMatch(settings.name ?? '');
        if (m != null) {
          return MaterialPageRoute(builder: (_) => WorkScreen(slug: m.group(1)!, openPosition: m.group(2) != null ? int.parse(m.group(2)!) : null), settings: settings);
        }
        return MaterialPageRoute(builder: (_) => const Shell(), settings: settings);
      },
      home: app.booted ? const Shell() : const _Splash(),
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text('Simulizi', style: theme.textTheme.headlineMedium!.copyWith(fontSize: 34)),
          const SizedBox(height: 8),
          Text(S.of(context)('app.tagline'), style: theme.textTheme.bodySmall),
        ]),
      ),
    );
  }
}

/// Five destinations behind the orbit hub.
class Shell extends StatefulWidget {
  const Shell({super.key});
  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final app = context.watch<AppState>();
    final items = [
      OrbitItem(icon: Icons.home_outlined, label: s('nav.home')),
      OrbitItem(icon: Icons.search, label: s('nav.search')),
      OrbitItem(icon: Icons.local_library_outlined, label: s('nav.library')),
      OrbitItem(icon: Icons.notifications_none, label: s('nav.notifications'), badge: app.unread),
      OrbitItem(icon: Icons.person_outline, label: s('nav.profile')),
    ];
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: IndexedStack(index: index, children: const [HomeScreen(), SearchScreen(), LibraryScreen(), NotificationsScreen(), ProfileScreen()]),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: OrbitNav(items: items, index: index, onSelect: (i) => setState(() => index = i), menuLabel: s('nav.menu')),
    );
  }
}
