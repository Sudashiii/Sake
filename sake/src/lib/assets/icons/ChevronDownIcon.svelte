<script lang="ts">
	import type { IconProps } from './IconProps';
	let { size = 14, class: className = '', decorative = true, title = 'Chevron down', strokeWidth = 2.1 }: IconProps = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className} role={decorative ? undefined : 'img'} aria-hidden={decorative} aria-label={decorative ? undefined : title}>
	<polyline points="6 9 12 15 18 9"></polyline>
</svg>
