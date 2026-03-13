<script lang="ts">
	import type { IconProps } from './IconProps';
	let { size = 17, class: className = '', decorative = true, title = 'Sort', strokeWidth = 2.1 }: IconProps = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className} role={decorative ? undefined : 'img'} aria-hidden={decorative} aria-label={decorative ? undefined : title}>
	<path d="m3 16 4 4 4-4"></path>
	<path d="M7 20V4"></path>
	<path d="m21 8-4-4-4 4"></path>
	<path d="M17 4v16"></path>
</svg>
