<script lang="ts">
	import type { IconProps } from './IconProps';
	let { size = 20, class: className = '', decorative = true, title = 'Annotations', strokeWidth = 2 }: IconProps = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className} role={decorative ? undefined : 'img'} aria-hidden={decorative} aria-label={decorative ? undefined : title}>
	<path d="m9 11-6 6v3h9l3-3"></path>
	<path d="m22 12-7 7-6-6 7-7a2.8 2.8 0 0 1 4 0l2 2a2.8 2.8 0 0 1 0 4Z"></path>
</svg>
