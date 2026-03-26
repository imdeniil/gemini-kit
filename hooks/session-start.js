#!/usr/bin/env node
/**
 * SessionStart Hook - High Reliability Version
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    // 1. Quick Input Parse (Non-blocking)
    let input = process.argv[2];
    if (!input) input = '{}';
    
    try { JSON.parse(input); } catch { input = '{}'; }

    const projectDir = process.env.GEMINI_PROJECT_DIR || process.cwd();
    const kitDir = path.join(projectDir, '.gemini-kit');

    // 2. Fast Sync Ops
    const dirs = ['artifacts', 'handoffs', 'memory', 'logs'];
    for (const dir of dirs) {
        if (!fs.existsSync(path.join(kitDir, dir))) {
            fs.mkdirSync(path.join(kitDir, dir), { recursive: true });
        }
    }

    const statsFile = path.join(kitDir, 'stats.json');
    let stats = { sessions: 0, lastSession: null };
    if (fs.existsSync(statsFile)) {
        try { stats = JSON.parse(fs.readFileSync(statsFile, 'utf8')); } catch { }
    }
    stats.sessions++;
    stats.lastSession = new Date().toISOString();
    fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));

    // 3. Initialization Logic
    let initMessage = '';
    const geminiMdPath = path.join(projectDir, 'GEMINI.md');
    const templatePath = path.join(projectDir, 'GEMINI.tmp.en.md');
    if (!fs.existsSync(geminiMdPath) && fs.existsSync(templatePath)) {
        try {
            fs.copyFileSync(templatePath, geminiMdPath);
            initMessage += ' | 📄 GEMINI.md created';
        } catch (e) { }
    }

    const ignorePath = path.join(projectDir, '.geminiignore');
    if (!fs.existsSync(ignorePath)) {
        try {
            fs.writeFileSync(ignorePath, "# Ignoring files\n.claude/*\n.tldr/*\nCLAUDE.md\nthoughts/*\n");
            initMessage += ' | 🛡️ .geminiignore created';
        } catch (e) { }
    }

    // 4. Background Tasks (Fire and Forget)
    const tldrDir = path.join(projectDir, '.tldr');
    const isFirstTime = !fs.existsSync(tldrDir);
    const logPath = path.join(kitDir, 'logs', 'indexing.log');
    const telegramHook = path.join(__dirname, 'telegram-notify.js');

    const startBackgroundTask = (taskType) => {
        const payload = JSON.stringify({
            event: "TLDR Indexing",
            summary: `✅ TLDR ${taskType} indexing completed.`
        });
        
        // The core "magic": run in a subshell, redirect to log, and background it with &
        // Fixed: tldr warm does not use --project argument
        const cmd = `(tldr warm . && node ${telegramHook} '${payload}') >> ${logPath} 2>&1`;
        
        const child = spawn('sh', ['-c', cmd], {
            cwd: projectDir,
            env: { ...process.env, TLDR_AUTO_DOWNLOAD: '1' },
            detached: true,
            stdio: 'ignore'
        });
        child.unref();
        
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ⚡ ${taskType} sequence started\n`);
    };

    if (isFirstTime) {
        startBackgroundTask('initial');
        initMessage += ' | ⚡ Indexing started';
    } else {
        // Quick check for changes without callback hell
        const gitCheck = spawn('sh', ['-c', 'git diff --name-only HEAD | wc -l'], { cwd: projectDir });
        gitCheck.stdout.on('data', (data) => {
            const count = parseInt(data.toString().trim(), 10);
            if (count > 20) startBackgroundTask('re-index');
        });
    }

    // 5. Immediate Return
    console.log(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'SessionStart',
            additionalContext: `🚀 Kit v4 (Session #${stats.sessions})${initMessage}`,
        },
        systemMessage: `🛠️ Gemini-Kit ready${initMessage}`,
    }));

    process.exit(0);
}

main().catch(() => process.exit(0));
