<script lang="ts">
	import ArchiveBoxIcon from '$lib/assets/icons/ArchiveBoxIcon.svelte';
	import LibraryIcon from '$lib/assets/icons/LibraryIcon.svelte';
	import QueueIcon from '$lib/assets/icons/QueueIcon.svelte';
	import SearchIcon from '$lib/assets/icons/SearchIcon.svelte';
	import StatsIcon from '$lib/assets/icons/StatsIcon.svelte';
	import Trash2Icon from '$lib/assets/icons/Trash2Icon.svelte';
	import type { MenuItem } from '$lib/types/Navigation';

	interface Props {
		icon?: MenuItem['icon'];
		size?: number;
		class?: string;
	}

	let { icon, size = 20, class: className = '' }: Props = $props();
</script>

{#if icon === 'search'}
	<SearchIcon size={size} class={className} decorative={true} />
{:else if icon === 'library'}
	<LibraryIcon size={size} class={className} decorative={true} />
{:else if icon === 'queue'}
	<QueueIcon size={size} class={className} decorative={true} />
{:else if icon === 'stats'}
	<StatsIcon size={size} class={className} decorative={true} />
{:else if icon === 'archive'}
	<ArchiveBoxIcon size={size} class={className} decorative={true} />
{:else if icon === 'trash'}
	<Trash2Icon size={size} class={className} decorative={true} />
{/if}
