import { env } from '$env/dynamic/public';
import { getAppVersionUseCase } from '$lib/server/application/composition';
import { getSearchActivationConfig } from '$lib/server/config/activatedProviders';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const searchActivationConfig = getSearchActivationConfig();
	const appVersionResult = await getAppVersionUseCase.execute({
		version: env.PUBLIC_WEBAPP_VERSION,
		gitTag: env.PUBLIC_WEBAPP_GIT_TAG,
		commitSha: env.PUBLIC_WEBAPP_COMMIT_SHA,
		releasedAt: env.PUBLIC_WEBAPP_RELEASED_AT
	});

	return {
		...searchActivationConfig,
		appVersionInfo: appVersionResult.ok ? appVersionResult.value : null,
		appVersionError: appVersionResult.ok ? null : appVersionResult.error.message
	};
};
