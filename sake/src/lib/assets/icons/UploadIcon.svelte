<script lang="ts">
	import type { IconProps } from './IconProps';
	let { size = 17, class: className = '', decorative = true, title = 'Upload', strokeWidth = 2.1 }: IconProps = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={className} role={decorative ? undefined : 'img'} aria-hidden={decorative} aria-label={decorative ? undefined : title}>
	<path d="M12 3v12"></path>
	<path d="m7 8 5-5 5 5"></path>
	<path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"></path>
</svg>
