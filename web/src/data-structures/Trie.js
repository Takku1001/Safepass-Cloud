/**
 * Trie Implementation for Auto-Complete Search
 * Fast O(m) prefix-based search where m is prefix length
 */

class TrieNode {
    constructor() {
        this.children = new Map();
        this.isEndOfWord = false;
        this.fullWebsite = '';
        this.metadata = null; // Store additional info
    }
}

class Trie {
    constructor() {
        this.root = new TrieNode();
    }

    // Insert a website name
    insert(website, metadata = null) {
        let current = this.root;
        const lowerWebsite = website.toLowerCase();

        for (const char of lowerWebsite) {
            if (!current.children.has(char)) {
                current.children.set(char, new TrieNode());
            }
            current = current.children.get(char);
        }

        current.isEndOfWord = true;
        current.fullWebsite = website;
        current.metadata = metadata;
    }

    // Search for exact match
    search(website) {
        let current = this.root;
        const lowerWebsite = website.toLowerCase();

        for (const char of lowerWebsite) {
            if (!current.children.has(char)) {
                return null;
            }
            current = current.children.get(char);
        }

        return current.isEndOfWord ? { website: current.fullWebsite, metadata: current.metadata } : null;
    }

    // Check if website exists
    exists(website) {
        return this.search(website) !== null;
    }

    // Auto-complete suggestions
    autoComplete(prefix, limit = 10) {
        const results = [];
        let current = this.root;
        const lowerPrefix = prefix.toLowerCase();

        // Navigate to prefix
        for (const char of lowerPrefix) {
            if (!current.children.has(char)) {
                return results;
            }
            current = current.children.get(char);
        }

        // Collect all words with this prefix
        this._collectWords(current, results, limit);
        return results;
    }

    // Helper to collect words from a node
    _collectWords(node, results, limit) {
        if (results.length >= limit) return;

        if (node.isEndOfWord) {
            results.push({
                website: node.fullWebsite,
                metadata: node.metadata
            });
        }

        for (const [char, childNode] of node.children) {
            if (results.length >= limit) break;
            this._collectWords(childNode, results, limit);
        }
    }

    // Get all websites
    getAllWebsites() {
        const results = [];
        this._collectWords(this.root, results, Infinity);
        return results;
    }

    // Delete a website
    delete(website) {
        return this._deleteHelper(this.root, website.toLowerCase(), 0);
    }

    _deleteHelper(node, website, index) {
        if (index === website.length) {
            if (!node.isEndOfWord) return false;
            node.isEndOfWord = false;
            node.fullWebsite = '';
            node.metadata = null;
            return node.children.size === 0;
        }

        const char = website[index];
        if (!node.children.has(char)) return false;

        const shouldDelete = this._deleteHelper(node.children.get(char), website, index + 1);

        if (shouldDelete) {
            node.children.delete(char);
            return node.children.size === 0 && !node.isEndOfWord;
        }

        return false;
    }

    // Fuzzy search (basic implementation)
    fuzzySearch(query, maxDistance = 2) {
        const results = [];
        const allWords = this.getAllWebsites();
        
        for (const item of allWords) {
            const distance = this._levenshteinDistance(query.toLowerCase(), item.website.toLowerCase());
            if (distance <= maxDistance) {
                results.push({
                    ...item,
                    distance
                });
            }
        }

        return results.sort((a, b) => a.distance - b.distance);
    }

    // Levenshtein distance for fuzzy matching
    _levenshteinDistance(str1, str2) {
        const m = str1.length;
        const n = str2.length;
        const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
                }
            }
        }

        return dp[m][n];
    }

    // Serialize for storage
    toJSON() {
        return this.getAllWebsites();
    }

    // Load from array
    fromArray(websites) {
        this.root = new TrieNode();
        for (const item of websites) {
            if (typeof item === 'string') {
                this.insert(item);
            } else {
                this.insert(item.website || item.websiteName, item.metadata || item);
            }
        }
    }
}

module.exports = { Trie, TrieNode };
