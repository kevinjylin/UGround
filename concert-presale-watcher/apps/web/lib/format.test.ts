import test from "node:test";
import assert from "node:assert";
import { lineupText, priceRange } from "./format";

test("priceRange", async (t) => {
  await t.test("formats a range in the show's currency", () => {
    assert.strictEqual(priceRange(35, 80, "USD"), "$35–$80");
    assert.strictEqual(priceRange(29.5, 45, "USD"), "$29.50–$45");
    assert.strictEqual(priceRange(40, 60, "EUR"), "€40–€60");
  });
  await t.test("collapses a single price", () => {
    assert.strictEqual(priceRange(35, 35, "USD"), "$35");
    assert.strictEqual(priceRange(35, null, "USD"), "$35");
    assert.strictEqual(priceRange(undefined, 80, null), "$80");
  });
  await t.test("puts a reversed range in order", () => {
    assert.strictEqual(priceRange(80, 35, "USD"), "$35–$80");
  });
  await t.test("returns null without a usable price", () => {
    assert.strictEqual(priceRange(null, null, "USD"), null);
    assert.strictEqual(priceRange(undefined, undefined, undefined), null);
    assert.strictEqual(priceRange(Number.NaN, -1, "USD"), null);
  });
  await t.test("survives a currency code Intl doesn't know", () => {
    assert.strictEqual(priceRange(10, 20, "points"), "10 POINTS–20 POINTS");
  });
});

test("lineupText", async (t) => {
  await t.test("lists up to three acts", () => {
    assert.strictEqual(lineupText(["Horsegirl"]), "With Horsegirl");
    assert.strictEqual(lineupText(["Horsegirl", "Ratboys"]), "With Horsegirl and Ratboys");
    assert.strictEqual(lineupText(["A", "B", "C"]), "With A, B and C");
    assert.strictEqual(lineupText(["A", "B", "C", "D", "E"]), "With A, B, C and 2 more");
  });
  await t.test("drops blanks, repeats and the headliner", () => {
    assert.strictEqual(lineupText([" ", "Geese", "geese", "Wednesday"], "Wednesday"), "With Geese");
  });
  await t.test("returns null with no one else on the bill", () => {
    assert.strictEqual(lineupText([]), null);
    assert.strictEqual(lineupText(undefined), null);
    assert.strictEqual(lineupText(["Wednesday"], "wednesday"), null);
  });
});
