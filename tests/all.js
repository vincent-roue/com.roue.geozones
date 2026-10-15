'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const suites = ['run.js', 'locales.js', ...fs.readdirSync(__dirname).filter(name => name.endsWith('.test.js')).sort()];
for (const suite of suites) {
  console.log(`\n--- ${suite} ---`);
  const result = spawnSync(process.execPath, [path.join(__dirname, suite)], {
    stdio: 'inherit',
    timeout: 60000,
  });
  if (result.error) console.error(result.error.message);
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
console.log(`\nAll ${suites.length} test suites passed.`);
