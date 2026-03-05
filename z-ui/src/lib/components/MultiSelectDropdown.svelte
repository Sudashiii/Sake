<script lang="ts">
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
		if (typeof option === "string") {
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
		const next = isSelected(value)
			? selected.filter((entry) => entry !== value)
			: [...selected, value];

		// Keep selected values in the same order as options.
		selected = normalizedOptions
			.map((entry) => entry.value)
			.filter((entry) => next.includes(entry));
		onchange?.(selected);
	}

	const selectedSummary = $derived.by(() => {
		if (selected.length === 0) {
			return placeholder;
		}
		if (selected.length <= 2) {
			return selected
				.map((value) => labelsByValue.get(value) ?? toLabel(value))
				.join(', ');
		}
		return `${selected.length} selected`;
	});
</script>

<details class="multi-dropdown">
	<summary
		id={id}
		class="multi-dropdown-summary"
		aria-labelledby={labelId}
	>
		<span class:placeholder={selected.length === 0}>{selectedSummary}</span>
		<span class="arrow" aria-hidden="true">
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="6 9 12 15 18 9"></polyline>
			</svg>
		</span>
	</summary>
	<div class="multi-dropdown-menu" role="group" aria-labelledby={labelId}>
		{#each normalizedOptions as option}
			<label class="multi-dropdown-option">
				<input
					type="checkbox"
					checked={isSelected(option.value)}
					onchange={() => toggleOption(option.value)}
				/>
				<span>{option.label}</span>
			</label>
		{/each}
	</div>
</details>

<style>
	.multi-dropdown {
		position: relative;
		display: inline-block;
	}

	.multi-dropdown-summary {
		min-width: 10rem;
		padding: 0.5rem 2rem 0.5rem 0.68rem;
		border-radius: 0.5rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface-2);
		color: var(--color-text-secondary);
		font-size: 0.78rem;
		font-weight: 500;
		cursor: pointer;
		list-style: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.multi-dropdown-summary::-webkit-details-marker {
		display: none;
	}

	.multi-dropdown-summary:hover {
		color: var(--color-text-primary);
		border-color: rgba(255, 255, 255, 0.16);
	}

	.multi-dropdown[open] .multi-dropdown-summary,
	.multi-dropdown-summary:focus-visible {
		outline: none;
		border-color: rgba(201, 169, 98, 0.52);
		box-shadow: 0 0 0 2px rgba(201, 169, 98, 0.16);
	}

	.placeholder {
		color: var(--color-text-muted);
	}

	.arrow {
		display: inline-flex;
		align-items: center;
		color: var(--color-text-muted);
		transition: transform 0.16s ease;
	}

	.multi-dropdown[open] .arrow {
		transform: rotate(180deg);
	}

	.multi-dropdown-menu {
		position: absolute;
		top: calc(100% + 0.35rem);
		left: 0;
		z-index: 20;
		min-width: 100%;
		max-height: 14rem;
		overflow: auto;
		padding: 0.35rem;
		border-radius: 0.55rem;
		border: 1px solid var(--color-border);
		background: #161b27;
		box-shadow: 0 16px 30px -22px rgba(0, 0, 0, 0.85);
	}

	.multi-dropdown-option {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.34rem 0.38rem;
		border-radius: 0.4rem;
		font-size: 0.76rem;
		color: var(--color-text-secondary);
		cursor: pointer;
	}

	.multi-dropdown-option:hover {
		background: rgba(255, 255, 255, 0.05);
		color: var(--color-text-primary);
	}

	.multi-dropdown-option input {
		margin: 0;
		accent-color: var(--color-primary);
	}
</style>
