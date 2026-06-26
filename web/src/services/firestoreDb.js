/**
 * Firestore Database Service
 * Replaces SQLite with Firebase Firestore
 */

const { db } = require('./firebase');

class FirestoreDatabase {
    constructor() {
        this.usersCollection = db.collection('users');
        this.passwordsCollection = db.collection('passwords');
        this.activityCollection = db.collection('activity');
    }

    // ==================== USER OPERATIONS ====================

    async createUser(username, email, hashedPassword) {
        const userDoc = {
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
            createdAt: new Date().toISOString(),
            lastLogin: null
        };

        const docRef = await this.usersCollection.add(userDoc);
        return { id: docRef.id, ...userDoc };
    }

    async getUserByEmail(email) {
        const snapshot = await this.usersCollection
            .where('email', '==', email.toLowerCase())
            .limit(1)
            .get();

        if (snapshot.empty) return null;
        
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    }

    async getUserByUsername(username) {
        const snapshot = await this.usersCollection
            .where('username', '==', username)
            .limit(1)
            .get();

        if (snapshot.empty) return null;
        
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    }

    async getUserById(id) {
        const doc = await this.usersCollection.doc(id).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() };
    }

    async updateUserLogin(userId) {
        await this.usersCollection.doc(userId).update({
            lastLogin: new Date().toISOString()
        });
    }

    // ==================== PASSWORD OPERATIONS ====================

    async addPassword(userId, passwordData) {
        const docData = {
            userId,
            websiteName: passwordData.websiteName,
            username: passwordData.username,
            encryptedPassword: passwordData.encryptedPassword,
            iv: passwordData.iv || '',
            url: passwordData.url || '',
            notes: passwordData.notes || '',
            category: passwordData.category || 'General',
            isFavorite: false,
            passwordStrength: passwordData.passwordStrength || 'medium',
            expiryDate: passwordData.expiryDate || null,
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };

        const docRef = await this.passwordsCollection.add(docData);
        return { id: docRef.id, ...docData };
    }

    async getPassword(userId, id) {
        const doc = await this.passwordsCollection.doc(id).get();
        if (!doc.exists) return null;
        
        const data = doc.data();
        if (data.userId !== userId) return null;
        
        return { id: doc.id, ...data };
    }

    async getPasswordByWebsite(userId, websiteName) {
        const snapshot = await this.passwordsCollection
            .where('userId', '==', userId)
            .where('websiteName', '==', websiteName)
            .limit(1)
            .get();

        if (snapshot.empty) return null;
        
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    }

    async getAllPasswords(userId) {
        const snapshot = await this.passwordsCollection
            .where('userId', '==', userId)
            .orderBy('websiteName')
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async searchPasswords(userId, searchQuery) {
        // Firestore doesn't support LIKE queries, so we get all and filter
        const all = await this.getAllPasswords(userId);
        const query = searchQuery.toLowerCase();
        
        return all.filter(p => 
            p.websiteName?.toLowerCase().includes(query) ||
            p.username?.toLowerCase().includes(query) ||
            p.url?.toLowerCase().includes(query) ||
            p.category?.toLowerCase().includes(query)
        );
    }

    async updatePassword(userId, id, passwordData) {
        const doc = await this.passwordsCollection.doc(id).get();
        if (!doc.exists || doc.data().userId !== userId) return null;

        const updateData = { lastModified: new Date().toISOString() };

        if (passwordData.websiteName !== undefined) updateData.websiteName = passwordData.websiteName;
        if (passwordData.username !== undefined) updateData.username = passwordData.username;
        if (passwordData.encryptedPassword !== undefined) updateData.encryptedPassword = passwordData.encryptedPassword;
        if (passwordData.iv !== undefined) updateData.iv = passwordData.iv;
        if (passwordData.url !== undefined) updateData.url = passwordData.url;
        if (passwordData.notes !== undefined) updateData.notes = passwordData.notes;
        if (passwordData.category !== undefined) updateData.category = passwordData.category;
        if (passwordData.isFavorite !== undefined) updateData.isFavorite = passwordData.isFavorite;
        if (passwordData.passwordStrength !== undefined) updateData.passwordStrength = passwordData.passwordStrength;
        if (passwordData.expiryDate !== undefined) updateData.expiryDate = passwordData.expiryDate;

        await this.passwordsCollection.doc(id).update(updateData);
        return this.getPassword(userId, id);
    }

    async deletePassword(userId, id) {
        const doc = await this.passwordsCollection.doc(id).get();
        if (!doc.exists || doc.data().userId !== userId) return false;
        
        await this.passwordsCollection.doc(id).delete();
        return true;
    }

    async toggleFavorite(userId, id) {
        const password = await this.getPassword(userId, id);
        if (!password) return null;

        await this.passwordsCollection.doc(id).update({
            isFavorite: !password.isFavorite,
            lastModified: new Date().toISOString()
        });

        return this.getPassword(userId, id);
    }

    async getPasswordsByCategory(userId, category) {
        const snapshot = await this.passwordsCollection
            .where('userId', '==', userId)
            .where('category', '==', category)
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async getFavorites(userId) {
        const snapshot = await this.passwordsCollection
            .where('userId', '==', userId)
            .where('isFavorite', '==', true)
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async getExpiringPasswords(userId, days = 30) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);

        const all = await this.getAllPasswords(userId);
        return all.filter(p => {
            if (!p.expiryDate) return false;
            const expiry = new Date(p.expiryDate);
            return expiry <= futureDate && expiry >= new Date();
        });
    }

    // ==================== ACTIVITY LOG ====================

    async logActivity(userId, action, details = {}) {
        await this.activityCollection.add({
            userId,
            action,
            details,
            timestamp: new Date().toISOString()
        });
    }

    async getRecentActivity(userId, limit = 20) {
        const snapshot = await this.activityCollection
            .where('userId', '==', userId)
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // ==================== STATISTICS ====================

    async getStats(userId) {
        const passwords = await this.getAllPasswords(userId);
        
        const stats = {
            totalPasswords: passwords.length,
            favoriteCount: passwords.filter(p => p.isFavorite).length,
            weakPasswords: passwords.filter(p => p.passwordStrength === 'weak' || p.passwordStrength === 'very-weak').length,
            strongPasswords: passwords.filter(p => p.passwordStrength === 'strong' || p.passwordStrength === 'very-strong').length,
            expiringCount: 0,
            categories: {},
            strengthDistribution: {
                'very-strong': 0,
                'strong': 0,
                'medium': 0,
                'weak': 0,
                'very-weak': 0
            }
        };

        // Count expiring and strength distribution
        const now = new Date();
        const thirtyDays = new Date();
        thirtyDays.setDate(thirtyDays.getDate() + 30);

        passwords.forEach(p => {
            if (p.expiryDate) {
                const expiry = new Date(p.expiryDate);
                if (expiry <= thirtyDays && expiry >= now) {
                    stats.expiringCount++;
                }
            }
            
            // Count categories
            const cat = p.category || 'General';
            stats.categories[cat] = (stats.categories[cat] || 0) + 1;
            
            // Count strength distribution
            const strength = p.passwordStrength || 'medium';
            if (stats.strengthDistribution[strength] !== undefined) {
                stats.strengthDistribution[strength]++;
            }
        });

        return stats;
    }

    async getCategories(userId) {
        const passwords = await this.getAllPasswords(userId);
        const categories = {};
        
        passwords.forEach(p => {
            const cat = p.category || 'General';
            categories[cat] = (categories[cat] || 0) + 1;
        });

        return Object.entries(categories).map(([name, count]) => ({ name, count }));
    }
}

module.exports = new FirestoreDatabase();
