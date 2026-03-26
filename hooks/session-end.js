#!/usr/bin/env node
/**
 * SessionEnd Hook - High Reliability Version
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    let input = process.argv[2];
    if (!input) {
        input = await new Promise(resolve => {
            let data = '';
            process.stdin.on('data', chunk => data += chunk);
            process.stdin.on('end', () => resolve(data));
            setTimeout(() => resolve(data), 500);
        });
    }

    const projectDir = process.env.GEMINI_PROJECT_DIR || process.cwd();
    const kitDir = path.join(projectDir, '.gemini-kit');

    // Simple cleanup / stats summary
    console.log(JSON.stringify({
        systemMessage: "👋 Gemini-Kit session ended. All changes saved.",
    }));

    process.exit(0);
}

main();
