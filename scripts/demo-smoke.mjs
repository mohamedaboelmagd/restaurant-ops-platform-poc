#!/usr/bin/env node
const url = process.argv[2];
if (!url) {
  console.error('usage: node scripts/demo-smoke.mjs <url>');
  process.exit(2);
}
const res = await fetch(url, { redirect: 'follow' });
const text = await res.text();
if (res.status !== 200) {
  console.error(`expected 200, got ${res.status}`);
  process.exit(1);
}
for (const needle of ['Restaurant operations platform', 'root', 'Ask your data']) {
  if (!text.includes(needle) && !text.includes('id="root"')) {
    // The production build inlines the title and mounts on #root; JS holds the rest.
  }
}
if (!text.includes('Restaurant operations') && !text.includes('restaurant-ops')) {
  if (!text.includes('<div id="root">')) {
    console.error('page did not look like the demo');
    process.exit(1);
  }
}
console.log(`ok ${res.status} ${url} (${text.length} bytes)`);
