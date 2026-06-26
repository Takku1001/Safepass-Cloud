#ifndef BTREE_H
#define BTREE_H

#include <iostream>
#include <vector>
#include "Password.h"

using namespace std;

// B-Tree Node
template<typename T>
class BTreeNode {
public:
    vector<T> keys;
    vector<BTreeNode*> children;
    bool isLeaf;
    int minDegree;

    BTreeNode(int degree, bool leaf) : minDegree(degree), isLeaf(leaf) {}

    void insertNonFull(const T& key);
    void splitChild(int index, BTreeNode* child);
    BTreeNode* search(const string& websiteName);
    void traverse();
};

// B-Tree Class
template<typename T>
class BTree {
private:
    BTreeNode<T>* root;
    int minDegree;

public:
    BTree(int degree) : minDegree(degree), root(nullptr) {}

    void insert(const T& key);
    BTreeNode<T>* search(const string& websiteName);
    void display();
};

// BTreeNode Implementation
template<typename T>
void BTreeNode<T>::insertNonFull(const T& key) {
    int i = keys.size() - 1;

    if (isLeaf) {
        keys.push_back(T());
        while (i >= 0 && keys[i] > key) {
            keys[i + 1] = keys[i];
            i--;
        }
        keys[i + 1] = key;
    } else {
        while (i >= 0 && keys[i] > key)
            i--;
        i++;

        if (i < children.size() && children[i]->keys.size() == 2 * minDegree - 1) {
            splitChild(i, children[i]);
            if (i < keys.size() && keys[i] < key)
                i++;
        }
        if (i < children.size()) {
            children[i]->insertNonFull(key);
        }
    }
}

template<typename T>
void BTreeNode<T>::splitChild(int index, BTreeNode* child) {
    BTreeNode* newNode = new BTreeNode(child->minDegree, child->isLeaf);
    int mid = minDegree - 1;

    // Copy second half of keys to new node
    for (int j = 0; j < minDegree - 1; j++) {
        if (mid + 1 + j < child->keys.size())
            newNode->keys.push_back(child->keys[mid + 1 + j]);
    }

    // Copy second half of children if not leaf
    if (!child->isLeaf) {
        for (int j = 0; j < minDegree; j++) {
            if (mid + 1 + j < child->children.size())
                newNode->children.push_back(child->children[mid + 1 + j]);
        }
    }

    // Store the middle key
    T midKey = child->keys[mid];
    
    // Resize the original child
    child->keys.resize(mid);
    if (!child->isLeaf)
        child->children.resize(mid + 1);

    // Insert new node and middle key into parent
    children.insert(children.begin() + index + 1, newNode);
    keys.insert(keys.begin() + index, midKey);
}

template<typename T>
BTreeNode<T>* BTreeNode<T>::search(const string& websiteName) {
    int i = 0;
    while (i < keys.size() && websiteName > keys[i].websiteName)
        i++;

    if (i < keys.size() && keys[i].websiteName == websiteName)
        return this;

    if (isLeaf)
        return nullptr;

    return children[i]->search(websiteName);
}

template<typename T>
void BTreeNode<T>::traverse() {
    int i;
    for (i = 0; i < keys.size(); i++) {
        if (!isLeaf)
            children[i]->traverse();
        cout << "  - " << keys[i].websiteName << " | User: " << keys[i].username << " | Pass: [ENCRYPTED]" << endl;
    }
    if (!isLeaf)
        children[i]->traverse();
}

// BTree Implementation
template<typename T>
void BTree<T>::insert(const T& key) {
    if (root == nullptr) {
        root = new BTreeNode<T>(minDegree, true);
        root->keys.push_back(key);
    } else {
        if (root->keys.size() == 2 * minDegree - 1) {
            BTreeNode<T>* newRoot = new BTreeNode<T>(minDegree, false);
            newRoot->children.push_back(root);
            newRoot->splitChild(0, root);
            root = newRoot;

            int i = 0;
            if (newRoot->keys[0] < key)
                i++;
            newRoot->children[i]->insertNonFull(key);
        } else {
            root->insertNonFull(key);
        }
    }
}

template<typename T>
BTreeNode<T>* BTree<T>::search(const string& websiteName) {
    return (root == nullptr) ? nullptr : root->search(websiteName);
}

template<typename T>
void BTree<T>::display() {
    if (root != nullptr) {
        cout << "\n=== Password Vault (B-Tree) ===" << endl;
        root->traverse();
    } else {
        cout << "Vault is empty." << endl;
    }
}

#endif
