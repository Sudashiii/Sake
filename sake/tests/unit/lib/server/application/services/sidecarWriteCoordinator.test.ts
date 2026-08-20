import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { SidecarWriteCoordinator } from "$lib/server/application/services/SidecarWriteCoordinator";

describe("SidecarWriteCoordinator", () => {
  test("serializes writes for the same book", async () => {
    const coordinator = new SidecarWriteCoordinator();
    const events: string[] = [];
    let releaseFirst: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let markFirstStarted: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });

    const first = coordinator.run(42, async () => {
      events.push("first-start");
      markFirstStarted();
      await firstGate;
      events.push("first-finish");
    });
    await firstStarted;
    const second = coordinator.run(42, async () => {
      events.push("second-start");
    });

    await Promise.resolve();
    assert.deepEqual(events, ["first-start"]);
    releaseFirst!();
    await Promise.all([first, second]);
    assert.deepEqual(events, ["first-start", "first-finish", "second-start"]);
  });
});
