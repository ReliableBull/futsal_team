import assert from "node:assert/strict";
import { addDemoBooking, bookingDates, demoVenues, isFutureSlot, readDemoBookings, slotLabel } from "../lib/demo-venues";
import { matchesSport } from "../lib/community";
import { parseTeamFields } from "../lib/team-validation";
import { isPlatformPath, teamPath } from "../lib/team-paths";

const now = new Date("2026-10-23T14:30:00Z"); // 23:30 KST: today's slots have all passed.
assert.equal(bookingDates(now)[0], "2026-10-23");
assert.equal(bookingDates(new Date("2026-10-23T15:00:00Z"))[0], "2026-10-24");
assert.equal(bookingDates(new Date("2026-12-31T15:00:00Z"))[0], "2027-01-01");
assert.equal(bookingDates(now).length, 7);
assert.equal(isFutureSlot("2026-10-23", 22, now), false);
assert.equal(slotLabel(22), "22:00 – 24:00");
const input = { venueSlug: demoVenues[0].slug, date: "2026-10-24", hour: 8, teamName: "  테스트 FC  " };
const bookings = addDemoBooking([], input, "first", now);
assert.equal(bookings[0].teamName, "테스트 FC");
assert.equal(bookings[0].price, demoVenues[0].price);
assert.equal(bookings[0].status, "REQUESTED");
assert.throws(() => addDemoBooking(bookings, input, "duplicate", now), /이미/);
assert.equal(addDemoBooking([{ ...bookings[0], status: "CANCELLED" }], input, "rebook", now).length, 2);
for (const invalid of [{ date: "2026-10-23", hour: 22 }, { date: "2026-11-03" }, { date: "nonsense" }, { hour: 9 }, { venueSlug: "unknown" }, { teamName: " " }]) assert.throws(() => addDemoBooking([], { ...input, ...invalid }, "invalid", now));
assert.deepEqual(readDemoBookings(JSON.stringify(bookings)), bookings);
for (const invalid of [null, "{broken", "{}", '[null,3,"x"]', JSON.stringify([{ ...bookings[0], date: "invalid" }]), JSON.stringify([{ ...bookings[0], venueSlug: "missing" }]), JSON.stringify([{ ...bookings[0], price: 1 }])]) assert.deepEqual(readDemoBookings(invalid), []);
assert.equal(matchesSport("BOTH", "FOOTBALL"), true);
assert.equal(matchesSport("FUTSAL", "FOOTBALL"), false);
for (const path of ["/venues", "/venues/seongsu-rooftop", "/bookings", "/teams/examples/hangang-united"]) { assert.equal(isPlatformPath(path), true); assert.equal(teamPath("/t/test", path), path); }
assert.equal(isPlatformPath("/t/test/venues"), false);
const form = new FormData();
for (const [key, value] of Object.entries({ name: "테스트 FC", slug: "test-fc", sport: "FOOTBALL", recruiting: "on", schedule: "매주 토요일 오전 9시", joinUrl: "https://example.com/join" })) form.set(key, value);
assert.equal(parseTeamFields(form).sport, "FOOTBALL");
assert.equal(parseTeamFields(form).recruiting, true);
for (const url of ["javascript:alert(1)", "//example.com", "http://example.com", "https://user:pass@example.com", "broken"]) { form.set("joinUrl", url); assert.throws(() => parseTeamFields(form)); }
form.set("joinUrl", ""); form.set("sport", "invalid"); assert.throws(() => parseTeamFields(form));
console.log("Community checks passed: KST date boundaries, slot validation, duplicates/cancellation, malformed storage, filters, paths and safe recruitment URLs.");
