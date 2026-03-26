#!/usr/bin/env node
/**
 * BeforeAgent Hook - High Reliability Version
 * Inject relevant learnings based on prompt context
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findRelevantLearnings(prompt, learningsContent, limit = 3) {
    const promptTerms = prompt.toLowerCase().match(/\b[a-z][a-z0-9_]{2,}\b/g) || [];
    const sections = learningsContent.split(/## \[/).slice(1).map(s => '## [' + s);
    if (sections.length === 0) return [];

    const scored = sections.map(section => {
        let score = 0;
        const sectionLower = section.toLowerCase();
        for (const term of promptTerms) {
            const escapedTerm = escapeRegex(term);
            const matches = (sectionLower.match(new RegExp(escapedTerm, 'g')) || []).length;
            score += matches;
            if (sectionLower.includes(`lesson:** ${term}`) || sectionLower.includes(`lesson:**${term}`)) {
                score += 3;
            }
        }
        return { section, score };
    });

    return scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(s => s.section);
}

async function main() {
    // 1. Non-blocking input read
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
    try {
        data = JSON.parse(input);
    } catch (e) {
        console.log(JSON.stringify({}));
        process.exit(0);
    }

    const { prompt } = data;
    const projectDir = process.env.GEMINI_PROJECT_DIR || process.cwd();
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';

    if (!prompt?.trim()) {
        console.log(JSON.stringify({}));
        process.exit(0);
    }

    const context = [];

    // Inject Learnings
    const learningsFile = path.join(homeDir, '.gemini-kit', 'learnings', 'LEARNINGS.md');
    if (fs.existsSync(learningsFile)) {
        try {
            const learningsContent = fs.readFileSync(learningsFile, 'utf8');
            const relevantLearnings = findRelevantLearnings(prompt, learningsContent, 3);
            if (relevantLearnings.length > 0) {
                context.push(`## 🧠 Relevant Learnings (Apply these!)\n\n${relevantLearnings.join('\n')}`);
            }
        } catch { }
    }

    // Auto-inject Workflows
    const workflowDir = path.join(__dirname, '..', '.agent', 'workflows');
    if (fs.existsSync(workflowDir)) {
        try {
            const devRulesFile = path.join(workflowDir, 'development-rules.md');
            if (fs.existsSync(devRulesFile)) {
                const devRules = fs.readFileSync(devRulesFile, 'utf8');
                context.push(`## 📋 Development Rules\n\n${devRules.slice(0, 500)}...`);
            }
        } catch { }
    }

    // Git activity
    const keywords = ['commit', 'change', 'recent', 'history', 'git'];
    if (keywords.some(kw => prompt.toLowerCase().includes(kw))) {
        try {
            const log = execSync('git log --oneline -5', {
                cwd: projectDir,
                encoding: 'utf8',
                timeout: 2000
            });
            context.push(`Recent commits:\n${log}`);
        } catch { }
    }

    if (context.length > 0) {
        console.log(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'BeforeAgent',
                additionalContext: `## Project Context\n\n${context.join('\n\n')}`,
            },
        }));
    } else {
        console.log(JSON.stringify({}));
    }
    
    process.exit(0);
}

main();
