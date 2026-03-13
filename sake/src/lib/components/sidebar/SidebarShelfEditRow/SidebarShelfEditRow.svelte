<script lang="ts">
	import { onMount } from 'svelte';
	import styles from './SidebarShelfEditRow.module.scss';

	interface Props {
		name?: string;
		icon?: string;
		showEmojiPicker?: boolean;
		emojiOptions: string[];
		placeholder?: string;
		confirmLabel: string;
		disabled?: boolean;
		autofocus?: boolean;
		onToggleEmojiPicker: () => void;
		onSelectEmoji: (emoji: string) => void;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let {
		name = $bindable(''),
		icon = $bindable('📚'),
		showEmojiPicker = $bindable(false),
		emojiOptions,
		placeholder = 'Shelf name',
		confirmLabel,
		disabled = false,
		autofocus = false,
		onToggleEmojiPicker,
		onSelectEmoji,
		onConfirm,
		onCancel
	}: Props = $props();

	let inputEl = $state<HTMLInputElement | null>(null);

	onMount(() => {
		if (autofocus) {
			inputEl?.focus();
		}
	});
</script>

<div class={styles.root}>
	<div class="shelf-emoji-picker-wrap">
		<span class="shelf-icon shelf-icon-edit" aria-hidden="true">{icon}</span>
		<button type="button" class="shelf-emoji-hitbox" aria-label="Select shelf icon" onclick={onToggleEmojiPicker}></button>
		{#if showEmojiPicker}
			<button type="button" class="menu-backdrop" aria-label="Close emoji picker" onclick={onToggleEmojiPicker}></button>
			<div class="shelf-emoji-menu">
				{#each emojiOptions as emoji}
					<button type="button" class={`shelf-emoji-option ${icon === emoji ? 'active' : ''}`} onclick={() => onSelectEmoji(emoji)}>{emoji}</button>
				{/each}
			</div>
		{/if}
	</div>
	<input bind:this={inputEl} bind:value={name} class="shelf-edit-input" {placeholder} onkeydown={(event) => {
		if (event.key === 'Enter') onConfirm();
		if (event.key === 'Escape') onCancel();
	}} />
	<button type="button" class="shelf-inline-btn save" onclick={onConfirm} disabled={disabled}>{confirmLabel}</button>
	<button type="button" class="shelf-inline-btn cancel" onclick={onCancel}>✕</button>
</div>
