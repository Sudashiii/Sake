<script lang="ts">
	import styles from './ArchivedHeader.module.scss';

	interface Props {
		count: number;
	}

	let { count }: Props = $props();
</script>

<header class={styles.root}>
	<h2>Archived</h2>
	<p>
		{count} archived book{count === 1 ? '' : 's'}. These books are hidden from your main library view.
	</p>
</header>
