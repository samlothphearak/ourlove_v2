import assert from "node:assert/strict";
import { test } from "node:test";
import User from "../models/User.js";
import { getMemoryOwnerIds } from "../routes/memory.routes.js";

test("memory access includes only a mutually linked partner", async (t) => {
  const originalFindOne = User.findOne;
  t.after(() => {
    User.findOne = originalFindOne;
  });

  await t.test("returns only the user when they have no partner", async () => {
    let lookupCount = 0;
    User.findOne = () => {
      lookupCount += 1;
      throw new Error("No partner lookup should be needed.");
    };

    const owners = await getMemoryOwnerIds({
      _id: "user-id",
      partnerId: null,
    });

    assert.deepEqual(owners, ["user-id"]);
    assert.equal(lookupCount, 0);
  });

  await t.test("includes a partner with a reciprocal link", async () => {
    let partnerFilter;
    User.findOne = (filter) => {
      partnerFilter = filter;
      return {
        select: () => ({
          lean: async () => ({ _id: "partner-id" }),
        }),
      };
    };

    const owners = await getMemoryOwnerIds({
      _id: "user-id",
      partnerId: "partner-id",
    });

    assert.deepEqual(owners, ["user-id", "partner-id"]);
    assert.deepEqual(partnerFilter, {
      _id: "partner-id",
      partnerId: "user-id",
    });
  });

  await t.test("fails closed when the partner link is not reciprocal", async () => {
    User.findOne = () => ({
      select: () => ({
        lean: async () => null,
      }),
    });

    const owners = await getMemoryOwnerIds({
      _id: "user-id",
      partnerId: "partner-id",
    });

    assert.deepEqual(owners, ["user-id"]);
  });
});
