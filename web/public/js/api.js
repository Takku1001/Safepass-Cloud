/**
 * SafePass Cloud - API Service
 * Handles all API communication with the backend
 */

const API_BASE = '/api';

class ApiService {
    constructor() {
        this.sessionId = localStorage.getItem('sessionId');
    }

    // Generic request method
    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.sessionId) {
            headers['x-session-id'] = this.sessionId;
        }

        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Set session
    setSession(sessionId) {
        this.sessionId = sessionId;
        if (sessionId) {
            localStorage.setItem('sessionId', sessionId);
        } else {
            localStorage.removeItem('sessionId');
        }
    }

    // Clear session
    clearSession() {
        this.sessionId = null;
        localStorage.removeItem('sessionId');
    }

    // ==================== Auth ====================
    
    async register(username, masterPassword) {
        const data = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, masterPassword })
        });
        this.setSession(data.sessionId);
        return data;
    }

    async login(username, masterPassword) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, masterPassword })
        });
        this.setSession(data.sessionId);
        return data;
    }

    async logout() {
        try {
            await this.request('/auth/logout', { method: 'POST' });
        } finally {
            this.clearSession();
        }
    }

    async verifySession() {
        if (!this.sessionId) return null;
        try {
            return await this.request('/auth/verify');
        } catch {
            this.clearSession();
            return null;
        }
    }

    // ==================== Passwords ====================
    
    async getPasswords() {
        return this.request('/passwords');
    }

    async getPassword(id) {
        return this.request(`/passwords/${id}`);
    }

    async searchPasswords(query) {
        return this.request(`/passwords/search?q=${encodeURIComponent(query)}`);
    }

    async addPassword(passwordData) {
        return this.request('/passwords', {
            method: 'POST',
            body: JSON.stringify(passwordData)
        });
    }

    async updatePassword(id, passwordData) {
        return this.request(`/passwords/${id}`, {
            method: 'PUT',
            body: JSON.stringify(passwordData)
        });
    }

    async deletePassword(id) {
        return this.request(`/passwords/${id}`, {
            method: 'DELETE'
        });
    }

    async toggleFavorite(id) {
        return this.request(`/passwords/${id}/favorite`, {
            method: 'POST'
        });
    }

    // ==================== Generator ====================
    
    async generatePassword(options = {}) {
        return this.request('/generate', {
            method: 'POST',
            body: JSON.stringify(options)
        });
    }

    async checkStrength(password) {
        return this.request('/check-strength', {
            method: 'POST',
            body: JSON.stringify({ password })
        });
    }

    // ==================== Dashboard ====================
    
    async getStats() {
        return this.request('/dashboard/stats');
    }

    async getExpiring(days = 30) {
        return this.request(`/dashboard/expiring?days=${days}`);
    }

    async getDuplicates() {
        return this.request('/dashboard/duplicates');
    }

    async getWeakPasswords() {
        return this.request('/dashboard/weak');
    }

    // ==================== Activity ====================
    
    async getActivity(limit = 50) {
        return this.request(`/activity?limit=${limit}`);
    }

    // ==================== Clipboard ====================
    
    async recordCopy(websiteName, username, field) {
        return this.request('/clipboard/copy', {
            method: 'POST',
            body: JSON.stringify({ websiteName, username, field })
        });
    }

    async getClipboardHistory() {
        return this.request('/clipboard/history');
    }

    async clearClipboardHistory() {
        return this.request('/clipboard/history', {
            method: 'DELETE'
        });
    }

    // ==================== Categories ====================
    
    async getCategories() {
        return this.request('/categories');
    }

    // ==================== Sync ====================
    
    async exportVault() {
        return this.request('/sync/export');
    }

    async importVault(data) {
        return this.request('/sync/import', {
            method: 'POST',
            body: JSON.stringify({ data })
        });
    }
}

// Create global instance
const api = new ApiService();
