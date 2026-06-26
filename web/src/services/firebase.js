/**
 * Firebase Configuration and Initialization
 * Backend service using Firebase Admin SDK
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Load service account key - check multiple locations
let serviceAccount;

// Render.com stores secret files in /etc/secrets/
const renderPath = '/etc/secrets/serviceAccountKey.json';
const localPath = path.join(__dirname, '..', 'serviceAccountKey.json');

if (fs.existsSync(renderPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(renderPath, 'utf8'));
    console.log('Loaded Firebase credentials from Render secrets');
} else if (fs.existsSync(localPath)) {
    serviceAccount = require(localPath);
    console.log('Loaded Firebase credentials from local file');
} else {
    console.error('Firebase service account key not found!');
    process.exit(1);
}

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
});

// Get Firestore instance
const db = admin.firestore();

// Get Auth instance
const auth = admin.auth();

module.exports = {
    admin,
    db,
    auth
};
