# NoteNest — MERN Stack Notes Application

A full-stack, enterprise-ready **Notes Application** built with the **MERN stack** (MongoDB, Express, React, Node.js) and **TypeScript**. NoteNest provides safe, user-isolated note management with markdown creation, live HTML preview (sanitized with DOMPurify), secure JWT authentication with server-side token revocation, password strength metrics, comprehensive unit testing, and static code quality analysis via **SonarQube Community Build**.

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Features](#2-features)
- [3. Technology Stack](#3-technology-stack)
- [4. Project Architecture](#4-project-architecture)
- [5. Complete Folder Structure](#5-complete-folder-structure)
- [6. Prerequisites](#6-prerequisites)
- [7. Installation & Setup](#7-installation--setup)
- [8. Environment Variables](#8-environment-variables)
- [9. How to Start the Backend](#9-how-to-start-the-backend)
- [10. How to Start the Frontend](#10-how-to-start-the-frontend)
- [11. Running Frontend + Backend Together](#11-running-frontend--backend-together)
- [12. Database Setup](#12-database-setup)
- [13. API Documentation](#13-api-documentation)
- [14. Authentication & Security](#14-authentication--security)
- [15. Testing](#15-testing)
- [16. Code Coverage](#16-code-coverage)
- [17. SonarQube Integration](#17-sonar-qube-integration)
- [18. Docker & Local SonarQube](#18-docker--local-sonarqube)
- [19. Common Commands Reference](#19-common-commands-reference)
- [20. Troubleshooting](#20-troubleshooting)
- [21. Development Workflow](#21-development-workflow)
- [22. Code Quality Standards](#22-code-quality-standards)
- [23. Security Notes](#23-security-notes)
- [24. Git & Contribution Guidelines](#24-git--contribution-guidelines)
- [25. Project Status](#25-project-status)

---

## 1. Overview

NoteNest is designed as a clean, performant, and secure personal notes management system. The application enforces complete user isolation where each user manages their own notes, credentials, and profile settings.

### Key Highlights
- **Single Page Application (SPA)**: Powered by React 18, Vite 5, and React Router 6.
- **RESTful API Backend**: Powered by Node.js, Express 4, and TypeScript 5.
- **Persistent Database**: MongoDB with Mongoose 8 ORM.
- **Stateful JWT Revocation**: Logout invalidates JWT tokens in a dedicated MongoDB revocation table (`TokenRevocation`).
- **Markdown Studio**: Interactive editor featuring formatting tools and DOMPurify-sanitized live previews.
- **Code Quality & Testing**: Mocha/Chai/Sinon/Supertest backend tests, Jest + React Testing Library frontend tests, and SonarQube static analysis.

---

## 2. Features

### User Account & Profile
- **User Registration**: Real-time password strength meter and field validation.
- **User Login**: Secure JWT token generation.
- **User Logout**: Server-side token revocation (`TokenRevocation` model).
- **Profile Management**: Update full name, update password with current password verification.

### Notes Management
- **Create Notes**: Add titled notes with custom markdown content.
- **Read & Search Notes**: Search notes by keyword, navigate through paginated results, and sort by date or title.
- **Edit Notes**: Dynamic note editing in full edit mode.
- **Delete Notes**: Instant note deletion scoped to the logged-in owner.
- **Markdown Editor & Preview**: Integrated editor toolbar (bold, italic, lists, task lists, code blocks, blockquotes, links, headers) with instant preview and DOMPurify XSS protection.

### System & Security
- **Health Check API**: Endpoint (`/api/health`) monitoring database connectivity, process uptime, and environment state.
- **Security Middleware**: Helmet security headers, CORS origin verification, and centralized async error handling.

---

## 3. Technology Stack

### Frontend

| Technology | Version | Purpose |
| :--- | :--- | :--- |
| **React** | `^18.3.1` | UI library for building the user interface |
| **TypeScript** | `^5.5.3` | Type safety across components, hooks, and services |
| **Vite** | `^5.4.1` | Fast build tool and dev server with proxy support |
| **React Router DOM** | `^6.26.1` | Client-side routing and page navigation |
| **DOMPurify** | `^3.1.6` | XSS sanitization for rendering markdown preview HTML |
| **React Icons** | `^5.7.0` | Comprehensive UI icons for action controls |
| **Jest** | `^30.5.0` | Frontend unit and integration testing framework |
| **Testing Library** | `^16.0.0` | Component DOM testing utilities (`@testing-library/react`) |

### Backend

| Technology | Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `>=18.0.0` | JavaScript runtime environment |
| **Express** | `^4.21.2` | Web framework for HTTP API endpoints and routing |
| **TypeScript** | `^5.8.3` | Static typing for controllers, services, models, and routes |
| **MongoDB / Mongoose** | `^8.6.3` | Document database and object modeling layer |
| **jsonwebtoken** | `^9.0.3` | Authentication token generation and validation |
| **bcryptjs** | `^3.0.3` | Password hashing with salt processing |
| **Helmet** | `^8.0.1` | HTTP header security hardening |
| **Cors** | `^2.8.5` | Cross-Origin Resource Sharing control |
| **Pino** | `^9.1.0` | High-performance structured logging |
| **Mocha / Chai / Sinon** | `^10.7.3` / `^4.3.10` | Backend unit testing, assertions, and test stubs |
| **Supertest** | `^7.0.0` | End-to-end HTTP endpoint testing |
| **c8** | `^10.1.3` | Code coverage generation for V8 / Node.js |

### Quality & Development Tools

| Tool | Purpose |
| :--- | :--- |
| **SonarQube Community Build** | Static code analysis, vulnerability scanning, and code coverage tracking |
| **Git** | Version control |
| **tsx** | Execute TypeScript directly in development with live hot-reloading |

---

## 4. Project Architecture

### Architecture Diagram

```text
+-------------------------------------------------------------------+
|                        Browser (Client Side)                      |
|  React 18 SPA (Vite) | React Router DOM | DOMPurify | Context API |
+-------------------------------------------------------------------+
                                  |
                                  | HTTP / REST API (JSON)
                                  v
+-------------------------------------------------------------------+
|                     Express 4 REST API Server                     |
|  [Helmet] [Cors] [RequestLogger] -> [AuthMiddleware] -> Routes    |
+-------------------------------------------------------------------+
                                  |
            +---------------------+---------------------+
            |                                           |
            v                                           v
+-----------------------+                   +-----------------------+
|   Auth Controller     |                   |    Note Controller    |
|   (Auth Service)      |                   |    (Note Service)     |
+-----------------------+                   +-----------------------+
            |                                           |
            +---------------------+---------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                         Mongoose Models                           |
|       User Model   |   Note Model   |   TokenRevocation Model     |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                           MongoDB Database                        |
|              Collections: users | notes | tokenrevocations         |
+-------------------------------------------------------------------+
```

### Request Flow
1. **User Action**: User interacts with the React UI (e.g., creating a note or logging in).
2. **API Layer**: `frontend/src/services/api.ts` sends an HTTP request (`fetch`) attaching `Authorization: Bearer <token>` if present.
3. **Vite Proxy**: In development, Vite forwards requests from port `3000` to Express on port `5000`.
4. **Middleware Execution**: Express runs security headers (`helmet`), CORS checks, logging (`requestLogger`), and authentication validation (`authMiddleware`).
5. **Controller Routing**: The request reaches the matching controller (`auth.controller.ts` or `note.controller.ts`).
6. **Service Logic**: The controller delegates business logic to `auth.service.ts` or `note.service.ts`.
7. **Database Operations**: Mongoose queries or mutates documents inside MongoDB (`User`, `Note`, `TokenRevocation`).
8. **Response Standard**: Response is formatted using `ApiResponse` helper (`{ success: true, data: ..., message: ... }`) and returned to the frontend.

---

## 5. Complete Folder Structure

```text
notes-app-mern/
├── .coderabbit.yaml             # CodeRabbit AI code review configuration
├── .gitignore                   # Root git ignore rules
├── sonar-project.properties     # SonarQube scanner properties configuration
├── README.md                    # Root project documentation
├── SonarQube Analysis Screeshots/
│   ├── Activity Graph pic (Coverage).png
│   ├── Activity Graph pic (Issues).png
│   ├── Dashboard pic.png
│   ├── Issues Category pic.png
│   ├── Issues list pic.png
│   ├── Overview Measures Graph pic.png
│   └── Overview Overall Code pic.png
│
├── backend/
│   ├── .env.example             # Backend environment variable template
│   ├── .gitignore               # Backend git ignore rules
│   ├── package.json             # Backend dependencies and scripts
│   ├── tsconfig.json            # TypeScript compiler configuration for source
│   ├── tsconfig.test.json       # TypeScript compiler configuration for tests
│   ├── src/
│   │   ├── app.ts               # Express app instance and middleware assembly
│   │   ├── server.ts            # Server entrypoint and MongoDB initialization
│   │   ├── config/
│   │   │   ├── database.ts      # MongoDB Mongoose connection handler
│   │   │   └── env.ts           # Environment variable validation & parser
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts   # Auth HTTP request handlers
│   │   │   ├── health.controller.ts # Health check handler
│   │   │   └── note.controller.ts   # Notes HTTP request handlers
│   │   ├── logger/
│   │   │   └── logger.ts        # Pino logger configuration
│   │   ├── middleware/
│   │   │   ├── authMiddleware.ts    # JWT verification & token revocation check
│   │   │   ├── errorHandler.ts      # Global Express error handler
│   │   │   ├── notFound.ts          # 404 route handler
│   │   │   └── requestLogger.ts     # HTTP request logging middleware
│   │   ├── models/
│   │   │   ├── Note.ts              # Mongoose schema for Note
│   │   │   ├── TokenRevocation.ts   # Mongoose schema for revoked JWT tokens
│   │   │   └── User.ts              # Mongoose schema for User
│   │   ├── routes/
│   │   │   ├── auth.routes.ts       # Router for /api/auth
│   │   │   ├── health.routes.ts     # Router for /api/health
│   │   │   ├── index.ts             # Central API router aggregator
│   │   │   └── note.routes.ts       # Router for /api/notes
│   │   ├── services/
│   │   │   ├── auth.service.ts      # Business logic for auth & users
│   │   │   └── note.service.ts      # Business logic for note CRUD & search
│   │   └── utils/
│   │       ├── ApiError.ts          # Custom API Error class
│   │       ├── ApiResponse.ts       # Standardized response wrapper
│   │       ├── asyncHandler.ts      # Express async handler wrapper
│   │       └── jwt.ts               # JWT signing, verification, and decoding helpers
│   └── tests/
│       ├── auth.controller.test.ts  # Auth controller integration tests
│       ├── auth.service.test.ts     # Auth service unit tests
│       ├── errorHandler.test.ts     # Error handler middleware tests
│       ├── healthAndMiddleware.test.ts # Health endpoint & request logger tests
│       ├── jwt.test.ts              # JWT utility unit tests
│       ├── note.controller.test.ts  # Note controller integration tests
│       └── note.service.test.ts     # Note service unit tests
│
└── frontend/
    ├── index.html               # Main HTML entrypoint
    ├── jest.config.cjs          # Jest test runner configuration
    ├── package.json             # Frontend dependencies and scripts
    ├── tsconfig.json            # TypeScript configuration
    ├── vite.config.ts           # Vite server & proxy configuration
    ├── public/                  # Static assets
    └── src/
        ├── index.css            # Base CSS styles & theme definitions
        ├── main.tsx             # React DOM root render entrypoint
        ├── components/
        │   ├── Layout.tsx       # Main page layout wrapper
        │   ├── NoteCard.tsx     # Note item preview card
        │   ├── NoteEditor.tsx   # Markdown editor & live DOMPurify preview
        │   ├── PasswordInput.tsx # Password input with show/hide toggle
        │   ├── PasswordStrengthIndicator.tsx # Visual password strength calculator
        │   ├── ProfileDropdown.tsx # Top navigation user menu
        │   └── ProtectedRoute.tsx  # Auth guard for protected routes
        ├── context/
        │   └── AuthContext.tsx  # Authentication global state & actions
        ├── pages/
        │   ├── Dashboard.tsx    # Notes list, search, pagination & action page
        │   ├── Login.tsx        # Login form page
        │   ├── NoteEditorPage.tsx # Separate note creation/editing page
        │   ├── Profile.tsx      # User profile edit & password update page
        │   └── Register.tsx     # Registration form page
        ├── services/
        │   └── api.ts           # Axios-like Fetch wrapper API service
        ├── test/
        │   ├── setup.ts         # Jest DOM setup script
        │   └── importMetaTransformer.cjs # Transformer for import.meta in Jest
        └── types/
            └── index.ts         # Frontend TypeScript type definitions
```

---

## 6. Prerequisites

Ensure your development machine has the following installed:

- **Node.js**: `v18.x` or `v20.x` (LTS recommended)
- **npm**: `v9.x` or `v10.x`
- **MongoDB**: Local instance running at `mongodb://127.0.0.1:27017` OR a **MongoDB Atlas** database URI
- **Git**: For cloning and managing repository branches
- *(Optional)* **SonarScanner CLI** & **SonarQube Community Build Server**: For running local static code quality analysis

---

## 7. Installation & Setup

### Step 1: Open the Project
```bash
cd "D:\Hussain Projects\Notes App for AWS Deployment"
```

### Step 2: Set Up Backend
```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory based on `.env.example` (PowerShell):
```bash
Copy-Item .env.example .env
```

The application defaults to development mode when `NODE_ENV` is omitted. Development and test mode use the local MongoDB URI and development JWT secret defaults; production still requires explicit secure values.

### Step 3: Set Up Frontend
```bash
cd ../frontend
npm install
```

---

## 8. Environment Variables

### Backend Environment Variables (`backend/.env`)

| Variable | Required | Default Value | Purpose | Example / Placeholder |
| :--- | :---: | :--- | :--- | :--- |
| `PORT` | No | `5000` | Port for Express server | `5000` |
| `NODE_ENV` | No | `development` | Environment mode (`development`, `production`, `test`) | `development` |
| `MONGODB_URI` | **Yes** *(prod)* | `mongodb://127.0.0.1:27017/notes-app` | Connection string for MongoDB | `your_mongodb_connection_string` |
| `JWT_SECRET` | **Yes** *(prod)* | `development-jwt-secret` | Secret key used for signing JWT tokens (min 32 chars in prod) | `your_jwt_secret_key` |
| `LOG_LEVEL` | No | `info` | Logging verbosity (`fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`) | `info` |

### Frontend Environment Variables (`frontend/.env`)

| Variable | Required | Default Value | Purpose | Example |
| :--- | :---: | :--- | :--- | :--- |
| `VITE_API_URL` | No | `/api` | Base API URL target for frontend network requests | `http://localhost:5000/api` |

> [!WARNING]
> **Security Reminder**: NEVER commit `.env` files containing real production database strings or JWT secrets to Git repository history.

---

## 9. How to Start the Backend

Navigate to the `backend/` directory:

```bash
cd backend
```

### Development Mode
Runs the backend using `tsx watch` with hot reloading:
```bash
npm run dev
```
The server will start at `http://localhost:5000`.

### Build & Production Mode
Compile TypeScript to JavaScript in `dist/` and start the server:
```bash
npm run build
npm start
```

### Type Checking
```bash
npm run typecheck
npm run typecheck:test
```

### Unit & Integration Testing
```bash
npm test
npm run test:coverage
```

---

## 10. How to Start the Frontend

Navigate to the `frontend/` directory:

```bash
cd frontend
```

### Development Mode
Starts the Vite dev server with proxy enabled:
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### Build & Preview
Build the bundle for production and preview locally:
```bash
npm run build
npm run preview
```

### Type Checking & Testing
```bash
npm run typecheck
npm test
npm run test:coverage
```

---

## 11. Running Frontend + Backend Together

To run the complete full-stack application during development, open two separate terminal windows:

### Terminal 1: Backend
```bash
cd backend
npm run dev
```

### Terminal 2: Frontend
```bash
cd frontend
npm run dev
```

1. Ensure MongoDB is running locally or your Atlas `MONGODB_URI` is correctly configured in `backend/.env`.
2. Access the application in your web browser at `http://localhost:3000`.

---

## 12. Database Setup

NoteNest uses **MongoDB** with **Mongoose**.

1. **Connection**: Defined in `backend/src/config/database.ts`. The backend automatically connects to MongoDB when `server.ts` starts up.
2. **Automatic Schema & Index Initialization**:
   - `User`: Unique lowercased index on `email`.
   - `Note`: Compound index on `{ userId: 1, createdAt: -1 }` and `{ userId: 1, updatedAt: -1 }` for high-performance note filtering and sorting.
   - `TokenRevocation`: TTL (Time-To-Live) index on `expiresAt` so expired revoked token records are automatically purged by MongoDB.
3. **Local Database Verification**:
   If using local MongoDB, confirm the service status:
   ```bash
   # On Windows (PowerShell)
   Get-Service MongoDB
   ```

---

## 13. API Documentation

All API endpoints return JSON conforming to standard response formatting (`{ success: boolean, data?: any, message?: string }`).

### Health Endpoint

| Method | Endpoint | Auth Required | Purpose |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/health` | No | Check backend health, DB connection status, and uptime |

### Authentication Endpoints (`/api/auth`)

| Method | Endpoint | Auth Required | Request Body / Parameters | Purpose |
| :--- | :--- | :---: | :--- | :--- |
| `POST` | `/api/auth/register` | No | `{ name, email, password }` | Register a new user account |
| `POST` | `/api/auth/login` | No | `{ email, password }` | Authenticate user & receive JWT token |
| `POST` | `/api/auth/logout` | **Yes** | None | Revoke active JWT token |
| `GET` | `/api/auth/me` | **Yes** | None | Fetch profile of logged-in user |
| `PUT` | `/api/auth/profile` | **Yes** | `{ name }` | Update user full name |
| `PUT` | `/api/auth/change-password` | **Yes** | `{ currentPassword, newPassword }` | Verify current password and update to new password |

### Notes Endpoints (`/api/notes`)

| Method | Endpoint | Auth Required | Query / Body Parameters | Purpose |
| :--- | :--- | :---: | :--- | :--- |
| `GET` | `/api/notes` | **Yes** | Query: `search`, `page`, `limit`, `sortBy`, `sortOrder` | List, search, & paginate user's notes |
| `POST` | `/api/notes` | **Yes** | Body: `{ title, content }` | Create a new note |
| `GET` | `/api/notes/:id` | **Yes** | Params: `id` | Get note by ID (owner restricted) |
| `PUT` | `/api/notes/:id` | **Yes** | Params: `id`, Body: `{ title, content }` | Update existing note |
| `DELETE` | `/api/notes/:id` | **Yes** | Params: `id` | Delete note by ID |

---

## 14. Authentication & Security

1. **Password Security**: Passwords are hashed using `bcryptjs` with salt factor 10. Raw passwords are never stored or returned in API queries (`select: false` on Mongoose `User` model).
2. **JWT Tokens**: Signed using `jsonwebtoken` containing user identity and unique `jti` (JWT ID).
3. **Stateful Token Revocation**: Upon calling `POST /api/auth/logout`, the token's `jti` is inserted into the `TokenRevocation` collection in MongoDB. Subsequent requests with that token are rejected by `authMiddleware`.
4. **Credential Versioning**: Changing a user's password increments `credentialVersion`, rendering existing tokens invalid.
5. **XSS Protection**: Frontend markdown previews pass generated HTML through `DOMPurify.sanitize()` prior to rendering.

---

## 15. Testing

### Backend Testing
Backend unit and integration tests are located in `backend/tests/` and use **Mocha**, **Chai**, **Sinon**, and **Supertest**.

Run backend tests:
```bash
cd backend
npm test
```

Test coverage includes:
- Auth controller & service tests (`auth.controller.test.ts`, `auth.service.test.ts`)
- Note controller & service tests (`note.controller.test.ts`, `note.service.test.ts`)
- Middleware & error handling tests (`errorHandler.test.ts`, `healthAndMiddleware.test.ts`, `jwt.test.ts`)

### Frontend Testing
Frontend component and context tests are located in `frontend/src/**/__tests__/` and use **Jest** and **React Testing Library**.

Run frontend tests:
```bash
cd frontend
npm test
```

Test coverage includes:
- Authentication state management (`AuthContext.test.tsx`)
- Form components (`Login.test.tsx`, `Register.test.tsx`, `Profile.test.tsx`)
- Note components & pages (`NoteCard.test.tsx`, `NoteEditor.test.tsx`, `Dashboard.test.tsx`, `NoteEditorPage.test.tsx`)

---

## 16. Code Coverage

Generating LCOV reports produces standard test coverage data utilized locally and ingested by SonarQube.

### Generate Backend Coverage
```bash
cd backend
npm run test:coverage
```
- Output Path: `backend/coverage/lcov.info`

### Generate Frontend Coverage
```bash
cd frontend
npm run test:coverage
```
- Output Path: `frontend/coverage/lcov.info`

---

## 17. SonarQube Integration

The project is configured for static code quality, security vulnerability, and code coverage monitoring using **SonarQube Community Build**.

### Configuration File (`sonar-project.properties`)
```properties
sonar.projectKey=notes-app-mern
sonar.projectName=Notes App (Frontend & Backend)
sonar.projectVersion=1.0.0

sonar.sources=frontend/src,backend/src
sonar.tests=frontend/src,backend/tests
sonar.test.inclusions=frontend/src/**/__tests__/**,backend/tests/**/*.test.ts
sonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/**,.scannerwork/**,frontend/src/test/**,frontend/src/**/__tests__/**

sonar.typescript.tsconfigPaths=frontend/tsconfig.json,backend/tsconfig.json
sonar.javascript.lcov.reportPaths=frontend/coverage/lcov.info,backend/coverage/lcov.info
```

### How to Run SonarScanner
1. Generate test coverage for both backend and frontend.
2. Run the `sonar-scanner` command from the root directory:
   ```bash
   sonar-scanner -Dsonar.host.url=http://localhost:9000 -Dsonar.token=<your_sonarqube_token>
   ```

### Analysis Screenshots
Pre-analyzed SonarQube metrics and reports are documented in the `SonarQube Analysis Screeshots/` directory:
- `Dashboard pic.png`: Quality Gate status and metrics summary
- `Activity Graph pic (Coverage).png`: Code coverage trend graphs
- `Issues list pic.png`: Issue breakdown by severity and reliability

---

## 18. Docker & Local SonarQube

While NoteNest application services run directly via Node.js and MongoDB, Docker can be used to run a local SonarQube Community Build server instance:

```bash
docker run -d --name sonarqube -p 9000:9000 sonarqube:community
```

Access the local SonarQube dashboard at `http://localhost:9000` (default credentials: `admin` / `admin`).

---

## 19. Common Commands Reference

| Task | Location | Command |
| :--- | :--- | :--- |
| **Install backend dependencies** | `backend/` | `npm install` |
| **Start backend in dev mode** | `backend/` | `npm run dev` |
| **Build backend for production** | `backend/` | `npm run build` |
| **Start backend production server** | `backend/` | `npm start` |
| **Typecheck backend source** | `backend/` | `npm run typecheck` |
| **Typecheck backend tests** | `backend/` | `npm run typecheck:test` |
| **Run backend unit tests** | `backend/` | `npm test` |
| **Run backend test coverage** | `backend/` | `npm run test:coverage` |
| **Install frontend dependencies** | `frontend/` | `npm install` |
| **Start frontend in dev mode** | `frontend/` | `npm run dev` |
| **Build frontend for production** | `frontend/` | `npm run build` |
| **Preview frontend production build** | `frontend/` | `npm run preview` |
| **Typecheck frontend code** | `frontend/` | `npm run typecheck` |
| **Run frontend tests** | `frontend/` | `npm test` |
| **Run frontend test coverage** | `frontend/` | `npm run test:coverage` |

---

## 20. Troubleshooting

### 1. Backend Cannot Connect to MongoDB
- **Symptom**: `MongooseServerSelectionError: connect ECONNREFUSED`
- **Solution**: Ensure MongoDB service is running locally (`mongod`), or check if your `MONGODB_URI` string in `backend/.env` is correct.

### 2. Frontend Cannot Reach Backend API
- **Symptom**: `Network Error` or `404 Not Found` on API requests
- **Solution**: Verify backend is running on port `5000`. Confirm Vite proxy configuration in `frontend/vite.config.ts` targets `http://localhost:5000`.

### 3. Missing `JWT_SECRET` Error
- **Symptom**: Backend crashes on startup with `JWT_SECRET must be configured...`
- **Solution**: Create `backend/.env` and define a valid `JWT_SECRET`. Outside development, the secret must be at least 32 characters long.

### 4. Port `5000` or `3000` Already in Use
- **Symptom**: `Error: listen EADDRINUSE: address already in use :::5000`
- **Solution**: Stop any background process using the port, or change the `PORT` variable in `backend/.env`.

---

## 21. Development Workflow

1. **Pull & Update**: Pull latest changes from git and update dependencies if necessary (`npm install`).
2. **Environment Verification**: Ensure `backend/.env` is configured correctly.
3. **Start Services**: Run backend (`npm run dev` in `backend/`) and frontend (`npm run dev` in `frontend/`).
4. **Develop**: Implement features or fixes in TypeScript.
5. **Quality Verification**:
   - Run typechecks: `npm run typecheck` in both folders.
   - Run tests: `npm test` in both folders.
   - Generate coverage: `npm run test:coverage` in both folders.
6. **SonarQube Analysis**: Trigger `sonar-scanner` locally to ensure Quality Gate pass.
7. **Commit & PR**: Commit verified code and open a pull request.

---

## 22. Code Quality Standards

- **Strict Type System**: Explicit TypeScript interfaces and models; no untyped explicit `any` mutations.
- **Security Hardening**: HTTP header defense (`helmet`), CORS restriction, DOMPurify XSS sanitization.
- **Structured Error Handling**: Custom `ApiError` class with standardized JSON response schema (`ApiResponse`).
- **Pino Logging**: Contextual structured logging across environment levels.

---

## 23. Security Notes

- **Password Encryption**: Implemented using `bcryptjs` password hashing.
- **Token Invalidation**: Server-side JWT revocation via `TokenRevocation` model in MongoDB on logout.
- **Header Protection**: Enforced via Helmet security headers.
- **Data Isolation**: Notes queries are strictly locked to the authenticated user's ID (`req.user.id`).
- **Environment Confidentiality**: Secret keys are kept strictly within `.env` files which are excluded via `.gitignore`.

---

## 24. Git & Contribution Guidelines

1. Create a feature branch off `main` or `develop`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Write clean code following existing folder structures and TypeScript conventions.
3. Verify typechecking and test suites pass locally prior to staging.
4. Commit changes with clear, descriptive commit messages.
5. Push your branch and open a Pull Request.

---

## 25. Project Status

- **Backend Typecheck**: Passed (0 errors)
- **Frontend Typecheck**: Passed (0 errors)
- **Backend Test Suite**: Verified passing
- **Frontend Test Suite**: Verified passing
- **SonarQube Quality Gate**: Configured and documented in `sonar-project.properties`
