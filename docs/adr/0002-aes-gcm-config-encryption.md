# 2. AES-256-GCM for provider secrets

Date: 2026-04-14

## Status

Accepted

## Context

Users paste provider API keys into the Connection Wizard. These are
written to `~/.webnovel-writer/provider-config.json`. Storing them in
plaintext on disk leaves them exposed to any other process that can
read the user's home dir; storing them unencrypted in a repo-level
`.env` is worse.

## Decision

Encrypt each secret at write time with AES-256-GCM using a key derived
from `$WEBNOVEL_WRITER_KEY` via scrypt, or a host-specific default when
the env var is absent. Ciphertext is stored as three colon-separated
base64 segments (`iv : authTag : ciphertext`). Legacy plaintext values
remain readable for a grace window so upgrades don't lock users out.

## Consequences

- **Positive:** secrets on disk are opaque; rotating
  `WEBNOVEL_WRITER_KEY` invalidates stored keys cleanly; GCM auth tags
  detect tampering.
- **Negative:** users who lose `WEBNOVEL_WRITER_KEY` must re-enter
  their provider keys. The wizard's error message makes this explicit.
- **Neutral:** tests disable decryption (`NODE_ENV=test`) to avoid
  key management in CI.
