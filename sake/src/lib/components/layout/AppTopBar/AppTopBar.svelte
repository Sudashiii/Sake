<script lang="ts">
	import LogInIcon from '$lib/assets/icons/LogInIcon.svelte';
	import LogOutIcon from '$lib/assets/icons/LogOutIcon.svelte';
	import MenuIcon from '$lib/assets/icons/MenuIcon.svelte';
	import UserCircleIcon from '$lib/assets/icons/UserCircleIcon.svelte';
	import styles from './AppTopBar.module.scss';

	interface Props {
		currentSection: string;
		zlibName: string;
		onToggleMobileSidebar: () => void;
		onOpenAuthModal: () => void;
		onLogout: () => void;
	}

	let { currentSection, zlibName, onToggleMobileSidebar, onOpenAuthModal, onLogout }: Props = $props();
</script>

<header class={styles.root}>
	<div class={styles.left}>
		<button class={styles.mobileMenuBtn} onclick={onToggleMobileSidebar} aria-label="Toggle navigation">
			<MenuIcon size={18} strokeWidth={2.5} />
		</button>
		<span class={styles.sectionName}>{currentSection}</span>
	</div>
	<div class={styles.loginArea}>
		{#if zlibName}
			<div class={styles.userInfo}>
				<span class={styles.userBadge}>
					<UserCircleIcon size={14} strokeWidth={2} />
					{zlibName}
				</span>
				<button class={styles.logoutBtn} onclick={onLogout} title="Logout from Z-Library">
					<LogOutIcon size={16} strokeWidth={2} />
				</button>
			</div>
		{:else}
			<button class={styles.connectBtn} onclick={onOpenAuthModal}>
				<LogInIcon size={16} strokeWidth={2} />
				Connect Z-Library
			</button>
		{/if}
	</div>
</header>
