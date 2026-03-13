<script lang="ts">
	import { RULE_FIELD_OPTIONS, type RuleField, type RuleOperator, type ShelfCondition } from '$lib/types/Library/ShelfRule';
	import { getFieldType, getOperatorsForField, getRulePlaceholder } from '../shelfRulesView';
	import styles from './ShelfRuleConditionRow.module.scss';

	interface Props {
		condition: ShelfCondition;
		onChange: (updated: ShelfCondition) => void;
		onRemove: () => void;
	}

	let { condition, onChange, onRemove }: Props = $props();

	const fieldType = $derived(getFieldType(condition.field));
	const operators = $derived(getOperatorsForField(condition.field));

	function handleFieldChange(event: Event): void {
		const nextField = (event.currentTarget as HTMLSelectElement).value as RuleField;
		const nextType = getFieldType(nextField);
		const previousType = getFieldType(condition.field);

		onChange({
			...condition,
			field: nextField,
			operator: nextType !== previousType ? 'equals' : condition.operator
		});
	}

	function handleOperatorChange(event: Event): void {
		onChange({
			...condition,
			operator: (event.currentTarget as HTMLSelectElement).value as RuleOperator
		});
	}

	function handleValueChange(event: Event): void {
		onChange({
			...condition,
			value: (event.currentTarget as HTMLInputElement).value
		});
	}
</script>

<div class={styles.root}>
	<div class={styles.controls}>
		<div class={styles.selectWrap}>
			<select value={condition.field} onchange={handleFieldChange}>
				{#each RULE_FIELD_OPTIONS as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>

		<div class={`${styles.selectWrap} ${styles.operatorWrap}`}>
			<select value={condition.operator} onchange={handleOperatorChange}>
				{#each operators as operator}
					<option value={operator.value}>{operator.label}</option>
				{/each}
			</select>
		</div>

		<input
			type={fieldType === 'number' ? 'number' : 'text'}
			value={condition.value}
			placeholder={getRulePlaceholder(condition.field)}
			oninput={handleValueChange}
		/>
	</div>
	<button type="button" class={styles.removeButton} onclick={onRemove}>✕</button>
</div>
