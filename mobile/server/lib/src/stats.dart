/// Pure aggregation rules shared by every list, detail, card, ranking and
/// hall-of-fame response, so numbers cannot drift between screens.
///
/// Rules (ported from ARENA's web code and made consistent):
/// * Only `completed` matches with both scores recorded count. Scheduled,
///   in-progress and cancelled matches never count (not even as draws).
/// * The result of an appearance comes from the team scores.
/// * Win rate = wins / completed appearances; draws stay in the denominator.
/// * Streaks walk the player's own completed appearances in (date, id) order.
///   Missing a match does not break a streak; playing without meeting the
///   condition does. Multiple goals in one match count as one streak match.
/// * Rankings use competition ranking (1, 1, 3) and keep ties together.
library;

import 'db.dart';
import 'http.dart';

class StatGoal {
  const StatGoal(this.scorerId, this.assistId, this.assistKnown);
  final int scorerId;
  final int? assistId;
  final bool assistKnown;
}

class StatLine {
  const StatLine(this.playerId, this.team, this.goals, this.assists, this.mom);
  final int playerId;
  final String team; // 'A' or 'B'
  final int goals;
  final int assists;
  final bool mom;
}

class StatMatch {
  StatMatch({
    required this.id,
    required this.date,
    required this.status,
    required this.teamAName,
    required this.teamBName,
    required this.scoreA,
    required this.scoreB,
    required this.lines,
    this.goals = const [],
  });
  final int id;
  final String date;
  final String status;
  final String teamAName;
  final String teamBName;
  final int? scoreA;
  final int? scoreB;
  final List<StatLine> lines;
  final List<StatGoal> goals;

  bool get countsForStats =>
      status == 'completed' && scoreA != null && scoreB != null;

  String resultFor(String team) {
    final mine = team == 'A' ? scoreA! : scoreB!;
    final other = team == 'A' ? scoreB! : scoreA!;
    return mine > other ? 'W' : (mine < other ? 'L' : 'D');
  }
}

class StatPlayer {
  const StatPlayer(this.id, this.name, this.nickname, this.active, this.guest,
      [this.extra = const {}]);
  final int id;
  final String name;
  final String? nickname;
  final bool active;
  final bool guest;
  final Json extra;
  Json toJson() => {
        'id': id,
        'name': name,
        'nickname': nickname,
        'isActive': active,
        'isGuest': guest,
        ...extra,
      };
}

class Appearance {
  Appearance(this.match, this.line) : result = match.resultFor(line.team);
  final StatMatch match;
  final StatLine line;
  final String result;
  Json toJson() => {
        'matchId': match.id,
        'matchDate': match.date,
        'team': line.team,
        'teamName': line.team == 'A' ? match.teamAName : match.teamBName,
        'opponentName': line.team == 'A' ? match.teamBName : match.teamAName,
        'teamScore': line.team == 'A' ? match.scoreA : match.scoreB,
        'opponentScore': line.team == 'A' ? match.scoreB : match.scoreA,
        'result': result,
        'goals': line.goals,
        'assists': line.assists,
        'isMom': line.mom,
      };
}

int _chrono(Appearance a, Appearance b) {
  final d = a.match.date.compareTo(b.match.date);
  return d != 0 ? d : a.match.id - b.match.id;
}

List<StatMatch> countedMatches(Iterable<StatMatch> matches, Period period) =>
    matches.where((m) => m.countsForStats && period.contains(m.date)).toList();

/// Appearances per player for already-filtered matches, chronological.
Map<int, List<Appearance>> appearancesByPlayer(List<StatMatch> matches) {
  final map = <int, List<Appearance>>{};
  for (final match in matches) {
    for (final line in match.lines) {
      (map[line.playerId] ??= []).add(Appearance(match, line));
    }
  }
  for (final list in map.values) {
    list.sort(_chrono);
  }
  return map;
}

typedef Hit = bool Function(Appearance a);
final Map<String, Hit> streakRules = {
  'win': (a) => a.result == 'W',
  'goal': (a) => a.line.goals > 0,
  'assist': (a) => a.line.assists > 0,
};

int currentStreak(List<Appearance> chronological, Hit hit) {
  var n = 0;
  for (final a in chronological.reversed) {
    if (!hit(a)) break;
    n++;
  }
  return n;
}

/// All streak runs of maximal length, latest first.
List<Json> bestStreaks(List<Appearance> chronological, Hit hit) {
  final runs = <List<Appearance>>[];
  var current = <Appearance>[];
  for (final a in chronological) {
    if (hit(a)) {
      current.add(a);
    } else if (current.isNotEmpty) {
      runs.add(current);
      current = [];
    }
  }
  if (current.isNotEmpty) runs.add(current);
  if (runs.isEmpty) return [];
  final best = runs.map((r) => r.length).reduce((a, b) => a > b ? a : b);
  return runs.where((r) => r.length == best).toList().reversed.map((r) {
    return {
      'length': r.length,
      'startDate': r.first.match.date,
      'endDate': r.last.match.date,
      'startMatchId': r.first.match.id,
      'endMatchId': r.last.match.id,
      'ongoing': identical(r.last, chronological.last),
    };
  }).toList();
}

double winRate(int wins, int matches) =>
    matches == 0 ? 0 : (wins * 1000 / matches).round() / 10;

class PlayerAggregate {
  PlayerAggregate(this.player, List<Appearance> chronological)
      : appearances = chronological {
    for (final a in chronological) {
      if (a.result == 'W') wins++;
      if (a.result == 'L') losses++;
      if (a.result == 'D') draws++;
      goals += a.line.goals;
      assists += a.line.assists;
      if (a.line.mom) mom++;
    }
  }
  final StatPlayer player;
  final List<Appearance> appearances;
  int wins = 0, losses = 0, draws = 0, goals = 0, assists = 0, mom = 0;
  int get matches => appearances.length;
  double get rate => winRate(wins, matches);
  int current(String rule) => currentStreak(appearances, streakRules[rule]!);
  int best(String rule) {
    final runs = bestStreaks(appearances, streakRules[rule]!);
    return runs.isEmpty ? 0 : runs.first['length'] as int;
  }

  Json summary() => {
        ...player.toJson(),
        'matches': matches,
        'wins': wins,
        'draws': draws,
        'losses': losses,
        'winRate': rate,
        'goals': goals,
        'assists': assists,
        'attackPoints': goals + assists,
        'mom': mom,
        'currentWinStreak': current('win'),
        'currentGoalStreak': current('goal'),
        'currentAssistStreak': current('assist'),
      };

  Json detail() => {
        ...summary(),
        'bestStreaks': {
          for (final rule in streakRules.keys)
            rule: bestStreaks(appearances, streakRules[rule]!),
        },
        'history': appearances.reversed.map((a) => a.toJson()).toList(),
      };
}

List<PlayerAggregate> aggregatePlayers(
    List<StatPlayer> players, List<StatMatch> matches, Period period) {
  final byPlayer = appearancesByPlayer(countedMatches(matches, period));
  return players
      .map((p) => PlayerAggregate(p, byPlayer[p.id] ?? const []))
      .toList();
}

/// Competition ranking. Keeps every player whose rank <= [limit].
List<Json> rankBy(
  Iterable<PlayerAggregate> aggregates,
  num Function(PlayerAggregate) value, {
  int limit = 5,
  bool Function(PlayerAggregate)? where,
  String Function(num)? display,
}) {
  final candidates = aggregates
      .where((a) => (where?.call(a) ?? true) && value(a) > 0)
      .toList()
    ..sort((a, b) {
      final c = value(b).compareTo(value(a));
      return c != 0 ? c : a.player.name.compareTo(b.player.name);
    });
  final out = <Json>[];
  for (var i = 0; i < candidates.length; i++) {
    final v = value(candidates[i]);
    final rank = i == 0 || value(candidates[i - 1]) != v
        ? i + 1
        : out.last['rank'] as int;
    if (rank > limit) break;
    final tied = candidates.where((c) => value(c) == v).length > 1;
    out.add({
      'rank': rank,
      'tied': tied,
      'value': v,
      'displayValue': display?.call(v) ?? '$v',
      'sampleMatches': candidates[i].matches,
      'player': candidates[i].player.toJson(),
    });
  }
  return out;
}

Json dashboardRankings(List<PlayerAggregate> aggregates, int minWinRateMatches) {
  final ranked = aggregates.where((a) => a.player.active).toList();
  return {
    'minWinRateMatches': minWinRateMatches,
    'goals': rankBy(ranked, (a) => a.goals, display: (v) => '$v골'),
    'assists': rankBy(ranked, (a) => a.assists, display: (v) => '$v도움'),
    'mom': rankBy(ranked, (a) => a.mom, display: (v) => '$v회'),
    'winRate': rankBy(ranked, (a) => a.rate,
        where: (a) => a.matches >= minWinRateMatches,
        display: (v) => '$v%'),
    'winStreak': rankBy(ranked, (a) => a.current('win'), display: (v) => '$v연승'),
    'goalStreak':
        rankBy(ranked, (a) => a.current('goal'), display: (v) => '$v경기 연속골'),
    'assistStreak': rankBy(ranked, (a) => a.current('assist'),
        display: (v) => '$v경기 연속도움'),
  };
}

const hallCategories = [
  ('mostWins', '최다승', '출전한 경기에서 소속팀이 승리한 횟수', '승'),
  ('mostAppearances', '최다 출전', '실제로 출전한 완료 경기 수', '경기'),
  ('longestWinStreak', '최다 연승', '출전 경기 기준 최다 연속 승리', '연승'),
  ('longestScoringStreak', '최다 연속골', '출전 경기 기준 최다 연속 득점 경기', '경기 연속골'),
  ('longestAssistStreak', '최다 연속도움', '출전 경기 기준 최다 연속 도움 경기', '경기 연속도움'),
  ('mostGoals', '최다 득점', '완료 경기 총 득점', '골'),
  ('mostAssists', '최다 도움', '완료 경기 총 도움', '도움'),
  ('mostAttackPoints', '최다 공격 포인트', '득점 + 도움 합계', '포인트'),
  ('mostMom', '최다 MOM', 'MOM 선정 횟수', '회'),
];

num _hallValue(String key, PlayerAggregate a) => switch (key) {
      'mostWins' => a.wins,
      'mostAppearances' => a.matches,
      'longestWinStreak' => a.best('win'),
      'longestScoringStreak' => a.best('goal'),
      'longestAssistStreak' => a.best('assist'),
      'mostGoals' => a.goals,
      'mostAssists' => a.assists,
      'mostAttackPoints' => a.goals + a.assists,
      'mostMom' => a.mom,
      _ => 0,
    };

Json hallOfFame(List<PlayerAggregate> aggregates, int countedMatchCount) {
  final ranked = aggregates.where((a) => a.player.active).toList();
  return {
    'totalMatches': countedMatchCount,
    'totalPlayers': ranked.length,
    'categories': [
      for (final (key, title, description, unit) in hallCategories)
        {
          'key': key,
          'title': title,
          'description': description,
          'entries': rankBy(ranked, (a) => _hallValue(key, a),
              limit: 3, display: (v) => '$v$unit'),
        },
    ],
  };
}

/// Teammate / opponent records and goal-assist partners for one player.
/// Unknown assist links are counted separately from real zeros.
Json chemistry(int playerId, Map<int, StatPlayer> players,
    List<StatMatch> matches, Period period, int minMatches) {
  final teammates = <int, Map<String, num>>{};
  final opponents = <int, Map<String, num>>{};
  final partners = <int, Map<String, int>>{};
  var total = 0, unknownGoalLinks = 0, unknownAssistLinks = 0;
  String? first, last;
  for (final match in countedMatches(matches, period)) {
    final self = match.lines.where((l) => l.playerId == playerId).firstOrNull;
    if (self == null) continue;
    total++;
    if (first == null || match.date.compareTo(first) < 0) first = match.date;
    if (last == null || match.date.compareTo(last) > 0) last = match.date;
    final result = match.resultFor(self.team);
    final gf = self.team == 'A' ? match.scoreA! : match.scoreB!;
    final ga = self.team == 'A' ? match.scoreB! : match.scoreA!;
    for (final other in match.lines) {
      if (other.playerId == playerId) continue;
      final group = other.team == self.team ? teammates : opponents;
      final r = group[other.playerId] ??=
          {'matches': 0, 'wins': 0, 'draws': 0, 'losses': 0, 'goalsFor': 0, 'goalsAgainst': 0};
      r['matches'] = r['matches']! + 1;
      if (result == 'W') r['wins'] = r['wins']! + 1;
      if (result == 'D') r['draws'] = r['draws']! + 1;
      if (result == 'L') r['losses'] = r['losses']! + 1;
      r['goalsFor'] = r['goalsFor']! + gf;
      r['goalsAgainst'] = r['goalsAgainst']! + ga;
    }
    final teamOf = {for (final l in match.lines) l.playerId: l.team};
    var resolvedGoals = 0, resolvedAssists = 0;
    for (final g in match.goals) {
      if (!g.assistKnown) continue;
      final valid = g.assistId != null &&
          teamOf[g.scorerId] != null &&
          teamOf[g.scorerId] == teamOf[g.assistId] &&
          g.scorerId != g.assistId;
      if (g.scorerId == playerId && (g.assistId == null || valid)) resolvedGoals++;
      if (!valid) continue;
      if (g.scorerId != playerId && g.assistId != playerId) continue;
      final receiving = g.scorerId == playerId;
      final partnerId = receiving ? g.assistId! : g.scorerId;
      final p = partners[partnerId] ??= {'received': 0, 'supplied': 0, 'total': 0};
      if (receiving) {
        p['received'] = p['received']! + 1;
      } else {
        p['supplied'] = p['supplied']! + 1;
        resolvedAssists++;
      }
      p['total'] = p['total']! + 1;
    }
    final goalGap = self.goals - resolvedGoals;
    final assistGap = self.assists - resolvedAssists;
    unknownGoalLinks += goalGap > 0 ? goalGap : 0;
    unknownAssistLinks += assistGap > 0 ? assistGap : 0;
  }

  Json playerJson(int id) =>
      (players[id] ?? StatPlayer(id, '알 수 없는 선수', null, false, false)).toJson();

  List<Json> ranked(Map<int, Map<String, num>> group) {
    final list = group.entries
        .where((e) => e.value['matches']! >= minMatches)
        .map((e) => {
              'player': playerJson(e.key),
              ...e.value,
              'winRate': winRate(e.value['wins']!.toInt(), e.value['matches']!.toInt()),
            })
        .toList();
    list.sort((a, b) {
      final c = (b['winRate'] as num).compareTo(a['winRate'] as num);
      if (c != 0) return c;
      final m = (b['matches'] as num).compareTo(a['matches'] as num);
      if (m != 0) return m;
      return ((a['player'] as Json)['name'] as String)
          .compareTo((b['player'] as Json)['name'] as String);
    });
    return list;
  }

  final connections = partners.entries
      .map((e) => {'player': playerJson(e.key), ...e.value})
      .toList()
    ..sort((a, b) {
      final c = (b['total'] as int).compareTo(a['total'] as int);
      return c != 0 ? c : (b['received'] as int).compareTo(a['received'] as int);
    });

  return {
    'player': playerJson(playerId),
    'period': period.toJson(),
    'minMatches': minMatches,
    'totalMatches': total,
    'firstDate': first,
    'lastDate': last,
    'unknownGoalLinks': unknownGoalLinks,
    'unknownAssistLinks': unknownAssistLinks,
    'teammateCount': teammates.length,
    'opponentCount': opponents.length,
    'teammates': ranked(teammates),
    'opponents': ranked(opponents),
    'connections': connections,
  };
}
