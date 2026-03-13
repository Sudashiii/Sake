export interface RegisteredDevice {
	deviceId: string;
	pluginVersion: string;
	createdAt: string;
	updatedAt: string;
	lastSeenAt: string;
	hasActiveApiKey: boolean;
}

export interface DevicesResponse {
	success: true;
	devices: RegisteredDevice[];
}

export interface DeleteDeviceResponse {
	success: true;
	deviceId: string;
}
