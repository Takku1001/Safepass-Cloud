#ifndef HASHING_H
#define HASHING_H

#include <iostream>
#include <string>
#include <sstream>
#include <iomanip>

using namespace std;

// Simple Hashing Utility (Basic SHA-256 simulation for Phase 1)
class HashUtil {
public:
    // Simple hash function for demonstration (NOT cryptographically secure)
    // In Phase 2, replace with actual SHA-256/bcrypt library
    static string simpleHash(const string& input) {
        unsigned long hash = 5381;
        
        for (char c : input) {
            hash = ((hash << 5) + hash) + c; // hash * 33 + c
        }
        
        stringstream ss;
        ss << hex << setfill('0') << setw(16) << hash;
        return ss.str();
    }

    // Verify password against hash
    static bool verifyPassword(const string& password, const string& hash) {
        return simpleHash(password) == hash;
    }

    // Simple XOR-based encryption (placeholder for AES)
    static string simpleEncrypt(const string& plaintext, const string& key) {
        string encrypted = plaintext;
        for (size_t i = 0; i < plaintext.length(); i++) {
            encrypted[i] = plaintext[i] ^ key[i % key.length()];
        }
        return encrypted;
    }

    // Simple XOR-based decryption
    static string simpleDecrypt(const string& ciphertext, const string& key) {
        return simpleEncrypt(ciphertext, key); // XOR is symmetric
    }

    // Password Strength Analysis
    static bool hasUppercase(const string& password) {
        for (char c : password) {
            if (c >= 'A' && c <= 'Z') return true;
        }
        return false;
    }

    static bool hasLowercase(const string& password) {
        for (char c : password) {
            if (c >= 'a' && c <= 'z') return true;
        }
        return false;
    }

    static bool hasNumbers(const string& password) {
        for (char c : password) {
            if (c >= '0' && c <= '9') return true;
        }
        return false;
    }

    static bool hasSpecialChars(const string& password) {
        string special = "!@#$%^&*()_+-=[]{}|;':,.<>?/~`";
        for (char c : password) {
            if (special.find(c) != string::npos) return true;
        }
        return false;
    }

    static int analyzePasswordStrength(const string& password) {
        int score = 0;
        if (password.length() >= 8) score++;
        if (hasUppercase(password)) score++;
        if (hasLowercase(password)) score++;
        if (hasNumbers(password)) score++;
        if (hasSpecialChars(password)) score++;
        return score; // 0-5 scale
    }

    static string getStrengthLabel(int score) {
        switch (score) {
            case 0:
            case 1: return "VERY WEAK";
            case 2: return "WEAK";
            case 3: return "MODERATE";
            case 4: return "STRONG";
            case 5: return "VERY STRONG";
            default: return "UNKNOWN";
        }
    }

    static string getStrengthBar(int score) {
        string bar = "[";
        for (int i = 0; i < 5; i++) {
            bar += (i < score) ? "#" : "-";
        }
        bar += "]";
        return bar;
    }
};

// Hash Table for Duplicate Detection
class HashTable {
private:
    static const int TABLE_SIZE = 100;
    struct HashNode {
        string key;
        string value;
        HashNode* next;
        
        HashNode(string k, string v) : key(k), value(v), next(nullptr) {}
    };
    
    HashNode* table[TABLE_SIZE];

    int hashFunction(const string& key) {
        unsigned long hash = 0;
        for (char c : key) {
            hash = (hash * 31 + c) % TABLE_SIZE;
        }
        return hash;
    }

public:
    HashTable() {
        for (int i = 0; i < TABLE_SIZE; i++) {
            table[i] = nullptr;
        }
    }

    // Insert key-value pair
    void insert(const string& key, const string& value) {
        int index = hashFunction(key);
        HashNode* newNode = new HashNode(key, value);
        
        if (table[index] == nullptr) {
            table[index] = newNode;
        } else {
            HashNode* current = table[index];
            while (current->next != nullptr) {
                current = current->next;
            }
            current->next = newNode;
        }
    }

    // Search for key
    bool search(const string& key) {
        int index = hashFunction(key);
        HashNode* current = table[index];
        
        while (current != nullptr) {
            if (current->key == key) {
                return true;
            }
            current = current->next;
        }
        return false;
    }

    // Get value by key
    string get(const string& key) {
        int index = hashFunction(key);
        HashNode* current = table[index];
        
        while (current != nullptr) {
            if (current->key == key) {
                return current->value;
            }
            current = current->next;
        }
        return "";
    }

    // Display all entries
    void display() {
        cout << "\n=== Hash Table Contents ===" << endl;
        for (int i = 0; i < TABLE_SIZE; i++) {
            if (table[i] != nullptr) {
                HashNode* current = table[i];
                while (current != nullptr) {
                    cout << "  [" << current->key << "] -> " << current->value << endl;
                    current = current->next;
                }
            }
        }
    }
};

#endif
