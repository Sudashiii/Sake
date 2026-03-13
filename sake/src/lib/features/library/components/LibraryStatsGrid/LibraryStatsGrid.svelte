<script lang="ts">
	import styles from './LibraryStatsGrid.module.scss';

	interface Props {
		stats: {
			total: number;
			reading: number;
			unread: number;
			read: number;
		};
	}

	let { stats }: Props = $props();
</script>

<section class={styles.root}>
	<div class="stat-card"><p>Total Books</p><h2>{stats.total}</h2></div>
	<div class="stat-card"><p>Reading</p><h2 class="accent-reading">{stats.reading}</h2></div>
	<div class="stat-card"><p>Unread</p><h2 class="accent-unread">{stats.unread}</h2></div>
	<div class="stat-card"><p>Completed</p><h2 class="accent-read">{stats.read}</h2></div>
</section>
