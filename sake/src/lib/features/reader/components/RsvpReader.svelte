<script lang="ts">
	import { onMount } from 'svelte';
	import type { ReaderTheme } from '../readerAppearance';
	import {
		MAX_RSVP_TEXT_SCALE,
		MAX_RSVP_WPM,
		MIN_RSVP_TEXT_SCALE,
		MIN_RSVP_WPM,
		RSVP_TEXT_SCALE_STEP,
		RSVP_WPM_STEP
	} from '../rsvpPreferences';
	import { splitRsvpWord, type RsvpToken } from '../rsvpText';
	import styles from './RsvpReader.module.scss';

	interface Props {
		token: RsvpToken | null;
		isPlaying: boolean;
		isCompleted: boolean;
		isLoading: boolean;
		wpm: number;
		textScale: number;
		showGuideLine: boolean;
		autoAnnotateLastWord: boolean;
		percentFinished: number;
		chapterTitle: string;
		theme: ReaderTheme;
		error: string | null;
		onTogglePlay: () => void;
		onJumpWords: (delta: number) => void;
		onJumpSentence: (direction: 'previous' | 'next') => void;
		onWpmChange: (wpm: number) => void;
		onTextScaleChange: (scale: number) => void;
		onShowGuideLineChange: (show: boolean) => void;
		onAutoAnnotateLastWordChange: (enabled: boolean) => void;
		onExit: () => void;
	}

	let {
		token,
		isPlaying,
		isCompleted,
		isLoading,
		wpm,
		textScale,
		showGuideLine,
		autoAnnotateLastWord,
		percentFinished,
		chapterTitle,
		theme,
		error,
		onTogglePlay,
		onJumpWords,
		onJumpSentence,
		onWpmChange,
		onTextScaleChange,
		onShowGuideLineChange,
		onAutoAnnotateLastWordChange,
		onExit
	}: Props = $props();

	let word = $derived(token ? splitRsvpWord(token) : null);
	let displayFontSize = $derived(Math.max(48, Math.min(180, Math.round(72 * textScale / 100))));

	function updateWpm(event: Event): void {
		onWpmChange(Number((event.currentTarget as HTMLInputElement).value));
	}

	function updateTextScale(event: Event): void {
		onTextScaleChange(Number((event.currentTarget as HTMLInputElement).value));
	}

	function updateGuideLine(event: Event): void {
		onShowGuideLineChange((event.currentTarget as HTMLInputElement).checked);
	}

	function updateAutoAnnotateLastWord(event: Event): void {
		onAutoAnnotateLastWordChange((event.currentTarget as HTMLInputElement).checked);
	}

	function isEditableTarget(target: EventTarget | null): boolean {
		return target instanceof HTMLElement &&
			(target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName));
	}

	onMount(() => {
		const handleKeydown = (event: KeyboardEvent): void => {
			if (event.defaultPrevented || isEditableTarget(event.target)) return;
			if (event.key === 'Escape') {
				event.preventDefault();
				onExit();
				return;
			}
			if (event.code === 'Space') {
				event.preventDefault();
				onTogglePlay();
				return;
			}
			if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
				event.preventDefault();
				if (event.shiftKey) {
					onJumpSentence(event.key === 'ArrowLeft' ? 'previous' : 'next');
				} else {
					onJumpWords(event.key === 'ArrowLeft' ? -10 : 10);
				}
				return;
			}
			if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
				event.preventDefault();
				onWpmChange(wpm + (event.key === 'ArrowUp' ? RSVP_WPM_STEP : -RSVP_WPM_STEP));
			}
		};

		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

<section
	class={`${styles.root} ${theme === 'paper' ? styles.paper : theme === 'night' ? styles.night : styles.sepia}`}
	style={`--rsvp-guide-gap: ${Math.round(displayFontSize / 2 + 18)}px`}
	aria-label="RSVP reader"
>
	<div class={styles.context}>
		<span>{chapterTitle || 'RSVP mode'}</span>
		<span>{Math.round(Math.max(0, Math.min(1, percentFinished)) * 100)}%</span>
	</div>

	<div class={styles.stage}>
		<div class={`${styles.guides} ${showGuideLine ? '' : styles.guidesWithoutLine}`} aria-hidden="true"><span></span><span></span></div>
		{#if isLoading}
			<p class={styles.message}>Preparing RSVP…</p>
		{:else if error}
			<p class={styles.message} role="alert">{error}</p>
		{:else if isCompleted}
			<p class={styles.message}>Book complete</p>
		{:else if word}
			<button
				class={styles.word}
				style={`font-size: ${displayFontSize}px`}
				aria-label={isPlaying ? 'Pause RSVP playback' : 'Play RSVP playback'}
				onclick={onTogglePlay}
			>
				<span class={styles.prefix}>{word.prefix}</span><strong class={styles.focus}>{word.focus}</strong><span class={styles.suffix}>{word.suffix}</span>
			</button>
		{:else}
			<p class={styles.message}>No readable text in this book section.</p>
		{/if}
	</div>

	<div class={styles.controls}>
		<div class={styles.transport} aria-label="RSVP navigation">
			<button type="button" onclick={() => onJumpSentence('previous')} disabled={!token} title="Previous sentence">Sentence −</button>
			<button type="button" onclick={() => onJumpWords(-10)} disabled={!token} title="Back ten words">−10</button>
			<button type="button" class={styles.play} onclick={onTogglePlay} disabled={!token || Boolean(error)} aria-pressed={isPlaying}>{isPlaying ? 'Pause' : 'Play'}</button>
			<button type="button" onclick={() => onJumpWords(10)} disabled={!token} title="Forward ten words">+10</button>
			<button type="button" onclick={() => onJumpSentence('next')} disabled={!token} title="Next sentence">Sentence +</button>
			<button type="button" class={styles.pageMode} onclick={onExit}>Page View</button>
		</div>

		<label class={styles.speed}>
			<span>Speed <strong>{wpm} WPM</strong></span>
			<input type="range" min={MIN_RSVP_WPM} max={MAX_RSVP_WPM} step={RSVP_WPM_STEP} value={wpm} oninput={updateWpm} />
		</label>
		<label class={styles.speed}>
			<span>Text size <strong>{textScale}%</strong></span>
			<input
				type="range"
				min={MIN_RSVP_TEXT_SCALE}
				max={MAX_RSVP_TEXT_SCALE}
				step={RSVP_TEXT_SCALE_STEP}
				value={textScale}
				oninput={updateTextScale}
				aria-label="RSVP text size"
			/>
		</label>
		<div class={styles.options}>
			<label class={styles.toggle}>
				<input type="checkbox" checked={showGuideLine} onchange={updateGuideLine} />
				<span>Horizontal guide</span>
			</label>
			<label class={styles.toggle}>
				<input type="checkbox" checked={autoAnnotateLastWord} onchange={updateAutoAnnotateLastWord} />
				<span>Save last word as note</span>
			</label>
		</div>
		<p class={styles.hint}>Space play/pause · ←/→ ten words · Shift+←/→ sentence · ↑/↓ speed</p>
	</div>
</section>
