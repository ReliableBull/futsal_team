import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'club/club_api.dart';
import 'club/club_manage.dart' show InviteScreen;
import 'club/shell.dart';
import 'core/api.dart';
import 'core/widgets.dart';
import 'features/browse.dart';
import 'features/settings.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Legacy ARENA website API (existing screens) and the separate club/booking
  // backend. Neither blocks startup on login.
  final legacy = ArenaApi();
  final club = ClubApi();
  await Future.wait([legacy.initialize(), club.initialize()]);
  runApp(ClubApp(api: club, legacy: legacy));
}

ThemeData arenaTheme() => ThemeData(
  useMaterial3: true,
  brightness: Brightness.dark,
  colorScheme: ColorScheme.fromSeed(
    seedColor: lime,
    brightness: Brightness.dark,
    surface: const Color(0xFF151C25),
  ),
  scaffoldBackgroundColor: const Color(0xFF0C1219),
  appBarTheme: const AppBarTheme(
    backgroundColor: Color(0xFF0C1219),
    centerTitle: false,
  ),
  cardTheme: CardThemeData(
    elevation: 0,
    color: const Color(0xFF18212C),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
  ),
  inputDecorationTheme: InputDecorationTheme(
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
  ),
  navigationBarTheme: const NavigationBarThemeData(
    backgroundColor: Color(0xFF151C25),
  ),
);

/// Multi-club app root. Opens on public browsing; `arenaclub://app/invite/<token>`
/// deep links (and the `/invite/<token>` route) open the invite screen.
class ClubApp extends StatelessWidget {
  const ClubApp({super.key, required this.api, required this.legacy});
  final ClubApi api;
  final ArenaApi legacy;
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'ARENA CLUB',
    debugShowCheckedModeBanner: false,
    locale: const Locale('ko'),
    supportedLocales: const [Locale('ko')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    theme: arenaTheme(),
    onGenerateInitialRoutes: (initial) => [
      MaterialPageRoute(builder: (_) => AppShell(api: api, legacy: legacy)),
      if (parseInvite(initial) case final token?)
        MaterialPageRoute(builder: (_) => InviteScreen(api, token)),
    ],
    onGenerateRoute: (settings) {
      final token = parseInvite(settings.name ?? '');
      if (token == null) return null;
      return MaterialPageRoute(builder: (_) => InviteScreen(api, token));
    },
  );
}

class ArenaApp extends StatelessWidget {
  const ArenaApp({super.key, required this.api});
  final ArenaApi api;
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'ARENA FC',
    debugShowCheckedModeBanner: false,
    locale: const Locale('ko'),
    supportedLocales: const [Locale('ko')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    theme: arenaTheme(),
    home: ListenableBuilder(
      listenable: api,
      builder: (context, _) => api.server == null
          ? ConnectionScreen(api)
          : ArenaShell(api, key: ValueKey(api.server.toString())),
    ),
  );
}

class ArenaShell extends StatefulWidget {
  const ArenaShell(this.api, {super.key});
  final ArenaApi api;
  @override
  State<ArenaShell> createState() => _ArenaShellState();
}

class _ArenaShellState extends State<ArenaShell> {
  int index = 0;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text(
        'ARENA FC',
        style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 2),
      ),
      actions: [
        IconButton(
          tooltip: '설정',
          onPressed: () => openPage(context, SettingsScreen(widget.api)),
          icon: const Icon(Icons.settings_outlined),
        ),
      ],
    ),
    body: SafeArea(
      child: [
        HomeScreen(widget.api),
        PlayersScreen(widget.api),
        MatchesScreen(widget.api),
        HallScreen(widget.api),
        AdminScreen(widget.api),
      ][index],
    ),
    bottomNavigationBar: NavigationBar(
      selectedIndex: index,
      onDestinationSelected: (i) => setState(() => index = i),
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.home_outlined),
          selectedIcon: Icon(Icons.home),
          label: '홈',
        ),
        NavigationDestination(
          icon: Icon(Icons.groups_outlined),
          selectedIcon: Icon(Icons.groups),
          label: '선수',
        ),
        NavigationDestination(icon: Icon(Icons.sports_soccer), label: '경기'),
        NavigationDestination(
          icon: Icon(Icons.emoji_events_outlined),
          selectedIcon: Icon(Icons.emoji_events),
          label: '명예의 전당',
        ),
        NavigationDestination(
          icon: Icon(Icons.admin_panel_settings_outlined),
          selectedIcon: Icon(Icons.admin_panel_settings),
          label: '관리',
        ),
      ],
    ),
  );
}
