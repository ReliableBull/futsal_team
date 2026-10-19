import 'api.dart';

class MatchDraft {
  MatchDraft([Json? match]) {
    if (match == null) return;
    for (final record in rows(match['matchPlayers'])) {
      final id = record['playerId'] as int;
      teams[id] = record['teamName'] == match['teamAName'] ? 'A' : 'B';
      goals[id] = record['goals'] as int;
      legacyAssists[id] = record['assists'] as int;
      if (record['isMvp'] == true) moms.add(id);
      links[id] = List<dynamic>.filled(goals[id]!, 'UNKNOWN');
    }
    for (final goal in rows(match['goals'])) {
      final list = links[goal['scorerId']];
      final index = (goal['sequence'] as int) - 1;
      if (list != null && index >= 0 && index < list.length) {
        list[index] = goal['assistKnown'] == false
            ? 'UNKNOWN'
            : goal['assisterId'];
      }
    }
  }
  final Map<int, String> teams = {};
  final Map<int, int> goals = {};
  final Map<int, int> legacyAssists = {};
  final Map<int, List<dynamic>> links = {};
  final Set<int> moms = {};
  List<int> members(String team) =>
      teams.entries.where((e) => e.value == team).map((e) => e.key).toList();
  List<int> assistCandidates(int scorer) =>
      members(teams[scorer] ?? '').where((id) => id != scorer).toList();
  void assign(int id, String? team) {
    if (teams[id] == team) return;
    teams.remove(id);
    goals.remove(id);
    legacyAssists.remove(id);
    links.remove(id);
    moms.remove(id);
    for (final values in links.values) {
      for (var i = 0; i < values.length; i++) {
        if (values[i] == id) values[i] = null;
      }
    }
    if (team != null) {
      teams[id] = team;
      setGoals(id, 0);
    }
  }

  void setGoals(int id, int count) {
    if (count < 0 || count > 100) {
      throw const ApiException('득점은 0~100 사이로 입력해주세요.');
    }
    goals[id] = count;
    final previous = links[id] ?? [];
    links[id] = List.generate(
      count,
      (i) => i < previous.length ? previous[i] : null,
    );
  }

  int score(String team) =>
      members(team).fold(0, (sum, id) => sum + (goals[id] ?? 0));
  Json toJson() {
    if (members('A').isEmpty || members('B').isEmpty) {
      throw const ApiException('각 팀에 최소 1명의 선수를 배정해주세요.');
    }
    final assists = <int, int>{for (final id in teams.keys) id: 0};
    bool unknown = false;
    for (final entry in links.entries) {
      for (final value in entry.value) {
        if (value == 'UNKNOWN') unknown = true;
        if (value is int) {
          if (!assistCandidates(entry.key).contains(value)) {
            throw const ApiException('도움 선수는 득점자를 제외한 같은 팀 선수여야 합니다.');
          }
          assists[value] = (assists[value] ?? 0) + 1;
        }
      }
    }
    if (unknown) {
      for (final id in teams.keys) {
        final legacy = legacyAssists[id] ?? 0;
        if (legacy > (assists[id] ?? 0)) assists[id] = legacy;
      }
    }
    return {
      'teamAPlayerIds': members('A'),
      'teamBPlayerIds': members('B'),
      'chairmanTeamMvpIds': members('A').where(moms.contains).toList(),
      'managerTeamMvpIds': members('B').where(moms.contains).toList(),
      'goalsByPlayerId': {for (final id in teams.keys) '$id': goals[id] ?? 0},
      'assistsByPlayerId': {
        for (final id in teams.keys) '$id': assists[id] ?? 0,
      },
      'goalAssistPlayerIdsByScorerId': {
        for (final id in teams.keys) '$id': links[id] ?? [],
      },
    };
  }
}
