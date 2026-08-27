import test from "node:test";
import assert from "node:assert/strict";
import { buildShopPurchase, isValidOrderId, validateDonation } from "../src/index.js";
test("server catalog controls totals", () => { const r=buildShopPurchase([{id:"vehicle-model",qty:2},{id:"model-edit-basic",qty:1}]); assert.equal(r.cents,24000); assert.equal(r.value,"240.00"); });
test("invalid carts are rejected", () => { assert.equal(buildShopPurchase([]).error,"empty_or_large_cart"); assert.equal(buildShopPurchase([{id:"fake",qty:1}]).error,"invalid_item"); assert.equal(buildShopPurchase([{id:"vehicle-model",qty:21}]).error,"invalid_item"); });
test("donations enforce bounds and cents", () => { assert.deepEqual(validateDonation(5),{cents:500,value:"5.00"}); assert.equal(validateDonation(4.99).error,"invalid_amount"); assert.equal(validateDonation(5.001).error,"invalid_amount"); });
test("order IDs are constrained", () => { assert.equal(isValidOrderId("5O190127TN364715T"),true); assert.equal(isValidOrderId("../../etc/passwd"),false); });
