/**
 * Min-Heap Implementation for Password Expiry Alerts
 * Efficiently tracks passwords that are expiring soon
 */

class ExpiryEntry {
    constructor(websiteName, expiryDate, passwordId = null) {
        this.websiteName = websiteName;
        this.passwordId = passwordId;
        this.expiryDate = expiryDate instanceof Date ? expiryDate.getTime() : expiryDate;
        this.daysUntilExpiry = this._calculateDays();
    }

    _calculateDays() {
        const now = Date.now();
        return Math.ceil((this.expiryDate - now) / (1000 * 60 * 60 * 24));
    }

    refresh() {
        this.daysUntilExpiry = this._calculateDays();
    }

    isExpired() {
        return this.daysUntilExpiry <= 0;
    }

    isExpiringSoon(days = 7) {
        // Return true if expiring within 'days' days (including today)
        return this.daysUntilExpiry <= days && this.daysUntilExpiry >= 0;
    }
}

class MinHeap {
    constructor() {
        this.heap = [];
    }

    // Get parent index
    _parent(i) {
        return Math.floor((i - 1) / 2);
    }

    // Get left child index
    _leftChild(i) {
        return 2 * i + 1;
    }

    // Get right child index
    _rightChild(i) {
        return 2 * i + 2;
    }

    // Swap elements
    _swap(i, j) {
        [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
    }

    // Heapify up (bubble up)
    _heapifyUp(index) {
        while (index > 0) {
            const parent = this._parent(index);
            if (this.heap[index].daysUntilExpiry < this.heap[parent].daysUntilExpiry) {
                this._swap(index, parent);
                index = parent;
            } else {
                break;
            }
        }
    }

    // Heapify down (bubble down)
    _heapifyDown(index) {
        const size = this.heap.length;

        while (true) {
            const left = this._leftChild(index);
            const right = this._rightChild(index);
            let smallest = index;

            if (left < size && this.heap[left].daysUntilExpiry < this.heap[smallest].daysUntilExpiry) {
                smallest = left;
            }

            if (right < size && this.heap[right].daysUntilExpiry < this.heap[smallest].daysUntilExpiry) {
                smallest = right;
            }

            if (smallest !== index) {
                this._swap(index, smallest);
                index = smallest;
            } else {
                break;
            }
        }
    }

    // Insert new entry
    insert(entry) {
        if (!(entry instanceof ExpiryEntry)) {
            entry = new ExpiryEntry(entry.websiteName, entry.expiryDate, entry.passwordId);
        }
        this.heap.push(entry);
        this._heapifyUp(this.heap.length - 1);
    }

    // Get minimum (soonest expiry)
    getMin() {
        if (this.isEmpty()) return null;
        return this.heap[0];
    }

    // Extract minimum
    extractMin() {
        if (this.isEmpty()) return null;

        const min = this.heap[0];
        const last = this.heap.pop();

        if (this.heap.length > 0) {
            this.heap[0] = last;
            this._heapifyDown(0);
        }

        return min;
    }

    // Peek at top k entries
    peekTop(k = 5) {
        // Create a copy and sort
        return [...this.heap]
            .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
            .slice(0, k);
    }

    // Get all expired passwords
    getExpired() {
        return this.heap.filter(entry => entry.isExpired());
    }

    // Get expiring soon (within n days)
    getExpiringSoon(days = 7) {
        // Refresh days calculation for all entries
        this.heap.forEach(entry => entry.refresh());
        
        // Return all entries expiring within the specified days
        const result = this.heap.filter(entry => {
            return entry.daysUntilExpiry <= days && entry.daysUntilExpiry >= 0;
        }).sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
        
        console.log('MinHeap getExpiringSoon called with days:', days);
        console.log('Heap size:', this.heap.length);
        console.log('Filtered result:', result.length, result);
        
        return result;
    }

    // Get all entries in the heap
    getAll() {
        this.heap.forEach(entry => entry.refresh());
        return [...this.heap].sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
    }

    // Remove entry by website name
    removeByWebsite(websiteName) {
        const index = this.heap.findIndex(e => e.websiteName === websiteName);
        if (index === -1) return false;

        const last = this.heap.pop();
        if (index < this.heap.length) {
            this.heap[index] = last;
            this._heapifyDown(index);
            this._heapifyUp(index);
        }
        return true;
    }

    // Update expiry for a website
    updateExpiry(websiteName, newExpiryDate) {
        const entry = this.heap.find(e => e.websiteName === websiteName);
        if (!entry) return false;

        this.removeByWebsite(websiteName);
        this.insert(new ExpiryEntry(websiteName, newExpiryDate, entry.passwordId));
        return true;
    }

    // Check if heap is empty
    isEmpty() {
        return this.heap.length === 0;
    }

    // Get size
    size() {
        return this.heap.length;
    }

    // Refresh all entries (recalculate days)
    refreshAll() {
        this.heap.forEach(entry => entry.refresh());
        // Rebuild heap
        this._buildHeap();
    }

    _buildHeap() {
        for (let i = Math.floor(this.heap.length / 2) - 1; i >= 0; i--) {
            this._heapifyDown(i);
        }
    }

    // Get statistics
    getStats() {
        if (this.isEmpty()) {
            return { total: 0, expired: 0, expiringSoon: 0, healthy: 0 };
        }

        const expired = this.heap.filter(e => e.isExpired()).length;
        const expiringSoon = this.heap.filter(e => e.isExpiringSoon(30)).length;

        return {
            total: this.heap.length,
            expired,
            expiringSoon,
            healthy: this.heap.length - expired - expiringSoon,
            nearestExpiry: this.getMin()
        };
    }

    // Serialize
    toJSON() {
        return this.heap.map(e => ({
            websiteName: e.websiteName,
            passwordId: e.passwordId,
            expiryDate: e.expiryDate,
            daysUntilExpiry: e.daysUntilExpiry
        }));
    }

    // Load from array
    fromArray(entries) {
        this.heap = [];
        entries.forEach(e => this.insert(e));
    }
}

module.exports = { MinHeap, ExpiryEntry };
