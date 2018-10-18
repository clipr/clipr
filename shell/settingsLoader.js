const Store = require("electron-store");
const store = new Store();

export function saveSetting(setting, val) {
    store.set(`settings.${setting}`, val);
}

export function loadSetting(setting, defaultVal) {
    return store.get(`settings.${setting}`, defaultVal);
}
