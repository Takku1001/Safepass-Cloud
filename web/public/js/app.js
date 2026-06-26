/**
 * SafePass Cloud - Main Application
 * Handles UI interactions and state management
 */

class SafePassApp {
    constructor() {
        this.currentUser = null;
        this.passwords = [];
        this.currentView = 'dashboard';
        this.currentPasswordId = null;
        this.searchTimeout = null;
        
        this.init();
    }

    async init() {
        // Reset all UI state first
        this.resetAppState();
        
        // Check for existing session
        const session = await api.verifySession();
        
        if (session && session.valid) {
            this.currentUser = session.user;
            this.showApp();
            await this.loadData();
        } else {
            this.showAuth();
        }

        this.hideLoader();
        this.setupEventListeners();
    }

    resetAppState() {
        // Reset all form fields and UI state
        this.currentView = 'dashboard';
        this.currentPasswordId = null;
        this.passwords = [];
        
        // Reset all forms
        document.querySelectorAll('form').forEach(form => form.reset());
        
        // Reset password generator
        const genLengthSlider = document.getElementById('gen-length');
        const genLengthValue = document.getElementById('gen-length-value');
        if (genLengthSlider) {
            genLengthSlider.value = 16;
            if (genLengthValue) genLengthValue.textContent = '16';
        }
        
        // Clear generated password field
        const generatedPassword = document.getElementById('generated-password');
        if (generatedPassword) generatedPassword.value = '';
        
        // Reset generator checkboxes to defaults
        const checkboxDefaults = {
            'gen-uppercase': true,
            'gen-lowercase': true,
            'gen-numbers': true,
            'gen-symbols': true
        };
        Object.entries(checkboxDefaults).forEach(([id, checked]) => {
            const el = document.getElementById(id);
            if (el) el.checked = checked;
        });
        
        // Reset strength meters
        document.querySelectorAll('.strength-bar').forEach(el => {
            el.className = 'strength-bar';
        });
        document.querySelectorAll('.strength-text').forEach(el => {
            el.textContent = '';
        });
        
        // Close all modals
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
        
        // Reset search
        const searchInput = document.getElementById('global-search');
        if (searchInput) searchInput.value = '';
        const searchSuggestions = document.getElementById('search-suggestions');
        if (searchSuggestions) searchSuggestions.classList.add('hidden');
        
        // Reset to dashboard view
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.view === 'dashboard') {
                item.classList.add('active');
            }
        });
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        const dashboardView = document.getElementById('dashboard-view');
        if (dashboardView) dashboardView.classList.add('active');
    }

    hideLoader() {
        document.getElementById('loader').classList.add('hidden');
    }

    showAuth() {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
        
        // Clear all auth form fields
        document.getElementById('login-form').reset();
        document.getElementById('register-form').reset();
        document.getElementById('register-strength').className = 'strength-bar';
        document.getElementById('register-strength-text').textContent = '';
    }

    showApp() {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('user-display-name').textContent = this.currentUser.username;
    }

    // ==================== Event Listeners ====================
    
    setupEventListeners() {
        // Auth tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchAuthTab(e.target.dataset.tab));
        });

        // Auth forms
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('register-form').addEventListener('submit', (e) => this.handleRegister(e));

        // Password visibility toggles
        document.querySelectorAll('.toggle-password').forEach(btn => {
            btn.addEventListener('click', (e) => this.togglePasswordVisibility(e));
        });

        // Register password strength
        document.getElementById('register-password').addEventListener('input', (e) => {
            this.updateStrengthMeter(e.target.value, 'register-strength', 'register-strength-text');
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchView(e.currentTarget.dataset.view);
            });
        });

        // Global search
        document.getElementById('global-search').addEventListener('input', (e) => this.handleSearch(e));
        document.getElementById('global-search').addEventListener('focus', () => {
            const suggestions = document.getElementById('search-suggestions');
            if (suggestions.children.length > 0) {
                suggestions.classList.remove('hidden');
            }
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                document.getElementById('search-suggestions').classList.add('hidden');
            }
        });

        // Add password button
        document.getElementById('add-password-btn').addEventListener('click', () => this.openPasswordModal());

        // Password modal
        document.getElementById('password-form').addEventListener('submit', (e) => this.handleSavePassword(e));
        document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });

        // Password strength in modal
        document.getElementById('password-password').addEventListener('input', (e) => {
            this.updateStrengthMeter(e.target.value, 'modal-strength', 'modal-strength-text');
        });

        // Generate password for form
        document.getElementById('generate-for-form').addEventListener('click', () => this.generateForForm());

        // Generator page
        document.getElementById('generate-btn').addEventListener('click', () => this.generatePassword());
        document.getElementById('regenerate-btn').addEventListener('click', () => this.generatePassword());
        document.getElementById('copy-generated').addEventListener('click', () => this.copyGenerated());
        document.getElementById('password-length').addEventListener('input', (e) => {
            document.getElementById('length-value').textContent = e.target.value;
        });

        // View toggle
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleViewType(e.currentTarget.dataset.viewType));
        });

        // Category filter
        document.getElementById('category-filter').addEventListener('change', () => this.filterPasswords());
        document.getElementById('sort-filter').addEventListener('change', () => this.filterPasswords());

        // Security tabs
        document.querySelectorAll('.security-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchSecurityTab(e.currentTarget.dataset.securityTab));
        });

        // View password modal
        document.getElementById('edit-from-view').addEventListener('click', () => this.editFromView());
        document.getElementById('delete-from-view').addEventListener('click', () => this.deleteFromView());
        document.querySelector('.toggle-view-password').addEventListener('click', () => this.toggleViewPassword());
        
        // Use event delegation for copy buttons
        document.getElementById('view-password-modal').addEventListener('click', (e) => {
            if (e.target.closest('.copy-btn')) {
                const field = e.target.closest('.copy-btn').dataset.field;
                this.copyField(field);
            }
        });

        // Sync button
        document.getElementById('sync-btn').addEventListener('click', () => this.syncVault());

        // Close modals on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModals();
        });

        // Close modals on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModals();
            });
        });
    }

    // ==================== Authentication ====================
    
    switchAuthTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.toggle('active', form.id === `${tab}-form`);
            form.reset(); // Clear form when switching tabs
        });
        
        // Reset strength meter
        document.getElementById('register-strength').className = 'strength-bar';
        document.getElementById('register-strength-text').textContent = '';
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            const result = await api.login(username, password);
            this.currentUser = result.user;
            this.showApp();
            await this.loadData();
            this.showToast('Welcome back!', 'success');
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;

        if (password !== confirm) {
            this.showToast('Passwords do not match', 'error');
            return;
        }

        try {
            const result = await api.register(username, password);
            this.currentUser = result.user;
            this.showApp();
            await this.loadData();
            this.showToast('Account created successfully!', 'success');
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    async handleLogout() {
        try {
            await api.logout();
        } finally {
            this.currentUser = null;
            this.resetAppState();
            this.showAuth();
            this.showToast('Logged out successfully', 'info');
        }
    }

    // ==================== Data Loading ====================
    
    async loadData() {
        try {
            const [passwordsData, statsData, categoriesData, expiringData] = await Promise.all([
                api.getPasswords(),
                api.getStats(),
                api.getCategories(),
                api.getExpiring(30)
            ]);

            this.passwords = passwordsData.passwords || [];
            this.updateDashboard(statsData, expiringData.expiring || []);
            this.updateCategories(categoriesData.categories || []);
            this.renderPasswords();
        } catch (error) {
            console.error('Failed to load data:', error);
            this.showToast('Failed to load data', 'error');
        }
    }

    // ==================== Navigation ====================
    
    switchView(view) {
        this.currentView = view;
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === view);
        });
        
        document.querySelectorAll('.view').forEach(v => {
            v.classList.toggle('active', v.id === `${view}-view`);
        });

        // Load view-specific data
        if (view === 'security') {
            this.loadSecurityData('weak');
        } else if (view === 'activity') {
            this.loadActivityLog();
        }
    }

    // ==================== Dashboard ====================
    
    updateDashboard(stats, expiringPasswords = []) {
        console.log('Updating dashboard with stats:', stats);
        
        // Update expiring soon list in dashboard
        this.renderDashboardExpiring(expiringPasswords);
        
        // Update stat cards
        document.getElementById('stat-total').textContent = stats.totalPasswords || 0;
        
        const strongCount = (stats.strengthDistribution?.['very-strong'] || 0) + 
                           (stats.strengthDistribution?.['strong'] || 0);
        document.getElementById('stat-strong').textContent = strongCount;
        
        const weakCount = (stats.strengthDistribution?.['weak'] || 0) + 
                         (stats.strengthDistribution?.['very-weak'] || 0);
        document.getElementById('stat-weak').textContent = weakCount;
        
        const duplicateCount = stats.duplicateCount || 0;
        console.log('Setting duplicate count to:', duplicateCount);
        document.getElementById('stat-duplicates').textContent = duplicateCount;

        // Update strength chart
        const total = stats.totalPasswords || 1;
        const dist = stats.strengthDistribution || {};
        
        ['very-strong', 'strong', 'medium', 'weak', 'very-weak'].forEach(strength => {
            const count = dist[strength] || 0;
            const percentage = (count / total) * 100;
            document.getElementById(`bar-${strength}`).style.width = `${percentage}%`;
            document.getElementById(`count-${strength}`).textContent = count;
        });

        // Update recent activity
        this.renderRecentActivity(stats.recentActivity || []);
    }

    renderDashboardExpiring(entries) {
        const container = document.getElementById('expiring-list');
        
        if (!entries || entries.length === 0) {
            container.innerHTML = '<p class="empty-message">No passwords expiring soon</p>';
            return;
        }

        // Sort by days until expiry (soonest first)
        const sorted = [...entries].sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
        
        container.innerHTML = sorted.slice(0, 5).map(entry => `
            <div class="expiry-item" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; border-radius: 8px; background: var(--bg-secondary); margin-bottom: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="width: 36px; height: 36px; border-radius: 8px; background: ${entry.daysUntilExpiry <= 7 ? 'var(--danger)' : 'var(--warning)'}; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-clock" style="color: white;"></i>
                    </div>
                    <div>
                        <strong style="display: block;">${this.escapeHtml(entry.websiteName)}</strong>
                        <small style="color: ${entry.daysUntilExpiry <= 7 ? 'var(--danger)' : 'var(--warning)'};">
                            ${entry.daysUntilExpiry <= 0 ? 'EXPIRED' : `Expires in ${entry.daysUntilExpiry} days`}
                        </small>
                    </div>
                </div>
                <button class="btn btn-outline btn-sm" onclick="app.openPasswordModal('${entry.passwordId}')">
                    Update
                </button>
            </div>
        `).join('');
    }

    renderRecentActivity(activities) {
        const container = document.getElementById('recent-activity');
        
        if (activities.length === 0) {
            container.innerHTML = '<p class="empty-message">No recent activity</p>';
            return;
        }

        container.innerHTML = activities.map(activity => {
            const data = activity.data || activity;
            const icon = this.getActivityIcon(data.action);
            const time = this.formatTime(data.timestamp || data.created_at);
            const details = typeof data.details === 'string' ? JSON.parse(data.details || '{}') : (data.details || {});
            
            return `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="${icon}"></i>
                    </div>
                    <div class="activity-info">
                        <strong>${this.formatAction(data.action)}</strong>
                        <span>${details.websiteName || ''}</span>
                    </div>
                    <span class="activity-time">${time}</span>
                </div>
            `;
        }).join('');
    }

    // ==================== Passwords ====================
    
    renderPasswords() {
        const container = document.getElementById('passwords-container');
        
        if (this.passwords.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                    <i class="fas fa-vault" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                    <h3>No passwords yet</h3>
                    <p style="color: var(--text-muted); margin-bottom: 1rem;">Add your first password to get started</p>
                    <button class="btn btn-primary" onclick="app.openPasswordModal()">
                        <i class="fas fa-plus"></i> Add Password
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.passwords.map(pwd => `
            <div class="password-card" data-id="${pwd.id}" onclick="app.viewPassword('${pwd.id}')">
                <div class="password-card-header">
                    <div class="password-card-title">
                        <div class="password-card-icon">
                            <i class="fas fa-globe"></i>
                        </div>
                        <div class="password-card-info">
                            <h4>${this.escapeHtml(pwd.websiteName)}</h4>
                            <span>${this.escapeHtml(pwd.username)}</span>
                        </div>
                    </div>
                    <div class="password-card-actions">
                        <button class="btn btn-icon" onclick="event.stopPropagation(); app.copyPasswordToClipboard('${pwd.id}')" title="Copy password">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn btn-icon" onclick="event.stopPropagation(); app.toggleFavorite('${pwd.id}')" title="${pwd.isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                            <i class="fas fa-star" style="color: ${pwd.isFavorite ? 'var(--warning)' : 'inherit'}"></i>
                        </button>
                    </div>
                </div>
                <div class="password-card-meta">
                    <span class="password-category">${this.escapeHtml(pwd.category || 'General')}</span>
                    <span class="password-strength ${pwd.passwordStrength || 'medium'}">${this.formatStrength(pwd.passwordStrength)}</span>
                </div>
            </div>
        `).join('');
    }

    filterPasswords() {
        const category = document.getElementById('category-filter').value;
        const sort = document.getElementById('sort-filter').value;

        let filtered = [...this.passwords];

        if (category) {
            filtered = filtered.filter(p => p.category === category);
        }

        switch (sort) {
            case 'name':
                filtered.sort((a, b) => a.websiteName.localeCompare(b.websiteName));
                break;
            case 'date':
                filtered.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
                break;
            case 'strength':
                const order = { 'very-weak': 0, 'weak': 1, 'medium': 2, 'strong': 3, 'very-strong': 4 };
                filtered.sort((a, b) => (order[b.passwordStrength] || 2) - (order[a.passwordStrength] || 2));
                break;
        }

        const temp = this.passwords;
        this.passwords = filtered;
        this.renderPasswords();
        this.passwords = temp;
    }

    updateCategories(categories) {
        const select = document.getElementById('category-filter');
        const currentValue = select.value;
        
        select.innerHTML = '<option value="">All Categories</option>' +
            categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        
        select.value = currentValue;
    }

    toggleViewType(type) {
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.viewType === type);
        });
        
        const container = document.getElementById('passwords-container');
        container.className = type === 'list' ? 'passwords-list' : 'passwords-grid';
    }

    // ==================== Search ====================
    
    async handleSearch(e) {
        const query = e.target.value.trim();
        const suggestions = document.getElementById('search-suggestions');

        if (query.length < 2) {
            suggestions.classList.add('hidden');
            return;
        }

        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(async () => {
            try {
                const result = await api.searchPasswords(query);
                this.renderSearchSuggestions(result.suggestions || []);
            } catch (error) {
                console.error('Search error:', error);
            }
        }, 300);
    }

    renderSearchSuggestions(suggestions) {
        const container = document.getElementById('search-suggestions');
        
        if (suggestions.length === 0) {
            container.classList.add('hidden');
            return;
        }

        container.innerHTML = suggestions.map(s => `
            <div class="suggestion-item" onclick="app.selectSuggestion('${this.escapeHtml(s.website)}')">
                <span>${this.escapeHtml(s.website)}</span>
            </div>
        `).join('');
        
        container.classList.remove('hidden');
    }

    selectSuggestion(website) {
        const password = this.passwords.find(p => p.websiteName === website);
        if (password) {
            this.viewPassword(password.id);
        }
        document.getElementById('search-suggestions').classList.add('hidden');
        document.getElementById('global-search').value = '';
    }

    // ==================== Password Modal ====================
    
    openPasswordModal(passwordId = null) {
        const modal = document.getElementById('password-modal');
        const title = document.getElementById('modal-title');
        const form = document.getElementById('password-form');
        
        form.reset();
        document.getElementById('password-id').value = '';
        
        if (passwordId) {
            title.textContent = 'Edit Password';
            const pwd = this.passwords.find(p => p.id === passwordId);
            if (pwd) {
                document.getElementById('password-id').value = pwd.id;
                document.getElementById('password-website').value = pwd.websiteName || '';
                document.getElementById('password-url').value = pwd.url || '';
                document.getElementById('password-username').value = pwd.username || '';
                document.getElementById('password-category').value = pwd.category || 'General';
                document.getElementById('password-password').value = pwd.password || '';
                document.getElementById('password-notes').value = pwd.notes || '';
                
                if (pwd.password) {
                    this.updateStrengthMeter(pwd.password, 'modal-strength', 'modal-strength-text');
                }
            }
        } else {
            title.textContent = 'Add New Password';
        }
        
        modal.classList.remove('hidden');
    }

    async handleSavePassword(e) {
        e.preventDefault();
        
        const idValue = document.getElementById('password-id').value;
        const id = idValue || null; // Keep as string for Firebase compatibility
        const data = {
            websiteName: document.getElementById('password-website').value,
            username: document.getElementById('password-username').value,
            password: document.getElementById('password-password').value,
            url: document.getElementById('password-url').value,
            category: document.getElementById('password-category').value,
            notes: document.getElementById('password-notes').value,
            expiryDays: document.getElementById('password-expiry').value || null
        };

        try {
            if (id) {
                await api.updatePassword(id, data);
                this.showToast('Password updated', 'success');
            } else {
                await api.addPassword(data);
                this.showToast('Password added', 'success');
            }
            
            this.closeModals();
            await this.loadData();
        } catch (error) {
            this.showToast(error.message || 'Failed to save password', 'error');
        }
    }

    async generateForForm() {
        try {
            const result = await api.generatePassword({
                length: 16,
                includeUppercase: true,
                includeLowercase: true,
                includeNumbers: true,
                includeSymbols: true
            });
            
            document.getElementById('password-password').value = result.password;
            this.updateStrengthMeter(result.password, 'modal-strength', 'modal-strength-text');
            this.showToast('Password generated!', 'success');
        } catch (error) {
            this.showToast('Failed to generate password', 'error');
        }
    }

    // ==================== View Password ====================
    
    async viewPassword(id) {
        this.currentPasswordId = id;
        const pwd = this.passwords.find(p => p.id === id);
        
        if (!pwd) return;

        document.getElementById('view-website').textContent = pwd.websiteName;
        document.getElementById('view-username').textContent = pwd.username;
        document.getElementById('view-password').textContent = '••••••••••••';
        document.getElementById('view-password').dataset.password = pwd.password;
        document.getElementById('view-category').textContent = pwd.category || 'General';
        
        const strengthEl = document.getElementById('view-strength');
        strengthEl.textContent = this.formatStrength(pwd.passwordStrength);
        strengthEl.className = `detail-value strength-badge password-strength ${pwd.passwordStrength || 'medium'}`;
        
        const notesRow = document.getElementById('view-notes-row');
        if (pwd.notes) {
            notesRow.style.display = 'flex';
            document.getElementById('view-notes').textContent = pwd.notes;
        } else {
            notesRow.style.display = 'none';
        }

        document.getElementById('view-password-modal').classList.remove('hidden');
    }

    toggleViewPassword() {
        const el = document.getElementById('view-password');
        const icon = document.querySelector('.toggle-view-password i');
        
        if (el.classList.contains('password-hidden')) {
            el.textContent = el.dataset.password;
            el.classList.remove('password-hidden');
            icon.className = 'fas fa-eye-slash';
        } else {
            el.textContent = '••••••••••••';
            el.classList.add('password-hidden');
            icon.className = 'fas fa-eye';
        }
    }

    editFromView() {
        this.closeModals();
        this.openPasswordModal(this.currentPasswordId);
    }

    async deleteFromView() {
        if (!confirm('Are you sure you want to delete this password?')) return;
        
        try {
            await api.deletePassword(this.currentPasswordId);
            this.closeModals();
            await this.loadData();
            this.showToast('Password deleted', 'success');
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    async copyField(field) {
        const pwd = this.passwords.find(p => p.id === this.currentPasswordId);
        if (!pwd) return;

        const value = field === 'password' ? pwd.password : pwd.username;
        
        try {
            await navigator.clipboard.writeText(value);
            await api.recordCopy(pwd.websiteName, pwd.username, field);
            this.showToast(`${field === 'password' ? 'Password' : 'Username'} copied!`, 'success');
        } catch (error) {
            this.showToast('Failed to copy', 'error');
        }
    }

    async copyPasswordToClipboard(id) {
        const pwd = this.passwords.find(p => p.id === id);
        if (!pwd) return;

        try {
            await navigator.clipboard.writeText(pwd.password);
            await api.recordCopy(pwd.websiteName, pwd.username, 'password');
            this.showToast('Password copied!', 'success');
        } catch (error) {
            this.showToast('Failed to copy', 'error');
        }
    }

    async toggleFavorite(id) {
        try {
            await api.toggleFavorite(id);
            await this.loadData();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    // ==================== Generator ====================
    
    async generatePassword() {
        const length = parseInt(document.getElementById('password-length').value);
        const options = {
            length,
            includeUppercase: document.getElementById('include-uppercase').checked,
            includeLowercase: document.getElementById('include-lowercase').checked,
            includeNumbers: document.getElementById('include-numbers').checked,
            includeSymbols: document.getElementById('include-symbols').checked,
            excludeAmbiguous: document.getElementById('exclude-ambiguous').checked
        };

        try {
            const result = await api.generatePassword(options);
            document.getElementById('generated-password').value = result.password;
            this.updateStrengthMeter(result.password, 'generator-strength', 'generator-strength-text');
            this.showToast('Password generated!', 'success');
        } catch (error) {
            this.showToast('Failed to generate password', 'error');
        }
    }

    async copyGenerated() {
        const password = document.getElementById('generated-password').value;
        if (!password) return;

        try {
            await navigator.clipboard.writeText(password);
            this.showToast('Password copied!', 'success');
        } catch (error) {
            this.showToast('Failed to copy', 'error');
        }
    }

    // ==================== Security ====================
    
    async loadSecurityData(tab) {
        const container = document.getElementById('security-content');
        
        try {
            let data;
            switch (tab) {
                case 'weak':
                    data = await api.getWeakPasswords();
                    this.renderWeakPasswords(data.weak || []);
                    break;
                case 'duplicates':
                    data = await api.getDuplicates();
                    this.renderDuplicates(data.duplicates || []);
                    break;
                case 'expiring':
                    data = await api.getExpiring(30);
                    this.renderExpiring(data.expiring || []);
                    break;
            }
        } catch (error) {
            container.innerHTML = '<p class="empty-message">Failed to load data</p>';
        }
    }

    switchSecurityTab(tab) {
        document.querySelectorAll('.security-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.securityTab === tab);
        });
        this.loadSecurityData(tab);
    }

    renderWeakPasswords(passwords) {
        const container = document.getElementById('security-content');
        
        if (passwords.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 3rem;">
                    <i class="fas fa-shield-check" style="font-size: 3rem; color: var(--success); margin-bottom: 1rem;"></i>
                    <h3>All passwords are strong!</h3>
                    <p style="color: var(--text-muted);">Great job maintaining password security</p>
                </div>
            `;
            return;
        }

        container.innerHTML = passwords.map(pwd => `
            <div class="security-item">
                <div class="security-item-icon warning">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="security-item-info">
                    <h4>${this.escapeHtml(pwd.websiteName)}</h4>
                    <p>Password strength: ${this.formatStrength(pwd.passwordStrength)}</p>
                </div>
                <button class="btn btn-outline btn-sm" onclick="app.openPasswordModal('${pwd.id}')">
                    Update
                </button>
            </div>
        `).join('');
    }

    renderDuplicates(duplicates) {
        const container = document.getElementById('security-content');
        
        if (duplicates.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 3rem;">
                    <i class="fas fa-fingerprint" style="font-size: 3rem; color: var(--success); margin-bottom: 1rem;"></i>
                    <h3>No duplicate passwords!</h3>
                    <p style="color: var(--text-muted);">Each account has a unique password</p>
                </div>
            `;
            return;
        }

        container.innerHTML = duplicates.map(group => `
            <div class="security-item">
                <div class="security-item-icon danger">
                    <i class="fas fa-copy"></i>
                </div>
                <div class="security-item-info">
                    <h4>${group.count} accounts share the same password</h4>
                    <p>${group.websites.map(w => this.escapeHtml(w)).join(', ')}</p>
                </div>
            </div>
        `).join('');
    }

    renderExpiring(entries) {
        const container = document.getElementById('security-content');
        
        if (entries.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 3rem;">
                    <i class="fas fa-calendar-check" style="font-size: 3rem; color: var(--success); margin-bottom: 1rem;"></i>
                    <h3>No passwords expiring soon!</h3>
                    <p style="color: var(--text-muted);">All your passwords are up to date</p>
                </div>
            `;
            return;
        }

        container.innerHTML = entries.map(entry => `
            <div class="security-item">
                <div class="security-item-icon ${entry.daysUntilExpiry <= 7 ? 'danger' : 'warning'}">
                    <i class="fas fa-clock"></i>
                </div>
                <div class="security-item-info">
                    <h4>${this.escapeHtml(entry.websiteName)}</h4>
                    <p>Expires in ${entry.daysUntilExpiry} days</p>
                </div>
                <button class="btn btn-outline btn-sm" onclick="app.openPasswordModal('${entry.passwordId}')">
                    Update
                </button>
            </div>
        `).join('');
    }

    // ==================== Activity ====================
    
    async loadActivityLog() {
        const container = document.getElementById('activity-log-container');
        
        try {
            const data = await api.getActivity(50);
            console.log('Activity data received:', data);
            const activitiesRaw = data.activity || data.activities || [];
            console.log('Activities array:', activitiesRaw);
            
            // Parse queue node structure: {data: {action, details}, timestamp}
            const activities = activitiesRaw.map(item => {
                if (item.data) {
                    // Queue node format
                    return {
                        action: item.data.action || item.data,
                        details: item.data.details || {},
                        timestamp: item.timestamp
                    };
                }
                // Already in correct format
                return item;
            });
            
            if (activities.length === 0) {
                container.innerHTML = '<p class="empty-message">No activity recorded</p>';
                return;
            }

            container.innerHTML = activities.map(activity => {
                const details = typeof activity.details === 'string' 
                    ? JSON.parse(activity.details) 
                    : (activity.details || {});
                const icon = this.getActivityIcon(activity.action);
                const time = this.formatTime(activity.timestamp || activity.createdAt || activity.created_at);
                
                return `
                    <div class="activity-item">
                        <div class="activity-icon">
                            <i class="${icon}"></i>
                        </div>
                        <div class="activity-info">
                            <strong>${this.formatAction(activity.action)}</strong>
                            <span>${details?.website || details?.websiteName || ''}</span>
                        </div>
                        <span class="activity-time">${time}</span>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Activity log error:', error);
            container.innerHTML = `<p class="empty-message">Failed to load activity: ${error.message}</p>`;
        }
    }

    // ==================== Sync ====================
    
    async syncVault() {
        try {
            const data = await api.exportVault();
            this.showToast('Vault exported successfully', 'success');
            
            // In a real app, this would sync to cloud
            console.log('Export data:', data);
        } catch (error) {
            this.showToast('Sync failed', 'error');
        }
    }

    // ==================== Utilities ====================
    
    closeModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    }

    togglePasswordVisibility(e) {
        const btn = e.currentTarget;
        const input = btn.parentElement.querySelector('input');
        const icon = btn.querySelector('i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    }

    async updateStrengthMeter(password, barId, textId) {
        if (!password) {
            document.getElementById(barId).className = 'strength-bar';
            document.getElementById(textId).textContent = '';
            return;
        }

        try {
            const result = await api.checkStrength(password);
            document.getElementById(barId).className = `strength-bar ${result.strength}`;
            document.getElementById(textId).textContent = this.formatStrength(result.strength);
        } catch (error) {
            console.error('Strength check failed:', error);
        }
    }

    formatStrength(strength) {
        const labels = {
            'very-weak': 'Very Weak',
            'weak': 'Weak',
            'medium': 'Medium',
            'strong': 'Strong',
            'very-strong': 'Very Strong'
        };
        return labels[strength] || 'Unknown';
    }

    formatAction(action) {
        const labels = {
            'LOGIN_SUCCESS': 'Logged in',
            'LOGOUT': 'Logged out',
            'PASSWORD_ADDED': 'Password added',
            'PASSWORD_UPDATED': 'Password updated',
            'PASSWORD_DELETED': 'Password deleted',
            'PASSWORD_VIEWED': 'Password viewed',
            'PASSWORD_COPIED': 'Password copied',
            'VAULT_LOADED': 'Vault loaded',
            'VAULT_EXPORTED': 'Vault exported',
            'USER_REGISTERED': 'Account created'
        };
        return labels[action] || action;
    }

    getActivityIcon(action) {
        const icons = {
            'LOGIN_SUCCESS': 'fas fa-sign-in-alt',
            'LOGOUT': 'fas fa-sign-out-alt',
            'PASSWORD_ADDED': 'fas fa-plus',
            'PASSWORD_UPDATED': 'fas fa-edit',
            'PASSWORD_DELETED': 'fas fa-trash',
            'PASSWORD_VIEWED': 'fas fa-eye',
            'PASSWORD_COPIED': 'fas fa-copy',
            'VAULT_LOADED': 'fas fa-vault',
            'VAULT_EXPORTED': 'fas fa-cloud-arrow-up',
            'USER_REGISTERED': 'fas fa-user-plus'
        };
        return icons[action] || 'fas fa-info';
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const icon = toast.querySelector('.toast-icon');
        const msg = toast.querySelector('.toast-message');
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-times-circle',
            warning: 'fas fa-exclamation-circle',
            info: 'fas fa-info-circle'
        };
        
        icon.className = `toast-icon ${icons[type]}`;
        msg.textContent = message;
        toast.className = `toast ${type}`;
        
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }
}

// Initialize app
const app = new SafePassApp();
