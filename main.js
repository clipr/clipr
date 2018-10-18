const menubar = require("./menubar");
const {ipcMain, session, app, globalShortcut} = require("electron");
const AutoLaunch = require("auto-launch");
const {autoUpdater} = require("electron-updater");
const Sentry = require("@sentry/electron");
let sentryEnabled = false;

if (process.env.CLIPR_ENV !== "development") {
    sentryEnabled = true;
    Sentry.init({
        dsn: "https://c8aa8e2e09d24acebebdb6cb213dfda6@sentry.io/1296558"
    });
}

let shellDir;
if (process.env.CLIPR_ENV === "development") {
    shellDir = "./built/shell";
} else {
    shellDir = process.resourcesPath + "/app.asar/built/shell";
}
let winPos;
if (process.platform === "darwin") {
    winPos = "topRight";
} else {
    winPos = "bottomRight";
}

const mb = menubar({
    dir: shellDir,
    icon: "/assets/icons",
    preloadWindow: true,
    windowPosition: winPos,
    alwaysOnTop: process.env.CLIPR_ENV === "development" ? true : false,
    tooltip: "Clipr"
});

const isSecondInstance = app.makeSingleInstance(function() {
    console.log("second instance launched!", "it will be killed...");
    if (mb.window) {
        if (!mb.window.isVisible()) mb.show();
        mb.window.focus();
    }
});

if (isSecondInstance) {
    app.quit();
    process.exit(0);
}

mb.on("ready", function ready() {
    console.log("app is ready");
    if (process.env.CLIPR_ENV !== "development" && process.platform !== "darwin") {
        autoUpdater.checkForUpdatesAndNotify();
        setInterval(function() {
            autoUpdater.checkForUpdatesAndNotify();
        }, 600000);
    }
});

ipcMain.on("app-quit", function() {
    quitApp();
});

function quitApp() {
    console.log("quiting...");
    disableShortcut();
    mb.window = null;
    app.quit();
    process.exit(0);
}

if (process.env.CLIPR_ENV !== "development") {
    ipcMain.on("setting-launch-on-start", function(_, shouldLaunch) {
        const launchConfig = {name: "Clipr"};
        if (process.env.APPIMAGE) {
            launchConfig.path = process.env.APPIMAGE;
        }
        const launcher = new AutoLaunch(launchConfig);
        launcher.isEnabled()
            .then(function(isEnabled) {
                if (isEnabled && shouldLaunch) {
                    return;
                } else if (!isEnabled && shouldLaunch) {
                    console.log("enabing auto-launch");
                    launcher.enable();
                }
                if (isEnabled && !shouldLaunch) {
                    console.log("disabling auto-launch");
                    launcher.disable();
                }
            })
            .catch(function(err) {
                reportError(err);
            });
    });
}

let syncProvider = "https://sync.clipr.cloud";

ipcMain.on("sync-provider", function(_, provider) {
    console.log("using sync provider:", provider);
    syncProvider = provider;
});

ipcMain.on("set-sync-cookie", function(event, args) {
    let cookie;
    try {
        cookie = {url: `${syncProvider}/couchdb`, name: args.cookie.split("=")[0], value: args.cookie.split("=")[1]};
    } catch (e) {
        return reportError(e);
    }
    session.defaultSession.cookies.set(cookie, (error) => {
        if (error) return reportError(error);
        event.sender.send("sync-cookie-set");
    });
});

ipcMain.on("refresh-sync-cookie", function(_, args) {
    let cookie;
    try {
        cookie = {url: `${syncProvider}/couchdb`, name: args.cookie.split("=")[0], value: args.cookie.split("=")[1]};
    } catch (e) {
        return reportError(e);
    }
    session.defaultSession.cookies.set(cookie, (error) => {
        if (error) return reportError(error);
    });
});

autoUpdater.on("update-downloaded", (info) => {
    console.log("new update downloaded");
    //do not show install button, appImage takes care of notifying
    if (process.platform !== "linux") {
        mb.window.webContents.send("new-update-ready");
    }
    //on linux we should remove the old appImage autostart entry
    if (process.platform === "linux") {
        const launchConfig = {
            name: "Clipr",
            path: process.env.APPIMAGE
        };
        const launcher = new AutoLaunch(launchConfig);
        launcher.isEnabled()
            .then(function(isEnabled) {
                if (isEnabled) {
                    launcher.disable();
                }
            })
            .catch(function(err) {
                reportError(err);
            });
    }
});

ipcMain.on("install-update-and-restart", function(event, args) {
    console.log("quiting and installing update");
    autoUpdater.quitAndInstall();
});

autoUpdater.on("download-progress", (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + " - Downloaded " + progressObj.percent + "%";
    log_message = log_message + " (" + progressObj.transferred + "/" + progressObj.total + ")";
    console.log(log_message);
});

const reportError = function(err) {
    if (!err instanceof Error) {
        const tmp = new Error();
        tmp.name = err.name || "GenericError";
        tmp.message = err.message || "no message";
        err = tmp;
    }
    if (sentryEnabled) {
        Sentry.captureException(err);
        console.error(err);
    } else {
        console.error(err);
    }
};

const SHORTCUT_MACRO = "CommandOrControl+Space";

ipcMain.on("setting-shortcut-toggle", function(_, shortcutEnabled) {
    if (shortcutEnabled) {
        enableShortcut();
    } else {
        disableShortcut();
    }
});

function enableShortcut() {
    if (!globalShortcut.isRegistered(SHORTCUT_MACRO)) {
        const ret = globalShortcut.register(SHORTCUT_MACRO, () => {
            mb.show();
        });
        if (!ret) {
            reportError("shortcut registration failed");
        }
        console.log("shortcut registered:", globalShortcut.isRegistered(SHORTCUT_MACRO));
    } else {
        console.log("shortcut already registered");
    }
}

function disableShortcut() {
    if (globalShortcut.isRegistered(SHORTCUT_MACRO)) {
        globalShortcut.unregister(SHORTCUT_MACRO);
        console.log("shortcut registered:", globalShortcut.isRegistered(SHORTCUT_MACRO));
    } else {
        console.log("shortcut already unregistered");
    }
}
