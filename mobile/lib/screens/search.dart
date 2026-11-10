import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../l10n/strings.dart';
import '../models.dart';
import '../widgets/common.dart';
import 'work.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});
  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final ctl = TextEditingController();
  Timer? debounce;
  List<WorkCard>? results;
  bool busy = false;

  @override
  void dispose() {
    debounce?.cancel();
    ctl.dispose();
    super.dispose();
  }

  void onChanged(String q) {
    debounce?.cancel();
    if (q.trim().length < 2) {
      setState(() => results = null);
      return;
    }
    debounce = Timer(const Duration(milliseconds: 350), () => run(q.trim()));
  }

  Future<void> run(String q) async {
    setState(() => busy = true);
    try {
      final j = await context.read<AppState>().api.get('/search?q=${Uri.encodeQueryComponent(q)}') as List;
      results = j.map((w) => WorkCard.fromJson(w as Map<String, dynamic>)).toList();
    } catch (_) {
      results = const [];
    }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
        child: TextField(
          controller: ctl,
          autofocus: false,
          textInputAction: TextInputAction.search,
          onChanged: onChanged,
          onSubmitted: (q) => run(q.trim()),
          decoration: InputDecoration(hintText: s('search.hint'), prefixIcon: const Icon(Icons.search), suffixIcon: busy ? const Padding(padding: EdgeInsets.all(12), child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))) : null),
        ),
      ),
      Expanded(
        child: results == null
            ? EmptyState(icon: Icons.search, title: s('search.start'))
            : results!.isEmpty
                ? EmptyState(icon: Icons.search_off, title: s('search.empty'))
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
                    children: [for (final w in results!) WorkRow(work: w, onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => WorkScreen(slug: w.slug))))],
                  ),
      ),
    ]);
  }
}
