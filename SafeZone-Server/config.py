# SafeZone Server Configuration
# Secrets are loaded from .env file (NOT tracked by Git)

import os
from dotenv import load_dotenv

load_dotenv()

# Secret key for Admin Auto-Login (Used by Admin EXE)
ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "SAFEZONE_ADMIN_V2_SECRET_KEY_99887766")

# JWT Secret (if used later, currently using random tokens stored in DB)
JWT_SECRET = os.environ.get("JWT_SECRET", "your-secret-key")
