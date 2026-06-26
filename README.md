# SafePass Cloud

> A secure password manager powered by custom data structures — available as a C++ console app and a Node.js web app.

SafePass Cloud stores, searches, and analyzes passwords using DSA built from scratch (B-Tree, Trie, Min-Heap, Queue, Hash Table). Phase 1 is an interactive C++ console app; Phase 2 is an Express web app with AES encryption, SQLite, and optional Firebase cloud sync.

## Tech Stack

- **C++ app:** C++11, custom DSA (header-only)
- **Web app:** Node.js, Express, bcryptjs, crypto-js, uuid, sql.js (SQLite), firebase-admin
- **Frontend:** HTML / CSS / vanilla JS

## Folder Structure

```
safepass-cloud/
├── cpp/                  # Phase 1 — C++ console app
│   ├── src/main.cpp      # Menu-driven application
│   ├── include/          # DSA headers (BTree, Trie, MinHeap, Queue, Hashing)
│   └── docs/
└── web/                  # Phase 2 — Node/Express web app
    ├── src/              # server, services, data-structures
    ├── public/           # frontend (HTML/CSS/JS)
    └── docs/
```

## Prerequisites

- C++11 compiler (`g++` / MinGW) for the console app
- [Node.js](https://nodejs.org/) v16+ and npm for the web app

## How to Run

**C++ console app**
```bash
cd cpp
g++ -std=c++11 src/main.cpp -o build/SafePass
./build/SafePass
```

**Web app** (then open <http://localhost:3000>)
```bash
cd web
npm install
npm start
```

## Author

Muhammad Rayyan Malik
