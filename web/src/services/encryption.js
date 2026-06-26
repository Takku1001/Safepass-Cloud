/**
 * Encryption Service - Secure password encryption/decryption
 * Uses AES-256 encryption with CryptoJS
 */

const CryptoJS = require('crypto-js');

class EncryptionService {
    constructor() {
        this.algorithm = 'AES';
    }

    // Derive encryption key from master password
    deriveKey(masterPassword, salt) {
        return CryptoJS.PBKDF2(masterPassword, salt, {
            keySize: 256 / 32,
            iterations: 100000
        }).toString();
    }

    // Generate random salt
    generateSalt() {
        return CryptoJS.lib.WordArray.random(128 / 8).toString();
    }

    // Generate random IV
    generateIV() {
        return CryptoJS.lib.WordArray.random(128 / 8).toString();
    }

    // Encrypt data
    encrypt(plaintext, key) {
        const iv = this.generateIV();
        const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
            iv: CryptoJS.enc.Hex.parse(iv),
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });

        return {
            ciphertext: encrypted.ciphertext.toString(),
            iv: iv
        };
    }

    // Decrypt data
    decrypt(ciphertext, key, iv) {
        try {
            const decrypted = CryptoJS.AES.decrypt(
                { ciphertext: CryptoJS.enc.Hex.parse(ciphertext) },
                key,
                {
                    iv: CryptoJS.enc.Hex.parse(iv),
                    mode: CryptoJS.mode.CBC,
                    padding: CryptoJS.pad.Pkcs7
                }
            );
            return decrypted.toString(CryptoJS.enc.Utf8);
        } catch (error) {
            console.error('Decryption failed:', error);
            return null;
        }
    }

    // Simple encrypt (for backward compatibility)
    simpleEncrypt(plaintext, key) {
        const encrypted = CryptoJS.AES.encrypt(plaintext, key);
        return encrypted.toString();
    }

    // Simple decrypt
    simpleDecrypt(ciphertext, key) {
        try {
            const bytes = CryptoJS.AES.decrypt(ciphertext, key);
            return bytes.toString(CryptoJS.enc.Utf8);
        } catch (error) {
            return null;
        }
    }

    // Hash password (for comparison, not storage)
    hashPassword(password) {
        return CryptoJS.SHA256(password).toString();
    }

    // Generate secure random password
    generateSecurePassword(length = 16, options = {}) {
        const {
            includeUppercase = true,
            includeLowercase = true,
            includeNumbers = true,
            includeSymbols = true,
            excludeAmbiguous = false
        } = options;

        let charset = '';
        let uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let lowercase = 'abcdefghijklmnopqrstuvwxyz';
        let numbers = '0123456789';
        let symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

        if (excludeAmbiguous) {
            uppercase = uppercase.replace(/[OI]/g, '');
            lowercase = lowercase.replace(/[l]/g, '');
            numbers = numbers.replace(/[01]/g, '');
        }

        if (includeUppercase) charset += uppercase;
        if (includeLowercase) charset += lowercase;
        if (includeNumbers) charset += numbers;
        if (includeSymbols) charset += symbols;

        if (charset.length === 0) {
            charset = lowercase + numbers;
        }

        // Generate random password using Node.js crypto
        const crypto = require('crypto');
        let password = '';
        
        for (let i = 0; i < length; i++) {
            const randomIndex = crypto.randomInt(0, charset.length);
            password += charset[randomIndex];
        }

        // Ensure at least one character from each selected category
        let result = password.split('');
        let position = 0;

        if (includeUppercase && !/[A-Z]/.test(password)) {
            const idx = crypto.randomInt(0, uppercase.length);
            result[position++ % length] = uppercase[idx];
        }
        if (includeLowercase && !/[a-z]/.test(password)) {
            const idx = crypto.randomInt(0, lowercase.length);
            result[position++ % length] = lowercase[idx];
        }
        if (includeNumbers && !/[0-9]/.test(password)) {
            const idx = crypto.randomInt(0, numbers.length);
            result[position++ % length] = numbers[idx];
        }
        if (includeSymbols && !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
            const idx = crypto.randomInt(0, symbols.length);
            result[position++ % length] = symbols[idx];
        }

        // Shuffle the result
        for (let i = result.length - 1; i > 0; i--) {
            const j = crypto.randomInt(0, i + 1);
            [result[i], result[j]] = [result[j], result[i]];
        }

        return result.join('');
    }

    // Check password strength
    checkPasswordStrength(password) {
        let score = 0;
        const feedback = [];

        // Length checks
        if (password.length >= 8) score += 1;
        if (password.length >= 12) score += 1;
        if (password.length >= 16) score += 1;
        if (password.length < 8) feedback.push('Password should be at least 8 characters');

        // Character type checks
        if (/[a-z]/.test(password)) score += 1;
        else feedback.push('Add lowercase letters');

        if (/[A-Z]/.test(password)) score += 1;
        else feedback.push('Add uppercase letters');

        if (/[0-9]/.test(password)) score += 1;
        else feedback.push('Add numbers');

        if (/[^a-zA-Z0-9]/.test(password)) score += 1;
        else feedback.push('Add special characters');

        // Pattern checks
        if (/(.)\1{2,}/.test(password)) {
            score -= 1;
            feedback.push('Avoid repeated characters');
        }

        if (/^[a-zA-Z]+$/.test(password)) {
            score -= 1;
            feedback.push('Mix different character types');
        }

        // Common patterns
        const commonPatterns = ['password', '123456', 'qwerty', 'abc123', 'admin'];
        if (commonPatterns.some(p => password.toLowerCase().includes(p))) {
            score -= 2;
            feedback.push('Avoid common password patterns');
        }

        // Determine strength level
        let strength = 'very-weak';
        if (score >= 7) strength = 'very-strong';
        else if (score >= 5) strength = 'strong';
        else if (score >= 3) strength = 'medium';
        else if (score >= 1) strength = 'weak';

        return {
            score: Math.max(0, Math.min(10, score)),
            strength,
            feedback,
            isSecure: score >= 5
        };
    }
}

module.exports = new EncryptionService();
