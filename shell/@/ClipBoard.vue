<template>
    <el-container>
        <el-header>
            <el-form :model="searchForm" @submit.prevent.native="search">
                <el-form-item>
                    <el-input
                        v-model="searchForm.term"
                        placeholder="search"
                        @keyup.native="!searchForm.term && clearSearch()">
                    </el-input>
                </el-form-item>
            </el-form>
        </el-header>
        <el-main>
            <div id="clip-list">
                <el-col
                    :span="24" v-show="!searching"
                    v-for="clip in clipboard" :key="clip.id"
                    class="clip-entry">
                        <el-card shadow="always" @click.native="copyEntry(clip.id)">
                            {{clip.except || clip.fullText}}
                        </el-card>
                </el-col>
                <el-col
                    :span="24" v-show="searching"
                    v-for="clip in searchClipBoard" :key="clip.id"
                    class="clip-entry">
                        <el-card shadow="always" @click.native="copySearchEntry(clip.id)">
                            {{clip.except || clip.fullText}}
                        </el-card>
                </el-col>
            </div>
        </el-main>
    </el-container>
</template>

<script>
    import {clipboard} from "electron";
    import {debounce} from "lodash";
    import PouchDb from "pouchdb";
    import Bus from "../bus";
    import {loadSetting} from "../settingsLoader";
    const Store = require("electron-store");
    const store = new Store();

    let clipDb = new PouchDb("clipDb");
    let clipSearchDb = new PouchDb("clipSearchDb");
    let readerTimer;
    let syncHandler;
    let syncProvider = loadSetting("syncProvider", "https://sync.clipr.cloud");

    const CLIPBOARD_MAX_SIZE = 10;

    export default {
        data: function() {
            return {
                clipboard: [],
                searchClipBoard: [],
                lastCopied: null,
                lastSynced: null,
                searching: false,
                searchForm: {
                    term: ""
                }
            }
        },
        methods: {
            copyEntry: function(clipId) {
                console.log(clipId);
                const clipText = this.clipboard.find(c => c.id === clipId).fullText;
                this.lastCopied = clipText;
                clipboard.writeText(clipText);
            },
            copySearchEntry: function(clipId) {
                console.log(clipId);
                const clipText = this.searchClipBoard.find(c => c.id === clipId).fullText;
                clipboard.writeText(clipText);
                this.clearSearch();
            },
            search: function() {
                const cmp = this;
                this.searching = true;
                cmp.searchClipBoard = [];
                const searchKey = "search__" + cmp.searchForm.term.replace(/\s*/g, "").toLowerCase();
                clipSearchDb.allDocs({
                    startkey: searchKey,
                    endkey: `${searchKey}\uffff`,
                    limit: 10,
                    include_docs: true
                }).then(async function(result) {
                    const keys = result.rows.map(row => {
                        return row.doc.key;
                    });
                    for (let key of keys) {
                        if (key) {
                            const doc = await clipDb.get(key);
                            if (doc) cmp.searchClipBoard.unshift(doc);
                        }
                    }
                }).catch(function(err) {
                    reportError(err);
                });
            },
            clearSearch: function() {
                this.searchClipBoard = [];
                this.searching = false;
                this.searchForm.term = "";
            }
        },
        watch: {
            "searchForm.term": debounce(function() {
                if (this.searchForm.term) {
                    this.search();
                }
            }, 200)
        },
        created: function() {
            const cmp = this;
            loadSavedClips(cmp).then(function() {
                startReader(cmp);
            });

            Bus.$on("clear-local-data", async function() {
                try {
                    localStorage.clear();
                    if (syncHandler) syncHandler.cancel();
                    await clipDb.destroy();
                    await clipSearchDb.destroy();
                } catch (e) {
                    return reportErrorr(e);
                }
                clipDb = new PouchDb("clipDb");
                clipSearchDb = new PouchDb("clipSearchDb");
                cmp.clipboard = [];
                cmp.lastCopied = null;
            });

            Bus.$on("sync-provider-changed", function(args) {
                console.log("sync provider changed, stoping sync", args.provider);
                if (syncHandler) {
                    syncHandler.cancel();
                }
                syncProvider = args.provider;
            });

            Bus.$on("start-sync", function() {
                const remoteDb = new PouchDb(`${syncProvider}/couchdb/${store.get("syncDatabase")}`, {
                    fetch: (url, opts) => fetch(url, {...opts,
                        credentials: "include",
                        mode: "cors",
                        headers: {
                            "X-CouchDB-WWW-Authenticate": "Cookie",
                            "Content-Type": "application/json"
                        }
                    })
                });
                syncHandler = clipDb.sync(remoteDb, {
                    live: true,
                    retry: true
                }).on("change", function (change) {
                    console.log("sync", change);
                    if (change.direction === "pull") {
                        const searchDocs = change.change.docs.map(d => {
                            return {
                                _id: `search__${(d.except || d.fullText).replace(/\s*/g, "").toLowerCase()}__${d.ts}`,
                                key: d.id || d._id
                            };
                        });
                        change.change.docs.forEach(d => {
                            addToViewClipboard(cmp, (d.id || d._id), d.ts, d.fullText);
                            cmp.lastSynced = d.fullText;
                        });
                        clipSearchDb.bulkDocs(searchDocs)
                        .then(function() {
                            console.log("synced to search");
                        })
                        .catch(function(err) {
                            reportError(err);
                        });
                    }
                }).on("error", function (err) {
                    reportError(err);
                });
            });
        }
    }

    function stopReader() {
        clearInterval(readerTimer);
    }

    function addToViewClipboard(cmp, id, ts, text) {
        if (!text || text.length === 0) return {addedToView: false, except: null};
        if (cmp.clipboard.length > 0) {
            if (cmp.clipboard.find(clip => clip.fullText === text)) {
                return {addedToView: false, except: null};
            }
            if (text === cmp.lastCopied) {
                return {addedToView: false, except: null};
            }
            if (text === cmp.lastSynced) {
                return {addedToView: false, except: null};
            }
        }
        if (cmp.clipboard.length === CLIPBOARD_MAX_SIZE) cmp.clipboard.pop();
        let except;
        if (text.length > 120) {
            except = text.substr(0, 120) + "...";
        }
        cmp.clipboard.unshift({
            id: id,
            ts: ts,
            fullText: text,
            except: except
        });
        cmp.clipboard.sort(compareTs);
        return {addedToView: true, except: except};
    }

    function compareTs(a, b) {
        if (a.ts > b.ts) {
            return -1;
        }
        if (a.ts < b.ts) {
            return 1;
        }
        return 0;
    }

    function startReader(cmp) {
        readerTimer = setInterval(() => {
            const text = clipboard.readText();

            const ts = Date.now();
            const id = `clip__${ts}`

            const {addedToView, except} = addToViewClipboard(cmp, id, ts, text);

            if (!addedToView) return;

            console.info("adding", except || text, ts);

            clipDb.put({
                _id: id,
                ts: ts,
                fullText: text,
                except: except
            }).then(function(doc) {
                clipSearchDb.put({
                    _id: `search__${(except || text).replace(/\s*/g, "").toLowerCase()}__${ts}`,
                    key: id
                }).then(function() {
                    console.log("added to search");
                }).catch(function(err) {
                    reportError(err);
                });
            }).catch(function(err) {
                reportError(err);
            });
        }, 20);
    }

    function loadSavedClips(cmp) {
        if (cmp.clipboard.length < CLIPBOARD_MAX_SIZE) {
            return clipDb.allDocs({
                include_docs: true,
                limit: CLIPBOARD_MAX_SIZE - cmp.clipboard.length,
                descending: true
            }).then(function(result) {
                cmp.clipboard = result.rows.map(row => {
                    row.doc.id = row.doc._id;
                    return row.doc;
                });
                if (cmp.clipboard[0]) {
                    cmp.lastCopied = cmp.clipboard[0].fullText;
                }
                return Promise.resolve();
            }).catch(function(err) {
                reportError(err);
            });
        }
    }
</script>

<style lang="less" scoped>
    #clip-list {
        max-height: 280px;
        overflow-y: auto;
    }
    .el-main {
        padding: 0;
    }
    .clip-entry {
        cursor: pointer;
    }
    .clip-entry {
        div {
            background-color: #fff;
            color: #333;
        }
        div:hover {
            transition: background-color 0.2s ease-in;
            transition: color 0.2s ease-in;
            transition: border-top-left-radius 0.2s ease-in;
            background-color: #9368B7;
            color: #fff;
            border-top-left-radius: 20px;
        }
    }
    #clip-list::-webkit-scrollbar {
        width: 8px;
        background-color: #fff;
        border-radius: 10px;
    }
    #clip-list::-webkit-scrollbar-thumb {
        width: 8px;
        background-color: #9368B7;
        border-radius: 10px;
    }
    #clip-list::-webkit-scrollbar-track {
        -webkit-box-shadow: inset 0 0 6px rgba(0,0,0,0.3);
        box-shadow: inset 0 0 6px rgba(0,0,0,0.3);
        background-color: #F5F5F5;
        border-radius: 10px;
    }
</style>
