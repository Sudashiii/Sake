import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ReindexAnnotationsUseCase } from "$lib/server/application/use-cases/ReindexAnnotationsUseCase";
import type { AnnotationIndexService } from "$lib/server/application/services/AnnotationIndexService";
import { AnnotationMutationService } from "$lib/server/application/services/AnnotationMutationService";
import type { AnnotationRepositoryPort } from "$lib/server/application/ports/AnnotationRepositoryPort";
import type { BookRepositoryPort } from "$lib/server/application/ports/BookRepositoryPort";
import type { StoragePort } from "$lib/server/application/ports/StoragePort";
import { SidecarWriteCoordinator } from "$lib/server/application/services/SidecarWriteCoordinator";

describe("ReindexAnnotationsUseCase", () => {
  test("rejects reindexing in demo mode", async () => {
    const previousDemoMode = process.env.SAKE_DEMO_MODE;
    process.env.SAKE_DEMO_MODE = "true";
    let started = false;
    const useCase = new ReindexAnnotationsUseCase({
      startReconciliation: () => {
        started = true;
      },
    } as AnnotationIndexService);

    try {
      const result = await useCase.execute();
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.error.status, 403);
      assert.equal(started, false);
    } finally {
      if (previousDemoMode === undefined) delete process.env.SAKE_DEMO_MODE;
      else process.env.SAKE_DEMO_MODE = previousDemoMode;
    }
  });

  test("rejects annotation mutations in demo mode before reading storage", async () => {
    const previousDemoMode = process.env.SAKE_DEMO_MODE;
    process.env.SAKE_DEMO_MODE = "true";
    const mutationService = new AnnotationMutationService(
      {} as AnnotationRepositoryPort,
      {} as BookRepositoryPort,
      {} as StoragePort,
      {} as AnnotationIndexService,
      new SidecarWriteCoordinator(),
    );

    try {
      const result = await mutationService.delete({
        id: 1,
        expectedVersion: "v1-test",
      });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.error.status, 403);
    } finally {
      if (previousDemoMode === undefined) delete process.env.SAKE_DEMO_MODE;
      else process.env.SAKE_DEMO_MODE = previousDemoMode;
    }
  });
});
