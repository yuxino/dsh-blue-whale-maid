/**
 * dsh-blue-whale-maid — dependency-free host half.
 *
 * The product runs entirely in the DSH browser client. Keeping a no-op host
 * entry preserves the standard Bundle shape without requesting filesystem,
 * network, command, or credential capabilities.
 */
const name = "dsh-blue-whale-maid";
const inject = [];

function apply() {}

export { name, inject, apply };
