<script lang="ts">
	import type { IconProps } from './IconProps';
	let { size = 21, class: className = '', decorative = true, title = 'App', strokeWidth = 2 }: IconProps = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className} role={decorative ? undefined : 'img'} aria-hidden={decorative} aria-label={decorative ? undefined : title}>
	<rect x="3" y="4" width="18" height="16" rx="2"></rect>
	<path d="M3 9h18"></path>
	<path d="M8 4v5"></path>
</svg>
