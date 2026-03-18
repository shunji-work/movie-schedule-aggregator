#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { collectTohoSchedules } from './collectors/toho.js';

function getArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }

  return process.argv[index + 1] ?? fallback;
}

function formatDateInput(value) {
  if (!value) {
    const now = new Date();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  return value;
}

async function main() {
  const provider = getArg('--provider', 'toho');
  const date = formatDateInput(getArg('--date'));
  const out = getArg(
    '--out',
    path.join('data', 'collected', `${provider}-${date}.json`)
  );

  if (provider !== 'toho') {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const result = await collectTohoSchedules({ date });

  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, JSON.stringify(result, null, 2));

  process.stdout.write(
    `Collected ${result.theaters.length} theaters and ${result.showtimes.length} showtimes into ${out}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
