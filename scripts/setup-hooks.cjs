// Enables .githooks (secret scan) unless another core.hooksPath is already configured,
// so global hooks keep running.
const { execSync } = require('node:child_process');

try {
  let current = '';
  try {
    current = execSync('git config --get core.hooksPath', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {}
  if (current && current !== '.githooks') {
    console.log(`core.hooksPath is already set to ${current}; not enabling .githooks`);
  } else {
    execSync('git config core.hooksPath .githooks', { stdio: 'ignore' });
  }
} catch {}
