<script lang="ts">
	import type { IconProps } from './IconProps';
	let { size = 24, class: className = '', decorative = true, title = 'Download', strokeWidth = 1.5 }: IconProps = $props();
</script>

<svg
	width={size}
	height={size}
	stroke-width={strokeWidth}
	viewBox="0 0 24 24"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	color="currentColor"
	class={className}
	role={decorative ? undefined : 'img'}
	aria-hidden={decorative}
	aria-label={decorative ? undefined : title}
>
	<path
		d="M6 20L18 20"
		stroke="currentColor"
		stroke-width={strokeWidth}
		stroke-linecap="round"
		stroke-linejoin="round"
	></path>
	<path
		d="M12 4V16M12 16L15.5 12.5M12 16L8.5 12.5"
		stroke="currentColor"
		stroke-width={strokeWidth}
		stroke-linecap="round"
		stroke-linejoin="round"
	></path>
</svg>
