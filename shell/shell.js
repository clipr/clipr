import Vue from "vue";
import App from "./@/App.vue";
import Element from "element-ui";
import "element-ui/lib/theme-chalk/index.css";
import "./styles/app.less";
import locale from "element-ui/lib/locale/lang/en";
import Analytics from "electron-google-analytics";
import {remote} from "electron";
const Store = require("electron-store");
const store = new Store();
const Sentry = require("@sentry/electron");

if (process.env.CLIPR_ENV !== "development") {
    Sentry.init({
        dsn: "https://c8aa8e2e09d24acebebdb6cb213dfda6@sentry.io/1296558"
    });
    window.Sentry = Sentry;
}
window.reportError = function(err) {
    if (!err instanceof Error) {
        const tmp = new Error();
        tmp.name = err.name || "GenericError";
        tmp.message = err.message || "no message";
        err = tmp;
    }
    if (window.Sentry) {
        Sentry.captureException(err);
        console.error(err);
    } else {
        console.error(err);
    }
};

Vue.use(Element, {locale});

new Vue({
    el: "#app",
    render: function(h) {
        return h(App);
    }
});

if (process.env.CLIPR_ENV !== "development") {
    const analytics = new Analytics("UA-15935695-7");
    if (!store.get("clientId")) {
        const clientId = uuidv4();
        analytics.pageview("https://analytics.clipr.cloud", "App", clientId);
        analytics.event("App", "open", {
            evLabel: "openApp",
            evValue: {
                platform: process.platform,
                version: remote.app.getVersion(),
                systemVersions: process.versions
            },
            clientId: clientId
        });
        store.set("clientId", clientId);
        analytics.set("uid", clientId);
    } else {
        analytics.pageview("app", "App", store.get("clientId"));
        analytics.event("App", "open", {
            evLabel: "openApp",
            evValue: {
                platform: process.platform,
                version: remote.app.getVersion(),
                systemVersions: process.versions
            },
            clientId: store.get("clientId")
        });
    }
}

function uuidv4() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}
