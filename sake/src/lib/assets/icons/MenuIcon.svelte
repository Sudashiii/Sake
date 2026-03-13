<script lang="ts">
	import type { IconProps } from './IconProps';
	let { size = 18, class: className = '', decorative = true, title = 'Menu', strokeWidth = 2.5 }: IconProps = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className} role={decorative ? undefined : 'img'} aria-hidden={decorative} aria-label={decorative ? undefined : title}>
	<line x1="3" y1="6" x2="21" y2="6"></line>
	<line x1="3" y1="12" x2="21" y2="12"></line>
	<line x1="3" y1="18" x2="21" y2="18"></line>
</svg>
