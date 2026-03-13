<script lang="ts">
	import ChevronDownIcon from '$lib/assets/icons/ChevronDownIcon.svelte';
	import styles from './MultiSelectDropdown.module.scss';

	export interface MultiSelectOption {
		value: string;
		label: string;
	}

	interface Props {
		options?: Array<string | MultiSelectOption>;
		selected?: string[];
		id?: string;
		labelId?: string;
		placeholder?: string;
		onchange?: (value: string[]) => void;
	}

	let {
		options = [],
		selected = $bindable<string[]>([]),
		id,
		labelId,
		placeholder = 'Select',
		onchange
	}: Props = $props();

	function toLabel(value: string): string {
		if (!value) return value;
		return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
	}

	function toOption(option: string | MultiSelectOption): MultiSelectOption | null {
		if (typeof option === 'string') {
			const trimmed = option.trim();
			if (!trimmed) {
				return null;
			}
			return { value: trimmed, label: toLabel(trimmed) };
		}
		const value = option.value.trim();
		const label = option.label.trim();
		if (!value || !label) {
			return null;
		}
		return { value, label };
	}

	const normalizedOptions = $derived.by(() => {
		const values = new Set<string>();
		const normalized: MultiSelectOption[] = [];
		for (const option of options) {
			const parsed = toOption(option);
			if (!parsed || values.has(parsed.value)) {
				continue;
			}
			values.add(parsed.value);
			normalized.push(parsed);
		}
		return normalized;
	});

	const labelsByValue = $derived.by(() => {
		const map = new Map<string, string>();
		for (const option of normalizedOptions) {
			map.set(option.value, option.label);
		}
		return map;
	});

	function isSelected(value: string): boolean {
		return selected.includes(value);
	}

	function toggleOption(value: string): void {
		const next = isSelected(value) ? selected.filter((entry) => entry !== value) : [...selected, value];

		selected = normalizedOptions.map((entry) => entry.value).filter((entry) => next.includes(entry));
		onchange?.(selected);
	}

	const selectedSummary = $derived.by(() => {
		if (selected.length === 0) {
			return placeholder;
		}
		if (selected.length <= 2) {
			return selected.map((value) => labelsByValue.get(value) ?? toLabel(value)).join(', ');
		}
		return `${selected.length} selected`;
	});
</script>

<details class={styles.multiDropdown}>
	<summary id={id} class={styles.summary} aria-labelledby={labelId}>
		<span class={selected.length === 0 ? styles.placeholder : ''}>{selectedSummary}</span>
		<span class={styles.arrow} aria-hidden="true">
			<ChevronDownIcon size={14} strokeWidth={2} />
		</span>
	</summary>
	<div class={styles.menu} role="group" aria-labelledby={labelId}>
		{#each normalizedOptions as option}
			<label class={styles.option}>
				<input type="checkbox" checked={isSelected(option.value)} onchange={() => toggleOption(option.value)} />
				<span>{option.label}</span>
			</label>
		{/each}
	</div>
</details>
