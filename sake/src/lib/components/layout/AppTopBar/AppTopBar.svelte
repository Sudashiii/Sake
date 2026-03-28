<script lang="ts">
	import MenuIcon from '$lib/assets/icons/MenuIcon.svelte';
	import styles from './AppTopBar.module.scss';

	interface Props {
		currentSection: string;
		onToggleMobileSidebar: () => void;
	}

	let { currentSection, onToggleMobileSidebar }: Props = $props();
</script>

<header class={styles.root}>
	<div class={styles.left}>
		<button class={styles.mobileMenuBtn} onclick={onToggleMobileSidebar} aria-label="Toggle navigation">
			<MenuIcon size={18} strokeWidth={2.5} />
		</button>
		<span class={styles.sectionName}>{currentSection}</span>
	</div>
</header>
