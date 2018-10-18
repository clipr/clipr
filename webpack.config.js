const path = require("path");
const VueLoaderPlugin = require("vue-loader/lib/plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
    mode: process.env.CLIPR_ENV || "production",
    target: "electron-renderer",
    entry: "./shell/shell.js",
    module: {
        rules: [{
            test: /\.vue$/,
            loader: "vue-loader"
        }, {
            test: /\.less$/,
            use: [
                "vue-style-loader",
                "css-loader",
                "less-loader"
            ]
        }, {
            test: /\.(ttf|eot|woff|woff2)$/,
            use: {
                loader: "file-loader",
                options: {
                    name: "fonts/[name].[ext]"
                }
            }
        }, {
            test: /\.css$/,
            use: [
                "vue-style-loader",
                "css-loader"
            ]
        }]
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js", ".vue", ".css", ".less"],
        alias: {
            "vue$": "vue/dist/vue.runtime.common.js"
        }
    },
    output: {
        path: path.resolve(__dirname, "./built/shell"),
        filename: "shell.js"
    },
    plugins: [
        new VueLoaderPlugin(),
        new CopyWebpackPlugin([
            {from: "./shell/index.html", to: "./index.html"}
        ])
    ]
};

