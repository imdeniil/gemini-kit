#!/usr/bin/env node
/**
 * Telegram Notifications Hook - Terminal Friendly Version
 */

import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function sendTelegram(botToken, chatId, message) {
    const payload = JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
    });

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${botToken}/sendMessage`,
            method: 'POST',
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let resData = '';
            res.on('data', chunk => resData += chunk);
            res.on('end', () => {
                resolve({
                    success: res.statusCode === 200,
                    status: res.statusCode,
                    data: resData
                });
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timed out'));
        });

        req.on('error', (e) => reject(e));
        req.write(payload);
        req.end();
    });
}

async function main() {
    let input = process.argv[2];
    
    // Non-blocking stdin read
    if (!input) {
        input = await new Promise(resolve => {
            let data = '';
            process.stdin.on('data', chunk => data += chunk);
            process.stdin.on('end', () => resolve(data));
            setTimeout(() => resolve(data), 500); // Very short timeout for hooks
        });
    }

    if (!input || input.trim() === '') {
        console.log(JSON.stringify({ status: "no_input" }));
        process.exit(0);
    }

    let data;
    try {
        data = JSON.parse(input);
    } catch (e) {
        console.log(JSON.stringify({ status: "error", message: "invalid_json" }));
        process.exit(0);
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const extensionRoot = path.join(__dirname, '..');
    const settingsPath = path.join(extensionRoot, 'settings.json');

    let finalToken = botToken;
    let finalChatId = chatId;

    if (!finalToken || !finalChatId) {
        try {
            if (fs.existsSync(settingsPath)) {
                const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                if (settings.config && settings.config.telegram) {
                    finalToken = finalToken || settings.config.telegram.botToken;
                    finalChatId = finalChatId || settings.config.telegram.chatId;
                }
            }
        } catch (e) { }
    }

    if (!finalToken || !finalChatId || finalToken === 'YOUR_BOT_TOKEN_HERE') {
        console.log(JSON.stringify({ status: "not_configured" }));
        process.exit(0);
    }

    const { event, summary, taskName, systemMessage } = data;
    let message = '🤖 *Gemini-Kit*\n\n';
    if (event) message += `*Event:* ${event}\n`;
    if (taskName) message += `*Task:* ${taskName}\n`;
    if (summary) message += `*Summary:* ${summary}\n`;
    if (systemMessage) message += `*Info:* ${systemMessage}\n`;
    message += `*Time:* ${new Date().toLocaleString()}`;

    try {
        const result = await sendTelegram(finalToken, finalChatId, message);
        
        // Log to file
        const logPath = path.join(extensionRoot, '.gemini-kit', 'logs', 'notify.log');
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] Telegram Notify: ${result.success ? 'SUCCESS' : 'FAILED'}\n`);
        
        // IMPORTANT: Return JSON to CLI
        console.log(JSON.stringify({ 
            success: result.success, 
            telegramStatus: result.status 
        }));
    } catch (error) {
        console.log(JSON.stringify({ success: false, error: error.message }));
    }

    process.exit(0);
}

main();
