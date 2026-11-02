// Payment reconciliation.
//
// Reads payments.jsonl and works out how much money we actually collected.
// Run:  node reconcile.js

const fs = require("fs");
const path = require("path");

function reconcile(lines) {
  const latest = new Map();
  for (const line of lines) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (!event || event.txn_id == null || event.txn_id === "") continue;

    const timestamp = Date.parse(event.ts);
    const previous = latest.get(event.txn_id);
    if (!previous || timestamp > previous.timestamp) {
      latest.set(event.txn_id, { event, timestamp });
    }
  }

  let totalKobo = 0n;
  let count = 0;
  for (const { event } of latest.values()) {
    if (event.status !== "success") continue;
    // Parse decimal money directly into integer kobo to avoid float drift.
    const amount = String(event.amount).replace(/,/g, "").trim();
    const match = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount);
    if (!match) throw new Error(`Invalid amount for ${event.txn_id}: ${amount}`);
    const kobo = BigInt(match[2]) * 100n + BigInt((match[3] || "").padEnd(2, "0"));
    totalKobo += match[1] === "-" ? -kobo : kobo;
    count += 1;
  }
  return { count, totalKobo };
}

function main() {
  const lines = fs.readFileSync(path.join(__dirname, "payments.jsonl"), "utf8").split("\n");
  const { count, totalKobo } = reconcile(lines);
  const expected = parseInt(fs.readFileSync(path.join(__dirname, "expected.txt"), "utf8").trim(), 10);

  if (count !== expected) {
    console.log(`Check failed: counted ${count} successful payments, expected ${expected}.`);
    console.log("Something in the data isn't being handled the way the README describes.");
    process.exitCode = 1;
  } else {
    console.log(`Check passed: ${count} successful payments.`);
    const remainder = ((totalKobo % 100n) + 100n) % 100n;
    const roundedNaira = (totalKobo - remainder) / 100n + (remainder >= 50n ? 1n : 0n);
    console.log(`Your code: KOYA-${roundedNaira}`);
  }
}

if (require.main === module) main();
module.exports = { reconcile };
