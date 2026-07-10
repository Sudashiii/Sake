import { GetAuthStatusUseCase } from '$lib/server/application/use-cases/GetAuthStatusUseCase';
import { BootstrapLocalAccountUseCase } from '$lib/server/application/use-cases/BootstrapLocalAccountUseCase';
import { LoginLocalAccountUseCase } from '$lib/server/application/use-cases/LoginLocalAccountUseCase';
import { GetCurrentUserUseCase } from '$lib/server/application/use-cases/GetCurrentUserUseCase';
import { SetBasicAuthPasswordUseCase } from '$lib/server/application/use-cases/SetBasicAuthPasswordUseCase';
import { ClearBasicAuthPasswordUseCase } from '$lib/server/application/use-cases/ClearBasicAuthPasswordUseCase';
import { LogoutLocalAccountUseCase } from '$lib/server/application/use-cases/LogoutLocalAccountUseCase';
import { LogoutAllLocalSessionsUseCase } from '$lib/server/application/use-cases/LogoutAllLocalSessionsUseCase';
import { CreateDeviceApiKeyUseCase } from '$lib/server/application/use-cases/CreateDeviceApiKeyUseCase';
import { ListActiveApiKeysUseCase } from '$lib/server/application/use-cases/ListActiveApiKeysUseCase';
import { RevokeApiKeyUseCase } from '$lib/server/application/use-cases/RevokeApiKeyUseCase';
import { ResolveRequestAuthUseCase } from '$lib/server/application/use-cases/ResolveRequestAuthUseCase';
import { ReportDeviceVersionUseCase } from '$lib/server/application/use-cases/ReportDeviceVersionUseCase';
import { ListDevicesUseCase } from '$lib/server/application/use-cases/ListDevicesUseCase';
import { DeleteDeviceUseCase } from '$lib/server/application/use-cases/DeleteDeviceUseCase';
import {
	deviceDownloadRepository,
	deviceProgressDownloadRepository,
	deviceRepository,
	userApiKeyRepository,
	userRepository,
	userSessionRepository
} from './foundation';

export const getAuthStatusUseCase = new GetAuthStatusUseCase(userRepository);
export const bootstrapLocalAccountUseCase = new BootstrapLocalAccountUseCase(
	userRepository,
	userSessionRepository
);
export const loginLocalAccountUseCase = new LoginLocalAccountUseCase(
	userRepository,
	userSessionRepository
);
export const getCurrentUserUseCase = new GetCurrentUserUseCase(userRepository);
export const setBasicAuthPasswordUseCase = new SetBasicAuthPasswordUseCase(userRepository);
export const clearBasicAuthPasswordUseCase = new ClearBasicAuthPasswordUseCase(userRepository);
export const logoutLocalAccountUseCase = new LogoutLocalAccountUseCase(userSessionRepository);
export const logoutAllLocalSessionsUseCase = new LogoutAllLocalSessionsUseCase(userSessionRepository);
export const createDeviceApiKeyUseCase = new CreateDeviceApiKeyUseCase(
	userRepository,
	userApiKeyRepository,
	deviceRepository
);
export const listActiveApiKeysUseCase = new ListActiveApiKeysUseCase(userApiKeyRepository);
export const revokeApiKeyUseCase = new RevokeApiKeyUseCase(userApiKeyRepository);
export const resolveRequestAuthUseCase = new ResolveRequestAuthUseCase(
	userRepository,
	userSessionRepository,
	userApiKeyRepository
);
export const reportDeviceVersionUseCase = new ReportDeviceVersionUseCase(deviceRepository);
export const listDevicesUseCase = new ListDevicesUseCase(deviceRepository, userApiKeyRepository);
export const deleteDeviceUseCase = new DeleteDeviceUseCase(
	deviceRepository,
	userApiKeyRepository,
	deviceDownloadRepository,
	deviceProgressDownloadRepository
);
