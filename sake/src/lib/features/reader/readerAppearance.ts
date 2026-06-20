export const READER_THEMES = ['paper', 'night', 'sepia'] as const;

export type ReaderTheme = (typeof READER_THEMES)[number];

interface ThemePalette {
	background: string;
	text: string;
	link: string;
}

interface ReaderThemeController {
	themes: {
		default(theme: object): void;
		override(name: string, value: string, priority?: boolean): void;
		fontSize(size: string): void;
	};
}

const THEME_PALETTES: Record<ReaderTheme, ThemePalette> = {
	paper: {
		background: '#fbfaf7',
		text: '#252422',
		link: '#6f541d'
	},
	night: {
		background: '#111318',
		text: '#d8dbe1',
		link: '#d0b56b'
	},
	sepia: {
		background: '#ead8b5',
		text: '#43311f',
		link: '#87501d'
	}
};

export function parseReaderTheme(value: string | null): ReaderTheme {
	return READER_THEMES.includes(value as ReaderTheme) ? (value as ReaderTheme) : 'paper';
}

export function registerReaderAppearance(rendition: ReaderThemeController): void {
	rendition.themes.default({
		body: {
			'background-color': 'var(--sake-reader-background) !important',
			color: 'var(--sake-reader-text) !important'
		},
		a: {
			color: 'var(--sake-reader-link) !important'
		}
	});
}

export function applyReaderAppearance(
	rendition: ReaderThemeController,
	theme: ReaderTheme,
	fontSize: number
): void {
	const palette = THEME_PALETTES[theme];
	rendition.themes.override('--sake-reader-background', palette.background);
	rendition.themes.override('--sake-reader-text', palette.text);
	rendition.themes.override('--sake-reader-link', palette.link);
	rendition.themes.fontSize(`${fontSize}%`);
}
