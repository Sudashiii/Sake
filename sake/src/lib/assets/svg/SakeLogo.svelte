<script lang="ts">
	export let size = 32;
	export let decorative = false;
	export let title = 'sake logo';

	const aspectRatio = 80 / 200;
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 80 200"
	fill="none"
	width={size * aspectRatio}
	height={size}
	preserveAspectRatio="xMidYMid meet"
	role={decorative ? undefined : 'img'}
	aria-hidden={decorative}
	aria-label={decorative ? undefined : title}
>
	<path d="M0 6C0 2 2 0 6 0H74C78 0 80 2 80 6V200L40 172L0 200V6Z" fill="#C4AA6C" />
</svg>
