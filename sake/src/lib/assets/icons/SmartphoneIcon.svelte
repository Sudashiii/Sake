<script lang="ts">
	import type { IconProps } from './IconProps';
	let { size = 15, class: className = '', decorative = true, title = 'Device', strokeWidth = 2.1 }: IconProps = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className} role={decorative ? undefined : 'img'} aria-hidden={decorative} aria-label={decorative ? undefined : title}>
	<rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
	<line x1="12" y1="18" x2="12.01" y2="18"></line>
</svg>
