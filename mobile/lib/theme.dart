import 'package:flutter/material.dart';

/// Design tokens from the mockups (web/src/styles.css): paper and ink in light,
/// forest and cream in dark, one olive accent and a gold for stars.
class Tokens {
  Tokens._();
  static const paper = Color(0xFFFCFAF5);
  static const surface = Color(0xFFF1ECE2);
  static const line = Color(0xFFE7E1D7);
  static const ink = Color(0xFF302E27);
  static const muted = Color(0xFF5F6159);
  static const accent = Color(0xFF66734F);
  static const accentSoft = Color(0xFFE8EADF);
  static const gold = Color(0xFFB08D3E);
  static const danger = Color(0xFFA24A3A);

  static const darkBg = Color(0xFF191D1A);
  static const darkSurface = Color(0xFF292E29);
  static const darkLine = Color(0xFF3A4039);
  static const darkInk = Color(0xFFF4F0E7);
  static const darkMuted = Color(0xFFB7BAAE);
  static const darkAccent = Color(0xFFB7C394);
  static const darkAccentSoft = Color(0xFF343D30);
}

ThemeData buildTheme(Brightness b) {
  final dark = b == Brightness.dark;
  final scheme = ColorScheme(
    brightness: b,
    primary: dark ? Tokens.darkAccent : Tokens.accent,
    onPrimary: dark ? Tokens.darkBg : Colors.white,
    secondary: Tokens.gold,
    onSecondary: Colors.white,
    error: Tokens.danger,
    onError: Colors.white,
    surface: dark ? Tokens.darkBg : Tokens.paper,
    onSurface: dark ? Tokens.darkInk : Tokens.ink,
    surfaceContainerHighest: dark ? Tokens.darkSurface : Tokens.surface,
    onSurfaceVariant: dark ? Tokens.darkMuted : Tokens.muted,
    outline: dark ? Tokens.darkLine : Tokens.line,
    primaryContainer: dark ? Tokens.darkAccentSoft : Tokens.accentSoft,
    onPrimaryContainer: dark ? Tokens.darkAccent : Tokens.accent,
  );
  final base = ThemeData(colorScheme: scheme, useMaterial3: true, brightness: b);
  return base.copyWith(
    scaffoldBackgroundColor: scheme.surface,
    appBarTheme: AppBarTheme(backgroundColor: scheme.surface, foregroundColor: scheme.onSurface, elevation: 0, scrolledUnderElevation: 0, centerTitle: false,
        titleTextStyle: TextStyle(fontFamily: 'serif', fontSize: 22, fontWeight: FontWeight.w500, color: scheme.onSurface)),
    textTheme: base.textTheme.copyWith(
      headlineMedium: TextStyle(fontFamily: 'serif', fontSize: 26, fontWeight: FontWeight.w500, color: scheme.onSurface, height: 1.2),
      titleLarge: TextStyle(fontFamily: 'serif', fontSize: 20, fontWeight: FontWeight.w500, color: scheme.onSurface, height: 1.25),
      titleMedium: TextStyle(fontFamily: 'serif', fontSize: 17, fontWeight: FontWeight.w500, color: scheme.onSurface, height: 1.3),
      bodyMedium: TextStyle(fontSize: 14.5, color: scheme.onSurface, height: 1.45),
      bodySmall: TextStyle(fontSize: 12.5, color: scheme.onSurfaceVariant, height: 1.4),
      labelSmall: TextStyle(fontSize: 11, letterSpacing: 1.2, color: scheme.onSurfaceVariant, fontWeight: FontWeight.w600),
    ),
    cardTheme: CardThemeData(color: scheme.surfaceContainerHighest, elevation: 0, margin: EdgeInsets.zero, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
    dividerTheme: DividerThemeData(color: scheme.outline, thickness: 1, space: 1),
    chipTheme: base.chipTheme.copyWith(backgroundColor: scheme.surfaceContainerHighest, side: BorderSide(color: scheme.outline), labelStyle: TextStyle(fontSize: 12, color: scheme.onSurface), shape: const StadiumBorder()),
    filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(shape: const StadiumBorder(), padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12))),
    outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(shape: const StadiumBorder(), side: BorderSide(color: scheme.outline), foregroundColor: scheme.onSurface, padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12))),
    inputDecorationTheme: InputDecorationTheme(filled: true, fillColor: scheme.surfaceContainerHighest, border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: scheme.outline)), enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: scheme.outline)), focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: scheme.primary, width: 1.5))),
    snackBarTheme: SnackBarThemeData(behavior: SnackBarBehavior.floating, backgroundColor: scheme.onSurface, contentTextStyle: TextStyle(color: scheme.surface)),
  );
}

/// Deterministic placeholder cover colour (same hash as the web's coverClass).
Color coverColor(String key, Brightness b) {
  var h = 0;
  for (final ch in key.codeUnits) {
    h = (h * 31 + ch) & 0xFFFFFFFF;
  }
  const light = [Color(0xFF66734F), Color(0xFF8A6A3D), Color(0xFF4F6673), Color(0xFF73504F)];
  const dark = [Color(0xFF3F4A30), Color(0xFF5A4528), Color(0xFF30444F), Color(0xFF4A3332)];
  return (b == Brightness.dark ? dark : light)[h % 4];
}
