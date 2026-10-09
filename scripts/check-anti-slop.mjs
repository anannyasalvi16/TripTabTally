import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve(process.cwd(), 'src');

if (!fs.existsSync(srcDir)) {
  console.error('Error: src directory does not exist.');
  process.exit(1);
}

const bannedPatterns = [
  { name: 'em dash', regex: /\u2014/ },
  { name: 'emoji', regex: /\p{Extended_Pictographic}/u },
  { name: 'alert(', regex: /\balert\s*\(/ },
  { name: 'rounded-', regex: /\brounded-[a-z0-9]+/ },
  { name: 'shadow-', regex: /\bshadow-[a-z0-9]+/ },
  { name: 'marketing word (seamless)', regex: /\bseamless\b/i },
  { name: 'marketing word (empower)', regex: /\bempower\b/i },
  { name: 'marketing word (next-generation)', regex: /\bnext-generation\b/i },
  { name: 'marketing word (effortless)', regex: /\beffortless\b/i },
  { name: 'marketing word (unlock)', regex: /\bunlock\b/i },
  { name: 'marketing word (supercharge)', regex: /\bsupercharge\b/i },
  { name: 'marketing word (all-in-one)', regex: /\ball-in-one\b/i },
];

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

const files = getFiles(srcDir);
let violations = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    for (const pattern of bannedPatterns) {
      if (pattern.regex.test(line)) {
        console.error(
          `Violation [${pattern.name}] at ${path.relative(process.cwd(), file)}:${index + 1}`
        );
        console.error(`  Line: ${line.trim()}`);
        violations++;
      }
    }
  });
}

if (violations > 0) {
  console.error(`\nCheck failed: found ${violations} violation(s) in src.`);
  process.exit(1);
} else {
  console.log(`Anti-slop check passed cleanly across ${files.length} file(s) in src.`);
  process.exit(0);
}
