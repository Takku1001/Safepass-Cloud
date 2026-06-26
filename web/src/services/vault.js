/**
 * Vault Service - Password vault management using DSA
 * Integrates B-Tree, Trie, MinHeap, and HashTable
 */

const { BTree } = require('../data-structures/BTree');
const { Trie } = require('../data-structures/Trie');
const { MinHeap, ExpiryEntry } = require('../data-structures/MinHeap');
const { DuplicateChecker } = require('../data-structures/HashTable');
const { ActivityLog, ClipboardHistory } = require('../data-structures/Queue');
const encryption = require('./encryption');

class VaultService {
    constructor() {
        this.userVaults = new Map(); // userId -> vault data structures
    }

    // Initialize vault for a user
    initializeVault(userId) {
        if (this.userVaults.has(userId)) {
            return this.userVaults.get(userId);
        }

        const vault = {
            btree: new BTree(3),           // Password storage
            trie: new Trie(),               // Auto-complete search
            expiryHeap: new MinHeap(),      // Expiry alerts
            duplicateChecker: new DuplicateChecker(), // Duplicate detection
            activityLog: new ActivityLog(100),        // Activity history
            clipboardHistory: new ClipboardHistory(20) // Clipboard history
        };

        this.userVaults.set(userId, vault);
        return vault;
    }

    // Get vault for user
    getVault(userId) {
        return this.userVaults.get(userId) || this.initializeVault(userId);
    }

    // Load passwords into vault
    loadPasswords(userId, passwords, encryptionKey) {
        const vault = this.getVault(userId);
        
        // Clear existing data
        vault.btree = new BTree(3);
        vault.trie = new Trie();
        vault.expiryHeap = new MinHeap();
        vault.duplicateChecker = new DuplicateChecker();

        for (const password of passwords) {
            // Decrypt password for hashing
            const plainPassword = encryption.simpleDecrypt(password.encrypted_password, encryptionKey);
            
            // Add to B-Tree
            vault.btree.insert({
                id: password.id,
                websiteName: password.website_name,
                username: password.username,
                encryptedPassword: password.encrypted_password,
                iv: password.iv,
                url: password.url,
                notes: password.notes,
                category: password.category,
                isFavorite: password.is_favorite === 1,
                passwordStrength: password.password_strength,
                createdAt: password.created_at,
                lastModified: password.last_modified,
                expiryDate: password.expiry_date
            });

            // Add to Trie for search
            vault.trie.insert(password.website_name, {
                id: password.id,
                username: password.username,
                category: password.category
            });

            // Add to expiry heap if expiry date exists
            if (password.expiry_date) {
                console.log('Adding to expiry heap:', password.website_name, 'expiry:', password.expiry_date);
                vault.expiryHeap.insert(new ExpiryEntry(
                    password.website_name,
                    new Date(password.expiry_date).getTime(),
                    password.id
                ));
                console.log('Expiry heap size after insert:', vault.expiryHeap.size());
            }

            // Add to duplicate checker (using PLAIN password hash)
            if (plainPassword) {
                const passwordHash = encryption.hashPassword(plainPassword);
                console.log('Adding to duplicate checker:', password.website_name, 'plain:', plainPassword, 'hash:', passwordHash);
                vault.duplicateChecker.addPassword(password.website_name, passwordHash);
            }
        }

        console.log('Vault loaded. Duplicate hashes:', vault.duplicateChecker.passwordHashes);

        vault.activityLog.log('VAULT_LOADED', { 
            passwordCount: passwords.length 
        });

        return {
            success: true,
            passwordCount: passwords.length
        };
    }

    // Search passwords using Trie (auto-complete)
    search(userId, prefix) {
        const vault = this.getVault(userId);
        return vault.trie.autoComplete(prefix);
    }

    // Get password by website (B-Tree)
    getPassword(userId, websiteName) {
        const vault = this.getVault(userId);
        return vault.btree.search(websiteName);
    }

    // Get all passwords
    getAllPasswords(userId) {
        const vault = this.getVault(userId);
        return vault.btree.getAll();
    }

    // Add password to vault
    addPassword(userId, passwordData, plainPassword) {
        const vault = this.getVault(userId);

        // Add to B-Tree
        vault.btree.insert(passwordData);

        // Add to Trie
        vault.trie.insert(passwordData.websiteName, {
            id: passwordData.id,
            username: passwordData.username,
            category: passwordData.category
        });

        // Add to expiry heap
        if (passwordData.expiryDate) {
            vault.expiryHeap.insert(new ExpiryEntry(
                passwordData.websiteName,
                new Date(passwordData.expiryDate).getTime(),
                passwordData.id
            ));
        }

        // Add to duplicate checker (using PLAIN password hash)
        if (plainPassword) {
            const passwordHash = encryption.hashPassword(plainPassword);
            vault.duplicateChecker.addPassword(passwordData.websiteName, passwordHash);
        }

        // Log activity
        vault.activityLog.log('PASSWORD_ADDED', {
            websiteName: passwordData.websiteName,
            username: passwordData.username
        });

        return true;
    }

    // Update password in vault
    updatePassword(userId, oldWebsiteName, updatedData, plainPassword = null) {
        const vault = this.getVault(userId);

        // Check if website name changed
        const websiteNameChanged = updatedData.websiteName && updatedData.websiteName !== oldWebsiteName;
        
        if (websiteNameChanged) {
            // Get the existing entry first
            const existing = vault.btree.search(oldWebsiteName);
            if (existing) {
                // Remove from all data structures with old name
                vault.btree.delete(oldWebsiteName);
                vault.trie.delete(oldWebsiteName);
                vault.expiryHeap.removeByWebsite(oldWebsiteName);
                vault.duplicateChecker.removePassword(oldWebsiteName);
                
                // Merge updated data with existing data
                const mergedData = { ...existing, ...updatedData };
                
                // Add with new name
                vault.btree.insert(mergedData);
                vault.trie.insert(mergedData.websiteName, {
                    id: mergedData.id,
                    username: mergedData.username,
                    category: mergedData.category
                });
                
                // Add to expiry heap
                if (mergedData.expiryDate) {
                    vault.expiryHeap.insert(new ExpiryEntry(
                        mergedData.websiteName,
                        new Date(mergedData.expiryDate).getTime(),
                        mergedData.id
                    ));
                }
                
                // Add to duplicate checker (using PLAIN password hash)
                if (plainPassword) {
                    const passwordHash = encryption.hashPassword(plainPassword);
                    vault.duplicateChecker.addPassword(mergedData.websiteName, passwordHash);
                }
            }
        } else {
            // Update in B-Tree (no name change)
            vault.btree.update(oldWebsiteName, updatedData);

            // Update expiry if changed
            if (updatedData.expiryDate !== undefined) {
                if (updatedData.expiryDate) {
                    vault.expiryHeap.updateExpiry(oldWebsiteName, new Date(updatedData.expiryDate).getTime());
                } else {
                    vault.expiryHeap.removeByWebsite(oldWebsiteName);
                }
            }

            // Update duplicate checker if password changed
            if (plainPassword) {
                vault.duplicateChecker.removePassword(oldWebsiteName);
                const passwordHash = encryption.hashPassword(plainPassword);
                vault.duplicateChecker.addPassword(oldWebsiteName, passwordHash);
            }
        }

        // Log activity
        vault.activityLog.log('PASSWORD_UPDATED', {
            oldWebsiteName,
            newWebsiteName: updatedData.websiteName || oldWebsiteName
        });

        return true;
    }

    // Delete password from vault
    deletePassword(userId, websiteName) {
        const vault = this.getVault(userId);

        // Remove from all data structures
        vault.btree.delete(websiteName);
        vault.trie.delete(websiteName);
        vault.expiryHeap.removeByWebsite(websiteName);
        vault.duplicateChecker.removePassword(websiteName);

        // Log activity
        vault.activityLog.log('PASSWORD_DELETED', {
            websiteName
        });

        return true;
    }

    // Get expiring passwords
    getExpiringPasswords(userId, days = 30) {
        const vault = this.getVault(userId);
        console.log('Getting expiring passwords for user:', userId, 'within', days, 'days');
        console.log('Expiry heap size:', vault.expiryHeap.size());
        const result = vault.expiryHeap.getExpiringSoon(days);
        console.log('Expiring passwords found:', result.length);
        return result;
    }

    // Get expired passwords
    getExpiredPasswords(userId) {
        const vault = this.getVault(userId);
        return vault.expiryHeap.getExpired();
    }

    // Get duplicate passwords
    getDuplicates(userId) {
        const vault = this.getVault(userId);
        const duplicates = vault.duplicateChecker.getDuplicates();
        console.log('Duplicate check:', {
            totalHashes: vault.duplicateChecker.passwordHashes.size,
            duplicates: duplicates,
            allHashes: Array.from(vault.duplicateChecker.passwordHashes.entries())
        });
        return duplicates;
    }

    // Check if password is duplicate
    isDuplicate(userId, passwordHash, excludeWebsite = null) {
        const vault = this.getVault(userId);
        return vault.duplicateChecker.isDuplicate(passwordHash, excludeWebsite);
    }

    // Record clipboard copy
    recordCopy(userId, websiteName, username, field) {
        const vault = this.getVault(userId);
        vault.clipboardHistory.copy(websiteName, username, field);
        vault.activityLog.log('PASSWORD_COPIED', {
            websiteName,
            field
        });
    }

    // Get clipboard history
    getClipboardHistory(userId) {
        const vault = this.getVault(userId);
        return vault.clipboardHistory.toArray();
    }

    // Clear clipboard history
    clearClipboardHistory(userId) {
        const vault = this.getVault(userId);
        vault.clipboardHistory.clearSensitive();
        vault.activityLog.log('CLIPBOARD_CLEARED', {});
    }

    // Get activity log
    getActivityLog(userId, count = 20) 
    {
        const vault = this.getVault(userId);
        return vault.activityLog.getRecent(count);
    }

    // Get vault statistics
    getStats(userId) {
        const vault = this.getVault(userId);
        
        const allPasswords = vault.btree.getAll();
        const expiryStats = vault.expiryHeap.getStats();
        const duplicates = vault.duplicateChecker.getDuplicates();

        // Calculate strength distribution
        const strengthDist = {
            'very-strong': 0,
            'strong': 0,
            'medium': 0,
            'weak': 0,
            'very-weak': 0
        };

        for (const pass of allPasswords) {
            if (pass.passwordStrength && strengthDist[pass.passwordStrength] !== undefined) {
                strengthDist[pass.passwordStrength]++;
            }
        }

        // Category distribution
        const categories = {};
        for (const pass of allPasswords) {
            const cat = pass.category || 'General';
            categories[cat] = (categories[cat] || 0) + 1;
        }

        return {
            totalPasswords: allPasswords.length,
            duplicateGroups: duplicates.length,
            duplicateCount: vault.duplicateChecker.getDuplicateCount(),
            expiringSoon: expiryStats.expiringSoon,
            expired: expiryStats.expired,
            strengthDistribution: strengthDist,
            categories,
            recentActivity: vault.activityLog.getRecent(5)
        };
    }

    // Fuzzy search
    fuzzySearch(userId, query) {
        const vault = this.getVault(userId);
        return vault.trie.fuzzySearch(query);
    }

    // Clear vault
    clearVault(userId) {
        this.userVaults.delete(userId);
    }
}

module.exports = new VaultService();
