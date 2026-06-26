/**
 * SafePass Cloud - Express Server with Firebase
 * Main backend server with REST API using Firestore
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// Services
const database = require('./services/firestoreDb');
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

        // Check if user exists
        const existingUser = await database.getUserByUsername(username);
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Generate salt and hash password
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(masterPassword, salt);

        // Create user in Firestore
        const user = await database.createUser(username, username.toLowerCase() + '@safepass.local', passwordHash);

        // Create session
        const sessionId = uuidv4();
        const encryptionKey = encryption.deriveKey(masterPassword, salt);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        sessions.set(sessionId, {
            userId: user.id,
            username: user.username,
            encryptionKey,
            salt,
            expiresAt: expiresAt.toISOString()
        });

        // Initialize vault
        vaultService.initializeVault(user.id);

        // Log activity
        await database.logActivity(user.id, 'USER_REGISTERED', { username });

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

        // Get user from Firestore
        const user = await database.getUserByUsername(username);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isValid = await bcrypt.compare(masterPassword, user.password);
        if (!isValid) {
            await database.logActivity(user.id, 'LOGIN_FAILED', { reason: 'Invalid password' });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Create session
        const sessionId = uuidv4();
        // Derive salt from password hash for encryption key
        const salt = user.password.substring(0, 29); // bcrypt salt is first 29 chars
        const encryptionKey = encryption.deriveKey(masterPassword, salt);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        sessions.set(sessionId, {
            userId: user.id,
            username: user.username,
            encryptionKey,
            salt,
            expiresAt: expiresAt.toISOString()
        });

        // Update last login
        await database.updateUserLogin(user.id);

        // Load passwords into vault
        const passwords = await database.getAllPasswords(user.id);
        
        // Transform Firestore data to match vault format
        const transformedPasswords = passwords.map(p => ({
            id: p.id,
            website_name: p.websiteName,
            username: p.username,
            encrypted_password: p.encryptedPassword,
            iv: p.iv,
            url: p.url,
            notes: p.notes,
            category: p.category,
            is_favorite: p.isFavorite ? 1 : 0,
            password_strength: p.passwordStrength,
            created_at: p.createdAt,
            last_modified: p.lastModified,
            expiry_date: p.expiryDate
        }));
        
        vaultService.loadPasswords(user.id, transformedPasswords, encryptionKey);

        // Log activity
        await database.logActivity(user.id, 'LOGIN_SUCCESS', {});

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
app.post('/api/auth/logout', authenticate, async (req, res) => {
    const sessionId = req.headers['x-session-id'];
    
    await database.logActivity(req.user.userId, 'LOGOUT', {});
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
app.get('/api/passwords', authenticate, async (req, res) => {
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
app.get('/api/passwords/:id', authenticate, async (req, res) => {
    try {
        const password = await database.getPassword(req.user.userId, req.params.id);
        
        if (!password) {
            return res.status(404).json({ error: 'Password not found' });
        }

        res.json({
            ...password,
            password: encryption.simpleDecrypt(password.encryptedPassword, req.user.encryptionKey)
        });

    } catch (error) {
        console.error('Get password error:', error);
        res.status(500).json({ error: 'Failed to fetch password' });
    }
});

// Add new password
app.post('/api/passwords', authenticate, async (req, res) => {
    try {
        const { websiteName, username, password, url, notes, category, expiryDays } = req.body;

        if (!websiteName || !username || !password) {
            return res.status(400).json({ error: 'Website, username and password required' });
        }

        // Encrypt password
        const encryptedPassword = encryption.simpleEncrypt(password, req.user.encryptionKey);
        const passwordStrength = encryption.checkPasswordStrength(password).strength;

        // Calculate expiry date
        const expiryDate = expiryDays 
            ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
            : null;

        // Add to Firestore
        const newPassword = await database.addPassword(req.user.userId, {
            websiteName,
            username,
            encryptedPassword,
            iv: '',
            url,
            notes,
            category,
            passwordStrength,
            expiryDate
        });

        // Add to vault
        vaultService.addPassword(req.user.userId, {
            id: newPassword.id,
            websiteName,
            username,
            encryptedPassword,
            iv: '',
            url,
            notes,
            category,
            isFavorite: false,
            passwordStrength,
            createdAt: newPassword.createdAt,
            lastModified: newPassword.lastModified,
            expiryDate
        }, password); // Pass plain password for duplicate detection

        // Log activity
        await database.logActivity(req.user.userId, 'PASSWORD_ADDED', { website: websiteName });

        res.json({
            success: true,
            password: {
                ...newPassword,
                password // Return decrypted for UI
            }
        });

    } catch (error) {
        console.error('Add password error:', error);
        res.status(500).json({ error: 'Failed to add password' });
    }
});

// Update password
app.put('/api/passwords/:id', authenticate, async (req, res) => {
    try {
        const { websiteName, username, password, url, notes, category, expiryDays } = req.body;
        const id = req.params.id;

        // Get existing password from database
        const existing = await database.getPassword(req.user.userId, id);
        if (!existing) {
            console.error('Password not found in database:', id);
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
        let decryptedPassword;
        if (password) {
            updateData.encryptedPassword = encryption.simpleEncrypt(password, req.user.encryptionKey);
            updateData.iv = '';
            updateData.passwordStrength = encryption.checkPasswordStrength(password).strength;
            decryptedPassword = password;
        } else {
            // Keep existing encrypted password
            decryptedPassword = encryption.simpleDecrypt(existing.encryptedPassword, req.user.encryptionKey);
        }

        // Update expiry
        if (expiryDays !== undefined) {
            updateData.expiryDate = expiryDays 
                ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
                : null;
        }

        // Update in Firestore
        const updated = await database.updatePassword(req.user.userId, id, updateData);
        if (!updated) {
            console.error('Failed to update password in database:', id);
            return res.status(500).json({ error: 'Failed to update password in database' });
        }

        // Update in vault (pass old website name for lookup)
        try {
            vaultService.updatePassword(
                req.user.userId, 
                existing.websiteName, 
                {
                    ...updateData,
                    id: existing.id,
                    isFavorite: updated.isFavorite,
                    createdAt: updated.createdAt,
                    lastModified: updated.lastModified
                },
                decryptedPassword // Pass plain password for duplicate detection
            );
        } catch (vaultError) {
            console.error('Vault update error:', vaultError);
            // Continue even if vault update fails - database is source of truth
        }

        // Log activity
        await database.logActivity(req.user.userId, 'PASSWORD_UPDATED', { website: websiteName });

        // Return updated password with decrypted password
        res.json({ 
            success: true, 
            password: {
                ...updated,
                password: decryptedPassword
            }
        });

    } catch (error) {
        console.error('Update password error:', error);
        res.status(500).json({ error: 'Failed to update password: ' + error.message });
    }
});

// Delete password
app.delete('/api/passwords/:id', authenticate, async (req, res) => {
    try {
        const id = req.params.id;
        const password = await database.getPassword(req.user.userId, id);

        if (!password) {
            return res.status(404).json({ error: 'Password not found' });
        }

        // Delete from Firestore
        await database.deletePassword(req.user.userId, id);

        // Delete from vault
        vaultService.deletePassword(req.user.userId, password.websiteName);

        // Log activity
        await database.logActivity(req.user.userId, 'PASSWORD_DELETED', { website: password.websiteName });

        res.json({ success: true });

    } catch (error) {
        console.error('Delete password error:', error);
        res.status(500).json({ error: 'Failed to delete password' });
    }
});

// Toggle favorite
app.post('/api/passwords/:id/favorite', authenticate, async (req, res) => {
    try {
        const updated = await database.toggleFavorite(req.user.userId, req.params.id);
        
        if (!updated) {
            return res.status(404).json({ error: 'Password not found' });
        }

        res.json({ success: true, isFavorite: updated.isFavorite });

    } catch (error) {
        console.error('Toggle favorite error:', error);
        res.status(500).json({ error: 'Failed to toggle favorite' });
    }
});

// ==================== GENERATOR ====================

app.post('/api/generate', (req, res) => {
    try {
        const { 
            length = 16, 
            includeUppercase = true, 
            includeLowercase = true,
            includeNumbers = true, 
            includeSymbols = true 
        } = req.body;

        const password = encryption.generateSecurePassword(
            length,
            includeUppercase,
            includeLowercase,
            includeNumbers,
            includeSymbols
        );

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
            return res.json({ strength: 'none', score: 0 });
        }

        const result = encryption.checkPasswordStrength(password);
        res.json(result);

    } catch (error) {
        res.status(500).json({ error: 'Failed to check strength' });
    }
});

// ==================== DASHBOARD ====================

app.get('/api/dashboard/stats', authenticate, async (req, res) => {
    try {
        // Get stats from vault (includes duplicate detection from in-memory data structures)
        const vaultStats = vaultService.getStats(req.user.userId);
        res.json(vaultStats);
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// Alias for categories (used by frontend)
app.get('/api/categories', authenticate, async (req, res) => {
    try {
        const categories = await database.getCategories(req.user.userId);
        res.json({ categories });
    } catch (error) {
        console.error('Categories error:', error);
        res.status(500).json({ error: 'Failed to get categories' });
    }
});

app.get('/api/dashboard/categories', authenticate, async (req, res) => {
    try {
        const categories = await database.getCategories(req.user.userId);
        res.json({ categories });
    } catch (error) {
        console.error('Categories error:', error);
        res.status(500).json({ error: 'Failed to get categories' });
    }
});

app.get('/api/dashboard/expiring', authenticate, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        
        // Use vault service to get expiring from MinHeap
        const expiringFromHeap = vaultService.getExpiringPasswords(req.user.userId, days);
        
        // If MinHeap is empty, fallback to database query
        let expiring = expiringFromHeap;
        if (!expiring || expiring.length === 0) {
            const passwords = await database.getExpiringPasswords(req.user.userId, days);
            expiring = passwords.map(p => ({
                websiteName: p.websiteName,
                passwordId: p.id,
                expiryDate: new Date(p.expiryDate).getTime(),
                daysUntilExpiry: Math.ceil((new Date(p.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
            }));
        }

        res.json({ expiring });
    } catch (error) {
        console.error('Expiring error:', error);
        res.status(500).json({ error: 'Failed to get expiring passwords' });
    }
});

app.get('/api/dashboard/weak', authenticate, async (req, res) => {
    try {
        // Get passwords from vault
        const passwords = vaultService.getAllPasswords(req.user.userId);
        
        // Filter for weak and very weak passwords
        const weak = passwords.filter(p => 
            p.passwordStrength === 'weak' || 
            p.passwordStrength === 'very-weak'
        );
        
        // Decrypt passwords
        const decrypted = weak.map(p => ({
            id: p.id,
            websiteName: p.websiteName,
            username: p.username,
            passwordStrength: p.passwordStrength,
            password: encryption.simpleDecrypt(p.encryptedPassword, req.user.encryptionKey)
        }));

        res.json({ weak: decrypted });
    } catch (error) {
        console.error('Get weak passwords error:', error);
        res.status(500).json({ error: 'Failed to get weak passwords' });
    }
});

// Get duplicate passwords
app.get('/api/dashboard/duplicates', authenticate, (req, res) => {
    try {
        const duplicates = vaultService.getDuplicates(req.user.userId);
        res.json({ duplicates });
    } catch (error) {
        console.error('Get duplicates error:', error);
        res.status(500).json({ error: 'Failed to fetch duplicates' });
    }
});

app.get('/api/dashboard/recent', authenticate, async (req, res) => {
    try {
        const activity = await database.getRecentActivity(req.user.userId, 20);
        res.json({ activity });
    } catch (error) {
        console.error('Recent activity error:', error);
        res.status(500).json({ error: 'Failed to get activity' });
    }
});

// ==================== CLIPBOARD ROUTES ====================

// Record clipboard copy
app.post('/api/clipboard/copy', authenticate, async (req, res) => {
    try {
        const { websiteName, username, field } = req.body;
        
        vaultService.recordCopy(req.user.userId, websiteName, username, field);
        await database.logActivity(req.user.userId, 'PASSWORD_COPIED', { websiteName, field });

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

// ==================== ACTIVITY LOG ====================

app.post('/api/activity', authenticate, async (req, res) => {
    try {
        const { action, details } = req.body;
        await database.logActivity(req.user.userId, action, details || {});
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to log activity' });
    }
});

app.get('/api/activity', authenticate, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        // Use vault's in-memory activity log (Queue data structure)
        const activity = vaultService.getActivityLog(req.user.userId, limit);
        res.json({ activity });
    } catch (error) {
        console.error('Get activity error:', error);
        res.status(500).json({ error: 'Failed to get activity' });
    }
});

// ==================== EXPORT/IMPORT ====================

app.get('/api/export', authenticate, async (req, res) => {
    try {
        const passwords = await database.getAllPasswords(req.user.userId);
        
        const exportData = passwords.map(p => ({
            websiteName: p.websiteName,
            username: p.username,
            password: encryption.simpleDecrypt(p.encryptedPassword, req.user.encryptionKey),
            url: p.url,
            notes: p.notes,
            category: p.category
        }));

        await database.logActivity(req.user.userId, 'PASSWORDS_EXPORTED', { count: exportData.length });

        res.json({ passwords: exportData, exportedAt: new Date().toISOString() });
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export passwords' });
    }
});

app.post('/api/import', authenticate, async (req, res) => {
    try {
        const { passwords } = req.body;

        if (!Array.isArray(passwords)) {
            return res.status(400).json({ error: 'Invalid import data' });
        }

        let imported = 0;
        let skipped = 0;

        for (const pwd of passwords) {
            try {
                const existing = await database.getPasswordByWebsite(req.user.userId, pwd.websiteName);
                
                if (existing) {
                    skipped++;
                    continue;
                }

                const encryptedPassword = encryption.simpleEncrypt(pwd.password, req.user.encryptionKey);
                const passwordStrength = encryption.checkPasswordStrength(pwd.password).strength;

                const newPassword = await database.addPassword(req.user.userId, {
                    websiteName: pwd.websiteName,
                    username: pwd.username,
                    encryptedPassword,
                    iv: '',
                    url: pwd.url || '',
                    notes: pwd.notes || '',
                    category: pwd.category || 'General',
                    passwordStrength,
                    expiryDate: null
                });

                // Add to vault
                vaultService.addPassword(req.user.userId, {
                    id: newPassword.id,
                    websiteName: pwd.websiteName,
                    username: pwd.username,
                    encryptedPassword,
                    iv: '',
                    url: pwd.url || '',
                    notes: pwd.notes || '',
                    category: pwd.category || 'General',
                    isFavorite: false,
                    passwordStrength,
                    createdAt: newPassword.createdAt,
                    lastModified: newPassword.lastModified,
                    expiryDate: null
                });

                imported++;
            } catch (err) {
                console.error('Import item error:', err);
                skipped++;
            }
        }

        await database.logActivity(req.user.userId, 'PASSWORDS_IMPORTED', { imported, skipped });

        res.json({ success: true, imported, skipped });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: 'Failed to import passwords' });
    }
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   🔐 SafePass Cloud Server (Firebase)                     ║');
    console.log('║   ─────────────────────────────────────────               ║');
    console.log('║                                                           ║');
    console.log(`║   Server running at: http://localhost:${PORT}              ║`);
    console.log('║   Database: Firebase Firestore (Cloud)                    ║');
    console.log('║                                                           ║');
    console.log('║   API Endpoints:                                          ║');
    console.log('║   • POST /api/auth/register - Register new user           ║');
    console.log('║   • POST /api/auth/login    - Login                       ║');
    console.log('║   • GET  /api/passwords     - Get all passwords           ║');
    console.log('║   • POST /api/passwords     - Add password                ║');
    console.log('║   • POST /api/generate      - Generate password           ║');
    console.log('║   • GET  /api/dashboard/*   - Dashboard statistics        ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
});
