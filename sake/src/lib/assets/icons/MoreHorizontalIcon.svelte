<script lang="ts">
	import type { IconProps } from './IconProps';
	let { size = 15, class: className = '', decorative = true, title = 'More actions', strokeWidth = 2.2 }: IconProps = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className} role={decorative ? undefined : 'img'} aria-hidden={decorative} aria-label={decorative ? undefined : title}>
	<circle cx="12" cy="12" r="1"></circle>
	<circle cx="19" cy="12" r="1"></circle>
	<circle cx="5" cy="12" r="1"></circle>
</svg>
