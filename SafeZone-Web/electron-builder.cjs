const buildConfig = require('./electron/build_config.cjs');

module.exports = {
    appId: buildConfig.type === 'admin' ? "com.safezone.admin" : "com.safezone.client",
    productName: buildConfig.type === 'admin' ? "SafeZone Admin" : "SafeZone",
    directories: {
        output: "release"
    },
    files: [
        "dist/**/*",
        "electron/**/*",
        "package.json",
        "node_modules/**/*"
    ],
    extraResources: [
        {
            "from": "electron/server-config.json",
            "to": "server-config.json"
        }
    ],
    win: {
        target: "nsis",
        icon: "public/icon.ico"
    },
    publish: {
        provider: "github",
        owner: "TheCesarr",
        repo: "SafeZone",
        channel: buildConfig.type === 'admin' ? "admin" : "latest",
        releaseType: "release"
    }
};
