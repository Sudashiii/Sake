<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		settingsUrl: string;
		inputIdPrefix: string;
		note: string;
		placeholder?: string;
	}

	let {
		settingsUrl,
		inputIdPrefix,
		note,
		placeholder = 'https://mirror.example'
	}: Props = $props();

	const maxMirrors = 5;
	const maxMirrorUrlLength = 2048;
	let urls = $state<string[]>([]);
	let saved = $state<string[]>([]);
	let mirrorError = $state<string | null>(null);
	let mirrorNotice = $state<string | null>(null);
	let loadingMirrors = $state(true);
	let savingMirrors = $state(false);
	const changed = $derived(JSON.stringify(urls) !== JSON.stringify(saved));

	onMount(() => {
		void loadMirrors();
	});

	async function loadMirrors() {
		try {
			const response = await fetch(settingsUrl);
			const data = (await response.json()) as { urls?: string[]; error?: string };
			if (!response.ok) throw new Error(data.error);
			urls = data.urls ?? [];
			saved = [...urls];
		} catch (cause) {
			mirrorError = cause instanceof Error ? cause.message : 'Failed to load mirrors';
		} finally {
			loadingMirrors = false;
		}
	}

	function updateUrl(index: number, value: string) {
		urls = urls.map((url, currentIndex) => (currentIndex === index ? value : url));
	}

	function moveUrl(index: number, direction: -1 | 1) {
		const targetIndex = index + direction;
		if (targetIndex < 0 || targetIndex >= urls.length) return;

		const next = [...urls];
		const current = next[index];
		const target = next[targetIndex];
		if (current === undefined || target === undefined) return;
		next[index] = target;
		next[targetIndex] = current;
		urls = next;
	}

	async function saveMirrors() {
		const next = urls.map((url) => url.trim()).filter(Boolean);
		if (!next.length) {
			mirrorError = 'Add at least one mirror URL.';
			return;
		}
		if (next.length > maxMirrors) {
			mirrorError = `You can configure at most ${maxMirrors} mirrors.`;
			return;
		}
		if (next.some((url) => url.length > maxMirrorUrlLength)) {
			mirrorError = `Mirror URLs must be at most ${maxMirrorUrlLength} characters.`;
			return;
		}

		savingMirrors = true;
		mirrorError = null;
		mirrorNotice = null;
		try {
			const response = await fetch(settingsUrl, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ urls: next })
			});
			const data = (await response.json()) as { urls?: string[]; error?: string };
			if (!response.ok) throw new Error(data.error);
			urls = data.urls ?? [];
			saved = [...urls];
			mirrorNotice = 'Mirror configuration saved.';
		} catch (cause) {
			mirrorError = cause instanceof Error ? cause.message : 'Failed to save mirrors';
		} finally {
			savingMirrors = false;
		}
	}
</script>

<div class="mirror-settings">
	<div>
		<h4>Mirrors</h4>
		<p class="integration-note">{note}</p>
	</div>
	{#if loadingMirrors}
		<p class="integration-note">Loading mirror configuration...</p>
	{:else}
		{#each urls as url, index}
			<div class="mirror-row">
				<label class="sr-only" for={`${inputIdPrefix}-${index}`}>Mirror {index + 1}</label>
				<input
					id={`${inputIdPrefix}-${index}`}
					type="url"
					value={url}
					placeholder={placeholder}
					maxlength={maxMirrorUrlLength}
					disabled={savingMirrors}
					oninput={(event) => updateUrl(index, event.currentTarget.value)}
				/>
				<button
					type="button"
					disabled={index === 0 || savingMirrors}
					aria-label={`Move mirror ${index + 1} up`}
					onclick={() => moveUrl(index, -1)}>↑</button
				>
				<button
					type="button"
					disabled={index === urls.length - 1 || savingMirrors}
					aria-label={`Move mirror ${index + 1} down`}
					onclick={() => moveUrl(index, 1)}>↓</button
				>
				<button
					type="button"
					disabled={urls.length === 1 || savingMirrors}
					aria-label={`Remove mirror ${index + 1}`}
					onclick={() => (urls = urls.filter((_, currentIndex) => currentIndex !== index))}
				>
					Remove
				</button>
			</div>
		{/each}
		{#if mirrorError}<p class="integration-error" role="alert">{mirrorError}</p>{/if}
		{#if mirrorNotice}<p class="integration-success" role="status">{mirrorNotice}</p>{/if}
		<div class="mirror-actions">
			<button
				type="button"
				disabled={savingMirrors || urls.length >= maxMirrors}
				onclick={() => (urls = [...urls, ''])}>Add mirror</button
			>
			<button type="button" class="integration-sync-button" disabled={!changed || savingMirrors} onclick={saveMirrors}>
				{savingMirrors ? 'Saving...' : 'Save mirrors'}
			</button>
		</div>
	{/if}
</div>
