const path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

const COLOR_KEYS = ["color", "bgColor", "fillcolor"];

const transformDataColors = async (data, path) => {
    const {getNamedColor} = await import('./src/colors.mjs');
    // if not json file, return
    if (!path.endsWith(".json")) {
        return data;
    }
    const parsedData = JSON.parse(data);
    // Change the color of the data
    const deepIterateAndSetColor = (key, val) => {
        if (val === null) {
            return null;
        }
        if (val == undefined) {
            return undefined;
        }
        if (Array.isArray(val)) {
            return val.map(item => deepIterateAndSetColor(key, item));
        }
        if (typeof val === "object") {
            return Object.entries(val).reduce((newObj, [key, value]) => {
                newObj[key] = deepIterateAndSetColor(key, value);
                return newObj;
            }, {});
        }
        if (COLOR_KEYS.includes(key)) {
            const [colorName, opacity, ...rest] = val.trim().split(/\s+/);
            const floatOpacity = parseFloat(opacity);
            const newColor = getNamedColor(colorName, floatOpacity);
            if (newColor !== undefined && rest.length === 0 && !isNaN(floatOpacity)) {
                console.log(`key: ${key} in file ${path} changed from ${val} to ${newColor}`);
                return newColor;
            } else {
                return val;
            }
        }
        return val;
    };
    return JSON.stringify(deepIterateAndSetColor(undefined, parsedData))
};

module.exports = {
    entry: {
        distill: "./src/distill.js",
        main: "./src/index.js",
    },
    output: {
        filename: "[name].bundle.js",
        path: path.resolve(__dirname, "dist"),
    },
    module: {
        rules: [
            {
                test: /\.(js|mjs)$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["@babel/preset-env"],
                    },
                },
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    plugins: [
        new CleanWebpackPlugin(),
        new CopyPlugin({
            patterns: [
                {
                    from: "assets",
                    to: "assets",
                },
                { from: "src/style.css", to: "style.css" },
                { from: "src/bibliography.bib", to: "bibliography.bib" },
                { from: "src/index.html", to: "index.html" },
                { 
                    from: "../analysis/data",
                    to: "data",
                    globOptions: {
                        ignore: ["**/*.json"],
                    },
                },
            ],
        }),
    ],
    devtool: process.env.NODE_ENV === 'production' ? 'source-map' : 'eval-source-map',
    devServer: {
        static: "./dist",
        open: process.env.NODE_ENV !== 'production',
        hot: process.env.NODE_ENV !== 'production',
        liveReload: process.env.NODE_ENV !== 'production',
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
        }
    },
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
};

console.log(process.env.NODE_ENV)
