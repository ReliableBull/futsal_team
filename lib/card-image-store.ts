import { randomUUID } from "node:crypto";

export const MAX_CARD_IMAGE_BYTES = 6 * 1024 * 1024;
export const CARD_IMAGE_TTL_MS = 30 * 60 * 1000;
const MAX_STORE_BYTES = 64 * 1024 * 1024;
const MAX_STORE_ITEMS = 64;

export type StoredCardImage = { bytes: Buffer; filename: string; expiresAt: number };

export function isCardPng(bytes: Buffer) {
  if (bytes.length < 45 || bytes.length > MAX_CARD_IMAGE_BYTES) return false;
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
  if (bytes.readUInt32BE(8) !== 13 || bytes.toString("ascii", 12, 16) !== "IHDR") return false;
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  return width === 1080 && height > 0 && height <= 16000 && bytes.subarray(-12).equals(Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]));
}

export function cardImageFilename(value: string | null) {
  return value && value.length <= 100 && /^arena-fc-[a-z0-9-]+\.png$/i.test(value) ? value : "arena-fc-card.png";
}

/** Short-lived, bounded storage: no database changes or permanent uploaded files. */
export class CardImageStore {
  private images = new Map<string, StoredCardImage>();
  constructor(private maxBytes = MAX_STORE_BYTES, private maxItems = MAX_STORE_ITEMS) {}

  private purge(now: number) {
    this.images.forEach((image, id) => { if (image.expiresAt <= now) this.images.delete(id); });
  }

  put(bytes: Buffer, filename: string, now = Date.now()) {
    this.purge(now);
    let size = 0;
    for (const [id, image] of Array.from(this.images)) {
      if (image.filename === filename && image.bytes.equals(bytes)) {
        image.expiresAt = now + CARD_IMAGE_TTL_MS;
        return { id, expiresAt: image.expiresAt };
      }
      size += image.bytes.length;
    }
    if (this.images.size >= this.maxItems || size + bytes.length > this.maxBytes) return null;
    const id = randomUUID();
    const expiresAt = now + CARD_IMAGE_TTL_MS;
    this.images.set(id, { bytes, filename, expiresAt });
    return { id, expiresAt };
  }

  get(id: string, now = Date.now()) {
    this.purge(now);
    return this.images.get(id) ?? null;
  }
}

// Route handlers can be separate Next.js bundles; share the store within the server process.
const runtime = globalThis as typeof globalThis & { arenaCardImageStore?: CardImageStore };
export const cardImageStore = runtime.arenaCardImageStore ??= new CardImageStore();
