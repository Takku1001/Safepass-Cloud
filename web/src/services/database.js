/**
 * Database Service - SQL.js database management (Pure JavaScript SQLite)
 * Handles all database operations with encrypted storage
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

class DatabaseService {
    constructor() {
        this.db = null;
        this.dbPath = null;
        this.SQL = null;
    }

    // Initialize database
    async initialize(dbPath = './data/safepass.db') {
        // Ensure data directory exists
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        this.dbPath = dbPath;
        
        // Initialize SQL.js
        this.SQL = await initSqlJs();
        
        // Load existing database or create new
        if (fs.existsSync(dbPath)) {
            const buffer = fs.readFileSync(dbPath);
            this.db = new this.SQL.Database(buffer);
        } else {
            this.db = new this.SQL.Database();
        }
        
        // Create tables
        this.createTables();
        this.save();
        
        return true;
    }

    // Save database to disk
    save() {
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this.dbPath, buffer);
    }

    // Execute query with parameters (for SELECT queries)
    query(sql, params = []) {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    }

    // Execute single row query
    queryOne(sql, params = []) {
        const results = this.query(sql, params);
        return results.length > 0 ? results[0] : null;
    }

    // Execute statement (for INSERT, UPDATE, DELETE)
    execute(sql, params = []) {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        stmt.step();
        stmt.free();
    }

    // Get last insert row id
    lastInsertId() {
        const result = this.db.exec('SELECT last_insert_rowid() as id');
        return result[0].values[0][0];
    }

    // Create database tables
    createTables() {
        // Master user table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                last_login TEXT,
                settings TEXT DEFAULT '{}'
            )
        `);

        // Password vault table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS passwords (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                website_name TEXT NOT NULL,
                username TEXT NOT NULL,
                encrypted_password TEXT NOT NULL,
                iv TEXT NOT NULL,
                url TEXT,
                notes TEXT,
                category TEXT DEFAULT 'General',
                is_favorite INTEGER DEFAULT 0,
                password_strength TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                last_modified TEXT DEFAULT (datetime('now')),
                expiry_date TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // Activity log table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                details TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // Sessions table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                encryption_key TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                expires_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // Create indexes
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_passwords_user ON passwords(user_id)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_passwords_website ON passwords(website_name)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id)`);
    }

    // User operations
    createUser(username, passwordHash, salt) {
        // Check if user exists first
        const existing = this.queryOne('SELECT id FROM users WHERE username = ?', [username]);
        if (existing) {
            throw new Error('Username already exists');
        }

        this.execute(
            'INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)',
            [username, passwordHash, salt]
        );
        this.save();
        
        const id = this.lastInsertId();
        return { id, username };
    }

    getUser(username) {
        return this.queryOne('SELECT * FROM users WHERE username = ?', [username]);
    }

    getUserById(id) {
        return this.queryOne('SELECT * FROM users WHERE id = ?', [id]);
    }

    updateLastLogin(userId) {
        this.execute("UPDATE users SET last_login = datetime('now') WHERE id = ?", [userId]);
        this.save();
    }

    // Password operations
    addPassword(userId, passwordData) {
        this.execute(`
            INSERT INTO passwords (
                user_id, website_name, username, encrypted_password, iv,
                url, notes, category, password_strength, expiry_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            userId,
            passwordData.websiteName,
            passwordData.username,
            passwordData.encryptedPassword,
            passwordData.iv || '',
            passwordData.url || null,
            passwordData.notes || null,
            passwordData.category || 'General',
            passwordData.passwordStrength || null,
            passwordData.expiryDate || null
        ]);
        this.save();

        const id = this.lastInsertId();
        return { id, ...passwordData };
    }

    getPassword(userId, id) {
        return this.queryOne(
            'SELECT * FROM passwords WHERE id = ? AND user_id = ?',
            [id, userId]
        );
    }

    getPasswordByWebsite(userId, websiteName) {
        return this.queryOne(
            'SELECT * FROM passwords WHERE user_id = ? AND website_name = ?',
            [userId, websiteName]
        );
    }

    getAllPasswords(userId) {
        return this.query(
            'SELECT * FROM passwords WHERE user_id = ? ORDER BY website_name',
            [userId]
        );
    }

    searchPasswords(userId, searchQuery) {
        const searchTerm = `%${searchQuery}%`;
        return this.query(`
            SELECT * FROM passwords 
            WHERE user_id = ? AND (
                website_name LIKE ? OR 
                username LIKE ? OR 
                url LIKE ? OR
                category LIKE ?
            )
            ORDER BY website_name
        `, [userId, searchTerm, searchTerm, searchTerm, searchTerm]);
    }

    updatePassword(userId, id, passwordData) {
        const sets = [];
        const values = [];
        
        if (passwordData.websiteName !== undefined) {
            sets.push('website_name = ?');
            values.push(passwordData.websiteName);
        }
        if (passwordData.username !== undefined) {
            sets.push('username = ?');
            values.push(passwordData.username);
        }
        if (passwordData.encryptedPassword !== undefined) {
            sets.push('encrypted_password = ?');
            values.push(passwordData.encryptedPassword);
        }
        if (passwordData.iv !== undefined) {
            sets.push('iv = ?');
            values.push(passwordData.iv);
        }
        if (passwordData.url !== undefined) {
            sets.push('url = ?');
            values.push(passwordData.url);
        }
        if (passwordData.notes !== undefined) {
            sets.push('notes = ?');
            values.push(passwordData.notes);
        }
        if (passwordData.category !== undefined) {
            sets.push('category = ?');
            values.push(passwordData.category);
        }
        if (passwordData.isFavorite !== undefined) {
            sets.push('is_favorite = ?');
            values.push(passwordData.isFavorite ? 1 : 0);
        }
        if (passwordData.passwordStrength !== undefined) {
            sets.push('password_strength = ?');
            values.push(passwordData.passwordStrength);
        }
        if (passwordData.expiryDate !== undefined) {
            sets.push('expiry_date = ?');
            values.push(passwordData.expiryDate);
        }
        
        sets.push("last_modified = datetime('now')");
        values.push(id, userId);

        this.execute(
            `UPDATE passwords SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
            values
        );
        this.save();

        return this.getPassword(userId, id);
    }

    deletePassword(userId, id) {
        this.execute('DELETE FROM passwords WHERE id = ? AND user_id = ?', [id, userId]);
        this.save();
        return true;
    }

    toggleFavorite(userId, id) {
        this.execute(`
            UPDATE passwords SET is_favorite = NOT is_favorite, last_modified = datetime('now')
            WHERE id = ? AND user_id = ?
        `, [id, userId]);
        this.save();
        return this.getPassword(userId, id);
    }

    getPasswordsByCategory(userId, category) {
        return this.query(
            'SELECT * FROM passwords WHERE user_id = ? AND category = ?',
            [userId, category]
        );
    }

    getFavorites(userId) {
        return this.query(
            'SELECT * FROM passwords WHERE user_id = ? AND is_favorite = 1',
            [userId]
        );
    }

    getExpiringPasswords(userId, days = 30) {
        return this.query(`
            SELECT * FROM passwords 
            WHERE user_id = ? AND expiry_date IS NOT NULL 
            AND date(expiry_date) <= date('now', '+' || ? || ' days')
            ORDER BY expiry_date
        `, [userId, days.toString()]);
    }

    getCategories(userId) {
        const results = this.query(
            'SELECT DISTINCT category FROM passwords WHERE user_id = ?',
            [userId]
        );
        return results.map(r => r.category).filter(Boolean);
    }

    // Activity log operations
    logActivity(userId, action, details = {}) {
        this.execute(`
            INSERT INTO activity_log (user_id, action, details)
            VALUES (?, ?, ?)
        `, [userId, action, JSON.stringify(details)]);
        this.save();
    }

    getActivityLog(userId, limit = 50) {
        return this.query(`
            SELECT * FROM activity_log 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT ?
        `, [userId, limit]);
    }

    // Statistics
    getStats(userId) {
        let totalPasswords = 0;
        let weakPasswords = 0;
        let expiringSoon = 0;
        let categories = [];

        const totalResult = this.queryOne(
            'SELECT COUNT(*) as count FROM passwords WHERE user_id = ?',
            [userId]
        );
        if (totalResult) {
            totalPasswords = totalResult.count;
        }

        const catResult = this.query(
            'SELECT category, COUNT(*) as count FROM passwords WHERE user_id = ? GROUP BY category',
            [userId]
        );
        categories = catResult.map(row => ({
            category: row.category,
            count: row.count
        }));

        const weakResult = this.queryOne(
            "SELECT COUNT(*) as count FROM passwords WHERE user_id = ? AND password_strength IN ('weak', 'very-weak')",
            [userId]
        );
        if (weakResult) {
            weakPasswords = weakResult.count;
        }

        const expiringResult = this.queryOne(
            "SELECT COUNT(*) as count FROM passwords WHERE user_id = ? AND expiry_date IS NOT NULL AND date(expiry_date) <= date('now', '+30 days')",
            [userId]
        );
        if (expiringResult) {
            expiringSoon = expiringResult.count;
        }

        const recentResult = this.queryOne(
            "SELECT COUNT(*) as count FROM activity_log WHERE user_id = ? AND created_at >= datetime('now', '-7 days')",
            [userId]
        );
        let recentActivity = 0;
        if (recentResult) {
            recentActivity = recentResult.count;
        }

        return {
            totalPasswords,
            categories,
            recentActivity,
            weakPasswords,
            expiringSoon
        };
    }

    // Close database
    close() {
        if (this.db) {
            this.save();
            this.db.close();
        }
    }
}

module.exports = new DatabaseService();
