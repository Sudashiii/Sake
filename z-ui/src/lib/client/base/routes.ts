export const ZUIRoutes = {
	searchBook: '/zlibrary/search',
	searchBookMetadata: '/zlibrary/search/metadata',
	passwordLogin: '/zlibrary/passwordLogin',
	tokenLogin: '/zlibrary/login',
	downloadBook: '/zlibrary/download',
	authCheck: '/auth-check',
	library: '/library/list'
} as const;

export type ZUIRoute = (typeof ZUIRoutes)[keyof typeof ZUIRoutes];
