const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { reconcile } = require("./reconcile");

const event = (txn_id, status, amount, day) => JSON.stringify({
  txn_id, status, amount, currency: "NGN", ts: `2026-09-${day}T00:00:00Z`,
});

test("latest attempt wins regardless of input order, including non-successes", () => {
  const lines = [
    event("a", "failed", 100, "02"), event("a", "success", 100, "01"),
    event("b", "success", 200, "01"), event("b", "pending", 200, "02"),
    event("c", "failed", 300, "01"), event("c", "success", 300, "02"),
  ];
  for (const input of [lines, [...lines].reverse()]) {
    assert.deepEqual(reconcile(input), { count: 1, totalKobo: 30000n });
  }
});

test("skips unreadable and missing-ID records; parses money exactly", () => {
  assert.deepEqual(reconcile([
    "", "broken JSON", "null", "{}", event("", "success", 999, "01"),
    event("a", "success", "1,234.56", "01"),
    event("b", "success", 0.1, "01"), event("c", "success", "0.20", "01"),
    event("a", "success", "1,234.56", "01"),
  ]), { count: 3, totalKobo: 123486n });
});

test("full export agrees with finance count", () => {
  const lines = fs.readFileSync(path.join(__dirname, "payments.jsonl"), "utf8").split("\n");
  const expected = Number(fs.readFileSync(path.join(__dirname, "expected.txt"), "utf8"));
  assert.equal(reconcile(lines).count, expected);
  assert.deepEqual(reconcile([...lines].reverse()), reconcile(lines));
});
