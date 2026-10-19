import assert from "node:assert/strict";
import { createWorkbook } from "../lib/excel";
import { createPlayerListWorkbook, type PlayerListExportRow } from "../lib/player-list-excel";

function entries(bytes: Uint8Array) {
  const zip = Buffer.from(bytes);
  const files = new Map<string, string>();
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(zip.readUInt16LE(offset + 8), 0, "stored ZIP entries");
    const length = zip.readUInt32LE(offset + 18);
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    const name = zip.subarray(offset + 30, offset + 30 + nameLength).toString();
    const start = offset + 30 + nameLength + extraLength;
    files.set(name, zip.subarray(start, start + length).toString());
    offset = start + length;
  }
  assert.equal(zip.readUInt32LE(offset), 0x02014b50, "central directory follows local entries");
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50, "ZIP end record");
  assert.equal(zip.readUInt16LE(zip.length - 12), files.size);
  return files;
}

const players: PlayerListExportRow[] = [
  { name: "홍길동", nickname: '=HYPERLINK("https://example.com") & <별명>\u0000', position: "공격수 · 미드필더", number: 0, totalMatches: 2, wins: 1, losses: 1, draws: 0, winRate: 50, goals: 3, assists: 2, attackPoints: 5, attackPointsPerMatch: 2.5, mvpCount: 1 },
  { name: "김선수", nickname: null, position: "골키퍼", number: null, totalMatches: 0, wins: 0, losses: 0, draws: 0, winRate: 0, goals: 0, assists: 0, attackPoints: 0, attackPointsPerMatch: 0, mvpCount: 0 }
];
const before = structuredClone(players);
const context = { startDate: "2026-10-07", endDate: "2026-10-07", sortLabel: "공격 포인트", direction: "desc" as const };
const files = entries(createPlayerListWorkbook(players, context));
const sheet = files.get("xl/worksheets/sheet1.xml")!;
assert.ok(sheet.indexOf("홍길동") < sheet.indexOf("김선수"), "preserve displayed order instead of sorting by name");
assert.match(sheet, /조회 기간: 2026-10-07 ~ 2026-10-07/);
assert.match(sheet, /정렬: 공격 포인트 · 내림차순/);
assert.match(sheet, /<c r="D6"><v>0<\/v><\/c>/, "jersey zero remains numeric");
assert.match(sheet, /<c r="D7" t="inlineStr"><is><t xml:space="preserve"><\/t>/, "missing jersey stays empty");
assert.match(sheet, /<c r="I6" s="6"><f>IF\(E6=0,0,F6\/E6\)<\/f><v>0.5<\/v>/, "numeric percentage and cached value");
assert.match(sheet, /<c r="I7" s="6"><f>IF\(E7=0,0,F7\/E7\)<\/f><v>0<\/v>/, "zero-match percentage avoids division by zero");
assert.match(sheet, /<c r="L6" s="7"><f>J6\+K6<\/f><v>5<\/v>/, "attack points remain editable with a formula");
assert.match(sheet, /<c r="M6" s="8"><f>IF\(E6=0,0,ROUND\(L6\/E6,2\)\)<\/f><v>2.5<\/v>/, "per-match average remains numeric with a rounded formula");
assert.match(sheet, /<c r="M7" s="8"><f>IF\(E7=0,0,ROUND\(L7\/E7,2\)\)<\/f><v>0<\/v>/, "zero appearances produce zero instead of a formula error");
assert.match(sheet, /<c r="N6"><v>1<\/v>/, "MOM follows the new average column");
assert.match(sheet, /t="inlineStr"><is><t xml:space="preserve">=HYPERLINK\(&quot;https:\/\/example.com&quot;\) &amp; &lt;별명&gt;<\/t>/, "user text cannot become a formula or break XML");
assert.ok(!sheet.includes("\u0000"));
assert.match(sheet, /<tableParts count="1"><tablePart r:id="rId1"\/><\/tableParts>/);
assert.ok(!sheet.includes("<autoFilter"), "table owns its filter instead of overlapping a worksheet filter");
const table = files.get("xl/tables/table1.xml")!;
assert.match(table, /name="ArenaPlayerRecords" displayName="ArenaPlayerRecords" ref="A5:N7"/);
assert.match(table, /<autoFilter ref="A5:N7">/);
assert.equal((table.match(/hiddenButton="0" showButton="1"/g) ?? []).length, 14, "each header exposes its filter menu");
assert.match(table, /<tableColumns count="14">/);
assert.match(table, /<tableColumn id="6" name="승"\/>/);
assert.match(table, /<tableColumn id="12" name="공격 포인트"\/>/);
assert.match(table, /<tableColumn id="13" name="경기당 공격 포인트"\/>/);
assert.match(table, /<tableColumn id="14" name="MOM"\/>/);
assert.match(files.get("xl/worksheets/_rels/sheet1.xml.rels")!, /Target="\.\.\/tables\/table1.xml"/);
assert.match(files.get("[Content_Types].xml")!, /PartName="\/xl\/tables\/table1.xml" ContentType="application\/vnd.openxmlformats-officedocument.spreadsheetml.table\+xml"/);
assert.match(sheet, /ySplit="5" topLeftCell="A6"/);
assert.match(files.get("xl/styles.xml")!, /formatCode="0.0%"/);
assert.match(files.get("xl/styles.xml")!, /numFmtId="2" fontId="2"/, "built-in 0.00 number format for per-match average");
assert.deepEqual(players, before, "export cannot mutate the on-screen snapshot");

const empty = entries(createPlayerListWorkbook([], context)).get("xl/worksheets/sheet1.xml")!;
assert.match(empty, /<autoFilter ref="A5:N5"\/>/);
assert.match(empty, /공격 포인트/);
assert.ok(!empty.includes('<row r="6"'));
assert.ok(!empty.includes("tableParts"), "an empty list does not create an invalid header-only Excel table");

// Existing administrator exports use the same writer and style IDs 0–5.
const legacy = entries(createWorkbook([
  { name: "전체 경기 전적", rows: [["팀 & 선수", 4, true, null], [{ value: "MOM", style: 5 }]] },
  { name: "선수 통계", rows: [["득점", "도움"], [3, 2]] }
]));
assert.equal(legacy.size, 7);
assert.match(legacy.get("xl/workbook.xml")!, /name="선수 통계" sheetId="2"/);
assert.match(legacy.get("xl/worksheets/sheet1.xml")!, /<c r="C1" t="b"><v>1<\/v>/);
assert.match(legacy.get("xl/worksheets/sheet1.xml")!, /<c r="A2" s="5" t="inlineStr">/);
assert.match(legacy.get("xl/worksheets/sheet2.xml")!, /<c r="A2"><v>3<\/v>/);
console.log("Player-list Excel checks passed: snapshot order, period, typed values, formulas, text safety, empty records, legacy sheets.");
