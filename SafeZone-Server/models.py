from pydantic import BaseModel
from typing import Optional

# --- AUTH ---
class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    display_name: str
    recovery_pin: str = ""

class UserLogin(BaseModel):
    email: str
    password: str

class AdminLogin(BaseModel):
    secret: str
    
class UserReset(BaseModel):
    email: str
    recovery_pin: str
    new_password: str

# --- SERVER ---
class ServerCreate(BaseModel):
    token: str
    name: str

class ServerJoin(BaseModel):
    token: str
    invite_code: str

# --- CHANNELS ---
class ChannelCreate(BaseModel):
    token: str
    server_id: str
    channel_name: str
    channel_type: str  # "text" or "voice"

class ChannelRename(BaseModel):
    token: str
    channel_id: str
    new_name: str

class ChannelDelete(BaseModel):
    token: str
    channel_id: str

# --- ROLES ---
class RoleCreate(BaseModel):
    token: str
    name: str
    color: str
    permissions: int

class RoleUpdate(BaseModel):
    token: str
    name: str
    color: str
    permissions: int
    position: int

class RoleAssign(BaseModel):
    token: str
    user_id: int

# --- MESSAGING ---
class DMSend(BaseModel):
    token: str
    receiver_username: str
    content: str
