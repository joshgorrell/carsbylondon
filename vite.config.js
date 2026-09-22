import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
function copyApplePayVerificationFile() {
    return {
        name: 'copy-apple-pay-verification-file',
        writeBundle: function () {
            var source = resolve('public/.well-known/apple-developer-merchantid-domain-association');
            var destinationDirectory = resolve('dist/.well-known');
            mkdirSync(destinationDirectory, { recursive: true });
            copyFileSync(source, resolve(destinationDirectory, 'apple-developer-merchantid-domain-association'));
        },
    };
}
export default defineConfig({
    plugins: [react(), copyApplePayVerificationFile()],
    server: { host: true, port: 5173 },
});
