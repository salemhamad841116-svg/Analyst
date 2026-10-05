const { execSync } = require('child_process');
try {
  execSync('zip -r /Users/mac/.gemini/antigravity/brain/bf95e95a-c2ab-4030-91ae-4e20f8a931b2/High-Confidence-Engine-Release.zip . -x "node_modules/*" -x ".git/*" -x "dist/*" -x ".npm-cache/*"', { stdio: 'inherit' });
  console.log('Zipped project successfully.');
} catch (e) {
  console.error(e);
}
