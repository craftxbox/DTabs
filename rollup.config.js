// rollup.config.js
import copy from "rollup-plugin-copy";

export default {
    input: "dist/index.js",
    output: {
        file: "dist/index.packed.js",
        format: "esm",
        sourcemap: true,
    },
};
