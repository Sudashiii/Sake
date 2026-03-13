<script lang="ts">
	import type { IconProps } from './IconProps';
	let { size = 17, class: className = '', decorative = true, title = 'Grid', strokeWidth = 2.1 }: IconProps = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className} role={decorative ? undefined : 'img'} aria-hidden={decorative} aria-label={decorative ? undefined : title}>
	<rect x="3" y="3" width="7" height="7"></rect>
	<rect x="14" y="3" width="7" height="7"></rect>
	<rect x="14" y="14" width="7" height="7"></rect>
	<rect x="3" y="14" width="7" height="7"></rect>
</svg>
