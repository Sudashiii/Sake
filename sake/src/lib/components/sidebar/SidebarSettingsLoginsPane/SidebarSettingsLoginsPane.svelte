<script lang="ts">
	import styles from './SidebarSettingsLoginsPane.module.scss';

	interface Props {
		zlibName: string;
		showZLibraryLogin: boolean;
		isLoggingOutZLibrary?: boolean;
		onOpenZLibraryLogin: () => void;
		onLogoutZLibrary: () => void;
	}

	let {
		zlibName,
		showZLibraryLogin,
		isLoggingOutZLibrary = false,
		onOpenZLibraryLogin,
		onLogoutZLibrary
	}: Props = $props();
</script>

<section class={styles.root}>
	<div class="settings-logins-header">
		<div>
			<h4>Provider Logins</h4>
			<p>Connect external providers for authenticated search and download access.</p>
		</div>
	</div>

	{#if showZLibraryLogin}
		<article class="settings-login-card">
			<div class="settings-login-card-top">
				<div class="settings-login-provider">
					<div class="settings-login-provider-copy">
						<p class="settings-login-provider-name">Z-Library</p>
						<p class="settings-login-provider-description">
							Use your Z-Library account or remix credentials to enable authenticated provider access.
						</p>
					</div>
				</div>
				<span class={`settings-login-status ${zlibName ? 'connected' : ''}`}>
					{zlibName ? 'Connected' : 'Not connected'}
				</span>
			</div>

			{#if zlibName}
				<p class="settings-login-identity">{zlibName}</p>
			{/if}

			<div class="settings-login-actions">
				<button
					type="button"
					class={`settings-login-action-btn ${zlibName ? 'logout' : ''}`}
					onclick={zlibName ? onLogoutZLibrary : onOpenZLibraryLogin}
					disabled={isLoggingOutZLibrary}
				>
					{#if zlibName}
						{isLoggingOutZLibrary ? 'Logging Out...' : 'Log Out'}
					{:else}
						Connect Z-Library
					{/if}
				</button>
			</div>
		</article>
	{:else}
		<p class="settings-logins-empty">No provider logins are available right now.</p>
	{/if}
</section>
