<script lang="ts">
	import type { IconProps } from './IconProps';
	let { size = 13, class: className = '', decorative = true, title = 'Add to shelf', strokeWidth = 2 }: IconProps = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className} role={decorative ? undefined : 'img'} aria-hidden={decorative} aria-label={decorative ? undefined : title}>
	<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
	<line x1="12" y1="8" x2="12" y2="13"></line>
	<line x1="9.5" y1="10.5" x2="14.5" y2="10.5"></line>
</svg>
