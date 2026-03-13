<script lang="ts">
	import type { IconProps } from './IconProps';
	let { size = 20, class: className = '', decorative = true, title = 'File', strokeWidth = 2 }: IconProps = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className} role={decorative ? undefined : 'img'} aria-hidden={decorative} aria-label={decorative ? undefined : title}>
	<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
	<polyline points="14 2 14 8 20 8"></polyline>
</svg>
