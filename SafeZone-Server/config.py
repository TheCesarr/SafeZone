# SafeZone Server Configuration
# Secrets are loaded from .env file (NOT tracked by Git)
# If secrets are not set, they are auto-generated and saved to .env on first run.

import os
import secrets as _secrets
from dotenv import load_dotenv

load_dotenv()

# ── Secret Auto-Generation ────────────────────────────────────────────────────
# If a required secret is missing from .env, generate a cryptographically secure
# random value, save it to .env so it persists across restarts, and log a warning.

_ENV_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")


def _get_or_generate_secret(env_key: str, length: int = 32) -> str:
    """
    Returns the secret from environment, or generates a new one, appends it
    to the .env file, and returns it.
    """
    value = os.environ.get(env_key)
    if value and value not in ("your-secret-key", "SAFEZONE_ADMIN_V2_SECRET_KEY_99887766"):
        return value

    # Generate a secure random secret
    new_secret = _secrets.token_urlsafe(length)
    print(f"[CONFIG] ⚠️  {env_key} not set — auto-generated a secure random value.")
    print(f"[CONFIG]    Saved to {_ENV_FILE}")

    # Append to .env file
    try:
        with open(_ENV_FILE, "a", encoding="utf-8") as f:
            f.write(f"\n{env_key}={new_secret}\n")
        # Also set in current process environment
        os.environ[env_key] = new_secret
    except Exception as e:
        print(f"[CONFIG] ⚠️  Could not write to .env: {e}")
        print(f"[CONFIG]    Using ephemeral secret (will change on restart!)")

    return new_secret


# Secret key for Admin Auto-Login (Used by Admin EXE)
ADMIN_SECRET = _get_or_generate_secret("ADMIN_SECRET")

# JWT Secret (if used later, currently using random tokens stored in DB)
JWT_SECRET = _get_or_generate_secret("JWT_SECRET")
