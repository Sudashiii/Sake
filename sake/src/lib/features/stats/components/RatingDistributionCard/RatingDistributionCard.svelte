<script lang="ts">
	import type { RatingDistributionEntry } from '$lib/features/stats/statsView';
	import styles from './RatingDistributionCard.module.scss';

	interface Props {
		ratingDistribution: RatingDistributionEntry[];
		maxRatingCount: number;
	}

	let { ratingDistribution, maxRatingCount }: Props = $props();
</script>

<article class={styles.card}>
	<div class={styles.cardHead}><h3>Rating Distribution</h3></div>
	<div class={styles.rows}>
		{#each ratingDistribution as rating}
			<div class={styles.row} data-tooltip={`${rating.label}: ${rating.value} book${rating.value === 1 ? '' : 's'}`}>
				<span>{rating.label}</span>
				<div class={styles.track}>
					<div class={styles.fill} style={`width: ${(rating.value / maxRatingCount) * 100}%`}></div>
				</div>
				<em>{rating.value}</em>
			</div>
		{/each}
	</div>
</article>
