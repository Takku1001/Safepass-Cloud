#ifndef TRIE_H
#define TRIE_H

#include <iostream>
#include <string>
#include <unordered_map>
#include <vector>

using namespace std;

// Trie Node
class TrieNode {
public:
    unordered_map<char, TrieNode*> children;
    bool isEndOfWord;
    string fullWebsite;

    TrieNode() : isEndOfWord(false) {}
};

// Trie Class for Auto-complete Search
class Trie {
private:
    TrieNode* root;

    void collectWords(TrieNode* node, vector<string>& results);

public:
    Trie() {
        root = new TrieNode();
    }

    // Insert a website name
    void insert(const string& website);

    // Search for exact match
    bool search(const string& website);

    // Auto-complete: find all websites starting with prefix
    vector<string> autoComplete(const string& prefix);

    // Display all websites
    void displayAll();
};

// Insert website into Trie
void Trie::insert(const string& website) {
    TrieNode* current = root;
    
    for (char ch : website) {
        char lowerCh = tolower(ch);
        if (current->children.find(lowerCh) == current->children.end()) {
            current->children[lowerCh] = new TrieNode();
        }
        current = current->children[lowerCh];
    }
    
    current->isEndOfWord = true;
    current->fullWebsite = website;
}

// Search for exact website
bool Trie::search(const string& website) {
    TrieNode* current = root;
    
    for (char ch : website) {
        char lowerCh = tolower(ch);
        if (current->children.find(lowerCh) == current->children.end()) {
            return false;
        }
        current = current->children[lowerCh];
    }
    
    return current->isEndOfWord;
}

// Collect all words from a node
void Trie::collectWords(TrieNode* node, vector<string>& results) {
    if (node->isEndOfWord) {
        results.push_back(node->fullWebsite);
    }
    
    for (auto& pair : node->children) {
        collectWords(pair.second, results);
    }
}

// Auto-complete suggestions
vector<string> Trie::autoComplete(const string& prefix) {
    vector<string> results;
    TrieNode* current = root;
    
    // Navigate to the prefix
    for (char ch : prefix) {
        char lowerCh = tolower(ch);
        if (current->children.find(lowerCh) == current->children.end()) {
            return results; // No matches
        }
        current = current->children[lowerCh];
    }
    
    // Collect all words with this prefix
    collectWords(current, results);
    return results;
}

// Display all websites
void Trie::displayAll() {
    vector<string> allWebsites;
    collectWords(root, allWebsites);
    
    cout << "\n=== All Websites (Trie) ===" << endl;
    for (const string& site : allWebsites) {
        cout << "  - " << site << endl;
    }
}

#endif
