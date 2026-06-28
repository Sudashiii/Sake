export type PageDirection = 'previous' | 'next';
export type TapRejectionReason =
	| 'disabled'
	| 'double-click'
	| 'interactive-content'
	| 'invalid-viewport'
	| 'long-press'
	| 'missing-gesture'
	| 'moved'
	| 'selection'
	| 'stale-gesture';

export type ReaderTapDiagnostic =
	| { type: 'gesture-start'; source: InputSource; x: number; y: number }
	| { type: 'gesture-moved'; distance: number; source: InputSource }
	| { type: 'gesture-end'; duration: number; isTap: boolean; source: InputSource }
	| { type: 'tap-rejected'; reason: TapRejectionReason; x: number }
	| {
			type: 'tap-scheduled';
			direction: PageDirection;
			viewportWidth: number;
			x: number;
		}
	| { type: 'tap-center'; viewportWidth: number; x: number }
	| { type: 'tap-cancelled'; reason: string }
	| { type: 'navigate'; direction: PageDirection };

interface GesturePoint {
	x: number;
	y: number;
	time: number;
}

interface CompletedGesture {
	duration: number;
	endedAt: number;
	isTap: boolean;
	rejectionReason: 'long-press' | 'moved' | null;
}

interface TapClick {
	detail: number;
	hasSelection: boolean;
	isInteractive: boolean;
	time: number;
	viewportWidth: number;
	x: number;
}

interface TapNavigationOptions {
	edgeRatio?: number;
	longPressMs?: number;
	moveTolerancePx?: number;
	navigationDelayMs?: number;
	onDiagnostic?: (diagnostic: ReaderTapDiagnostic) => void;
}

export type InputSource = 'mouse' | 'touch';

const SYNTHETIC_MOUSE_WINDOW_MS = 800;
const CLICK_AFTER_GESTURE_MS = 800;

export class ReaderTapNavigation {
	private completedGesture: CompletedGesture | null = null;
	private gestureStart: GesturePoint | null = null;
	private isGestureMoved = false;
	private isDebugEnabled = false;
	private isEnabled = true;
	private pendingNavigation: ReturnType<typeof setTimeout> | null = null;
	private syntheticMouseUntil = 0;
	private readonly edgeRatio: number;
	private readonly longPressMs: number;
	private readonly moveTolerancePx: number;
	private navigationDelayMs: number;
	private readonly onDiagnostic?: (diagnostic: ReaderTapDiagnostic) => void;

	constructor(
		private readonly onNavigate: (direction: PageDirection) => void,
		options: TapNavigationOptions = {}
	) {
		this.edgeRatio = options.edgeRatio ?? 1 / 3;
		this.longPressMs = options.longPressMs ?? 450;
		this.moveTolerancePx = options.moveTolerancePx ?? 10;
		this.navigationDelayMs = options.navigationDelayMs ?? 500;
		this.onDiagnostic = options.onDiagnostic;
	}

	setEnabled(isEnabled: boolean): void {
		this.isEnabled = isEnabled;
		if (!isEnabled) this.cancel('disabled');
	}

	setDebugEnabled(isEnabled: boolean): void {
		this.isDebugEnabled = isEnabled;
	}

	setNavigationDelay(delayMs: number): void {
		this.navigationDelayMs = Math.max(0, delayMs);
	}

	start(point: GesturePoint, source: InputSource): void {
		if (source === 'mouse' && point.time <= this.syntheticMouseUntil) return;
		this.cancelPendingNavigation('new gesture');
		this.gestureStart = point;
		this.isGestureMoved = false;
		this.completedGesture = null;
		this.emit({ type: 'gesture-start', source, x: point.x, y: point.y });
	}

	move(point: GesturePoint, source: InputSource): void {
		if (source === 'mouse' && point.time <= this.syntheticMouseUntil) return;
		if (!this.gestureStart) return;
		const distance = Math.hypot(
			point.x - this.gestureStart.x,
			point.y - this.gestureStart.y
		);
		if (distance > this.moveTolerancePx && !this.isGestureMoved) {
			this.isGestureMoved = true;
			this.emit({ type: 'gesture-moved', source, distance: Math.round(distance) });
		}
	}

	end(point: GesturePoint, source: InputSource): void {
		if (source === 'mouse' && point.time <= this.syntheticMouseUntil) return;
		if (!this.gestureStart) return;
		const duration = point.time - this.gestureStart.time;
		this.move(point, source);
		const rejectionReason = this.isGestureMoved
			? 'moved'
			: duration > this.longPressMs
				? 'long-press'
				: null;
		this.completedGesture = {
			duration,
			endedAt: point.time,
			isTap: rejectionReason === null,
			rejectionReason
		};
		this.gestureStart = null;
		if (source === 'touch') this.syntheticMouseUntil = point.time + SYNTHETIC_MOUSE_WINDOW_MS;
		this.emit({
			type: 'gesture-end',
			source,
			duration: Math.round(duration),
			isTap: rejectionReason === null
		});
	}

	click(input: TapClick): void {
		const gesture = this.completedGesture;
		this.completedGesture = null;
		const rejectionReason = this.rejectionReason(gesture, input);
		if (rejectionReason) {
			this.cancelPendingNavigation();
			this.emit({ type: 'tap-rejected', reason: rejectionReason, x: input.x });
			return;
		}

		const direction =
			input.x <= input.viewportWidth * this.edgeRatio
				? 'previous'
				: input.x >= input.viewportWidth * (1 - this.edgeRatio)
					? 'next'
					: null;
		if (!direction) {
			this.emit({ type: 'tap-center', x: input.x, viewportWidth: input.viewportWidth });
			return;
		}

		this.emit({
			type: 'tap-scheduled',
			direction,
			x: input.x,
			viewportWidth: input.viewportWidth
		});
		if (this.navigationDelayMs === 0) {
			this.navigate(direction);
			return;
		}
		this.pendingNavigation = setTimeout(() => {
			this.pendingNavigation = null;
			this.navigate(direction);
		}, this.navigationDelayMs);
	}

	cancel(reason = 'cancelled'): void {
		this.gestureStart = null;
		this.completedGesture = null;
		this.isGestureMoved = false;
		this.cancelPendingNavigation(reason);
	}

	destroy(): void {
		this.cancel();
	}

	private cancelPendingNavigation(reason?: string): void {
		if (this.pendingNavigation === null) return;
		clearTimeout(this.pendingNavigation);
		this.pendingNavigation = null;
		if (reason) this.emit({ type: 'tap-cancelled', reason });
	}

	private emit(diagnostic: ReaderTapDiagnostic): void {
		if (this.isDebugEnabled) this.onDiagnostic?.(diagnostic);
	}

	private navigate(direction: PageDirection): void {
		if (!this.isEnabled) return;
		this.emit({ type: 'navigate', direction });
		this.onNavigate(direction);
	}

	private rejectionReason(
		gesture: CompletedGesture | null,
		input: TapClick
	): TapRejectionReason | null {
		if (!this.isEnabled) return 'disabled';
		if (!gesture) return 'missing-gesture';
		if (!gesture.isTap) return gesture.rejectionReason ?? 'missing-gesture';
		if (input.time - gesture.endedAt > CLICK_AFTER_GESTURE_MS) return 'stale-gesture';
		if (input.detail > 1) return 'double-click';
		if (input.hasSelection) return 'selection';
		if (input.isInteractive) return 'interactive-content';
		if (input.viewportWidth <= 0) return 'invalid-viewport';
		return null;
	}
}
