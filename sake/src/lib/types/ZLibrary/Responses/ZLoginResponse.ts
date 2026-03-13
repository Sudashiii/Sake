export interface ZLibUser {
	id: number;
	email: string;
	name: string;
	kindle_email: string;
	remix_userkey: string;
	donations_active: string | null;
	donations_expire: string | null;
	downloads_today: number;
	downloads_limit: number;
	confirmed: 0 | 1;
	isPremium: 0 | 1;
}

export interface ZLoginResponse {
	success: 1 | 0;
	user: ZLibUser;
}
