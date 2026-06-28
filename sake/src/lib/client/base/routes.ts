export const ZUIRoutes = {
	appVersion: '/app/version',
	authStatus: '/auth/status',
	authBootstrap: '/auth/bootstrap',
	authLogin: '/auth/login',
	authLogout: '/auth/logout',
	authLogoutAll: '/auth/logout-all',
	authMe: '/auth/me',
	authBasicPassword: '/auth/basic-password',
	authApiKeys: '/auth/api-keys',
	authDeviceKey: '/auth/device-key',
	devices: '/devices',
	koreaderPluginReleases: '/plugin/koreader/releases',
	koreaderPluginUpstreamVersion: '/plugin/koreader/upstream-version',
	hardcoverProgress: '/integrations/hardcover/progress',
	hardcoverProgressSync: '/integrations/hardcover/progress/sync',
	queue: '/queue',
	searchBooks: '/search',
	searchQueue: '/search/queue',
	searchDownload: '/search/download',
	searchBookMetadata: '/zlibrary/search/metadata',
	passwordLogin: '/zlibrary/passwordLogin',
	tokenLogin: '/zlibrary/login',
	zlibraryLogout: '/zlibrary/logout',
	downloadBook: '/zlibrary/download',
	library: '/library/list'
} as const;

export type ZUIRoute = (typeof ZUIRoutes)[keyof typeof ZUIRoutes];
