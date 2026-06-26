/**
 * Hash Table Implementation for Duplicate Detection & Fast Lookups
 * Uses chaining for collision resolution
 */

class HashNode {
    constructor(key, value) {
        this.key = key;
        this.value = value;
        this.next = null;
    }
}

class HashTable {
    constructor(size = 100) {
        this.size = size;
        this.table = new Array(size).fill(null);
        this.count = 0;
    }

    // Hash function
    _hash(key) {
        let hash = 0;
        const str = String(key).toLowerCase();
        
        for (let i = 0; i < str.length; i++) {
            hash = (hash * 31 + str.charCodeAt(i)) % this.size;
        }
        
        return hash;
    }

    // Insert key-value pair
    insert(key, value) {
        const index = this._hash(key);
        const newNode = new HashNode(key, value);

        if (!this.table[index]) {
            this.table[index] = newNode;
        } else {
            // Check for existing key and update
            let current = this.table[index];
            while (current) {
                if (current.key === key) {
                    current.value = value;
                    return true;
                }
                if (!current.next) break;
                current = current.next;
            }
            current.next = newNode;
        }

        this.count++;
        return true;
    }

    // Search for key
    search(key) {
        const index = this._hash(key);
        let current = this.table[index];

        while (current) {
            if (current.key === key) {
                return current.value;
            }
            current = current.next;
        }

        return null;
    }

    // Check if key exists
    exists(key) {
        return this.search(key) !== null;
    }

    // Delete key
    delete(key) {
        const index = this._hash(key);
        let current = this.table[index];
        let prev = null;

        while (current) {
            if (current.key === key) {
                if (prev) {
                    prev.next = current.next;
                } else {
                    this.table[index] = current.next;
                }
                this.count--;
                return true;
            }
            prev = current;
            current = current.next;
        }

        return false;
    }

    // Get all entries
    getAll() {
        const entries = [];
        
        for (let i = 0; i < this.size; i++) {
            let current = this.table[i];
            while (current) {
                entries.push({ key: current.key, value: current.value });
                current = current.next;
            }
        }
        
        return entries;
    }

    // Get all keys
    keys() {
        return this.getAll().map(e => e.key);
    }

    // Get all values
    values() {
        return this.getAll().map(e => e.value);
    }

    // Clear table
    clear() {
        this.table = new Array(this.size).fill(null);
        this.count = 0;
    }

    // Get count
    getCount() {
        return this.count;
    }

    // Check if empty
    isEmpty() {
        return this.count === 0;
    }

    // Serialize
    toJSON() {
        return this.getAll();
    }

    // Load from array
    fromArray(entries) {
        this.clear();
        for (const entry of entries) {
            this.insert(entry.key, entry.value);
        }
    }
}

// Duplicate Checker extends HashTable
class DuplicateChecker extends HashTable {
    constructor() {
        super(200);
        this.passwordHashes = new Map(); // Hash -> [websites]
    }

    // Add password for duplicate checking
    addPassword(websiteName, passwordHash) {
        // Store in hash table
        this.insert(websiteName, passwordHash);

        // Track duplicates
        if (!this.passwordHashes.has(passwordHash)) {
            this.passwordHashes.set(passwordHash, []);
        }
        
        const sites = this.passwordHashes.get(passwordHash);
        if (!sites.includes(websiteName)) {
            sites.push(websiteName);
        }
    }

    // Remove password
    removePassword(websiteName) {
        const hash = this.search(websiteName);
        if (hash && this.passwordHashes.has(hash)) {
            const sites = this.passwordHashes.get(hash);
            const index = sites.indexOf(websiteName);
            if (index > -1) {
                sites.splice(index, 1);
            }
            if (sites.length === 0) {
                this.passwordHashes.delete(hash);
            }
        }
        this.delete(websiteName);
    }

    // Check if password is duplicate
    isDuplicate(passwordHash, excludeWebsite = null) {
        const sites = this.passwordHashes.get(passwordHash) || [];
        const filtered = excludeWebsite 
            ? sites.filter(s => s !== excludeWebsite)
            : sites;
        return filtered.length > 0;
    }

    // Get all duplicate groups
    getDuplicates() {
        const duplicates = [];
        
        for (const [hash, sites] of this.passwordHashes) {
            if (sites.length >= 2) {
                duplicates.push({
                    count: sites.length,
                    websites: [...sites]
                });
            }
        }

        return duplicates.sort((a, b) => b.count - a.count);
    }

    // Get duplicate count
    getDuplicateCount() {
        let count = 0;
        for (const [hash, sites] of this.passwordHashes) {
            if (sites.length >= 2) {
                count += sites.length; // Count all passwords that are duplicates
            }
        }
        return count;
    }

    // Get sites using same password as given site
    getSitesWithSamePassword(websiteName) {
        const hash = this.search(websiteName);
        if (!hash) return [];
        
        const sites = this.passwordHashes.get(hash) || [];
        return sites.filter(s => s !== websiteName);
    }

    // Clear all
    clearAll() {
        this.clear();
        this.passwordHashes.clear();
    }

    // Serialize
    toJSON() {
        return {
            passwords: this.getAll(),
            duplicates: this.getDuplicates()
        };
    }

    // Load from data
    fromData(passwords) {
        this.clearAll();
        for (const p of passwords) {
            this.addPassword(p.websiteName, p.passwordHash);
        }
    }
}

module.exports = { HashTable, DuplicateChecker };
