#ifndef MINHEAP_H
#define MINHEAP_H

#include <iostream>
#include <vector>
#include <string>
#include <ctime>

using namespace std;

// Structure for Password Expiry
struct ExpiryEntry {
    string websiteName;
    time_t expiryDate;
    int daysUntilExpiry;

    ExpiryEntry(string site, time_t expiry) 
        : websiteName(site), expiryDate(expiry) {
        time_t now = time(nullptr);
        daysUntilExpiry = (expiry - now) / (60 * 60 * 24);
    }

    bool operator>(const ExpiryEntry& other) const {
        return daysUntilExpiry > other.daysUntilExpiry;
    }
};

// Min-Heap for Password Expiry Alerts
class MinHeap {
private:
    vector<ExpiryEntry> heap;

    void heapifyUp(int index) {
        if (index == 0) return;
        
        int parent = (index - 1) / 2;
        if (heap[index].daysUntilExpiry < heap[parent].daysUntilExpiry) {
            swap(heap[index], heap[parent]);
            heapifyUp(parent);
        }
    }

    void heapifyDown(int index) {
        int left = 2 * index + 1;
        int right = 2 * index + 2;
        int smallest = index;

        if (left < heap.size() && heap[left].daysUntilExpiry < heap[smallest].daysUntilExpiry) {
            smallest = left;
        }

        if (right < heap.size() && heap[right].daysUntilExpiry < heap[smallest].daysUntilExpiry) {
            smallest = right;
        }

        if (smallest != index) {
            swap(heap[index], heap[smallest]);
            heapifyDown(smallest);
        }
    }

public:
    // Insert expiry entry
    void insert(const ExpiryEntry& entry) {
        heap.push_back(entry);
        heapifyUp(heap.size() - 1);
    }

    // Get minimum (closest expiry)
    ExpiryEntry getMin() {
        if (heap.empty()) {
            return ExpiryEntry("", 0);
        }
        return heap[0];
    }

    // Remove minimum
    void extractMin() {
        if (heap.empty()) return;

        heap[0] = heap.back();
        heap.pop_back();
        
        if (!heap.empty()) {
            heapifyDown(0);
        }
    }

    // Check if heap is empty
    bool isEmpty() {
        return heap.empty();
    }

    // Display upcoming expiries
    void displayUpcomingExpiries() {
        if (heap.empty()) {
            cout << "No password expiry alerts." << endl;
            return;
        }

        cout << "\n=== Upcoming Password Expiries (Min-Heap) ===" << endl;
        vector<ExpiryEntry> temp = heap;
        
        // Sort for display
        for (size_t i = 0; i < temp.size(); i++) {
            for (size_t j = i + 1; j < temp.size(); j++) {
                if (temp[i].daysUntilExpiry > temp[j].daysUntilExpiry) {
                    swap(temp[i], temp[j]);
                }
            }
        }

        for (const auto& entry : temp) {
            cout << "  - " << entry.websiteName << ": ";
            if (entry.daysUntilExpiry <= 0) {
                cout << "EXPIRED" << endl;
            } else {
                cout << entry.daysUntilExpiry << " days left" << endl;
            }
        }
    }

    // Get count
    int size() {
        return heap.size();
    }
};

#endif
