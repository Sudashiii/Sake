import { dev } from '$app/environment';
import { AuthService } from '$lib/client/services/authService';
import { ZLibAuthService } from '$lib/client/services/zlibAuthService';
import { toastStore } from '$lib/client/stores/toastStore.svelte';
import { ZUI } from '$lib/client/zui';
import type { AppVersionResponse } from '$lib/types/App/AppVersion';
import type { AuthApiKey } from '$lib/types/Auth/ApiKey';
import type { RegisteredDevice } from '$lib/types/Auth/Device';
import type { CurrentUser } from '$lib/types/Auth/CurrentUser';
import { createWebappVersion } from '$lib/webappVersion';
import { env } from '$env/dynamic/public';

const fallbackAppVersion = createWebappVersion({ version: env.PUBLIC_WEBAPP_VERSION });
const SETTINGS_BASE_SECTIONS = [
	{ id: 'app', label: 'App' },
	{ id: 'account', label: 'Account' },
	{ id: 'devices', label: 'Devices' }
] as const;
const LOGINS_SETTINGS_SECTION = { id: 'logins', label: 'Logins' } as const;
const APP_SOURCE_URL = 'https://github.com/Sudashiii/Sake';
const APP_SOURCE_LABEL = 'https://github.com/Sudashiii/Sake';
const appEnvironment = dev ? 'Development' : 'Production';

export type SettingsSectionId =
	(typeof SETTINGS_BASE_SECTIONS)[number]['id'] | typeof LOGINS_SETTINGS_SECTION.id;

export function getSidebarSettingsSections(showZLibraryLogin: boolean) {
	return showZLibraryLogin
		? [...SETTINGS_BASE_SECTIONS, LOGINS_SETTINGS_SECTION]
		: SETTINGS_BASE_SECTIONS;
}

export class SidebarSettingsController {
	showSettingsModal = $state(false);
	activeSection = $state<SettingsSectionId>('app');
	currentUser = $state<CurrentUser | null>(null);
	currentUserError = $state<string | null>(null);
	isLoadingCurrentUser = $state(false);
	appVersionInfo = $state<AppVersionResponse | null>(null);
	appVersionError = $state<string | null>(null);
	isLoadingAppVersion = $state(false);
	apiKeys = $state<AuthApiKey[]>([]);
	apiKeysError = $state<string | null>(null);
	isLoadingApiKeys = $state(false);
	revokingApiKeyId = $state<number | null>(null);
	devices = $state<RegisteredDevice[]>([]);
	devicesError = $state<string | null>(null);
	isLoadingDevices = $state(false);
	deletingDeviceId = $state<string | null>(null);
	pendingDeleteDeviceId = $state<string | null>(null);
	showDeleteDeviceModal = $state(false);
	isLoggingOut = $state(false);
	isLoggingOutEverywhere = $state(false);
	isSavingBasicAuthPassword = $state(false);
	isRemovingBasicAuthPassword = $state(false);

	private previouslyFocusedSettingsElement: HTMLElement | null = null;

	get appVersion(): string {
		return this.appVersionInfo?.version ?? fallbackAppVersion.version;
	}

	get databaseVersion() {
		return this.appVersionInfo?.database ?? null;
	}

	get appEnvironment(): string {
		return appEnvironment;
	}

	get appSourceUrl(): string {
		return APP_SOURCE_URL;
	}

	get appSourceLabel(): string {
		return APP_SOURCE_LABEL;
	}

	syncActiveSection(showZLibraryLogin: boolean): void {
		if (!showZLibraryLogin && this.activeSection === 'logins') {
			this.activeSection = 'app';
		}
	}

	openModal = (): void => {
		this.previouslyFocusedSettingsElement =
			typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
		this.showSettingsModal = true;
		this.activeSection = 'app';
		void this.loadAppVersion();
		void this.loadCurrentUser();
		void this.loadAuthApiKeys();
		void this.loadDevices();
	};

	closeModal = (): void => {
		this.showSettingsModal = false;
		this.activeSection = 'app';
		this.cancelDeleteDevice();
		this.previouslyFocusedSettingsElement?.focus();
		this.previouslyFocusedSettingsElement = null;
	};

	formatDateTime = (value: string | null): string => {
		if (!value) {
			return 'Never';
		}

		const date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			return value;
		}

		return new Intl.DateTimeFormat(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(date);
	};

	loadAuthApiKeys = async (): Promise<void> => {
		if (this.isLoadingApiKeys) {
			return;
		}
		this.isLoadingApiKeys = true;
		this.apiKeysError = null;
		const result = await ZUI.getAuthApiKeys();
		this.isLoadingApiKeys = false;
		if (!result.ok) {
			this.apiKeys = [];
			this.apiKeysError = result.error.message;
			return;
		}
		this.apiKeys = result.value.apiKeys;
	};

	loadAppVersion = async (): Promise<void> => {
		if (this.isLoadingAppVersion) {
			return;
		}

		this.isLoadingAppVersion = true;
		this.appVersionError = null;

		const result = await ZUI.getAppVersion();

		this.isLoadingAppVersion = false;
		if (!result.ok) {
			this.appVersionInfo = null;
			this.appVersionError = result.error.message;
			return;
		}

		this.appVersionInfo = result.value;
	};

	loadDevices = async (): Promise<void> => {
		if (this.isLoadingDevices) {
			return;
		}
		this.isLoadingDevices = true;
		this.devicesError = null;
		const result = await ZUI.getDevices();
		this.isLoadingDevices = false;
		if (!result.ok) {
			this.devices = [];
			this.devicesError = result.error.message;
			return;
		}
		this.devices = result.value.devices;
	};

	loadCurrentUser = async (): Promise<void> => {
		if (this.isLoadingCurrentUser) {
			return;
		}
		this.isLoadingCurrentUser = true;
		this.currentUserError = null;
		const result = await AuthService.restoreSession();
		this.isLoadingCurrentUser = false;
		if (!result.ok) {
			this.currentUser = null;
			this.currentUserError = result.error.message;
			return;
		}
		this.currentUser = result.value;
	};

	handleRevokeApiKey = async (apiKeyId: number, deviceId: string): Promise<void> => {
		if (this.revokingApiKeyId !== null) {
			return;
		}
		this.revokingApiKeyId = apiKeyId;
		const result = await ZUI.revokeAuthApiKey(apiKeyId);
		this.revokingApiKeyId = null;
		if (!result.ok) {
			toastStore.add(`Failed to revoke API key: ${result.error.message}`, 'error');
			return;
		}
		this.apiKeys = this.apiKeys.filter((apiKey) => apiKey.id !== apiKeyId);
		toastStore.add(`Revoked API key for ${deviceId}`, 'success');
		void this.loadDevices();
	};

	requestDeleteDevice = (deviceId: string): void => {
		if (this.deletingDeviceId !== null) {
			return;
		}
		this.pendingDeleteDeviceId = deviceId;
		this.showDeleteDeviceModal = true;
	};

	cancelDeleteDevice = (): void => {
		this.showDeleteDeviceModal = false;
		this.pendingDeleteDeviceId = null;
	};

	confirmDeleteDevice = async (): Promise<void> => {
		if (!this.pendingDeleteDeviceId || this.deletingDeviceId !== null) {
			return;
		}

		this.deletingDeviceId = this.pendingDeleteDeviceId;
		const result = await ZUI.deleteDevice(this.pendingDeleteDeviceId);
		this.deletingDeviceId = null;

		if (!result.ok) {
			toastStore.add(`Failed to delete device: ${result.error.message}`, 'error');
			return;
		}

		const deletedDeviceId = result.value.deviceId;
		this.cancelDeleteDevice();
		await Promise.all([this.loadDevices(), this.loadAuthApiKeys()]);
		toastStore.add(`Deleted device "${deletedDeviceId}"`, 'success');
	};

	handleAppLogout = async (): Promise<boolean> => {
		if (this.isLoggingOut) {
			return false;
		}
		this.isLoggingOut = true;
		const result = await AuthService.logout();
		this.isLoggingOut = false;
		if (!result.ok) {
			toastStore.add(`Failed to log out: ${result.error.message}`, 'error');
			return false;
		}
		ZLibAuthService.clearUserName();
		this.closeModal();
		return true;
	};

	handleLogoutAllSessions = async (): Promise<boolean> => {
		if (this.isLoggingOutEverywhere) {
			return false;
		}
		this.isLoggingOutEverywhere = true;
		const result = await AuthService.logoutAllSessions();
		this.isLoggingOutEverywhere = false;
		if (!result.ok) {
			toastStore.add(`Failed to log out all sessions: ${result.error.message}`, 'error');
			return false;
		}
		ZLibAuthService.clearUserName();
		this.closeModal();
		return true;
	};

	handleSetBasicAuthPassword = async (password: string): Promise<boolean> => {
		if (this.isSavingBasicAuthPassword) {
			return false;
		}

		this.isSavingBasicAuthPassword = true;
		const result = await AuthService.setBasicAuthPassword(password);
		this.isSavingBasicAuthPassword = false;

		if (!result.ok) {
			toastStore.add(`Failed to save Basic authentication password: ${result.error.message}`, 'error');
			return false;
		}

		await this.loadCurrentUser();
		toastStore.add('Basic authentication password saved', 'success');
		return true;
	};

	handleClearBasicAuthPassword = async (): Promise<boolean> => {
		if (this.isRemovingBasicAuthPassword) {
			return false;
		}

		this.isRemovingBasicAuthPassword = true;
		const result = await AuthService.clearBasicAuthPassword();
		this.isRemovingBasicAuthPassword = false;

		if (!result.ok) {
			toastStore.add(`Failed to remove Basic authentication password: ${result.error.message}`, 'error');
			return false;
		}

		await this.loadCurrentUser();
		toastStore.add('Basic authentication password removed', 'success');
		return true;
	};
}
