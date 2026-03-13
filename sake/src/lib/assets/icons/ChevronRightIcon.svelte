<script lang="ts">
	import type { IconProps } from './IconProps';
	let { size = 18, class: className = '', decorative = true, title = 'Chevron right', strokeWidth = 2 }: IconProps = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className} role={decorative ? undefined : 'img'} aria-hidden={decorative} aria-label={decorative ? undefined : title}>
	<polyline points="9 18 15 12 9 6"></polyline>
</svg>
