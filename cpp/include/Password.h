#ifndef PASSWORD_H
#define PASSWORD_H

#include <string>
#include <ctime>

using namespace std;

// Password Entry Structure
struct Password {
    int passwordID;
    string websiteName;
    string username;
    string encryptedPassword;
    time_t createdAt;
    time_t lastModified;

    Password() : passwordID(0), createdAt(0), lastModified(0) {}

    Password(int id, string website, string user, string pass) 
        : passwordID(id), websiteName(website), username(user), 
          encryptedPassword(pass) {
        createdAt = time(nullptr);
        lastModified = time(nullptr);
    }

    // Comparison operators for B-Tree
    bool operator<(const Password& other) const {
        return websiteName < other.websiteName;
    }

    bool operator>(const Password& other) const {
        return websiteName > other.websiteName;
    }

    bool operator==(const Password& other) const {
        return websiteName == other.websiteName;
    }
};

#endif
