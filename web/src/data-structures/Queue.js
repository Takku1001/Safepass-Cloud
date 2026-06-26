/**
 * Queue Implementation for Activity Log & Clipboard History
 * FIFO (First In, First Out) with maximum size limit
 */

class QueueNode {
    constructor(data) {
        this.data = data;
        this.timestamp = Date.now();
        this.next = null;
    }
}

class Queue {
    constructor(maxSize = 50) {
        this.front = null;
        this.rear = null;
        this.size = 0;
        this.maxSize = maxSize;
    }

    // Add to queue
    enqueue(data) {
        const newNode = new QueueNode(data);

        if (this.isEmpty()) {
            this.front = this.rear = newNode;
        } else {
            this.rear.next = newNode;
            this.rear = newNode;
        }

        this.size++;

        // Remove oldest if exceeds max size
        while (this.size > this.maxSize) {
            this.dequeue();
        }

        return true;
    }

    // Remove from queue
    dequeue() {
        if (this.isEmpty()) return null;

        const data = this.front.data;
        this.front = this.front.next;

        if (!this.front) {
            this.rear = null;
        }

        this.size--;
        return data;
    }

    // Peek at front
    peek() {
        if (this.isEmpty()) return null;
        return this.front.data;
    }

    // Peek at rear
    peekRear() {
        if (this.isEmpty()) return null;
        return this.rear.data;
    }

    // Check if empty
    isEmpty() {
        return this.front === null;
    }

    // Get current size
    getSize() {
        return this.size;
    }

    // Clear queue
    clear() {
        this.front = null;
        this.rear = null;
        this.size = 0;
    }

    // Get all items as array (newest first)
    toArray() {
        const result = [];
        let current = this.front;

        while (current) {
            result.push({
                data: current.data,
                timestamp: current.timestamp
            });
            current = current.next;
        }

        return result.reverse(); // Newest first
    }

    // Get last N items
    getRecent(n = 10) {
        const all = this.toArray();
        return all.slice(0, n);
    }

    // Search in queue
    search(predicate) {
        let current = this.front;

        while (current) {
            if (predicate(current.data)) {
                return current.data;
            }
            current = current.next;
        }

        return null;
    }

    // Filter queue items
    filter(predicate) {
        const result = [];
        let current = this.front;

        while (current) {
            if (predicate(current.data)) {
                result.push({
                    data: current.data,
                    timestamp: current.timestamp
                });
            }
            current = current.next;
        }

        return result;
    }

    // Serialize
    toJSON() {
        return this.toArray();
    }

    // Load from array
    fromArray(items) {
        this.clear();
        // Items should be in chronological order (oldest first for proper queue order)
        const sorted = [...items].sort((a, b) => 
            (a.timestamp || 0) - (b.timestamp || 0)
        );
        
        for (const item of sorted) {
            const data = item.data || item;
            this.enqueue(data);
        }
    }
}

// Activity Log extends Queue with specific functionality
class ActivityLog extends Queue {
    constructor(maxSize = 100) {
        super(maxSize);
    }

    // Log an activity
    log(action, details = {}) {
        const entry = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            action,
            details,
            timestamp: new Date().toISOString()
        };
        this.enqueue(entry);
        return entry;
    }

    // Get activities by type
    getByAction(action) {
        return this.filter(item => item.action === action);
    }

    // Get activities for a specific website
    getByWebsite(websiteName) {
        return this.filter(item => 
            item.details && item.details.websiteName === websiteName
        );
    }

    // Get activities in date range
    getInDateRange(startDate, endDate) {
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();

        return this.filter(item => {
            const itemTime = new Date(item.timestamp).getTime();
            return itemTime >= start && itemTime <= end;
        });
    }

    // Get summary statistics
    getSummary() {
        const all = this.toArray();
        const actionCounts = {};

        for (const item of all) {
            const action = item.data?.action || 'unknown';
            actionCounts[action] = (actionCounts[action] || 0) + 1;
        }

        return {
            totalActivities: this.size,
            actionBreakdown: actionCounts,
            recentActivity: this.getRecent(5)
        };
    }
}

// Clipboard History specific implementation
class ClipboardHistory extends Queue {
    constructor(maxSize = 20) {
        super(maxSize);
    }

    // Copy to clipboard history
    copy(websiteName, username, field = 'password') {
        const entry = {
            websiteName,
            username,
            field,
            copiedAt: new Date().toISOString()
        };
        this.enqueue(entry);
        return entry;
    }

    // Get history for a website
    getForWebsite(websiteName) {
        return this.filter(item => item.websiteName === websiteName);
    }

    // Clear sensitive data (for security)
    clearSensitive() {
        this.clear();
        return true;
    }
}

module.exports = { Queue, ActivityLog, ClipboardHistory };
