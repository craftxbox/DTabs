import './build.js';
import {availableTargets, mutuallyExclusiveTargets} from './package-targets.js';

const requestedTargets = process.argv.slice(2);

if (requestedTargets.length === 0) {
    requestedTargets.push("self");
}

for (const [target, excludes] of Object.entries(mutuallyExclusiveTargets)) {
    if (requestedTargets.includes(target)) {
        for (const exclude of excludes) {
            const index = requestedTargets.indexOf(exclude);
            if(index !== -1) {
                console.warn(`${exclude} is excluded by ${target}. Ignoring ${exclude}.`);
                requestedTargets.splice(index, 1);
            }
        }
    }
}

for (const target of requestedTargets) {
    const packageFunction = availableTargets[target];
    if (packageFunction) {
        console.log(`Packaging for target: ${target}`);
        packageFunction();
    } else {
        console.error(`Unknown target: ${target}`);
        process.exit(1);
    }
}