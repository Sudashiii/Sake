<script lang="ts">
	import SidebarMenuIcon from '../SidebarMenuIcon.svelte';
	import styles from './SidebarNavItem.module.scss';
	import type { MenuItem } from '$lib/types/Navigation';

	interface Props {
		item: MenuItem;
		active?: boolean;
		collapsed?: boolean;
		onClick?: () => void;
	}

	let { item, active = false, collapsed = false, onClick }: Props = $props();
</script>

<a href={item.href} class={`${styles.root} ${active ? styles.active : ''} ${collapsed ? styles.collapsed : ''}`} title={collapsed ? item.label : undefined} onclick={onClick}>
	<span class="icon"><SidebarMenuIcon icon={item.icon} size={20} /></span>
	{#if !collapsed}
		<span class="label">{item.label}</span>
	{/if}
</a>
