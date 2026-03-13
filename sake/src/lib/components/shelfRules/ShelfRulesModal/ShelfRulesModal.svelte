<script lang="ts">
	import { tick } from 'svelte';
	import { countRuleConditions, createEmptyRuleGroup, type RuleGroup, type RuleNode } from '$lib/types/Library/ShelfRule';
	import ShelfRulesEmptyState from '../ShelfRulesEmptyState/ShelfRulesEmptyState.svelte';
	import ShelfRulesFooter from '../ShelfRulesFooter/ShelfRulesFooter.svelte';
	import ShelfRulesHeader from '../ShelfRulesHeader/ShelfRulesHeader.svelte';
	import ShelfRulesTreeNode from '../ShelfRulesTreeNode/ShelfRulesTreeNode.svelte';
	import { createRuleCondition, createRuleGroup } from '../shelfRulesView';
	import styles from './ShelfRulesModal.module.scss';

	interface Props {
		open: boolean;
		shelfName: string;
		shelfIcon: string;
		initialRuleGroup: RuleGroup;
		pending?: boolean;
		onClose: () => void;
		onSave: (ruleGroup: RuleGroup) => void | Promise<void>;
	}

	let {
		open,
		shelfName,
		shelfIcon,
		initialRuleGroup,
		pending = false,
		onClose,
		onSave
	}: Props = $props();

	let ruleGroup = $state<RuleGroup>(createEmptyRuleGroup());
	let panelEl = $state<HTMLElement | null>(null);
	let previouslyFocusedElement = $state<HTMLElement | null>(null);
	const totalConditions = $derived(countRuleConditions(ruleGroup));

	$effect(() => {
		if (open) {
			ruleGroup = JSON.parse(JSON.stringify(initialRuleGroup)) as RuleGroup;
		}
	});

	$effect(() => {
		if (!open) {
			return;
		}

		previouslyFocusedElement = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;

		void tick().then(() => {
			panelEl?.focus();
		});

		const onKeyDown = (event: KeyboardEvent): void => {
			if (!open) {
				return;
			}

			if (event.key === 'Escape' && !pending) {
				event.preventDefault();
				onClose();
				return;
			}

			if (event.key !== 'Tab' || !panelEl) {
				return;
			}

			const focusableElements = Array.from(
				panelEl.querySelectorAll<HTMLElement>(
					'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
				)
			);

			if (focusableElements.length === 0) {
				event.preventDefault();
				return;
			}

			const first = focusableElements[0];
			const last = focusableElements[focusableElements.length - 1];
			const activeElement = document.activeElement as HTMLElement | null;

			if (event.shiftKey && activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};

		window.addEventListener('keydown', onKeyDown);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			previouslyFocusedElement?.focus();
		};
	});

	function addRootCondition(): void {
		ruleGroup = {
			...ruleGroup,
			children: [...ruleGroup.children, createRuleCondition()]
		};
	}

	function addRootGroup(): void {
		ruleGroup = {
			...ruleGroup,
			children: [...ruleGroup.children, createRuleGroup(ruleGroup.connector === 'AND' ? 'OR' : 'AND')]
		};
	}

	function cleanGroup(group: RuleGroup): RuleGroup {
		return {
			...group,
			children: group.children
				.map((child) => {
					if (child.type === 'condition') {
						return child.value.trim().length > 0 ? child : null;
					}

					const cleaned = cleanGroup(child);
					return cleaned.children.length > 0 ? cleaned : null;
				})
				.filter((child): child is RuleNode => child !== null)
		};
	}

	async function handleSave(): Promise<void> {
		if (pending) {
			return;
		}
		await onSave(cleanGroup(ruleGroup));
	}

	function handleBackdropClose(): void {
		if (!pending) {
			onClose();
		}
	}
</script>

{#if open}
	<div class={styles.modal}>
		<button type="button" class={styles.backdrop} aria-label="Close rules modal" onclick={handleBackdropClose}></button>
		<div class={styles.panel} role="dialog" aria-modal="true" aria-labelledby="shelf-rules-title" tabindex="-1" bind:this={panelEl}>
			<ShelfRulesHeader shelfName={shelfName} shelfIcon={shelfIcon} pending={pending} onClose={onClose} />

			<div class={styles.content}>
				<div class={styles.info}>
					Build a rule tree to automatically include books on this shelf. Nested groups are supported. Manually assigned books always appear regardless of rules.
				</div>

				{#if ruleGroup.children.length === 0}
					<ShelfRulesEmptyState onAddCondition={addRootCondition} onAddGroup={addRootGroup} />
				{:else}
					<ShelfRulesTreeNode group={ruleGroup} isRoot={true} onChange={(updated) => (ruleGroup = updated)} />
				{/if}
			</div>

			<ShelfRulesFooter totalConditions={totalConditions} pending={pending} onClose={onClose} onSave={handleSave} />
		</div>
	</div>
{/if}
