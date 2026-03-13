<script lang="ts">
	import type { IconProps } from './IconProps';
	let { size = 17, class: className = '', decorative = true, title = 'Filter', strokeWidth = 2.1 }: IconProps = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className} role={decorative ? undefined : 'img'} aria-hidden={decorative} aria-label={decorative ? undefined : title}>
	<path d="M3 6h18"></path>
	<path d="M7 12h10"></path>
	<path d="M10 18h4"></path>
</svg>
