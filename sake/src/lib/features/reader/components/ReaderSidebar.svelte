<script lang="ts">
	import type { NavItem } from 'epubjs';
	import type { ReaderAnnotation } from '../koreaderSidecar';
	import type { ReaderTheme } from '../readerAppearance';
	import styles from './ReaderSidebar.module.scss';

	interface Props {
		isOpen: boolean;
		activeTab: 'contents' | 'annotations' | 'settings';
		toc: NavItem[];
		annotations: ReaderAnnotation[];
		theme: ReaderTheme;
		fontSize: number;
		isTapNavigationEnabled: boolean;
		arePageControlsHidden: boolean;
		isTapNavigationDebugEnabled: boolean;
		tapNavigationDelayMs: number;
		onClose: () => void;
		onSelectTab: (tab: 'contents' | 'annotations' | 'settings') => void;
		onNavigateToc: (href: string) => void;
		onNavigateAnnotation: (annotation: ReaderAnnotation) => void;
		onDeleteAnnotation: (annotation: ReaderAnnotation) => void;
		onThemeChange: (theme: ReaderTheme) => void;
		onFontSizeChange: (fontSize: number) => void;
		onTapNavigationChange: (isEnabled: boolean) => void;
		onPageControlsHiddenChange: (isHidden: boolean) => void;
		onTapNavigationDebugChange: (isEnabled: boolean) => void;
		onTapNavigationDelayChange: (delayMs: number) => void;
	}

	let {
		isOpen,
		activeTab,
		toc,
		annotations,
		theme,
		fontSize,
		isTapNavigationEnabled,
		arePageControlsHidden,
		isTapNavigationDebugEnabled,
		tapNavigationDelayMs,
		onClose,
		onSelectTab,
		onNavigateToc,
		onNavigateAnnotation,
		onDeleteAnnotation,
		onThemeChange,
		onFontSizeChange,
		onTapNavigationChange,
		onPageControlsHiddenChange,
		onTapNavigationDebugChange,
		onTapNavigationDelayChange
	}: Props = $props();

	function flatten(items: NavItem[], depth = 0): Array<{ item: NavItem; depth: number }> {
		return items.flatMap((item) => [
			{ item, depth },
			...flatten(item.subitems ?? [], depth + 1)
		]);
	}
</script>

<aside class={`${styles.sidebar} ${isOpen ? styles.open : ''}`} aria-hidden={!isOpen}>
	<div class={styles.header}>
		<div class={styles.tabs} role="tablist" aria-label="Reader tools">
			<button class:active={activeTab === 'contents'} onclick={() => onSelectTab('contents')}>Contents</button>
			<button class:active={activeTab === 'annotations'} onclick={() => onSelectTab('annotations')}>Notes</button>
			<button class:active={activeTab === 'settings'} onclick={() => onSelectTab('settings')}>Settings</button>
		</div>
		<button class={styles.close} aria-label="Close reader tools" onclick={onClose}>×</button>
	</div>

	<div class={styles.body}>
		{#if activeTab === 'contents'}
			<nav aria-label="Table of contents" class={styles.toc}>
				{#each flatten(toc) as row (row.item.id)}
					<button style={`--depth: ${row.depth}`} onclick={() => onNavigateToc(row.item.href)}>
						{row.item.label}
					</button>
				{/each}
			</nav>
		{:else if activeTab === 'annotations'}
			{#if annotations.length === 0}
				<p class={styles.empty}>Bookmarks and highlights will appear here.</p>
			{:else}
				<div class={styles.annotationList}>
					{#each annotations as annotation (annotation.id)}
						<article>
							<button class={styles.annotationMain} onclick={() => onNavigateAnnotation(annotation)}>
								<span>{annotation.kind === 'bookmark' ? 'Bookmark' : annotation.chapter || 'Highlight'}</span>
								<strong>{annotation.text || annotation.note || annotation.chapter || 'Saved location'}</strong>
								{#if annotation.note}<small>{annotation.note}</small>{/if}
							</button>
							<button class={styles.delete} onclick={() => onDeleteAnnotation(annotation)}>Delete</button>
						</article>
					{/each}
				</div>
			{/if}
		{:else}
			<div class={styles.appearance}>
				<label>
					<span>Theme</span>
					<select
						value={theme}
						onchange={(event) => onThemeChange(event.currentTarget.value as ReaderTheme)}
					>
						<option value="paper">Paper</option>
						<option value="night">Night</option>
						<option value="sepia">Sepia</option>
					</select>
				</label>
				<label>
					<span>Text size <strong>{fontSize}%</strong></span>
					<input
						type="range"
						min="80"
						max="160"
						step="10"
						value={fontSize}
						oninput={(event) => onFontSizeChange(Number(event.currentTarget.value))}
					/>
				</label>
				<div class={styles.settingGroup}>
					<label class={styles.toggleSetting}>
						<span>
							<strong>Tap page edges</strong>
							<small>Tap the left or right third of the page to navigate.</small>
						</span>
						<input
							type="checkbox"
							checked={isTapNavigationEnabled}
							onchange={(event) => onTapNavigationChange(event.currentTarget.checked)}
						/>
					</label>
					<label class={styles.delaySetting}>
						<span>
							<strong>Page-turn delay</strong>
							<small>
								{tapNavigationDelayMs === 0 ? 'Instant' : `${tapNavigationDelayMs} ms`}
							</small>
						</span>
						<input
							type="range"
							min="0"
							max="500"
							step="50"
							value={tapNavigationDelayMs}
							oninput={(event) =>
								onTapNavigationDelayChange(Number(event.currentTarget.value))}
						/>
						<small>Instant feels fastest. A short delay better protects double-tap word selection.</small>
					</label>
					<label class={styles.toggleSetting}>
						<span>
							<strong>Hide arrow controls</strong>
							<small>Remove the visible previous and next page buttons.</small>
						</span>
						<input
							type="checkbox"
							checked={arePageControlsHidden}
							onchange={(event) => onPageControlsHiddenChange(event.currentTarget.checked)}
						/>
					</label>
					<label class={styles.toggleSetting}>
						<span>
							<strong>Show tap diagnostics</strong>
							<small>Visualize tap zones and log gesture decisions in the browser console.</small>
						</span>
						<input
							type="checkbox"
							checked={isTapNavigationDebugEnabled}
							onchange={(event) =>
								onTapNavigationDebugChange(event.currentTarget.checked)}
						/>
					</label>
				</div>
			</div>
		{/if}
	</div>
</aside>
