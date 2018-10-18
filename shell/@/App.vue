<template>
    <div id="wrapper">
        <el-tabs v-model="activeTab" type="border-card" id="tabs">
            <el-tab-pane label="Clipboard" name="clipboard">
                <clip-board></clip-board>
            </el-tab-pane>
            <el-tab-pane label="Sync" name="sync">
                <sync></sync>
            </el-tab-pane>
            <el-tab-pane label="Settings" name="settings">
                <settings></settings>
            </el-tab-pane>
        </el-tabs>
    </div>
</template>

<script>
    import ClipBoard from "./ClipBoard.vue";
    import Sync from "./Sync.vue";
    import Settings from "./Settings.vue";
    export default {
        data: function() {
            return {
                activeTab: "clipboard"
            };
        },
        components: {
            ClipBoard,
            Sync,
            Settings
        },
        methods: {

        }
    }
</script>

<style lang="less" scoped>
    #wrapper {
        height: 100%;
    }
    #tabs {
        height: 100%;
    }
</style>

