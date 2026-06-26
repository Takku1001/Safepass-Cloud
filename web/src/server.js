/**
 * SafePass Cloud - Express Server
 * Main backend server with REST API
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// Services
const database = require('./services/database');
const encryption = require('./services/encryption');
const vaultService = require('./services/vault');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Disable caching for dynamic content
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

app.use(express.static(path.join(__dirname, '..', 'public'), {
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
}));

// Session management (in-memory for simplicity)
const sessions = new Map();

// Middleware: Authentication
const authenticate = (req, res, next) => {
    const sessionId = req.headers['x-session-id'];
    
    if (!sessionId || !sessions.has(sessionId)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = sessions.get(sessionId);
    if (new Date(session.expiresAt) < new Date()) {
        sessions.delete(sessionId);
        return res.status(401).json({ error: 'Session expired' });
    }

    req.user = session;
    next();
};

// ==================== AUTH ROUTES ====================

// Register new user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, masterPassword } = req.body;

        if (!username || !masterPassword) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        if (masterPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Generate salt and hash password
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(masterPassword, salt);

        // Create user in database
        const user = database.createUser(username, passwordHash, salt);

        // Create session
        const sessionId = uuidv4();
        const encryptionKey = encryption.deriveKey(masterPassword, salt);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        sessions.set(sessionId, {
            userId: user.id,
            username: user.username,
            encryptionKey,
            expiresAt: expiresAt.toISOString()
        });

        // Initialize vault
        vaultService.initializeVault(user.id);

        // Log activity
        database.logActivity(user.id, 'USER_REGISTERED', { username });

        res.json({
            success: true,
            sessionId,
            user: { id: user.id, username: user.username },
            expiresAt: expiresAt.toISOString()
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, masterPassword } = req.body;

        if (!username || !masterPassword) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // Get user from database
        const user = database.getUser(username);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isValid = await bcrypt.compare(masterPassword, user.password_hash);
        if (!isValid) {
            database.logActivity(user.id, 'LOGIN_FAILED', { reason: 'Invalid password' });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Create session
        const sessionId = uuidv4();
        const encryptionKey = encryption.deriveKey(masterPassword, user.salt);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        sessions.set(sessionId, {
            userId: user.id,
            username: user.username,
            encryptionKey,
            expiresAt: expiresAt.toISOString()
        });

        // Update last login
        database.updateLastLogin(user.id);

        // Load passwords into vault
        const passwords = database.getAllPasswords(user.id);
        vaultService.loadPasswords(user.id, passwords, encryptionKey);

        // Log activity
        database.logActivity(user.id, 'LOGIN_SUCCESS', {});

        res.json({
            success: true,
            sessionId,
            user: { id: user.id, username: user.username },
            expiresAt: expiresAt.toISOString()
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Logout
app.post('/api/auth/logout', authenticate, (req, res) => {
    const sessionId = req.headers['x-session-id'];
    
    database.logActivity(req.user.userId, 'LOGOUT', {});
    vaultService.clearVault(req.user.userId);
    sessions.delete(sessionId);
    
    res.json({ success: true });
});

// Verify session
app.get('/api/auth/verify', authenticate, (req, res) => {
    res.json({
        valid: true,
        user: { id: req.user.userId, username: req.user.username },
        expiresAt: req.user.expiresAt
    });
});

// ==================== PASSWORD ROUTES ====================

// Get all passwords
app.get('/api/passwords', authenticate, (req, res) => {
    try {
        const passwords = vaultService.getAllPasswords(req.user.userId);
        
        // Decrypt passwords for response
        const decrypted = passwords.map(p => ({
            ...p,
            password: encryption.simpleDecrypt(p.encryptedPassword, req.user.encryptionKey)
        }));

        res.json({ passwords: decrypted });

    } catch (error) {
        console.error('Get passwords error:', error);
        res.status(500).json({ error: 'Failed to fetch passwords' });
    }
});

// Search passwords (auto-complete)
app.get('/api/passwords/search', authenticate, (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.json({ suggestions: [] });
        }

        const suggestions = vaultService.search(req.user.userId, q);
        res.json({ suggestions });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Get single password
app.get('/api/passwords/:id', authenticate, (req, res) => {
    try {
        const password = database.getPassword(req.user.userId, parseInt(req.params.id));
        
        if (!password) {
            return res.status(404).json({ error: 'Password not found' });
        }

        // Decrypt password
        const decrypted = {
            ...password,
            password: encryption.simpleDecrypt(password.encrypted_password, req.user.encryptionKey)
        };

        // Record access
        database.logActivity(req.user.userId, 'PASSWORD_VIEWED', {
            websiteName: password.website_name
        });

        res.json({ password: decrypted });

    } catch (error) {
        console.error('Get password error:', error);
        res.status(500).json({ error: 'Failed to fetch password' });
    }
});

// Add new password
app.post('/api/passwords', authenticate, (req, res) => {
    try {
        const { websiteName, username, password, url, notes, category, expiryDays } = req.body;

        if (!websiteName || !username || !password) {
            return res.status(400).json({ error: 'Website, username, and password required' });
        }

        // Check password strength
        const strength = encryption.checkPasswordStrength(password);

        // Encrypt password
        const encrypted = encryption.simpleEncrypt(password, req.user.encryptionKey);
        const passwordHash = encryption.hashPassword(password);

        // Check for duplicates
        const isDuplicate = vaultService.isDuplicate(req.user.userId, passwordHash);

        // Calculate expiry date
        let expiryDate = null;
        if (expiryDays) {
            expiryDate = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
        }

        // Save to database
        const saved = database.addPassword(req.user.userId, {
            websiteName,
            username,
            encryptedPassword: encrypted,
            iv: '',
            url,
            notes,
            category: category || 'General',
            passwordStrength: strength.strength,
            expiryDate
        });

        // Add to vault
        vaultService.addPassword(req.user.userId, {
            id: saved.id,
            websiteName,
            username,
            encryptedPassword: encrypted,
            category: category || 'General',
            passwordStrength: strength.strength,
            expiryDate
        }, password); // Pass plain password for duplicate detection

        res.json({
            success: true,
            password: saved,
            strength,
            isDuplicate,
            warning: isDuplicate ? 'This password is used for another account' : null
        });

    } catch (error) {
        console.error('Add password error:', error);
        res.status(500).json({ error: 'Failed to add password' });
    }
});

// Update password
app.put('/api/passwords/:id', authenticate, (req, res) => {
    try {
        const { websiteName, username, password, url, notes, category, expiryDays } = req.body;
        const id = parseInt(req.params.id);

        // Get existing password
        const existing = database.getPassword(req.user.userId, id);
        if (!existing) {
            return res.status(404).json({ error: 'Password not found' });
        }

        // Prepare update data
        const updateData = {
            websiteName,
            username,
            url,
            notes,
            category
        };

        // If password changed, encrypt new one
        if (password) {
            updateData.encryptedPassword = encryption.simpleEncrypt(password, req.user.encryptionKey);
            updateData.iv = '';
            updateData.passwordStrength = encryption.checkPasswordStrength(password).strength;
        }

        // Update expiry
        if (expiryDays !== undefined) {
            updateData.expiryDate = expiryDays 
                ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
                : null;
        }

        // Update in database
        const updated = database.updatePassword(req.user.userId, id, updateData);

        // Update in vault - get the decrypted password
        let decryptedPassword;
        if (password) {
            decryptedPassword = password;
        } else {
            decryptedPassword = encryption.simpleDecrypt(existing.encrypted_password, req.user.encryptionKey);
        }
        vaultService.updatePassword(req.user.userId, existing.website_name, updateData, decryptedPassword);

        res.json({ success: true, password: updated });

    } catch (error) {
        console.error('Update password error:', error);
        res.status(500).json({ error: 'Failed to update password' });
    }
});

// Delete password
app.delete('/api/passwords/:id', authenticate, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const password = database.getPassword(req.user.userId, id);

        if (!password) {
            return res.status(404).json({ error: 'Password not found' });
        }

        // Delete from database
        database.deletePassword(req.user.userId, id);

        // Delete from vault
        vaultService.deletePassword(req.user.userId, password.website_name);

        res.json({ success: true });

    } catch (error) {
        console.error('Delete password error:', error);
        res.status(500).json({ error: 'Failed to delete password' });
    }
});

// Toggle favorite
app.post('/api/passwords/:id/favorite', authenticate, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const updated = database.toggleFavorite(req.user.userId, id);

        if (!updated) {
            return res.status(404).json({ error: 'Password not found' });
        }

        res.json({ success: true, password: updated });

    } catch (error) {
        console.error('Toggle favorite error:', error);
        res.status(500).json({ error: 'Failed to toggle favorite' });
    }
});

// ==================== GENERATOR ROUTES ====================

// Generate password (no auth required - just generates random password)
app.post('/api/generate', (req, res) => {
    try {
        const { 
            length = 16, 
            includeUppercase = true, 
            includeLowercase = true,
            includeNumbers = true,
            includeSymbols = true,
            excludeAmbiguous = false
        } = req.body;

        const password = encryption.generateSecurePassword(length, {
            includeUppercase,
            includeLowercase,
            includeNumbers,
            includeSymbols,
            excludeAmbiguous
        });

        const strength = encryption.checkPasswordStrength(password);

        res.json({ password, strength });

    } catch (error) {
        console.error('Generate password error:', error);
        res.status(500).json({ error: 'Failed to generate password' });
    }
});

// Check password strength
app.post('/api/check-strength', (req, res) => {
    try {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({ error: 'Password required' });
        }

        const strength = encryption.checkPasswordStrength(password);
        res.json(strength);

    } catch (error) {
        console.error('Check strength error:', error);
        res.status(500).json({ error: 'Failed to check strength' });
    }
});

// ==================== DASHBOARD ROUTES ====================

// Get dashboard stats
app.get('/api/dashboard/stats', authenticate, (req, res) => {
    try {
        const dbStats = database.getStats(req.user.userId);
        const vaultStats = vaultService.getStats(req.user.userId);

        res.json({
            ...dbStats,
            ...vaultStats
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Get expiring passwords
app.get('/api/dashboard/expiring', authenticate, (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const expiring = vaultService.getExpiringPasswords(req.user.userId, days);
        
        res.json({ expiring });

    } catch (error) {
        console.error('Get expiring error:', error);
        res.status(500).json({ error: 'Failed to fetch expiring passwords' });
    }
});

// Get duplicates
app.get('/api/dashboard/duplicates', authenticate, (req, res) => {
    try {
        const duplicates = vaultService.getDuplicates(req.user.userId);
        res.json({ duplicates });

    } catch (error) {
        console.error('Get duplicates error:', error);
        res.status(500).json({ error: 'Failed to fetch duplicates' });
    }
});

// Get weak passwords
app.get('/api/dashboard/weak', authenticate, (req, res) => {
    try {
        const passwords = vaultService.getAllPasswords(req.user.userId);
        const weak = passwords.filter(p => 
            p.passwordStrength === 'weak' || p.passwordStrength === 'very-weak'
        );

        res.json({ weak });

    } catch (error) {
        console.error('Get weak passwords error:', error);
        res.status(500).json({ error: 'Failed to fetch weak passwords' });
    }
});

// ==================== ACTIVITY ROUTES ====================

// Get activity log
app.get('/api/activity', authenticate, (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const activities = database.getActivityLog(req.user.userId, limit);
        
        res.json({ activities });

    } catch (error) {
        console.error('Get activity error:', error);
        res.status(500).json({ error: 'Failed to fetch activity' });
    }
});

// ==================== CLIPBOARD ROUTES ====================

// Record copy
app.post('/api/clipboard/copy', authenticate, (req, res) => {
    try {
        const { websiteName, username, field } = req.body;
        
        vaultService.recordCopy(req.user.userId, websiteName, username, field);
        database.logActivity(req.user.userId, 'PASSWORD_COPIED', { websiteName, field });

        res.json({ success: true });

    } catch (error) {
        console.error('Record copy error:', error);
        res.status(500).json({ error: 'Failed to record copy' });
    }
});

// Get clipboard history
app.get('/api/clipboard/history', authenticate, (req, res) => {
    try {
        const history = vaultService.getClipboardHistory(req.user.userId);
        res.json({ history });

    } catch (error) {
        console.error('Get clipboard history error:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// Clear clipboard history
app.delete('/api/clipboard/history', authenticate, (req, res) => {
    try {
        vaultService.clearClipboardHistory(req.user.userId);
        res.json({ success: true });

    } catch (error) {
        console.error('Clear clipboard error:', error);
        res.status(500).json({ error: 'Failed to clear history' });
    }
});

// ==================== CATEGORIES ROUTES ====================

// Get categories
app.get('/api/categories', authenticate, (req, res) => {
    try {
        const categories = database.getCategories(req.user.userId);
        res.json({ categories });

    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// ==================== SYNC ROUTES (Placeholder for Cloud) ====================

// Export vault (encrypted)
app.get('/api/sync/export', authenticate, (req, res) => {
    try {
        const passwords = database.getAllPasswords(req.user.userId);
        
        // Export encrypted data
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            passwordCount: passwords.length,
            data: passwords
        };

        database.logActivity(req.user.userId, 'VAULT_EXPORTED', {});

        res.json({ export: exportData });

    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export vault' });
    }
});

// Import vault
app.post('/api/sync/import', authenticate, (req, res) => {
    try {
        const { data } = req.body;

        if (!data || !Array.isArray(data)) {
            return res.status(400).json({ error: 'Invalid import data' });
        }

        let imported = 0;
        let skipped = 0;

        for (const item of data) {
            try {
                database.addPassword(req.user.userId, {
                    websiteName: item.website_name,
                    username: item.username,
                    encryptedPassword: item.encrypted_password,
                    iv: item.iv || '',
                    url: item.url,
                    notes: item.notes,
                    category: item.category || 'Imported',
                    passwordStrength: item.password_strength
                });
                imported++;
            } catch (e) {
                skipped++;
            }
        }

        // Reload vault
        const passwords = database.getAllPasswords(req.user.userId);
        vaultService.loadPasswords(req.user.userId, passwords, req.user.encryptionKey);

        database.logActivity(req.user.userId, 'VAULT_IMPORTED', { imported, skipped });

        res.json({ success: true, imported, skipped });

    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: 'Failed to import vault' });
    }
});

// ==================== ERROR HANDLING ====================

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ==================== START SERVER ====================

async function startServer() {
    // Initialize database (async for sql.js)
    await database.initialize(path.join(__dirname, '..', 'data', 'safepass.db'));
    
    app.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🔐 SafePass Cloud Server                                ║
║   ─────────────────────────────────────────               ║
║                                                           ║
║   Server running at: http://localhost:${PORT}              ║
║   Database: SQLite (data/safepass.db)                     ║
║                                                           ║
║   API Endpoints:                                          ║
║   • POST /api/auth/register - Register new user           ║
║   • POST /api/auth/login    - Login                       ║
║   • GET  /api/passwords     - Get all passwords           ║
║   • POST /api/passwords     - Add password                ║
║   • POST /api/generate      - Generate password           ║
║   • GET  /api/dashboard/*   - Dashboard statistics        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
        `);
    });
}

startServer().catch(console.error);

module.exports = app;
