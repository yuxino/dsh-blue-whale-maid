# DSH STORE source-verified repair design

## Goal

Make `dsh-blue-whale-maid` eligible for DSH STORE's bounded, low-permission
`source-verified` path while preserving the product's core value: a draggable
blue-whale maid that follows session activity, shows task-state animation, and
surfaces completion, failure, and confirmation notices.

## Chosen design

The package becomes a browser-only desktop-pet plugin. The balance and session
cost panel is removed because it necessarily needs host filesystem, network,
environment, and credential access; disguising those capabilities to satisfy a
static scanner would be incorrect. The host entry remains as a dependency-free
no-op so the DSH Bundle contract stays stable.

The existing 2.7 MB animation atlas is replaced in the distributable client by
a compact original transparent character image created for this project. The
client keeps its state machine, notifications, drag behavior, hearts, sleep
particles, and one-shot gestures;
small canvas transforms provide distinct idle, run, wait, review, wave, jump,
and failure motion without a multi-megabyte embedded asset. The generated
`lib/client.js` therefore remains below the Store's 256 KiB per-file bound.
Development-only generators and profile-sync helpers move below `docs/`, which
the Store explicitly excludes from runtime review. They are not distributed.

## License and package contract

The root `LICENSE` returns to the standard MIT text so GitHub reports the same
SPDX identifier as `package.json`. The current character art was created from
scratch for this project without an earlier image as input and is distributed
under the same MIT License; historical asset credit remains in `CREDITS.md`.
The package does not claim ownership of third-party names or marks. The
manifest lists only runtime files, removes the unused credentials peer, and
bumps the major version because the account-cost feature is removed. It also
declares DSH `0.1.1-rc.2` as exactly compatible after tarball installation,
startup, and browser UI acceptance in an isolated Web profile.

## Verification

A regression test mirrors the Store's source bounds and permission-signal
patterns. Delivery also requires the normal test/build checks, a clean package
dry run, installation into an isolated DSH Web profile, native browser UI
inspection through ego-lite, and live remote SHA parity after pushing `main`.
