const fs = require('fs-extra');
const path = require('path');

const manifestPath = path.join(__dirname, '../mnm-3e-expanded/module.json');

async function bump() {
  try {
    const manifest = await fs.readJson(manifestPath);
    const versionParts = manifest.version.split('.');
    
    // Increment the PATCH version (the 3rd number)
    versionParts[2] = parseInt(versionParts[2]) + 1;
    
    const newVersion = versionParts.join('.');
    manifest.version = newVersion;
    
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });
    console.log(`Pre-commit: Bumped version to ${newVersion}`);
    
    // Automatically stage the changed module.json
    const { execSync } = require('child_process');
    execSync(`git add "${manifestPath}"`);
    
  } catch (err) {
    console.error('Failed to bump version:', err);
    process.exit(1);
  }
}

bump();
