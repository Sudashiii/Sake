<script lang="ts">
	import type { IconProps } from './IconProps';
	let { size = 20, class: className = '', decorative = true, title = 'Alert', strokeWidth = 2 }: IconProps = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className} role={decorative ? undefined : 'img'} aria-hidden={decorative} aria-label={decorative ? undefined : title}>
	<circle cx="12" cy="12" r="10"></circle>
	<line x1="12" y1="8" x2="12" y2="12"></line>
	<line x1="12" y1="16" x2="12.01" y2="16"></line>
</svg>
