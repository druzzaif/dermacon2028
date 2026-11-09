import { exec } from 'child_process';
import open from 'open';

// Start Next.js
const next = exec('npx next dev');

// Pipe Next.js output to terminal
next.stdout.pipe(process.stdout);
next.stderr.pipe(process.stderr);

// Wait 3 seconds for Next.js to boot, then open Chrome
setTimeout(() => {
  open('http://localhost:3000', { app: { name: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' } });
  console.log('?? Opened Google Chrome automatically!');
}, 3000);
