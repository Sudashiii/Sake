<script lang="ts">
	import type { IconProps } from './IconProps';
	let { size = 14, class: className = '', decorative = true, title = 'Refresh', strokeWidth = 2.1 }: IconProps = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className} role={decorative ? undefined : 'img'} aria-hidden={decorative} aria-label={decorative ? undefined : title}>
	<path d="M3 2v6h6"></path>
	<path d="M21 12A9 9 0 0 0 6 5.3L3 8"></path>
	<path d="M21 22v-6h-6"></path>
	<path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"></path>
</svg>
