# Grievance Redressal System

![Tech Stack](https://img.shields.io/badge/Stack-Node.js%20%7C%20Express%20%7C%20MySQL-brightgreen)

A full-stack complaint management system for West Bengal Government, enabling citizens to submit grievances and administrators to track resolution progress.

## Table of Contents
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Installation](#installation)
- [System Architecture](#system-architecture)
- [License](#license)

## Features

- **Citizen Portal**
  - Complaint submission with attachments
  - Real-time status tracking
  - District-wise categorization

- **Admin Dashboard**
  - JWT-based authentication
  - Complaint status management (Pending/In Progress/Resolved)
  - Action taken documentation
  - District-wise analytics dashboard

- **System Highlights**
  - RESTful API architecture
  - Secure password hashing (bcrypt)
  - Responsive web interface

## Technology Stack

| Component        | Technology |
|------------------|------------|
| Frontend         | HTML5, CSS3, JavaScript |
| Backend          | Node.js, Express |
| Database         | MySQL |
| Authentication   | JWT, bcrypt |
| Deployment       | Docker-ready |

## Installation

### Prerequisites
- Node.js 16+
- MySQL 8.0+
- npm/yarn

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/grievance-redressal.git
   cd grievance-redressal

2. **Install dependencies***
    ```bash
    npm install
    
3. ***Database Setup***
    ```bash
    mysql -u root -p < database_schema.sql

4. ***Configure environment***
    ```bash
    cp .env.example .env
    # Edit .env with your credentials

5. ***Run the application***
    ```bash
    node server.js

## System Architecture
    ```mermaid
    graph TD;
        A[Citizen Browser] -->|Submit Complaint| B[Node.js Server];
        B --> C[MySQL Database];
        D[Admin Browser] -->|Login| B;
        D -->|Manage Complaints| B;
        B --> E[Send Email Notifications];
    ```

## License