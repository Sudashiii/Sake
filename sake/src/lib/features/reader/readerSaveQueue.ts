import type { ReaderAnnotation, SidecarSnapshot } from './koreaderSidecar';
import { saveKoreaderSidecar } from './koreaderSidecarClient';

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

	constructor(
		private readonly fileName: string,
		private readonly getPosition: () => SavePosition,
		private readonly onSaved: (snapshot: SidecarSnapshot) => void,
		private readonly onStatus: (status: SaveStatus) => void
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
		if (!this.getPosition().lastXPointer) return;
		if (this.timer) clearTimeout(this.timer);
		this.timer = setTimeout(() => void this.flush(), delay);
	}

	async flush(): Promise<void> {
		const position = this.getPosition();
		if (!position.lastXPointer) return;
		if (this.isSaving) {
			this.saveAgain = true;
			return;
		}

		this.isSaving = true;
		this.onStatus({ isSaving: true, error: null });
		const capturedUpserts = [...this.upserts.values()];
		const capturedDeletes = [...this.deletions];
		try {
			const merged = await saveKoreaderSidecar(this.fileName, {
				percentFinished: position.percentFinished,
				lastXPointer: position.lastXPointer,
				upsertedAnnotations: capturedUpserts,
				deletedAnnotationIds: capturedDeletes
			});
			for (const annotation of capturedUpserts) {
				if (this.upserts.get(annotation.id) === annotation) this.upserts.delete(annotation.id);
			}
			for (const id of capturedDeletes) this.deletions.delete(id);
			this.onSaved(merged);
			this.onStatus({ isSaving: false, error: null });
		} catch (error: unknown) {
			this.onStatus({
				isSaving: false,
				error: error instanceof Error ? error.message : 'Failed to save reading state'
			});
		} finally {
			this.isSaving = false;
			if (this.saveAgain) {
				this.saveAgain = false;
				void this.flush();
			}
		}
	}

	destroy(): void {
		if (this.timer) clearTimeout(this.timer);
	}
}
