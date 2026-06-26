#ifndef QUEUE_H
#define QUEUE_H

#include <iostream>
#include <string>

using namespace std;

// Queue Node for Clipboard Manager
struct QueueNode {
    string data;
    QueueNode* next;
    
    QueueNode(string val) : data(val), next(nullptr) {}
};

// Queue Class (for Clipboard History)
class Queue {
private:
    QueueNode* front;
    QueueNode* rear;
    int size;
    int maxSize;

public:
    Queue(int max = 10) : front(nullptr), rear(nullptr), size(0), maxSize(max) {}

    // Enqueue (add to clipboard history)
    void enqueue(const string& data) {
        QueueNode* newNode = new QueueNode(data);
        
        if (rear == nullptr) {
            front = rear = newNode;
        } else {
            rear->next = newNode;
            rear = newNode;
        }
        
        size++;
        
        // If queue exceeds max size, remove oldest entry
        if (size > maxSize) {
            dequeue();
        }
    }

    // Dequeue (remove oldest clipboard entry)
    string dequeue() {
        if (isEmpty()) {
            return "";
        }
        
        QueueNode* temp = front;
        string data = front->data;
        front = front->next;
        
        if (front == nullptr) {
            rear = nullptr;
        }
        
        delete temp;
        size--;
        return data;
    }

    // Peek at front
    string peek() {
        if (isEmpty()) {
            return "";
        }
        return front->data;
    }

    // Check if queue is empty
    bool isEmpty() {
        return front == nullptr;
    }

    // Get current size
    int getSize() {
        return size;
    }

    // Display clipboard history
    void display() {
        if (isEmpty()) {
            cout << "Clipboard history is empty." << endl;
            return;
        }
        
        cout << "\n=== Clipboard History (Queue) ===" << endl;
        QueueNode* current = front;
        int index = 1;
        
        while (current != nullptr) {
            cout << "  " << index++ << ". " << current->data << endl;
            current = current->next;
        }
    }

    // Clear clipboard
    void clear() {
        while (!isEmpty()) {
            dequeue();
        }
        cout << "Clipboard cleared." << endl;
    }
};

#endif
