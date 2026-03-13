interface ResolveRequiredDeviceIdOptions {
	required: true;
}

interface ResolveOptionalDeviceIdOptions {
	required?: boolean;
}

interface ResolveDeviceIdRequiredSuccess {
	ok: true;
	deviceId: string;
}

interface ResolveDeviceIdOptionalSuccess {
	ok: true;
	deviceId: string | null;
}

interface ResolveDeviceIdFailure {
	ok: false;
	status: 400 | 403;
	message: string;
}

export type ResolveDeviceIdResult = ResolveDeviceIdOptionalSuccess | ResolveDeviceIdFailure;
export type ResolveDeviceIdRequiredResult = ResolveDeviceIdRequiredSuccess | ResolveDeviceIdFailure;
export type ResolveDeviceIdOptionalResult = ResolveDeviceIdOptionalSuccess | ResolveDeviceIdFailure;

function normalizeDeviceId(value: string | null | undefined): string | null {
	const normalized = value?.trim();
	return normalized ? normalized : null;
}

export function resolveAuthorizedDeviceId(
	locals: App.Locals,
	suppliedDeviceId: string | null | undefined,
	options: ResolveRequiredDeviceIdOptions
): ResolveDeviceIdRequiredResult;
export function resolveAuthorizedDeviceId(
	locals: App.Locals,
	suppliedDeviceId: string | null | undefined,
	options?: ResolveOptionalDeviceIdOptions
): ResolveDeviceIdOptionalResult;
export function resolveAuthorizedDeviceId(
	locals: App.Locals,
	suppliedDeviceId: string | null | undefined,
	options: ResolveRequiredDeviceIdOptions | ResolveOptionalDeviceIdOptions = {}
): ResolveDeviceIdResult {
	const requestedDeviceId = normalizeDeviceId(suppliedDeviceId);

	if (locals.auth?.type === 'api_key') {
		const boundDeviceId = normalizeDeviceId(locals.auth.deviceId);
		if (!boundDeviceId) {
			return {
				ok: false,
				status: 403,
				message: 'API key is not allowed for this device'
			};
		}

		if (requestedDeviceId && requestedDeviceId !== boundDeviceId) {
			return {
				ok: false,
				status: 403,
				message: 'API key is not allowed for this device'
			};
		}

		return {
			ok: true,
			deviceId: boundDeviceId
		};
	}

	if (!requestedDeviceId) {
		if (options.required) {
			return {
				ok: false,
				status: 400,
				message: 'Missing deviceId parameter'
			};
		}

		return {
			ok: true,
			deviceId: null
		};
	}

	return {
		ok: true,
		deviceId: requestedDeviceId
	};
}
