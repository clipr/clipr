<template>
    <el-container>
        <div v-show="!newAccount" id="login-wrapper">
            <div v-show="logged" id="logged-panel">
                <el-row class="elem">
                    <el-col :span="24">
                        <el-progress type="circle" :percentage="100" status="success" color="#9368B7"></el-progress>
                    </el-col>
                </el-row>
                <el-row class="elem">
                    <el-col :span="24">
                        <span>Your clipboard is syncing!</span>
                    </el-col>
                </el-row>
            </div>
            <div v-show="!logged">
                <el-form ref="loginForm" :model="loginForm">
                    <el-form-item label="E-mail">
                        <el-input v-model="loginForm.email" @keyup.enter.native="login"></el-input>
                    </el-form-item>
                    <el-form-item label="Password">
                        <el-input type="password" v-model="loginForm.password" @keyup.enter.native="login"></el-input>
                    </el-form-item>
                    <el-form-item>
                        <el-button type="primary" round @click="login">Login</el-button>
                    </el-form-item>
                    <span>Don't have an account?&nbsp;<a href="#" @click="showRegister">Register</a></span>
                </el-form>
            </div>
        </div>
        <div v-show="newAccount" id="register-wrapper">
            <el-form ref="registerForm" :model="registerForm">
                <el-form-item label="E-mail">
                    <el-input v-model="registerForm.email" @keyup.enter.native="register"></el-input>
                </el-form-item>
                <el-form-item label="Password">
                    <el-input type="password" v-model="registerForm.password" @keyup.enter.native="register"></el-input>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" round @click="register">Create</el-button>
                </el-form-item>
            </el-form>
            <span>Already have an account?&nbsp;<a href="#" @click="showLogin">Login</a></span>
        </div>
    </el-container>
</template>

<script>
    import Bus from "../bus";
    import {ipcRenderer, shell} from "electron";
    import {randomBytes, createCipher, createDecipher} from "crypto";
    import {loadSetting} from "../settingsLoader";
    const Store = require("electron-store");
    const store = new Store();
    let refreshCookieTimer;
    let syncProvider = loadSetting("syncProvider", "https://sync.clipr.cloud");
    export default {
        data: function() {
            return {
                newAccount: false,
                logged: false,
                loginForm: {
                    email: "",
                    password: ""
                },
                registerForm: {
                    email: "",
                    password: ""
                }
            };
        },
        methods: {
            login: function() {
                if (!this.checkForm("loginForm")) return;
                const cmp = this;
                fetch(`${syncProvider}/login`, {
                    method: "POST",
                    mode: "cors",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email: cmp.loginForm.email,
                        password: cmp.loginForm.password
                    }),
                })
                .then(function(res) {
                    if (res.ok) {
                        return res.json();
                    } else {
                        return res.json().then(function(err) {
                            cmp.createErrorMessage(err.message);
                            return Promise.reject(err);
                        });
                    }
                })
                .then(function(body) {
                    store.set("accessToken", body.token);
                    if (body.capabilities && body.capabilities.encryption === true && body.key) {
                        const decryptedKey = decryptKey(cmp.loginForm.email, cmp.loginForm.password, body.key);
                        store.set("usesEncryption", true);
                        store.set("key", decryptedKey);
                    } else {
                        store.set("usesEncryption", false);
                    }
                    cmp.logged = true;
                    cmp.newAccount = false;
                    getSyncToken(cmp, body.token);
                })
                .catch(function(err) {
                    reportError(err);
                });
            },
            register: function() {
                if (!this.checkForm("registerForm")) return;
                const cmp = this;
                const {key, encryptedKey} = createKey(cmp.registerForm.email, cmp.registerForm.password);
                fetch(`${syncProvider}/register`, {
                    method: "POST",
                    mode: "cors",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email: cmp.registerForm.email,
                        password: cmp.registerForm.password,
                        key: encryptedKey
                    }),
                })
                .then(function(res) {
                    if (res.ok) {
                        return res.json();
                    } else {
                        return res.json().then(function(err) {
                            cmp.createErrorMessage(err.message);
                            return Promise.reject(err);
                        });
                    }
                })
                .then(function(body) {
                    store.set("accessToken", body.token);
                    if (body.capabilities && body.capabilities.encryption === true) {
                        store.set("usesEncryption", true);
                        store.set("key", key);
                    } else {
                        store.set("usesEncryption", false);
                    }
                    cmp.logged = true;
                    cmp.newAccount = false;
                    getSyncToken(cmp, body.token);
                })
                .catch(function(err) {
                    reportError(err);
                });
            },
            showRegister: function() {
                this.newAccount = true;
            },
            showLogin: function() {
                this.newAccount = false;
            },
            checkForm: function (formType) {
                if (!this[formType].email) {
                    this.createErrorMessage('Email is required.');
                    return false;
                } else if (!this.validEmail(this[formType].email)) {
                    this.createErrorMessage('A Valid email is required.');
                    return false;
                }
                if (!this[formType].password) {
                    this.createErrorMessage('A Password is required.');
                    return false;
                }
                return true;
            },
            validEmail: function (email) {
                var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                return re.test(email);
            },
            createErrorMessage(text) {
                const h = this.$createElement;
                this.$message({
                    message: h('p', null, [
                        h('span', null, text)
                    ]),
                    center: true,
                    type: "error",
                    customClass: "alert-msg"
                });
            }
        },
        created: function() {
            const cmp = this;
            if (store.get("accessToken")) {
                this.logged = true;
                this.newAccount = false;
                getSyncToken(cmp, store.get("accessToken"));
            }
            Bus.$on("clear-local-data", function() {
                try {
                    if (refreshCookieTimer) clearInterval(refreshCookieTimer);
                    reset(cmp);
                } catch (e) {
                    return reportError(e);
                }
            });
            Bus.$on("sync-provider-changed", function(args) {
                console.log("sync provider changed, logging out", args.provider);
                syncProvider = args.provider;
                try {
                    if (refreshCookieTimer) clearInterval(refreshCookieTimer);
                    reset(cmp);
                } catch (e) {
                    return reportError(e);
                }
            });
        }
    }
    function reset(cmp) {
        cmp.newAccount = false;
        cmp.logged = false;
        cmp.loginForm.email = "";
        cmp.loginForm.password = "";
        cmp.registerForm.email = "";
        cmp.registerForm.password = "";
    }
    function getSyncToken(cmp, token) {
        return fetch(`${syncProvider}/sync-token?access_token=${token}`, {
            method: "GET",
            mode: "cors"
        })
        .then(function(res) {
            if (res.ok) {
                return res.json();
            } else {
                return res.json().then(function(err) {
                    cmp.createErrorMessage(err.message);
                    return Promise.reject(err);
                });
            }
        })
        .then(function(body) {
            store.set("syncCookie", body.cookie);
            store.set("syncDatabase", body.database);
            ipcRenderer.once("sync-cookie-set", function() {
                console.log("cookie ready!");
                Bus.$emit("start-sync");
            });
            ipcRenderer.send("set-sync-cookie", {cookie: body.cookie});
            refreshCookieTimer = setInterval(function() {
                refreshCookie(token);
            }, 300000);
        })
        .catch(error => reportError(error));
    }

    function refreshCookie(token) {
        fetch(`${syncProvider}/sync-token?access_token=${token}`, {
            method: "GET",
            mode: "cors"
        })
        .then(function(res) {
            if (res.ok) {
                return res.json();
            } else {
                return res.json().then(function(err) {
                    cmp.createErrorMessage(err.message);
                    return Promise.reject(err);
                });
            }
        })
        .then(function(body) {
            store.set("syncDatabase", body.database);
            ipcRenderer.send("refresh-sync-cookie", {cookie: body.cookie});
        })
        .catch(error => reportError(error));
    }

    function createKey(email, pass) {
        const key = randomBytes(256).toString("hex");
        const cipher = createCipher("aes256", `${email}__${pass}`);

        let encryptedKey = cipher.update(key, "utf8", "hex");
        encryptedKey += cipher.final("hex");

        return {key, encryptedKey};
    }

    function decryptKey(email, pass, key) {
        const decipher = createDecipher("aes256", `${email}__${pass}`);

        let decryptedKey = decipher.update(key, "hex", "utf8");
        decryptedKey += decipher.final("utf8");

        return decryptedKey;
    }
</script>

<style lang="less" scoped>
    .el-container {
        text-align: center;
    }
    .elem {
        margin: 20px;
    }
    #logged-panel {
        padding-top: 50px;
    }
    #login-wrapper, #register-wrapper {
        margin: auto;
        width: 100%;
    }
</style>
