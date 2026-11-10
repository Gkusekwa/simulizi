import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../app_state.dart';
import '../l10n/strings.dart';

/// Sign in / create account. Reading never requires this screen; it is reached
/// from follow, like, members-only parts or the profile tab.
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  bool signup = false;
  bool busy = false;
  String? error;
  final email = TextEditingController();
  final password = TextEditingController();
  final handle = TextEditingController();
  final name = TextEditingController();
  final year = TextEditingController();

  @override
  void dispose() {
    for (final c in [email, password, handle, name, year]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> submit() async {
    final app = context.read<AppState>();
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (signup) {
        await app.register(email: email.text.trim(), password: password.text, handle: handle.text.trim().replaceFirst('@', ''), displayName: name.text.trim(), birthYear: int.tryParse(year.text.trim()) ?? 0);
      } else {
        await app.login(email.text.trim(), password.text);
      }
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      setState(() => error = e.isNetwork ? S.of(context)('errors.network') : e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
        children: [
          Text(s('auth.welcome'), style: theme.textTheme.headlineMedium),
          const SizedBox(height: 6),
          Text(s('auth.subtitle'), style: theme.textTheme.bodySmall),
          const SizedBox(height: 22),
          if (signup) ...[
            TextField(controller: name, decoration: InputDecoration(labelText: s('auth.displayName')), textCapitalization: TextCapitalization.words),
            const SizedBox(height: 12),
            TextField(controller: handle, decoration: InputDecoration(labelText: s('auth.handle')), autocorrect: false),
            const SizedBox(height: 12),
            TextField(controller: year, decoration: InputDecoration(labelText: s('auth.birthYear'), helperText: s('auth.ageNote')), keyboardType: TextInputType.number),
            const SizedBox(height: 12),
          ],
          TextField(controller: email, decoration: InputDecoration(labelText: s('auth.email')), keyboardType: TextInputType.emailAddress, autocorrect: false),
          const SizedBox(height: 12),
          TextField(controller: password, decoration: InputDecoration(labelText: s('auth.password')), obscureText: true, onSubmitted: (_) => busy ? null : submit()),
          if (error != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(error!, style: TextStyle(color: theme.colorScheme.error))),
          const SizedBox(height: 18),
          FilledButton(onPressed: busy ? null : submit, child: Text(busy ? s('common.loading') : signup ? s('auth.signup') : s('auth.signin'))),
          const SizedBox(height: 10),
          TextButton(
            onPressed: () => setState(() {
              signup = !signup;
              error = null;
            }),
            child: Text('${signup ? s('auth.haveAccount') : s('auth.newHere')} ${signup ? s('auth.signin') : s('auth.signup')}'),
          ),
          const SizedBox(height: 10),
          OutlinedButton(onPressed: () => Navigator.of(context).pop(false), child: Text(s('auth.browse'))),
        ],
      ),
    );
  }
}
