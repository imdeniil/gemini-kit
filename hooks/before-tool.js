#!/usr/bin/env node
/**
 * BeforeTool Hook - High Reliability Version
 * Security validation - block secrets and dangerous commands
 */

import * as fs from 'fs';
import * as path from 'path';

// Secret patterns to detect
const SECRET_PATTERNS = [
    /api[_-]?key\s*[:=]\s*['"]?[a-zA-Z0-9_-]{20,}['"]?/i,
    /password\s*[:=]\s*['"]?[^\s'"]{8,}['"]?/i,
    /secret\s*[:=]\s*['"]?[a-zA-Z0-9_-]{20,}['"]?/i,
    /token\s*[:=]\s*['"]?[a-zA-Z0-9_-]{20,}['"]?/i,
    /AKIA[0-9A-Z]{16}/,
    /ghp_[a-zA-Z0-9]{36}/,
    /sk-[a-zA-Z0-9]{48}/,
    /sk-proj-[a-zA-Z0-9]{48}/,
    /sk-ant-[a-zA-Z0-9\-_]{95}/,
    /AIza[a-zA-Z0-9_-]{35}/,
    /Bearer\s+[a-zA-Z0-9_-]{20,}/i,
    /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/,
    /mongodb\+srv:\/\/[^:]+:[^@]+@/,
    /postgres:\/\/[^:]+:[^@]+@/,
    /mysql:\/\/[^:]+:[^@]+@/
];

const DANGEROUS_COMMANDS = [
    'rm -rf /', 'rm -rf ~', 'rm -rf *', 'dd if=', ':(){:|:&};:', 'mkfs.',
    'sudo rm', '> /dev/sda', 'chmod 777 /', 'wget | sh', 'curl | sh'
];

const DANGEROUS_PATHS = [
    /\.\.\//, /\/etc\/passwd/, /\/etc\/shadow/, /~\/\.ssh/, /\.ssh\/id_/,
    /\.env$/, /\.pem$/, /\.key$/
];

function deny(reason, systemMessage) {
    console.log(JSON.stringify({
        decision: 'deny',
        reason,
        systemMessage: systemMessage || '⛔ Security check failed',
    }));
    process.exit(2);
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
        console.log(JSON.stringify({ decision: 'allow' }));
        process.exit(0);
    }

    let data;
    try {
        data = JSON.parse(input);
    } catch (e) {
        deny(`Malformed input: ${e.message}`, '⛔ Security: Parse error');
    }

    const { tool_name, tool_input } = data;
    const content = tool_input?.content || tool_input?.new_string || '';

    // Check Secrets
    for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(content)) {
            deny('🚨 Potential secret detected.', '🔐 Secret scanner blocked operation');
        }
    }

    // Check Paths
    if (['WriteFile', 'Edit', 'write_file', 'edit'].includes(tool_name)) {
        const filePath = tool_input?.file_path || tool_input?.path || '';
        for (const pattern of DANGEROUS_PATHS) {
            if (pattern.test(filePath)) {
                deny(`🚫 Dangerous path: ${filePath}`, '⛔ Path security check failed');
            }
        }
    }

    // Check Commands
    if (tool_name === 'RunShellCommand' || tool_name === 'run_shell_command') {
        const cmd = tool_input?.command || '';
        for (const dangerous of DANGEROUS_COMMANDS) {
            if (cmd.includes(dangerous)) {
                deny(`🚫 Dangerous command: ${dangerous}`, '⛔ Dangerous command blocked');
            }
        }
    }

    console.log(JSON.stringify({ decision: 'allow' }));
    process.exit(0);
}

main();
