#!/usr/bin/env node
/**
 * SessionStart Hook - Fixed Detachment Version
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    let input = process.argv[2] || '{}';
    try { JSON.parse(input); } catch { input = '{}'; }

    const projectDir = process.env.GEMINI_PROJECT_DIR || process.cwd();
    const kitDir = path.join(projectDir, '.gemini-kit');

    // Ensure kit directories
    ['artifacts', 'handoffs', 'memory', 'logs'].forEach(dir => {
        const d = path.join(kitDir, dir);
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });

    const statsFile = path.join(kitDir, 'stats.json');
    let stats = { sessions: 0, lastSession: null };
    if (fs.existsSync(statsFile)) {
        try { stats = JSON.parse(fs.readFileSync(statsFile, 'utf8')); } catch { }
    }
    stats.sessions++;
    stats.lastSession = new Date().toISOString();
    fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));

    // Initialization Logic
    let initMessage = '';
    const extensionRootDir = path.join(__dirname, '..');
    
    // GEMINI.md
    const geminiMdPath = path.join(projectDir, 'GEMINI.md');
    const templatePath = path.join(extensionRootDir, 'GEMINI.tmp.en.md');
    if (!fs.existsSync(geminiMdPath) && fs.existsSync(templatePath)) {
        try {
            fs.copyFileSync(templatePath, geminiMdPath);
            initMessage += ' | 📄 GEMINI.md created';
        } catch (e) { }
    }

    // .geminiignore
    const ignorePath = path.join(projectDir, '.geminiignore');
    if (!fs.existsSync(ignorePath)) {
        try {
            fs.writeFileSync(ignorePath, "# Ignoring files\n.claude/*\n.tldr/*\nCLAUDE.md\nthoughts/*\n");
            initMessage += ' | 🛡️ .geminiignore created';
        } catch (e) { }
    }

    // Background TLDR Indexing
    const tldrDir = path.join(projectDir, '.tldr');
    const isFirstTime = !fs.existsSync(tldrDir);
    const logPath = path.join(kitDir, 'logs', 'indexing.log');
    const telegramHook = path.join(__dirname, 'telegram-notify.js');
    const wrapperPath = path.join(extensionRootDir, 'scripts', 'tldr-wrapper.sh');

    const triggerIndexing = (type) => {
        const payload = JSON.stringify({
            event: "TLDR Indexing",
            summary: `✅ TLDR ${type} indexing completed for ${path.basename(projectDir)}.`
        });
        
        // IMPORTANT: We use a subshell with nohup and & to ensure it survives parent exit.
        // We also use absolute paths for everything.
        const cmd = `nohup sh -c "(${wrapperPath} warm . && node ${telegramHook} '${payload}') >> ${logPath} 2>&1" > /dev/null 2>&1 &`;
        
        exec(cmd, { cwd: projectDir, env: { ...process.env, TLDR_AUTO_DOWNLOAD: '1' } });
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ⚡ ${type} indexing triggered\n`);
    };

    if (isFirstTime) {
        triggerIndexing('initial');
        initMessage += ' | ⚡ Indexing started';
    } else {
        // Only re-index if more than 20 files changed
        const gitCheck = spawn('sh', ['-c', 'git diff --name-only HEAD | wc -l'], { cwd: projectDir });
        gitCheck.stdout.on('data', (data) => {
            const count = parseInt(data.toString().trim(), 10);
            if (count > 20) triggerIndexing('re-index');
        });
    }

    // Immediate Return to CLI
    console.log(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'SessionStart',
            additionalContext: `🚀 Kit v4 (Session #${stats.sessions})${initMessage}`,
        },
        systemMessage: `🛠️ Gemini-Kit ready${initMessage}`,
    }));

    // Wait a tiny bit to ensure the detached process is handed off to OS
    setTimeout(() => process.exit(0), 100);
}

main().catch(() => process.exit(0));
