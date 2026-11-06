const fs = require('fs');
const src = fs.readFileSync('_archive/legacy/dashboard.html', 'utf8').split(/\r?\n/);
// 1-based inclusive ranges, extracted verbatim
const ranges = [
  [2158, 2197], // createStudioEnvMap
  [2199, 2416], // face canvas + contour numerals
  [2418, 2529], // geometry builders
  [2531, 2618], // buildSportBand
  [2620, 2836], // buildSmartwatch
];
const body = ranges.map(([a, b]) => src.slice(a - 1, b).join('\n')).join('\n\n');
fs.writeFileSync('.watch-body.tmp.js', body);
console.log('lines', body.split('\n').length);
console.log(body.split('\n').slice(0, 3).join('\n'));
console.log('...');
console.log(body.split('\n').slice(-3).join('\n'));
