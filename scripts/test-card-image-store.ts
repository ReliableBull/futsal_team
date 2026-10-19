import assert from "node:assert/strict";
import { CardImageStore, CARD_IMAGE_TTL_MS, MAX_CARD_IMAGE_BYTES, cardImageFilename, isCardPng } from "../lib/card-image-store";

// Valid 1080 × 1 RGBA PNG; no dependency on user photos or the database.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAABDgAAAABCAYAAAA7Kh75AAAAG0lEQVR4nO3BAQkAAAACoP6frh2BmgIAAACcG2bN0BFSMfJYAAAAAElFTkSuQmCC", "base64");
assert.equal(isCardPng(png), true);
assert.equal(isCardPng(Buffer.from("<svg onload='alert(1)'></svg>")), false);
assert.equal(isCardPng(png.subarray(0, png.length - 5)), false);
assert.equal(isCardPng(Buffer.concat([png, Buffer.alloc(MAX_CARD_IMAGE_BYTES)])), false);
const huge = Buffer.from(png); huge.writeUInt32BE(16001, 20);
assert.equal(isCardPng(huge), false);
for (const bad of ["../private.png", "arena-fc-x.png\r\nX-Test: injected", "arena-fc-<script>.png", null]) {
  assert.equal(cardImageFilename(bad), "arena-fc-card.png");
}
assert.equal(cardImageFilename("arena-fc-player-13-archive.png"), "arena-fc-player-13-archive.png");

const store = new CardImageStore(png.length * 2, 2);
const one = store.put(png, "arena-fc-first.png", 100)!;
assert.ok(one);
assert.deepEqual(store.get(one.id, 101)?.bytes, png, "download bytes match upload exactly");
const duplicate = store.put(png, "arena-fc-first.png", 200)!;
assert.equal(duplicate.id, one.id, "reopening the same image does not consume another slot");
assert.equal(duplicate.expiresAt, 200 + CARD_IMAGE_TTL_MS);
assert.ok(store.put(png, "arena-fc-second.png", 200));
assert.equal(store.put(png, "arena-fc-third.png", 201), null, "reject excess images without evicting active save links");
assert.ok(store.get(one.id, 201));
assert.equal(store.get(one.id, 200 + CARD_IMAGE_TTL_MS), null, "expired links cannot retrieve the image");
assert.ok(store.put(png, "arena-fc-after-expiry.png", 200 + CARD_IMAGE_TTL_MS), "expiry frees capacity");
assert.equal(new CardImageStore(png.length - 1, 10).put(png, "arena-fc-large.png"), null, "byte budget is enforced separately from entry count");
console.log("Card image storage: PNG validation, safe filenames, byte equality, expiry, deduplication and bounded capacity passed");
