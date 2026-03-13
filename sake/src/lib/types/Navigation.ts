export interface MenuItem {
	id: string;
	label: string;
	href: string;
	icon?: string;
}

export const menuItems: MenuItem[] = [
	{
		id: 'library',
		label: 'Library',
		href: '/library',
		icon: 'library'
	},
	{
		id: 'zlib-search',
		label: 'Search',
		href: '/search',
		icon: 'search'
	},
	{
		id: 'queue',
		label: 'Queue',
		href: '/queue',
		icon: 'queue'
	},
	{
		id: 'stats',
		label: 'Stats',
		href: '/stats',
		icon: 'stats'
	},
	{
		id: 'archived',
		label: 'Archived',
		href: '/archived',
		icon: 'archive'
	},
	{
		id: 'trash',
		label: 'Trash',
		href: '/trash',
		icon: 'trash'
	}
];

export function getMenuItems(searchEnabled: boolean): MenuItem[] {
	if (searchEnabled) {
		return menuItems;
	}

	return menuItems.filter((item) => item.id !== 'zlib-search');
}
