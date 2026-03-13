<script lang="ts">
	import type { IconProps } from './IconProps';
	let { size = 20, class: className = '', decorative = true, title = 'Trash', strokeWidth = 2 }: IconProps = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className} role={decorative ? undefined : 'img'} aria-hidden={decorative} aria-label={decorative ? undefined : title}>
	<polyline points="3 6 5 6 21 6"></polyline>
	<path d="M19 6l-1 14H6L5 6"></path>
	<path d="M10 11v6"></path>
	<path d="M14 11v6"></path>
	<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
</svg>
