#!/usr/bin/env node
/**
 * SessionStart Hook - Ultra Reliability Version
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    let input = process.argv[2] || '{}';
    try { JSON.parse(input); } catch { input = '{}'; }

    const projectDir = process.env.GEMINI_PROJECT_DIR || process.cwd();
    const kitDir = path.join(projectDir, '.gemini-kit');

    // 1. Sync Ops
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

    // 2. Initialization Logic
    let initMessage = '';
    const extensionRootDir = path.join(__dirname, '..');
    
    const geminiMdPath = path.join(projectDir, 'GEMINI.md');
    const templatePath = path.join(extensionRootDir, 'GEMINI.tmp.en.md');
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

    // 3. Ultra-Detached Background Task
    const tldrDir = path.join(projectDir, '.tldr');
    const isFirstTime = !fs.existsSync(tldrDir);
    const bgScript = path.join(extensionRootDir, 'scripts', 'background-index.sh');

    const triggerBgTask = (type) => {
        const payload = JSON.stringify({
            event: "TLDR Indexing",
            summary: `✅ TLDR ${type} indexing completed for ${path.basename(projectDir)}.`
        });
        
        // Use spawn with detached: true to completely separate from parent
        const child = spawn(bgScript, [projectDir, payload], {
            detached: true,
            stdio: 'ignore', // Crucial: disconnect streams
            cwd: projectDir
        });
        
        child.unref(); // Parent won't wait for child
    };

    if (isFirstTime) {
        triggerBgTask('initial');
        initMessage += ' | ⚡ Indexing started';
    } else {
        // Quick check for re-index
        const gitCheck = spawn('git', ['diff', '--name-only', 'HEAD'], { cwd: projectDir });
        let output = '';
        gitCheck.stdout.on('data', (d) => output += d);
        gitCheck.on('close', (code) => {
            if (code === 0 && output.split('\n').length > 20) {
                triggerBgTask('re-index');
            }
        });
    }

    // 4. Return to CLI
    console.log(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'SessionStart',
            additionalContext: `🚀 Kit v4 (Session #${stats.sessions})${initMessage}`,
        },
        systemMessage: `🛠️ Gemini-Kit ready${initMessage}`,
    }));

    // Small exit delay to ensure spawn process is handed over
    setTimeout(() => process.exit(0), 100);
}

main().catch(() => process.exit(0));
