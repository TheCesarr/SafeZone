// src/utils/permissions.js
export const PERMISSIONS = {
    VIEW_CHANNELS: 1 << 0,       // 1
    MANAGE_CHANNELS: 1 << 1,     // 2
    MANAGE_ROLES: 1 << 2,        // 4
    MANAGE_SERVER: 1 << 3,       // 8
    KICK_MEMBERS: 1 << 4,        // 16
    BAN_MEMBERS: 1 << 5,         // 32
    SEND_MESSAGES: 1 << 6,       // 64
    MANAGE_MESSAGES: 1 << 7,     // 128
    ATTACH_FILES: 1 << 8,        // 256
    MENTION_EVERYONE: 1 << 9,    // 512
    CONNECT_VOICE: 1 << 10,      // 1024
    SPEAK: 1 << 11,              // 2048
    MUTE_MEMBERS: 1 << 12,       // 4096
    DEAFEN_MEMBERS: 1 << 13,     // 8192
    MOVE_MEMBERS: 1 << 14,       // 16384
    ADMINISTRATOR: 1 << 15       // 32768
};

export const hasPermission = (userPermissions, permissionBit) => {
    // Safely fallback to 0 if undefined/null
    const perms = parseInt(userPermissions) || 0;

    // Administrator flag acts as a wildcard, granting all permissions
    if ((perms & PERMISSIONS.ADMINISTRATOR) === PERMISSIONS.ADMINISTRATOR) {
        return true;
    }

    return (perms & permissionBit) === permissionBit;
};
