<script lang="ts">
	export let size = 32;
	export let decorative = false;
	export let title = 'sake logo';
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 512 512"
	fill="none"
	width={size}
	height={size}
	role={decorative ? undefined : 'img'}
	aria-hidden={decorative}
	aria-label={decorative ? undefined : title}
>
	<defs>
		<linearGradient id="sake-logo-gold" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0%" stop-color="#e0c878"></stop>
			<stop offset="50%" stop-color="#c9a962"></stop>
			<stop offset="100%" stop-color="#a8893e"></stop>
		</linearGradient>
	</defs>

	<path
		d="M210 175 Q204 148 212 120"
		stroke="#c9a962"
		stroke-width="10"
		fill="none"
		stroke-linecap="round"
		opacity="0.3"
	></path>
	<path
		d="M256 165 Q250 132 258 100"
		stroke="#c9a962"
		stroke-width="12"
		fill="none"
		stroke-linecap="round"
		opacity="0.35"
	></path>
	<path
		d="M302 175 Q296 148 304 120"
		stroke="#c9a962"
		stroke-width="10"
		fill="none"
		stroke-linecap="round"
		opacity="0.3"
	></path>

	<path
		d="M128 220 L140 370 Q145 400 200 415 L312 415 Q367 400 372 370 L384 220 Z"
		fill="none"
		stroke="url(#sake-logo-gold)"
		stroke-width="14"
		stroke-linejoin="round"
	></path>
</svg>

