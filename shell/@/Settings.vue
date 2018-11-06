<template>
    <div id="wrapper">
        <el-row class="elem">
            <el-col :span="24">
                <label>Launch on system start</label>&nbsp;
                <el-switch
                    v-model="settings.launchOnStart"
                    active-color="#9368B7"
                    inactive-color="#ccc">
                </el-switch>
            </el-col>
        </el-row>
        <el-row class="elem">
            <el-col :span="24">
                <label>Use Control+Space to open/close</label>&nbsp;
                <el-switch
                    v-model="settings.shortcutEnabled"
                    active-color="#9368B7"
                    inactive-color="#ccc">
                </el-switch><br>
                <label>(Command+Space on Mac)</label>
            </el-col>
        </el-row>
        <el-row class="elem">
            <el-col :span="24">
                <label>Use alternative sync provider</label>&nbsp;
                <el-switch
                    v-model="settings.hasAlternativeSyncProvider"
                    active-color="#9368B7"
                    inactive-color="#ccc">
                </el-switch><br>
            </el-col>
        </el-row>
        <el-row class="elem" v-show="settings.hasAlternativeSyncProvider">
            <el-col :span="12">
                <el-input placeholder="provider" v-model="settings.syncProvider" @keyup.enter.native="addAlternativeProvider"></el-input>
            </el-col>
            <el-col :span="12">
                &nbsp;<el-button type="primary" round @click="addAlternativeProvider">Save</el-button>
            </el-col>
        </el-row>
        <el-row class="elem">
            <el-col :span="24">
                <label>Window Position</label>
                <el-select v-model="settings.selectedPosition" placeholder="Select">
                    <el-option
                        v-for="pos in availablePositions"
                        :key="pos.value"
                        :label="pos.label"
                        :value="pos.value">
                    </el-option>
                </el-select>
            </el-col>
        </el-row>
        <el-row class="elem" v-show="showUpdateForm">
            <el-col :span="24">
                <label>A new update is available!</label>&nbsp;
                <el-button round type="primary" @click="installUpdate">Install</el-button>
            </el-col>
        </el-row>
        <el-row class="elem">
            <el-col :span="12">
                <el-button type="danger" round @click="clearLocalData">Clear local data</el-button>
            </el-col>
            <el-col :span="12">
                <el-button round @click="quitApp">Quit</el-button>
            </el-col>
        </el-row>
        <el-tag id="version">v{{version}}</el-tag>
    </div>
</template>

<script>
    import {ipcRenderer} from "electron";
    import Bus from "../bus";
    import {loadSetting, saveSetting} from "../settingsLoader";
    import pkg from "../../package.json"
    const Store = require("electron-store");
    const store = new Store();

    export default {
        data: function() {
            return {
                settings: {
                    launchOnStart: loadSetting("launchOnStart", true),
                    shortcutEnabled: loadSetting("shortcutEnabled", true),
                    hasAlternativeSyncProvider: loadSetting("hasAlternativeSyncProvider", false),
                    syncProvider: loadSetting("syncProvider", "https://sync.clipr.cloud"),
                    selectedPosition: loadSetting("windowPosition", "")
                },
                showUpdateForm: false,
                version: pkg.version,
                availablePositions: [{
                    label: "Bottom Right",
                    value: "bottomRight"
                }, {
                    label: "Bottom Left",
                    value: "bottomLeft"
                }, {
                    label: "Top Right",
                    value: "topRight"
                }, {
                    label: "Top Left",
                    value: "topLeft"
                }]
            };
        },
        methods: {
            quitApp: function() {
                ipcRenderer.send("app-quit");
                process.exit(0);
            },
            clearLocalData: function() {
                store.clear();
                this.settings.hasAlternativeSyncProvider = false;
                Bus.$emit("clear-local-data");
                const h = this.$createElement;
                this.$message({
                    message: h('p', null, [
                        h('span', null, "Local data cleared!")
                    ]),
                    center: true,
                    type: "success",
                    customClass: "alert-msg"
                });
            },
            installUpdate: function() {
                ipcRenderer.send("install-update-and-restart");
            },
            addAlternativeProvider: function() {
                saveSetting("syncProvider", this.settings.syncProvider);
                Bus.$emit("sync-provider-changed", {provider: this.settings.syncProvider});
                const h = this.$createElement;
                this.$message({
                    message: h('p', null, [
                        h('span', null, "Sync provider changed!")
                    ]),
                    center: true,
                    type: "success",
                    customClass: "alert-msg"
                });
                ipcRenderer.send("sync-provider", this.settings.syncProvider);
            }
        },
        watch: {
            "settings.launchOnStart": function(newval, oldval) {
                ipcRenderer.send("setting-launch-on-start", newval);
                saveSetting("launchOnStart", newval);
            },
            "settings.shortcutEnabled": function(newval, oldval) {
                ipcRenderer.send("setting-shortcut-toggle", newval);
                saveSetting("shortcutEnabled", newval);
            },
            "settings.hasAlternativeSyncProvider": function(newval, oldval) {
                saveSetting("hasAlternativeSyncProvider", newval);
                if (newval === false && newval !== oldval) {
                    this.settings.syncProvider = "https://sync.clipr.cloud";
                    this.addAlternativeProvider();
                }
            },
            "settings.selectedPosition": function(newval, oldval) {
                ipcRenderer.send("set-position", newval);
                saveSetting("windowPosition", newval);
            },
        },
        created: function() {
            ipcRenderer.send("setting-launch-on-start", loadSetting("launchOnStart", true));
            ipcRenderer.send("setting-shortcut-toggle", loadSetting("shortcutEnabled", true));
            ipcRenderer.on("new-update-ready", (event, arg) => {
                this.showUpdateForm = true;
            });
            if (loadSetting("hasAlternativeSyncProvider", false)) {
                ipcRenderer.send("sync-provider", loadSetting("syncProvider", "https://sync.clipr.cloud"));
            }
            if (loadSetting("windowPosition", false)) {
                ipcRenderer.send("set-position", loadSetting("windowPosition", ""));
            }
        }
    }
</script>

<style lang="less" scoped>
    #wrapper {
        max-height: 300px;
        overflow-y: auto;
        margin: 10px;
        margin-top: 20px;
    }
    .elem {
        margin: 20px;
    }
    #version {
        position: absolute;
        top: 0px;
        right: 0px;
        border-radius: 0px;
        border: none;
        border-bottom-left-radius: 10px;
    }
    #wrapper::-webkit-scrollbar {
        width: 8px;
        background-color: #fff;
        border-radius: 10px;
    }
    #wrapper::-webkit-scrollbar-thumb {
        width: 8px;
        background-color: #9368B7;
        border-radius: 10px;
    }
    #wrapper::-webkit-scrollbar-track {
        -webkit-box-shadow: inset 0 0 6px rgba(0,0,0,0.3);
        box-shadow: inset 0 0 6px rgba(0,0,0,0.3);
        background-color: #F5F5F5;
        border-radius: 10px;
    }
</style>
