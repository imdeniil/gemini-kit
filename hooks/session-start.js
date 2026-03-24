#!/usr/bin/env node
/**
 * SessionStart Hook
 * Initialize gemini-kit on new session
 */

import * as fs from 'fs';
import * as path from 'path';

async function main(input) {
    // Parse input safely - data is validated but not used
    try {
        JSON.parse(input);
    } catch {
        // If parse fails, return success (fail-open)
        console.log(JSON.stringify({}));
        process.exit(0);
    }

    const projectDir = process.env.GEMINI_PROJECT_DIR || process.cwd();
    const kitDir = path.join(projectDir, '.gemini-kit');

    // Ensure kit directories exist
    const dirs = ['artifacts', 'handoffs', 'memory', 'logs'];
    for (const dir of dirs) {
        fs.mkdirSync(path.join(kitDir, dir), { recursive: true });
    }

    // Load/update session stats
    const statsFile = path.join(kitDir, 'stats.json');
    let stats = { sessions: 0, lastSession: null };

    if (fs.existsSync(statsFile)) {
        try {
            stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
        } catch { }
    }

    stats.sessions++;
    stats.lastSession = new Date().toISOString();
    fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));

    // Handle GEMINI.md initialization
    const geminiMdPath = path.join(projectDir, 'GEMINI.md');
    const templatePath = path.join(projectDir, 'GEMINI.tmp.en.md');
    let initMessage = '';

    if (!fs.existsSync(geminiMdPath) && fs.existsSync(templatePath)) {
        try {
            fs.copyFileSync(templatePath, geminiMdPath);
            initMessage += ' | 📄 GEMINI.md initialized';
        } catch (error) {
            initMessage += ' | ⚠️ Failed to initialize GEMINI.md';
        }
    }

    // Handle .geminiignore initialization
    const ignorePath = path.join(projectDir, '.geminiignore');
    if (!fs.existsSync(ignorePath)) {
        const ignoreContent = `# Ignoring files

This document provides an overview of the Gemini Ignore (\`.geminiignore\`)
feature of the Gemini CLI.

The Gemini CLI includes the ability to automatically ignore files, similar to
\`.gitignore\` (used by Git) and \`.aiexclude\` (used by Gemini Code Assist). Adding
paths to your \`.geminiignore\` file will exclude them from tools that support
this feature, although they will still be visible to other services (such as
Git).

## How it works

When you add a path to your \`.geminiignore\` file, tools that respect this file
will exclude matching files and directories from their operations. For example,
when you use the \`@\` command to share files, any paths in your \`.geminiignore\`
file will be automatically excluded.

## How to use \`.geminiignore\`

1. Create a file named \`.geminiignore\` in the root of your project directory.

### .geminiignore examples

\`\`\`
# Exclude your /packages/ directory and all subdirectories
/packages/

# Exclude all .md files except README.md
*.md
!README.md
\`\`\`

# Default project ignores
.claude/*
.tldr/*
CLAUDE.md
thoughts/*
`;
        try {
            fs.writeFileSync(ignorePath, ignoreContent);
            initMessage += ' | 🛡️ .geminiignore created';
        } catch (error) {
            initMessage += ' | ⚠️ Failed to create .geminiignore';
        }
    }

    // Return success message
    console.log(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'SessionStart',
            additionalContext: `🚀 Gemini-Kit initialized (Session #${stats.sessions})${initMessage}`,
        },
        systemMessage: `🛠️ Gemini-Kit ready | Session #${stats.sessions}${initMessage}`,
    }));
}

// Read stdin
const input = await new Promise(resolve => {
    let data = '';
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
});

main(input).catch(() => {
    console.log(JSON.stringify({}));
    process.exit(0);
});
