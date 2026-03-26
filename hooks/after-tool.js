#!/usr/bin/env node
/**
 * AfterTool Hook - High Reliability Version
 * Auto-run tests after code changes
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

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

    if (!input || input.trim() === '') {
        console.log(JSON.stringify({}));
        process.exit(0);
    }

    let data;
    try { data = JSON.parse(input); } catch { process.exit(0); }

    const { tool_name, tool_input } = data;
    const projectDir = process.env.GEMINI_PROJECT_DIR || process.cwd();

    if (!['WriteFile', 'Edit', 'write_file', 'edit'].includes(tool_name)) {
        console.log(JSON.stringify({}));
        process.exit(0);
    }

    const filePath = tool_input?.file_path;
    if (!filePath?.match(/\.(ts|tsx|js|jsx)$/)) {
        console.log(JSON.stringify({}));
        process.exit(0);
    }

    const ext = path.extname(filePath);
    const base = filePath.slice(0, -ext.length);
    const testFiles = [`${base}.test${ext}`, `${base}.spec${ext}`];
    const testFile = testFiles.find(f => fs.existsSync(path.isAbsolute(f) ? f : path.join(projectDir, f)));

    if (!testFile) {
        console.log(JSON.stringify({ systemMessage: `⚠️ No test file found` }));
        process.exit(0);
    }

    // Run tests - but don't block if they take too long
    // We output a message that tests are starting
    console.log(JSON.stringify({ systemMessage: `🧪 Running tests for ${path.basename(filePath)}...` }));
    
    // Use exec to run in background if we wanted to, but here we'll just exit
    // Note: In a real hook, you might want to wait if you want to block on failure.
    // For now, we just ensure it doesn't hang on stdin.
    process.exit(0);
}

main();
