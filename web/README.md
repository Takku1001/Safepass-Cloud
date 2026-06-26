# SafePass Cloud - Secure Password Manager

A professional web-based password manager implementing advanced Data Structures (DSA).

## 📁 Project Structure

```
web/
├── data/                      # SQLite database storage
├── data-structures/           # Custom DSA implementations
│   ├── BTree.js              # B-Tree for password vault (O(log n) operations)
│   ├── Trie.js               # Trie for auto-complete search
│   ├── MinHeap.js            # Min-Heap for expiry alerts
│   ├── Queue.js              # Queue for activity log & clipboard history
│   └── HashTable.js          # Hash Table for duplicate detection
├── services/                  # Backend services
│   ├── database.js           # SQLite database operations
│   ├── encryption.js         # AES encryption & password utilities
│   └── vault.js              # Password vault management
├── public/                    # Frontend files
│   ├── css/styles.css        # Professional UI styles
│   ├── js/
│   │   ├── api.js            # API communication
│   │   └── app.js            # Main application logic
│   └── index.html            # Main HTML file
├── server.js                  # Express.js backend server
└── package.json              # Dependencies
```

## 🚀 Quick Start

### Step 1: Install Node.js
Make sure you have Node.js installed (v16 or higher).
Download from: https://nodejs.org/

### Step 2: Install Dependencies
```bash
cd web
npm install
```

### Step 3: Start the Server
```bash
npm start
```

### Step 4: Open in Browser
Navigate to: http://localhost:3000

## 🔐 System Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    SafePass Cloud Workflow                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User Login                                               │
│     └── Master password entered                              │
│                                                              │
│  2. Master Password Verification                             │
│     └── bcrypt hash comparison                               │
│                                                              │
│  3. Encrypted Vault Loaded                                   │
│     └── AES-256 decryption with derived key                 │
│                                                              │
│  4. B-Tree Built                                             │
│     └── Passwords inserted into B-Tree structure            │
│                                                              │
│  5. Trie Built                                               │
│     └── Website names indexed for auto-complete             │
│                                                              │
│  6. User Manages Passwords                                   │
│     ├── Add/Edit/Delete passwords                           │
│     ├── Search with Trie auto-complete                      │
│     ├── View expiry alerts (MinHeap)                        │
│     └── Check duplicates (HashTable)                        │
│                                                              │
│  7. Changes Saved                                            │
│     └── Encrypted & stored in SQLite database               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Data Structures Used

| Structure | Usage | Time Complexity |
|-----------|-------|-----------------|
| **B-Tree** | Password vault storage | O(log n) search/insert/delete |
| **Trie** | Auto-complete search | O(m) where m = prefix length |
| **Min-Heap** | Password expiry alerts | O(log n) insert, O(1) get min |
| **Queue** | Activity log, clipboard history | O(1) enqueue/dequeue |
| **Hash Table** | Duplicate password detection | O(1) average lookup |

## 🔒 Security Features

- **AES-256 Encryption**: All passwords encrypted before storage
- **bcrypt Hashing**: Master password securely hashed with salt
- **PBKDF2 Key Derivation**: Encryption key derived from master password
- **Session Management**: Secure token-based sessions
- **No Plain Text Storage**: Passwords never stored in plain text

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login to vault
- `POST /api/auth/logout` - Logout
- `GET /api/auth/verify` - Verify session

### Passwords
- `GET /api/passwords` - Get all passwords
- `GET /api/passwords/:id` - Get single password
- `GET /api/passwords/search?q=...` - Search (Trie)
- `POST /api/passwords` - Add password
- `PUT /api/passwords/:id` - Update password
- `DELETE /api/passwords/:id` - Delete password

### Generator
- `POST /api/generate` - Generate secure password
- `POST /api/check-strength` - Check password strength

### Dashboard
- `GET /api/dashboard/stats` - Get statistics
- `GET /api/dashboard/expiring` - Get expiring passwords (MinHeap)
- `GET /api/dashboard/duplicates` - Get duplicates (HashTable)
- `GET /api/dashboard/weak` - Get weak passwords

### Activity
- `GET /api/activity` - Get activity log (Queue)

## 💾 Database Schema

### SQLite Tables

```sql
-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE,
    password_hash TEXT,
    salt TEXT,
    created_at DATETIME,
    last_login DATETIME
);

-- Passwords table  
CREATE TABLE passwords (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    website_name TEXT,
    username TEXT,
    encrypted_password TEXT,
    iv TEXT,
    category TEXT,
    password_strength TEXT,
    expiry_date DATETIME,
    created_at DATETIME,
    last_modified DATETIME
);

-- Activity log table
CREATE TABLE activity_log (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    action TEXT,
    details TEXT,
    created_at DATETIME
);
```

## 🎨 UI Features

- **Modern Dark Theme**: Easy on the eyes
- **Responsive Design**: Works on all devices
- **Real-time Search**: Trie-powered auto-complete
- **Strength Meter**: Visual password strength indicator
- **Dashboard**: Security overview with statistics
- **Categories**: Organize passwords by type
- **Favorites**: Quick access to important passwords

## 🧪 Testing Credentials

After starting the server, you can:
1. Create a new account with any username/password
2. Add sample passwords to test features
3. Try the search auto-complete (Trie)
4. Check the security dashboard

## 📝 Development Notes

- Backend: Node.js + Express
- Database: SQLite (better-sqlite3)
- Encryption: CryptoJS (AES-256)
- Hashing: bcryptjs
- Frontend: Vanilla JavaScript (no frameworks)

## 🔄 Future Enhancements (Cloud Sync)

For full cloud sync functionality, you would need:
1. Cloud storage (AWS S3, Google Cloud, etc.)
2. User authentication service
3. End-to-end encryption for sync
4. Conflict resolution for multiple devices

---

**Author**: BSAI24066  
**Course**: Data Structures & Algorithms  
**Project**: SafePass Cloud Password Manager
