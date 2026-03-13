export const ZUIRoutes = {
	authStatus: '/auth/status',
	authBootstrap: '/auth/bootstrap',
	authLogin: '/auth/login',
	authLogout: '/auth/logout',
	authLogoutAll: '/auth/logout-all',
	authMe: '/auth/me',
	authApiKeys: '/auth/api-keys',
	authDeviceKey: '/auth/device-key',
	devices: '/devices',
	searchBooks: '/search',
	searchDownload: '/search/download',
	searchBookMetadata: '/zlibrary/search/metadata',
	passwordLogin: '/zlibrary/passwordLogin',
	tokenLogin: '/zlibrary/login',
	downloadBook: '/zlibrary/download',
	library: '/library/list'
} as const;

export type ZUIRoute = (typeof ZUIRoutes)[keyof typeof ZUIRoutes];
