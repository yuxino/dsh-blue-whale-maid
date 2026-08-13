/**
 * Host half types. The host plugin contributes nothing server-side; it exists
 * so the package appears in the host Loader and the browser half is served
 * through the `dsh.client` declaration.
 */
export function apply(): void;
