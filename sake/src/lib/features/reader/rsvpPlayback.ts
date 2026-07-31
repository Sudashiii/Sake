import { getRsvpDelayMs, type RsvpToken } from './rsvpText';

export interface RsvpPlaybackSource {
	moveWords(delta: number): Promise<RsvpToken | null>;
	moveSentence(direction: 'previous' | 'next'): Promise<RsvpToken | null>;
}

export interface RsvpPlaybackCallbacks {
	onToken: (token: RsvpToken) => void;
	onPlayingChange?: (isPlaying: boolean) => void;
	onCompleted?: () => void;
	onError?: (error: unknown) => void;
}

export interface RsvpTimer {
	setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
	clearTimeout(timer: ReturnType<typeof setTimeout>): void;
}

const defaultTimer: RsvpTimer = {
	setTimeout: (callback, delay) => setTimeout(callback, delay),
	clearTimeout: (timer) => clearTimeout(timer)
};

export class RsvpPlaybackController {
	private currentToken: RsvpToken | null = null;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private generation = 0;
	private disposed = false;
	private isAdvancing = false;
	private playing = false;

	constructor(
		private readonly source: RsvpPlaybackSource,
		private readonly callbacks: RsvpPlaybackCallbacks,
		private readonly clock: RsvpTimer = defaultTimer,
		private wpm = 300
	) {}

	get isPlaying(): boolean {
		return this.playing;
	}

	get token(): RsvpToken | null {
		return this.currentToken;
	}

	setToken(token: RsvpToken | null): void {
		this.currentToken = token;
		if (token) this.callbacks.onToken(token);
	}

	setWpm(wpm: number): void {
		this.wpm = wpm;
		if (this.playing) this.schedule();
	}

	play(): void {
		if (this.disposed || !this.currentToken || this.playing) return;
		this.playing = true;
		this.callbacks.onPlayingChange?.(true);
		this.schedule();
	}

	pause(): void {
		if (!this.playing && !this.timer) return;
		this.playing = false;
		this.clearTimer();
		this.callbacks.onPlayingChange?.(false);
	}

	async moveWords(delta: number): Promise<void> {
		await this.move(() => this.source.moveWords(delta));
	}

	async moveSentence(direction: 'previous' | 'next'): Promise<void> {
		await this.move(() => this.source.moveSentence(direction));
	}

	private async move(loader: () => Promise<RsvpToken | null>): Promise<void> {
		if (this.disposed || this.isAdvancing) return;
		const shouldResume = this.playing;
		this.clearTimer();
		const generation = this.generation;
		this.isAdvancing = true;
		try {
			const token = await loader();
			if (this.disposed) return;
			if (token) {
				this.currentToken = token;
				this.callbacks.onToken(token);
				if (this.playing && (shouldResume || generation !== this.generation)) this.schedule();
			}
		} catch (error: unknown) {
			this.pause();
			this.callbacks.onError?.(error);
		} finally {
			this.isAdvancing = false;
		}
	}

	private schedule(): void {
		this.clearTimer();
		if (!this.playing || !this.currentToken || this.disposed) return;
		const generation = this.generation;
		this.timer = this.clock.setTimeout(() => {
			this.timer = null;
			if (!this.playing || this.disposed || generation !== this.generation) return;
			void this.advance(generation);
		}, getRsvpDelayMs(this.wpm, this.currentToken));
	}

	private async advance(generation: number): Promise<void> {
		if (this.isAdvancing || !this.playing || this.disposed || generation !== this.generation) return;
		this.isAdvancing = true;
		try {
			const token = await this.source.moveWords(1);
			if (this.disposed) return;
			if (!token) {
				this.playing = false;
				this.callbacks.onPlayingChange?.(false);
				this.callbacks.onCompleted?.();
				return;
			}
			this.currentToken = token;
			this.callbacks.onToken(token);
			if (this.playing) this.schedule();
		} catch (error: unknown) {
			this.pause();
			this.callbacks.onError?.(error);
		} finally {
			this.isAdvancing = false;
		}
	}

	private clearTimer(): void {
		this.generation += 1;
		if (this.timer) {
			this.clock.clearTimeout(this.timer);
			this.timer = null;
		}
	}

	destroy(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.pause();
		this.currentToken = null;
	}
}
