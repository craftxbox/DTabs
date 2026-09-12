import {execSync} from 'child_process';
import {packager} from '@electron/packager';

export const availableTargets = {
    "win-amd64": package_win_amd64,
    "win-arm64": package_win_arm64,
    "mac-amd64": package_mac_x64,
    "mac-arm64": package_mac_arm64,
    "linux-amd64": package_linux_x64,
    "linux-arm64": package_linux_arm64,
    "all-amd64": package_all_amd64,
    "all-arm64": package_all_arm64,
    "all": package_all,
    "self": package_self
}

export const mutuallyExclusiveTargets = {
    "all-amd64": ["win-amd64", "mac-amd64", "linux-amd64"],
    "all-arm64": ["win-arm64", "mac-arm64", "linux-arm64"],
    "all": ["all-amd64", "all-arm64"]
}

function package_self() {
    const platform = process.platform;
    const arch = process.arch;

    if (platform === "win32" && arch === "x64") {
        package_win_amd64();
    } else if (platform === "win32" && arch === "arm64") {
        package_win_arm64();
    } else if (platform === "darwin" && arch === "x64") {
        package_mac_x64();
    } else if (platform === "darwin" && arch === "arm64") {
        package_mac_arm64();
    } else if (platform === "linux" && arch === "x64") {
        package_linux_x64();
    } else if (platform === "linux" && arch === "arm64") {
        package_linux_arm64();
    } else {
        console.error(`Unrecognized platform/architecture: ${platform}/${arch}`);
        process.exit(1);
    }
}

function package_win_amd64() {
    packager({
        dir: 'build',
        platform: 'win32',
        arch: 'x64',
        overwrite: true,
        icon: 'icons/dtabs.ico',
        asar: false
    }).then((paths) => {
        console.log(`Packaged for Windows x64: ${paths}`);
    }).catch((error) => {
        console.error(`Error packaging for Windows x64: ${error}`);
    });
}

function package_win_arm64() {
    packager({
        dir: 'build',
        platform: 'win32',
        arch: 'arm64',
        overwrite: true,
        icon: 'icons/dtabs.ico',
        asar: false
    }).then((paths) => {
        console.log(`Packaged for Windows arm64: ${paths}`);
    }).catch((error) => {
        console.error(`Error packaging for Windows arm64: ${error}`);
    });
}

function package_mac_x64() {
    packager({
        dir: 'build',
        platform: 'darwin',
        arch: 'x64',
        overwrite: true,
        icon: [
            'icons/dtabs.mac.icns'
        ],
        asar: false
    }).then((paths) => {
        console.log(`Packaged for macOS x64: ${paths}`);
    }).catch((error) => {
        console.error(`Error packaging for macOS x64: ${error}`);
    });
}

function package_mac_arm64() {
    packager({
        dir: 'build',
        platform: 'darwin',
        arch: 'arm64',
        overwrite: true,
        icon: [
            'icons/dtabs.mac.icns'
        ],
        asar: false
    }).then((paths) => {
        console.log(`Packaged for macOS arm64: ${paths}`);
    }).catch((error) => {
        console.error(`Error packaging for macOS arm64: ${error}`);
    });
}

function package_linux_x64() {
    packager({
        dir: 'build',
        platform: 'linux',
        arch: 'x64',
        overwrite: true,
        icon: './dtabs-icon.png',
        asar: false
    }).then((paths) => {
        console.log(`Packaged for Linux x64: ${paths}`);
    }).catch((error) => {
        console.error(`Error packaging for Linux x64: ${error}`);
    });
}

function package_linux_arm64() {
    packager({
        dir: 'build',
        platform: 'linux',
        arch: 'arm64',
        overwrite: true,
        icon: './dtabs-icon.png',
        asar: false
    }).then((paths) => {
        console.log(`Packaged for Linux arm64: ${paths}`);
    }).catch((error) => {
        console.error(`Error packaging for Linux arm64: ${error}`);
    });
}

function package_all_amd64() {
    package_win_amd64();
    package_mac_x64();
    package_linux_x64();
}

function package_all_arm64() {
    package_win_arm64();
    package_mac_arm64();
    package_linux_arm64();
}

function package_all() {
    package_all_amd64();
    package_all_arm64();
}

