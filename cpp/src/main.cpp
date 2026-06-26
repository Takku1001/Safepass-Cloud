#include <iostream>
#include <string>
#include <ctime>
#include "../include/Password.h"
#include "../include/BTree.h"
#include "../include/Trie.h"
#include "../include/Hashing.h"
#include "../include/Queue.h"
#include "../include/MinHeap.h"

using namespace std;

void displayHeader() {
    cout << "\n";
    cout << "============================================\n";
    cout << "      SafePass Cloud - Phase 1 Demo\n";
    cout << "   Secure Password Manager with DSA\n";
    cout << "============================================\n";
}

void displayMenu() {
    cout << "\n--- Main Menu ---\n";
    cout << "1. Add Password\n";
    cout << "2. Search & View Password (B-Tree)\n";
    cout << "3. Auto-Complete Search (Trie)\n";
    cout << "4. View All Passwords\n";
    cout << "5. Clipboard History\n";
    cout << "6. Password Expiry Alerts\n";
    cout << "7. Test Hashing\n";
    cout << "8. Security Dashboard\n";
    cout << "0. Exit\n";
    cout << "Enter choice: ";
}

int main() {
    displayHeader();

    // Initialize Data Structures
    BTree<Password> passwordVault(3); // B-Tree with minimum degree 3
    Trie searchTrie;
    Queue clipboardHistory(5); // Store last 5 copied items
    MinHeap expiryHeap;
    HashTable duplicateChecker;

    // Master Password Setup (Phase 1 - Simple Demo)
    string masterPassword = "master123";
    string masterHash = HashUtil::simpleHash(masterPassword);
    cout << "\n[INFO] Master password set and hashed." << endl;
    cout << "[HASH] " << masterHash << endl;

    // Pre-populate with sample data
    cout << "\n[INFO] Loading sample passwords..." << endl;
    
    Password p1(1, "gmail.com", "user@gmail.com", HashUtil::simpleEncrypt("pass123", "key"));
    Password p2(2, "facebook.com", "john_doe", HashUtil::simpleEncrypt("fb_secure", "key"));
    Password p3(3, "github.com", "dev_user", HashUtil::simpleEncrypt("git@2024", "key"));
    Password p4(4, "amazon.com", "shopper99", HashUtil::simpleEncrypt("amz_pass", "key"));
    Password p5(5, "netflix.com", "movie_fan", HashUtil::simpleEncrypt("flix2024", "key"));

    passwordVault.insert(p1);
    passwordVault.insert(p2);
    passwordVault.insert(p3);
    passwordVault.insert(p4);
    passwordVault.insert(p5);

    searchTrie.insert("gmail.com");
    searchTrie.insert("facebook.com");
    searchTrie.insert("github.com");
    searchTrie.insert("amazon.com");
    searchTrie.insert("netflix.com");

    // Add to duplicate checker
    duplicateChecker.insert("gmail.com", "user@gmail.com");
    duplicateChecker.insert("facebook.com", "john_doe");
    duplicateChecker.insert("github.com", "dev_user");

    // Add expiry alerts (passwords expire in X days)
    time_t now = time(nullptr);
    expiryHeap.insert(ExpiryEntry("gmail.com", now + 5 * 24 * 60 * 60));   // 5 days
    expiryHeap.insert(ExpiryEntry("facebook.com", now + 15 * 24 * 60 * 60)); // 15 days
    expiryHeap.insert(ExpiryEntry("github.com", now + 30 * 24 * 60 * 60));   // 30 days

    cout << "[SUCCESS] Sample data loaded!\n";

    // Main Menu Loop
    int choice;
    do {
        displayMenu();
        cin >> choice;
        cin.ignore();

        switch (choice) {
            case 1: { // Add Password
                string website, username, password;
                cout << "\nEnter website: ";
                getline(cin, website);
                cout << "Enter username: ";
                getline(cin, username);
                cout << "Enter password: ";
                getline(cin, password);

                // Analyze password strength
                int strength = HashUtil::analyzePasswordStrength(password);
                cout << "\n[PASSWORD STRENGTH]" << endl;
                cout << "  Strength: " << HashUtil::getStrengthBar(strength) << " " << HashUtil::getStrengthLabel(strength) << endl;
                
                if (strength < 3) {
                    cout << "  [WARNING] Consider using a stronger password!" << endl;
                    cout << "  Tips: Use 8+ chars, uppercase, lowercase, numbers, symbols" << endl;
                }

                // Get expiry days
                int expiryDays;
                cout << "\nEnter password expiry (days): ";
                cin >> expiryDays;
                cin.ignore();

                string encrypted = HashUtil::simpleEncrypt(password, "key");
                static int nextId = 6;
                Password newPass(nextId++, website, username, encrypted);
                
                passwordVault.insert(newPass);
                searchTrie.insert(website);
                duplicateChecker.insert(website, username);

                // Add to expiry heap with user-specified days
                time_t now = time(nullptr);
                expiryHeap.insert(ExpiryEntry(website, now + expiryDays * 24 * 60 * 60));

                cout << "\n[SUCCESS] Password added for " << website << endl;
                cout << "[INFO] Password expires in " << expiryDays << " days" << endl;
                break;
            }

            case 2: { // Search Password (B-Tree)
                string website;
                cout << "\nEnter website to search: ";
                getline(cin, website);

                BTreeNode<Password>* result = passwordVault.search(website);
                if (result != nullptr) {
                    // Find the exact password entry
                    for (const auto& pass : result->keys) {
                        if (pass.websiteName == website) {
                            cout << "\n[FOUND] Password Details:" << endl;
                            cout << "  Website: " << pass.websiteName << endl;
                            cout << "  Username: " << pass.username << endl;
                            cout << "  Password (Decrypted): " << HashUtil::simpleDecrypt(pass.encryptedPassword, "key") << endl;
                            clipboardHistory.enqueue("Copied: " + website);
                            break;
                        }
                    }
                } else {
                    cout << "[NOT FOUND] No entry for " << website << endl;
                }
                break;
            }

            case 3: { // Auto-Complete (Trie)
                string prefix;
                cout << "\nEnter search prefix: ";
                getline(cin, prefix);

                vector<string> suggestions = searchTrie.autoComplete(prefix);
                if (!suggestions.empty()) {
                    cout << "\n[SUGGESTIONS]" << endl;
                    for (const string& site : suggestions) {
                        cout << "  - " << site << endl;
                    }
                } else {
                    cout << "[NO MATCHES] for prefix '" << prefix << "'" << endl;
                }
                break;
            }

            case 4: { // View All Passwords
                passwordVault.display();
                break;
            }

            case 5: { // Clipboard History
                clipboardHistory.display();
                break;
            }

            case 6: { // Password Expiry
                expiryHeap.displayUpcomingExpiries();
                break;
            }

            case 7: { // Test Hashing
                string testPassword;
                cout << "\nEnter password to hash: ";
                getline(cin, testPassword);
                
                string hashed = HashUtil::simpleHash(testPassword);
                cout << "[HASH] " << hashed << endl;
                
                // Also show strength analysis
                int strength = HashUtil::analyzePasswordStrength(testPassword);
                cout << "[STRENGTH] " << HashUtil::getStrengthBar(strength) << " " << HashUtil::getStrengthLabel(strength) << endl;
                
                cout << "Verify password (re-enter): ";
                string verify;
                getline(cin, verify);
                
                if (HashUtil::verifyPassword(verify, hashed)) {
                    cout << "[SUCCESS] Password verified!" << endl;
                } else {
                    cout << "[FAILED] Password mismatch!" << endl;
                }
                break;
            }

            case 8: { // Security Dashboard
                cout << "\n============================================" << endl;
                cout << "         SECURITY DASHBOARD" << endl;
                cout << "============================================" << endl;
                
                // Show passwords expiring soon (from MinHeap)
                cout << "\n--- Passwords Expiring Soon ---" << endl;
                expiryHeap.displayUpcomingExpiries();
                
                // Analyze stored passwords for weak ones
                cout << "\n--- Password Strength Analysis ---" << endl;
                cout << "(Analyzing all stored passwords...)" << endl;
                
                // Get sample passwords and check their strength
                struct PasswordStrengthEntry {
                    string website;
                    int strength;
                };
                
                vector<PasswordStrengthEntry> weakPasswords;
                
                // Check pre-loaded passwords
                string testPasswords[] = {"pass123", "fb_secure", "git@2024", "amz_pass", "flix2024"};
                string websites[] = {"gmail.com", "facebook.com", "github.com", "amazon.com", "netflix.com"};
                
                for (int i = 0; i < 5; i++) {
                    int str = HashUtil::analyzePasswordStrength(testPasswords[i]);
                    cout << "  " << websites[i] << ": " << HashUtil::getStrengthBar(str) << " " << HashUtil::getStrengthLabel(str) << endl;
                    if (str < 3) {
                        weakPasswords.push_back({websites[i], str});
                    }
                }
                
                cout << "\n--- Summary ---" << endl;
                cout << "  Total Weak Passwords: " << weakPasswords.size() << endl;
                if (!weakPasswords.empty()) {
                    cout << "  [ACTION REQUIRED] Update these passwords:" << endl;
                    for (const auto& wp : weakPasswords) {
                        cout << "    - " << wp.website << " (Strength: " << wp.strength << "/5)" << endl;
                    }
                } else {
                    cout << "  [GOOD] All passwords are secure!" << endl;
                }
                
                cout << "\n============================================" << endl;
                break;
            }

            case 0:
                cout << "\n[EXIT] Thank you for using SafePass Cloud!\n";
                break;

            default:
                cout << "[ERROR] Invalid choice. Try again.\n";
        }

    } while (choice != 0);

    return 0;
}
