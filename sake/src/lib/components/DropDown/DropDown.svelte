<script lang="ts">
	import ChevronDownIcon from '$lib/assets/icons/ChevronDownIcon.svelte';
	import styles from './DropDown.module.scss';

	interface Props {
		options?: string[];
		selected?: string;
		id?: string;
		onchange?: (value: string) => void;
	}

	let {
		options = ['option 1', 'option 2', 'option 3', 'option 4'],
		selected = $bindable(options[0]),
		id,
		onchange
	}: Props = $props();

	function handleChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		selected = target.value;
		onchange?.(selected);
	}
</script>

<div class={styles.wrapper}>
	<select id={id} bind:value={selected} onchange={handleChange} class={styles.dropdown}>
		{#each options as option}
			<option value={option.toLowerCase()}>
				{option.charAt(0).toUpperCase() + option.slice(1).toLowerCase()}
			</option>
		{/each}
	</select>
	<div class={styles.arrow}>
		<ChevronDownIcon size={14} strokeWidth={2} />
	</div>
</div>
