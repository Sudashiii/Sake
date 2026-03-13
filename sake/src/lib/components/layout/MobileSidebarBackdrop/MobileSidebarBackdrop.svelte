<script lang="ts">
	import styles from './MobileSidebarBackdrop.module.scss';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();
</script>

<div
	class={styles.root}
	role="button"
	tabindex="0"
	aria-label="Close navigation menu"
	onclick={onClose}
	onkeydown={(event) => (event.key === 'Enter' || event.key === ' ') && onClose()}
></div>
