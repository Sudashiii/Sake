<script lang="ts">
	import type { IconProps } from './IconProps';
	let { size = 13, class: className = '', decorative = true, title = 'Filter', strokeWidth = 2.1 }: IconProps = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className} role={decorative ? undefined : 'img'} aria-hidden={decorative} aria-label={decorative ? undefined : title}>
	<polygon points="3 4 21 4 14 12 14 19 10 21 10 12 3 4"></polygon>
</svg>
