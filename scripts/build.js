// mkdir build
// mkdir build/dist
// cp dist/index.packed.js build/dist/index.packed.js
// cp ./* build/
// rm build/ci.sh
// rm build/tsconfig.json
// rm build/dtabs-icon.png
// rm build/dtabs.icns
// rm build/dtabs.ico
// ln -s ../node_modules build/node_modules

import fs from "fs";
import path from "path";
import {glob} from "glob";

process.chdir(path.resolve(import.meta.dirname, ".."));

const directoriesToCreate = [
    "build",
    "build/dist",
    "build/icons"
];

for (const dir of directoriesToCreate) {
    const dirPath = path.resolve(dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

const filesToCopy = [
    ["dist/index.packed.js", "build/dist/"],
    ["icons/dtabs.png", "build/icons/"],
    ["./*", "build/"],
];

const filesToRemove = [
    "build/ci.sh",
    "build/tsconfig.json",
    "build/rollup.config.js",
];

for (const [src, dest] of filesToCopy) {
    for (const file of glob.sync(src, { nodir: true })) {
        const sourcePath = path.resolve(file);
        const destPath = path.resolve(dest, path.basename(file));
        fs.copyFileSync(sourcePath, destPath);
    }
}

for (const file of filesToRemove) {
    for (const matchedFile of glob.sync(file)) {
        fs.unlinkSync(matchedFile);
    }
}

const nodeModulesPath = path.resolve("node_modules");
const buildNodeModulesPath = path.resolve("build/node_modules");

if (!fs.existsSync(buildNodeModulesPath)) {
    fs.symlinkSync(nodeModulesPath, buildNodeModulesPath, "dir");
}
