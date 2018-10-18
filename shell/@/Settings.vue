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
            <el-col :span="12">
                <el-button type="danger" round @click="clearLocalData">Clear local data</el-button>
            </el-col>
            <el-col :span="12">
                <el-button round @click="quitApp">Quit</el-button>
            </el-col>
        </el-row>
        <el-row class="elem" v-show="showUpdateForm">
            <el-col :span="24">
                <label>A new update is available!</label>&nbsp;
                <el-button round type="primary" @click="installUpdate">Install</el-button>
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

    export default {
        data: function() {
            return {
                settings: {
                    launchOnStart: loadSetting("launchOnStart", true),
                    shortcutEnabled: loadSetting("shortcutEnabled", true),
                    hasAlternativeSyncProvider: loadSetting("hasAlternativeSyncProvider", false),
                    syncProvider: loadSetting("syncProvider", "https://sync.clipr.cloud")
                },
                showUpdateForm: false,
                version: pkg.version
            };
        },
        methods: {
            quitApp: function() {
                ipcRenderer.send("app-quit");
                process.exit(0);
            },
            clearLocalData: function() {
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
            }
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
        }
    }
</script>

<style lang="less" scoped>
    #wrapper {
        // text-align: center;
        margin: 10px;
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
</style>
