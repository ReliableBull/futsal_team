import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { PollAccess } from "./club-polls";
import { isLegacyMode } from "./teams";

export const pollReceiptCookie = "arena_poll_receipt";
export function readPollReceipt() {
  const value = cookies().get(pollReceiptCookie)?.value;
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export function newPollReceipt() { return randomBytes(32).toString("hex"); }
export function pollAccess(receipt = readPollReceipt()): PollAccess {
  return { audience: isLegacyMode() ? "LEGACY" : "MEMBERS", receiptHash: receipt ? createHash("sha256").update(receipt).digest("hex") : null };
}
