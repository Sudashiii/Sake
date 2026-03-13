<script lang="ts">
	import type { IconProps } from './IconProps';
	let { size = 20, class: className = '', decorative = true, title = 'Library', strokeWidth = 2 }: IconProps = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className} role={decorative ? undefined : 'img'} aria-hidden={decorative} aria-label={decorative ? undefined : title}>
	<path d="m16 6 4 14"></path>
	<path d="M12 6v14"></path>
	<path d="M8 8v12"></path>
	<path d="M4 4v16"></path>
</svg>
