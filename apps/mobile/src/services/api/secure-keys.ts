// SecureStore keys shared by the API client, socket client, and auth flows.
// Kept in a dependency-free module so the socket and session helpers can import
// them without creating an import cycle through the axios client.
export const SECURE_KEY_ACCESS = "eastpark_access_token";
export const SECURE_KEY_REFRESH = "eastpark_refresh_token";
export const SECURE_KEY_BIOMETRIC_ENABLED = "eastpark_biometric_enabled";
export const SECURE_KEY_BIOMETRIC_EMAIL = "eastpark_biometric_email";
