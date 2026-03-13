<script lang="ts">
	import type { IconProps } from './IconProps';
	let { size = 20, class: className = '', decorative = true, title = 'Error', strokeWidth = 2 }: IconProps = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className} role={decorative ? undefined : 'img'} aria-hidden={decorative} aria-label={decorative ? undefined : title}>
	<circle cx="12" cy="12" r="10"></circle>
	<line x1="15" y1="9" x2="9" y2="15"></line>
	<line x1="9" y1="9" x2="15" y2="15"></line>
</svg>
