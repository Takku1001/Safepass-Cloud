/**
 * B-Tree Implementation for Password Vault
 * Efficient O(log n) search, insert, and delete operations
 */

class BTreeNode {
    constructor(degree, isLeaf = true) {
        this.keys = [];           // Password entries
        this.children = [];       // Child nodes
        this.isLeaf = isLeaf;
        this.minDegree = degree;
    }

    // Insert key when node is not full
    insertNonFull(key) {
        let i = this.keys.length - 1;

        if (this.isLeaf) {
            // Find correct position and insert
            while (i >= 0 && this.keys[i].websiteName > key.websiteName) {
                i--;
            }
            this.keys.splice(i + 1, 0, key);
        } else {
            // Find child to insert into
            while (i >= 0 && this.keys[i].websiteName > key.websiteName) {
                i--;
            }
            i++;

            // Split child if full
            if (this.children[i].keys.length === 2 * this.minDegree - 1) {
                this.splitChild(i, this.children[i]);
                if (this.keys[i].websiteName < key.websiteName) {
                    i++;
                }
            }
            this.children[i].insertNonFull(key);
        }
    }

    // Split a full child
    splitChild(index, child) {
        const newNode = new BTreeNode(child.minDegree, child.isLeaf);
        const mid = this.minDegree - 1;

        // Move second half to new node
        newNode.keys = child.keys.splice(mid + 1);
        if (!child.isLeaf) {
            newNode.children = child.children.splice(mid + 1);
        }

        // Get middle key
        const midKey = child.keys.pop();

        // Insert into parent
        this.children.splice(index + 1, 0, newNode);
        this.keys.splice(index, 0, midKey);
    }

    // Search for a website
    search(websiteName) {
        let i = 0;
        while (i < this.keys.length && websiteName > this.keys[i].websiteName) {
            i++;
        }

        if (i < this.keys.length && this.keys[i].websiteName === websiteName) {
            return this.keys[i];
        }

        if (this.isLeaf) {
            return null;
        }

        return this.children[i].search(websiteName);
    }

    // Get all entries (in-order traversal)
    getAllEntries(result = []) {
        for (let i = 0; i < this.keys.length; i++) {
            if (!this.isLeaf) {
                this.children[i].getAllEntries(result);
            }
            result.push(this.keys[i]);
        }
        if (!this.isLeaf && this.children[this.keys.length]) {
            this.children[this.keys.length].getAllEntries(result);
        }
        return result;
    }

    // Delete a key
    delete(websiteName) {
        const idx = this.findKey(websiteName);

        if (idx < this.keys.length && this.keys[idx].websiteName === websiteName) {
            if (this.isLeaf) {
                this.keys.splice(idx, 1);
            } else {
                this.deleteFromNonLeaf(idx, websiteName);
            }
        } else {
            if (this.isLeaf) {
                return false;
            }

            const flag = (idx === this.keys.length);
            
            if (this.children[idx].keys.length < this.minDegree) {
                this.fill(idx);
            }

            if (flag && idx > this.keys.length) {
                this.children[idx - 1].delete(websiteName);
            } else {
                this.children[idx].delete(websiteName);
            }
        }
        return true;
    }

    findKey(websiteName) {
        let idx = 0;
        while (idx < this.keys.length && this.keys[idx].websiteName < websiteName) {
            idx++;
        }
        return idx;
    }

    deleteFromNonLeaf(idx, websiteName) {
        const key = this.keys[idx];

        if (this.children[idx].keys.length >= this.minDegree) {
            const pred = this.getPred(idx);
            this.keys[idx] = pred;
            this.children[idx].delete(pred.websiteName);
        } else if (this.children[idx + 1].keys.length >= this.minDegree) {
            const succ = this.getSucc(idx);
            this.keys[idx] = succ;
            this.children[idx + 1].delete(succ.websiteName);
        } else {
            this.merge(idx);
            this.children[idx].delete(websiteName);
        }
    }

    getPred(idx) {
        let cur = this.children[idx];
        while (!cur.isLeaf) {
            cur = cur.children[cur.keys.length];
        }
        return cur.keys[cur.keys.length - 1];
    }

    getSucc(idx) {
        let cur = this.children[idx + 1];
        while (!cur.isLeaf) {
            cur = cur.children[0];
        }
        return cur.keys[0];
    }

    fill(idx) {
        if (idx !== 0 && this.children[idx - 1].keys.length >= this.minDegree) {
            this.borrowFromPrev(idx);
        } else if (idx !== this.keys.length && this.children[idx + 1].keys.length >= this.minDegree) {
            this.borrowFromNext(idx);
        } else {
            if (idx !== this.keys.length) {
                this.merge(idx);
            } else {
                this.merge(idx - 1);
            }
        }
    }

    borrowFromPrev(idx) {
        const child = this.children[idx];
        const sibling = this.children[idx - 1];

        child.keys.unshift(this.keys[idx - 1]);
        this.keys[idx - 1] = sibling.keys.pop();

        if (!child.isLeaf) {
            child.children.unshift(sibling.children.pop());
        }
    }

    borrowFromNext(idx) {
        const child = this.children[idx];
        const sibling = this.children[idx + 1];

        child.keys.push(this.keys[idx]);
        this.keys[idx] = sibling.keys.shift();

        if (!child.isLeaf) {
            child.children.push(sibling.children.shift());
        }
    }

    merge(idx) {
        const child = this.children[idx];
        const sibling = this.children[idx + 1];

        child.keys.push(this.keys[idx]);
        child.keys = child.keys.concat(sibling.keys);

        if (!child.isLeaf) {
            child.children = child.children.concat(sibling.children);
        }

        this.keys.splice(idx, 1);
        this.children.splice(idx + 1, 1);
    }
}

class BTree {
    constructor(degree = 3) {
        this.root = null;
        this.minDegree = degree;
    }

    // Insert a password entry
    insert(entry) {
        if (!this.root) {
            this.root = new BTreeNode(this.minDegree, true);
            this.root.keys.push(entry);
        } else {
            if (this.root.keys.length === 2 * this.minDegree - 1) {
                const newRoot = new BTreeNode(this.minDegree, false);
                newRoot.children.push(this.root);
                newRoot.splitChild(0, this.root);

                let i = 0;
                if (newRoot.keys[0].websiteName < entry.websiteName) {
                    i++;
                }
                newRoot.children[i].insertNonFull(entry);
                this.root = newRoot;
            } else {
                this.root.insertNonFull(entry);
            }
        }
    }

    // Search for a password by website name
    search(websiteName) {
        if (!this.root) return null;
        return this.root.search(websiteName);
    }

    // Get all password entries
    getAll() {
        if (!this.root) return [];
        return this.root.getAllEntries();
    }

    // Delete a password entry
    delete(websiteName) {
        if (!this.root) return false;

        this.root.delete(websiteName);

        if (this.root.keys.length === 0) {
            if (this.root.isLeaf) {
                this.root = null;
            } else {
                this.root = this.root.children[0];
            }
        }
        return true;
    }

    // Update a password entry
    update(websiteName, newData) {
        const entry = this.search(websiteName);
        if (entry) {
            Object.assign(entry, newData);
            entry.lastModified = Date.now();
            return true;
        }
        return false;
    }

    // Get count of entries
    count() {
        return this.getAll().length;
    }

    // Serialize for storage
    toJSON() {
        return this.getAll();
    }

    // Load from array
    fromArray(entries) {
        this.root = null;
        entries.forEach(entry => this.insert(entry));
    }
}

module.exports = { BTree, BTreeNode };
