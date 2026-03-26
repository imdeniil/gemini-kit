import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectDir = process.cwd();
const extensionRoot = path.join(__dirname, '..');
const hookPath = path.join(extensionRoot, 'hooks', 'telegram-notify.js');

console.log('🚀 Starting hook mechanism verification...');
console.log('📍 Project Dir:', projectDir);
console.log('📍 Hook Path:', hookPath);

const notifyCompletion = (type) => {
    const payload = JSON.stringify({
        event: "TLDR Verification",
        summary: `✅ Verification of ${type} mechanism successful!`
    });
    
    console.log('📤 Sending notification to Telegram...');
    
    if (fs.existsSync(hookPath)) {
        exec(`node ${hookPath} '${payload}'`, { cwd: projectDir }, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ Error sending notification:', error);
                return;
            }
            console.log('✨ Notification script executed.');
        });
    } else {
        console.error('❌ Hook file NOT FOUND at:', hookPath);
    }
};

// Simulate tldr warm with a 2-second delay
console.log('⏳ Running simulated command (sleep 2)...');
exec('sleep 2 && echo "Done"', { cwd: projectDir }, (error, stdout) => {
    if (error) {
        console.error('❌ Simulated command failed:', error);
        return;
    }
    console.log('✅ Simulated command finished. Triggering callback...');
    notifyCompletion('simulation');
});
