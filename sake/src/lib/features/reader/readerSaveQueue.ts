import type { ReaderAnnotation, SidecarSnapshot } from '$lib/koreader/koreaderSidecar';
import { saveKoreaderSidecar } from './koreaderSidecarClient';

type SaveKoreaderSidecar = typeof saveKoreaderSidecar;

interface SavePosition {
	percentFinished: number;
	lastXPointer: string | null;
}

interface SaveStatus {
	isSaving: boolean;
	error: string | null;
}

export class ReaderSaveQueue {
	private readonly upserts = new Map<string, ReaderAnnotation>();
	private readonly deletions = new Set<string>();
	private timer: ReturnType<typeof setTimeout> | null = null;
	private isSaving = false;
	private saveAgain = false;
	private readonly pendingFlushes: Array<() => void> = [];
	private isDestroyed = false;

	constructor(
		private readonly fileName: string,
		private readonly readerSessionId: string,
		private readonly getPosition: () => SavePosition,
		private readonly onSaved: (snapshot: SidecarSnapshot) => void,
		private readonly onStatus: (status: SaveStatus) => void,
		private readonly saveSidecar: SaveKoreaderSidecar = saveKoreaderSidecar
	) {}

	upsert(annotation: ReaderAnnotation): void {
		this.deletions.delete(annotation.id);
		this.upserts.set(annotation.id, annotation);
	}

	delete(annotationId: string): void {
		this.upserts.delete(annotationId);
		this.deletions.add(annotationId);
	}

	schedule(delay = 700): void {
		if (this.isDestroyed) return;
		if (this.timer) clearTimeout(this.timer);
		this.timer = setTimeout(() => void this.flush(), delay);
	}

	async flush(isFinalAttempt = false): Promise<void> {
		if (this.isDestroyed && !isFinalAttempt) return;
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		if (this.isSaving) {
			this.saveAgain = true;
			await new Promise<void>((resolve) => this.pendingFlushes.push(resolve));
			return;
		}

		const position = this.getPosition();
		this.isSaving = true;
		if (!this.isDestroyed) this.onStatus({ isSaving: true, error: null });
		const capturedUpserts = [...this.upserts.values()];
		const capturedDeletes = [...this.deletions];
		try {
			const merged = await this.saveSidecar(
				this.fileName,
				{
					percentFinished: position.percentFinished,
					lastXPointer: position.lastXPointer ?? undefined,
					upsertedAnnotations: capturedUpserts,
					deletedAnnotationIds: capturedDeletes
				},
				this.readerSessionId
			);
			for (const annotation of capturedUpserts) {
				if (this.upserts.get(annotation.id) === annotation) this.upserts.delete(annotation.id);
			}
			for (const id of capturedDeletes) this.deletions.delete(id);
			if (!this.isDestroyed) {
				this.onSaved(merged);
				this.onStatus({ isSaving: false, error: null });
			}
		} catch (error: unknown) {
			if (!this.isDestroyed) {
				this.onStatus({
					isSaving: false,
					error: error instanceof Error ? error.message : 'Failed to save reading state'
				});
			}
		} finally {
			this.isSaving = false;
			const shouldRetry = this.saveAgain;
			this.saveAgain = false;
			if (shouldRetry) {
				await this.flush(this.isDestroyed);
			}
			for (const resolve of this.pendingFlushes.splice(0)) {
				resolve();
			}
		}
	}

	destroy(): void {
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
		this.isDestroyed = true;
		void this.flush(true);
	}
}
