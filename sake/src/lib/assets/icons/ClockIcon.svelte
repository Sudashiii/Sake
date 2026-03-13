<script lang="ts">
	import type { IconProps } from './IconProps';
	let { size = 16, class: className = '', decorative = true, title = 'Queued', strokeWidth = 2.1 }: IconProps = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className} role={decorative ? undefined : 'img'} aria-hidden={decorative} aria-label={decorative ? undefined : title}>
	<circle cx="12" cy="12" r="10"></circle>
	<polyline points="12 6 12 12 16 14"></polyline>
</svg>
