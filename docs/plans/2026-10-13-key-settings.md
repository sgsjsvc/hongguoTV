# Shared key settings implementation plan

Date: 2026-10-13. User approved immediate revocation of the old key.

Goal: Add custom/random shared-key rotation, confirmation, show/copy and durable storage to remote admin.
Architecture: SharedKey authority owns authentication and atomic file persistence; existing sync and admin endpoints consult the current key, including after reading POST bodies. HG_SYNC_KEY managed deployments remain explicitly read-only in the UI to prevent restart reverting a changed key. Browser settings use the login credential for masked current-key display, validate matching new keys and update the current browser session on success.

1. Add tests/sync-key.test.mjs covering revocation, persistence, validation, persistence failure and environment-managed state; confirm failures before implementation.
2. Add apps/sync-server/shared-key.mjs; wire index.mjs and server.mjs key metadata/rotation routes. Persist before swapping the live authentication digest; never return or log a key.
3. Add key settings tab with current-key display/copy, secure random generation, two matching inputs and an explicit replacement dialog; preserve data and handle errors.
4. Browser isolated-key rotation checks and full Node regression; review, package module into Docker/Linux bundles, update docs. Restart actual service keeping existing key unchanged.
