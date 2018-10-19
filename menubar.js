/*
Forked from https://github.com/maxogden/menubar

Copyright 2018 https://github.com/maxogden

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

var path = require("path");
var events = require("events");

var electron = require("electron");
var app = electron.app;
var Tray = electron.Tray;
var BrowserWindow = electron.BrowserWindow;

var extend = require("extend");
var Positioner = require("electron-positioner");

module.exports = function create(opts) {
    if (typeof opts === "undefined") opts = {dir: app.getAppPath()};
    if (typeof opts === "string") opts = {dir: opts};
    if (!opts.dir) opts.dir = app.getAppPath();
    if (!(path.isAbsolute(opts.dir))) opts.dir = path.resolve(opts.dir);
    if (!opts.index) opts.index = "file://" + path.join(opts.dir, "index.html");
    if (!opts.windowPosition) opts.windowPosition = (process.platform === "win32") ? "trayBottomCenter" : "trayCenter";
    if (typeof opts.showDockIcon === "undefined") opts.showDockIcon = false;

    // set width/height on opts to be usable before the window is created
    opts.width = opts.width || 400;
    opts.height = opts.height || 400;
    opts.tooltip = opts.tooltip || "";

    var menubar = new events.EventEmitter();
    menubar.app = app;

    if (app.isReady()) appReady();
    else app.on("ready", appReady);

    // Set / get options
    menubar.setOption = function(opt, val) {
        opts[opt] = val;
    };

    menubar.getOption = function(opt) {
        return opts[opt];
    };

    return menubar;

    function appReady() {
        if (app.dock && !opts.showDockIcon) app.dock.hide();

        var iconPath = opts.icon;
        if (process.env.CLIPR_ENV === "development") {
            iconPath = "." + iconPath + "/tray/clipr_tray.png";
        } else {
            if (process.platform === "darwin") {
                iconPath = path.join(app.getPath("exe"), "/../", "/../", iconPath, "tray", "clipr_tray.png");
            } else {
                iconPath = path.join(app.getPath("exe"), "/../", iconPath, "tray", "clipr_tray.png");
            }
        }
        console.log("setting tray icon", iconPath);
        var cachedBounds; // cachedBounds are needed for double-clicked event
        var defaultClickEvent = opts.showOnRightClick ? "right-click" : "click";

        menubar.tray = opts.tray || new Tray(iconPath);
        menubar.tray.on(defaultClickEvent, clicked);
        menubar.tray.on("double-click", clicked);
        menubar.tray.setToolTip(opts.tooltip);

        if (process.platform === "linux") {
            const contextMenu = electron.Menu.buildFromTemplate([
                {label: "clipr", type: "normal", click: clicked}
            ]);
            menubar.tray.setContextMenu(contextMenu);
        }

        var supportsTrayHighlightState = false;
        try {
            menubar.tray.setHighlightMode("never");
            supportsTrayHighlightState = true;
        } catch (e) {}

        if (opts.preloadWindow) {
            createWindow();
        }

        menubar.showWindow = showWindow;
        menubar.hideWindow = hideWindow;
        menubar.emit("ready");

        function clicked(e, bounds) {
            if (menubar.window && menubar.window.isVisible()) return hideWindow();
            cachedBounds = bounds || cachedBounds;
            showWindow(cachedBounds);
        }
        menubar.show = clicked;

        function createWindow() {
            menubar.emit("create-window");
            var defaults = {
                "show": false,
                "frame": false,
                "fullscreenable": false,
                "resizable": false,
                "transparent": true,
                "skipTaskbar": true
            };

            var iconPath;
            if (process.env.CLIPR_ENV === "development") {
                iconPath = "." + opts.icon + "/512.png";
            } else {
                iconPath = path.join(app.getPath("exe"), "/../", opts.icon, "512.png");
            }
            console.log("setting app icon:", iconPath);

            var winOpts = extend(defaults, opts);
            winOpts.icon = iconPath;
            menubar.window = new BrowserWindow(winOpts);

            menubar.positioner = new Positioner(menubar.window);

            menubar.window.on("blur", function() {
                opts.alwaysOnTop ? emitBlur() : hideWindow();
            });

            if (opts.showOnAllWorkspaces !== false) {
                menubar.window.setVisibleOnAllWorkspaces(true);
            }

            menubar.window.on("close", windowClear);
            menubar.window.loadURL(opts.index);
            menubar.emit("after-create-window");
        }

        function showWindow(trayPos) {
            if (supportsTrayHighlightState) menubar.tray.setHighlightMode("always");
            if (!menubar.window) {
                createWindow();
            }
            menubar.window.setSkipTaskbar(true);

            menubar.emit("show");

            if (trayPos && trayPos.x !== 0) {
                // Cache the bounds
                cachedBounds = trayPos;
            } else if (cachedBounds) {
                // Cached value will be used if showWindow is called without bounds data
                trayPos = cachedBounds;
            } else if (menubar.tray.getBounds) {
                // Get the current tray bounds
                trayPos = menubar.tray.getBounds();
            }

            // Default the window to the right if `trayPos` bounds are undefined or null.
            var noBoundsPosition = null;
            if ((trayPos === undefined || trayPos.x === 0) && opts.windowPosition.substr(0, 4) === "tray") {
                noBoundsPosition = (process.platform === "win32") ? "bottomRight" : "topRight";
            }

            var position = menubar.positioner.calculate(noBoundsPosition || opts.windowPosition, trayPos);

            var x = (menubar.customPos) ? menubar.customPos.x : position.x;
            var y = (menubar.customPos) ? menubar.customPos.y : position.y;

            menubar.window.setPosition(x, y);
            menubar.window.show();
            menubar.emit("after-show");
            return;
        }

        function hideWindow() {
            if (supportsTrayHighlightState) menubar.tray.setHighlightMode("never");
            if (!menubar.window) return;
            menubar.emit("hide");
            menubar.window.hide();
            menubar.emit("after-hide");
        }

        function windowClear() {
            delete menubar.window;
            menubar.emit("after-close");
        }

        function emitBlur() {
            menubar.emit("focus-lost");
        }
    }
};
