/**
 * dsh-blue-whale-maid — host half.
 *
 * This package contributes nothing server-side. The empty `apply` exists only
 * so the package appears as a loader entry in the host Loader, which is how
 * the client module system (`@deepseek-ai/dsh-client-modules`) discovers the
 * browser half declared in package.json under `dsh.client` and serves it as
 * `/plugins/<name>/client.js`.
 *
 * @module dsh-blue-whale-maid
 */
function apply() {}

export { apply };
