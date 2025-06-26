mkdir build
mkdir build/dist
cp dist/index.packed.js build/dist/index.packed.js
cp ./* build/
rm build/ci.sh
rm build/tsconfig.json
rm build/dtabs-icon.png
rm build/dtabs.icns
rm build/dtabs.ico
ln -s ../node_modules build/node_modules