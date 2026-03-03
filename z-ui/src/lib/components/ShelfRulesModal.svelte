<script lang="ts">
	import ShelfRulesTreeNode from '$lib/components/ShelfRulesTreeNode.svelte';
	import {
		countRuleConditions,
		createEmptyRuleGroup,
		type RuleGroup,
		type RuleNode
	} from '$lib/types/Library/ShelfRule';

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
	let totalConditions = $derived(countRuleConditions(ruleGroup));

	$effect(() => {
		if (open) {
			ruleGroup = JSON.parse(JSON.stringify(initialRuleGroup)) as RuleGroup;
		}
	});

	function addRootCondition(): void {
		ruleGroup = {
			...ruleGroup,
			children: [
				...ruleGroup.children,
				{
					id: `cond-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
					type: 'condition',
					field: 'status',
					operator: 'equals',
					value: ''
				}
			]
		};
	}

	function addRootGroup(): void {
		ruleGroup = {
			...ruleGroup,
			children: [
				...ruleGroup.children,
				{
					id: `grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
					type: 'group',
					connector: ruleGroup.connector === 'AND' ? 'OR' : 'AND',
					children: []
				}
			]
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
</script>

{#if open}
	<div class="rules-modal">
		<button type="button" class="rules-backdrop" aria-label="Close rules modal" onclick={onClose}></button>
		<div class="rules-panel">
			<header class="rules-head">
				<div class="rules-title-wrap">
					<div class="rules-icon" aria-hidden="true">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
							<polygon points="3 4 21 4 14 12 14 19 10 21 10 12 3 4"></polygon>
						</svg>
					</div>
					<div>
						<h2>Shelf Rules</h2>
						<p>{shelfIcon} {shelfName}</p>
					</div>
				</div>
				<button type="button" class="rules-close" onclick={onClose} disabled={pending}>✕</button>
			</header>

			<div class="rules-content">
				<div class="rules-info">
					Build a rule tree to automatically include books on this shelf. Nested groups are supported.
					Manually assigned books always appear regardless of rules.
				</div>

				{#if ruleGroup.children.length === 0}
					<div class="rules-empty">
						<p class="rules-empty-title">No rules defined</p>
						<p class="rules-empty-text">Add conditions or groups to automatically include matching books.</p>
						<div class="rules-empty-actions">
							<button type="button" class="rules-empty-btn" onclick={addRootCondition}>Add Condition</button>
							<button type="button" class="rules-empty-btn" onclick={addRootGroup}>Add Group</button>
						</div>
					</div>
				{:else}
					<ShelfRulesTreeNode group={ruleGroup} isRoot={true} onChange={(updated) => (ruleGroup = updated)} />
				{/if}
			</div>

			<footer class="rules-foot">
				<p class="rules-count">
					{#if totalConditions > 0}
						{totalConditions} condition{totalConditions === 1 ? '' : 's'}
					{:else}
						Manual assignment only
					{/if}
				</p>
				<div class="rules-actions">
					<button type="button" class="rules-btn cancel" onclick={onClose} disabled={pending}>Cancel</button>
					<button type="button" class="rules-btn save" onclick={() => void handleSave()} disabled={pending}>
						{pending ? 'Saving...' : 'Save Rules'}
					</button>
				</div>
			</footer>
		</div>
	</div>
{/if}

<style>
	.rules-modal {
		position: fixed;
		inset: 0;
		z-index: 160;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.rules-backdrop {
		position: absolute;
		inset: 0;
		border: 0;
		background: rgba(0, 0, 0, 0.68);
		backdrop-filter: blur(4px);
	}

	.rules-panel {
		position: relative;
		z-index: 1;
		width: min(100%, 42rem);
		max-height: 85vh;
		display: flex;
		flex-direction: column;
		border-radius: 1rem;
		border: 1px solid var(--color-border);
		background: color-mix(in oklab, var(--color-surface), white 2%);
		box-shadow: 0 26px 50px rgba(0, 0, 0, 0.45);
		overflow: hidden;
	}

	.rules-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid var(--color-border);
	}

	.rules-title-wrap {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}

	.rules-icon {
		width: 2rem;
		height: 2rem;
		border-radius: 0.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in oklab, var(--color-primary), transparent 90%);
		color: color-mix(in oklab, var(--color-primary), white 8%);
	}

	.rules-head h2 {
		margin: 0;
		font-size: 1.05rem;
		line-height: 1.2;
	}

	.rules-head p {
		margin: 0.12rem 0 0;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.rules-close {
		width: 2rem;
		height: 2rem;
		border-radius: 0.56rem;
		border: 1px solid transparent;
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.rules-close:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.06);
		color: var(--color-text-primary);
	}

	.rules-content {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
		display: grid;
		gap: 1rem;
	}

	.rules-info {
		border-radius: 0.5rem;
		padding: 0.75rem;
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--color-text-secondary);
		background: color-mix(in oklab, var(--color-surface), white 10%);
	}

	.rules-empty {
		border-radius: 0.5rem;
		border: 1px dashed color-mix(in oklab, var(--color-border), transparent 15%);
		padding: 2rem 1rem;
		text-align: center;
	}

	.rules-empty-title {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-text-primary);
	}

	.rules-empty-text {
		margin: 0.3rem 0 0;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.rules-empty-actions {
		margin-top: 1rem;
		display: inline-flex;
		gap: 0.5rem;
	}

	.rules-empty-btn {
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-text-secondary);
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.75rem;
		cursor: pointer;
	}

	.rules-empty-btn:hover {
		color: var(--color-text-primary);
		border-color: color-mix(in oklab, var(--color-primary), transparent 45%);
	}

	.rules-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.7rem;
		padding: 1rem 1.5rem;
		border-top: 1px solid var(--color-border);
	}

	.rules-count {
		margin: 0;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.rules-actions {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
	}

	.rules-btn {
		border: 0;
		border-radius: 0.5rem;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.rules-btn.cancel {
		background: rgba(255, 255, 255, 0.08);
		color: var(--color-text-primary);
	}

	.rules-btn.cancel:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.12);
	}

	.rules-btn.save {
		background: var(--color-primary);
		color: var(--color-primary-foreground);
	}

	.rules-btn.save:hover:not(:disabled) {
		filter: brightness(0.96);
	}

	.rules-btn:disabled,
	.rules-close:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	@media (max-width: 760px) {
		.rules-panel {
			max-height: 90vh;
		}

		.rules-head,
		.rules-content,
		.rules-foot {
			padding-left: 1rem;
			padding-right: 1rem;
		}

		.rules-foot {
			flex-direction: column;
			align-items: stretch;
		}

		.rules-actions {
			width: 100%;
		}

		.rules-btn {
			flex: 1;
		}
	}
</style>
