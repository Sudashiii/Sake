<script lang="ts">
	import { FORMAT_COLORS } from '$lib/features/stats/statsView';
	import type { DistributionEntry } from '$lib/features/stats/statsView';
	import styles from './FormatDistributionCard.module.scss';

	interface Props {
		booksByFormat: DistributionEntry[];
		formatPieGradient: string;
	}

	let { booksByFormat, formatPieGradient }: Props = $props();
</script>

<article class={styles.card}>
	<div class={styles.cardHead}><h3>Books by Format</h3></div>
	<div class={styles.pieWrap}>
		<div class={styles.pie} style={`background: ${formatPieGradient}`}></div>
		<div class={styles.pieHole}></div>
	</div>
	<div class={styles.legendGrid}>
		{#each booksByFormat as format, index}
			<div>
				<span style={`background: ${FORMAT_COLORS[index % FORMAT_COLORS.length]}`}></span>
				<p>{format.name} ({format.value})</p>
			</div>
		{/each}
	</div>
</article>
