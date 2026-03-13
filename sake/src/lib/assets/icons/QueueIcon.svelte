<script lang="ts">
	import type { IconProps } from './IconProps';
	let { size = 20, class: className = '', decorative = true, title = 'Queue', strokeWidth = 2 }: IconProps = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className} role={decorative ? undefined : 'img'} aria-hidden={decorative} aria-label={decorative ? undefined : title}>
	<path d="M16 3h5v5"></path>
	<path d="M4 20l17-17"></path>
	<path d="M21 16v5h-5"></path>
	<path d="M15 21l6-6"></path>
	<path d="M3 8V3h5"></path>
	<path d="M3 3l6 6"></path>
</svg>
