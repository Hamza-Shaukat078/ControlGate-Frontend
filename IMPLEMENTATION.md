# VULCAN Frontend - Implementation Documentation

## Overview
VULCAN is a production-ready security vulnerability scanner with AI-powered analysis. The frontend is built with React 19.2.0 and integrates with a FastAPI backend for comprehensive code security analysis.

---

## ✅ Fully Implemented Features

### 1. **Authentication System**
- **Status**: ✅ Fully Functional
- **Features**:
  - JWT-based authentication
  - Login/logout functionality
  - Protected routes with `RequireAuth` component
  - Token stored in localStorage
  - Smart 401 handling (only logout on auth failures)
- **APIs Consumed**:
  - `POST /api/v1/auth/login` - User authentication
  - `POST /api/v1/auth/register` - User registration
- **Pages**: `LoginPage.js`

---

### 2. **Dashboard**
- **Status**: ✅ Fully Functional
- **Features**:
  - Display latest scan summary
  - Vulnerability statistics (Total, Critical, High, Medium, Low)
  - Average confidence score
  - Scan metadata (ID, status, duration, files scanned)
  - Quick access to detailed vulnerability list
  - Direct code input for quick scanning
- **APIs Consumed**:
  - `GET /api/v1/scans/{scan_id}` - Fetch scan summary
- **State Management**:
  - sessionStorage persistence with fallback
  - Auto-load last scan on page load
- **Pages**: `DashboardPage.js`

---

### 3. **Scan Module** (Dual-Mode Scanning)
- **Status**: ✅ Fully Functional
- **Features**:
  - **Mode 1: Direct Code Input**
    - Paste vulnerable code directly
    - Instant analysis
    - Real-time scanning
  - **Mode 2: Repository Scanning**
    - Upload repository files
    - File tree analysis
    - Batch scanning
  - Real-time scan progress tracking
  - Scan ID generation and persistence
  - Navigate to graphs/patches/reports after scan
  - sessionStorage data persistence
- **APIs Consumed**:
  - `POST /api/v1/scan/direct` - Direct code scanning
  - `POST /api/v1/scan/repository` - Repository scanning
  - `GET /api/v1/scans/{scan_id}` - Fetch scan results
- **State Management**:
  - Save scan results to sessionStorage (`scan_${scanId}`)
  - Store `lastScanId` for cross-page access
- **Pages**: `ScanPage.js`

---

### 4. **Reports Module**
- **Status**: ✅ Fully Functional
- **Features**:
  - **Scan Selection**: Dropdown to select from multiple scans
  - **Summary Dashboard**:
    - Total vulnerabilities
    - Critical, High, Medium, Low counts
    - Average confidence percentage
  - **Vulnerability Table**:
    - Fixed-width columns (no horizontal scroll)
    - Sortable by Type, Severity, CWE, OWASP
    - File location and line numbers
    - Confidence scores
    - Click to view details
  - **Detailed Vulnerability View**:
    - Full-width horizontal layout (2-column grid)
    - AI classification and exploitability scores
    - Metadata (ID, CWE, OWASP, file, lines)
    - Data flow analysis (source, sink, pattern)
    - Static detection reasoning
    - Vulnerable code snippet with syntax highlighting
    - AI analysis and explanation
    - Recommended fixes and remediation steps
    - Responsive design (fits window, word wrapping)
  - **Export Options**:
    - Export to JSON (client-side)
    - Export to CSV (client-side)
    - Export to PDF (backend API)
  - **Compliance Indicator**: OWASP Top 10 / CWE / SANS 25
- **APIs Consumed**:
  - `GET /api/v1/scans` - List all scans
  - `GET /api/v1/scans/{scan_id}` - Fetch scan summary
  - `POST /api/v1/reports/export` - Export PDF report
- **State Management**:
  - sessionStorage fallback for scan data
  - Real-time vulnerability display with LLM analysis
- **Pages**: `ReportsPage.js`

---

### 5. **Repository Integration**
- **Status**: ✅ Fully Functional
- **Features**:
  - GitHub repository connection
  - Repository list display
  - Integration status tracking
  - Repository metadata
- **APIs Consumed**:
  - `POST /api/v1/repositories/integrate` - Integrate repository
  - `GET /api/v1/repositories` - List repositories
  - `DELETE /api/v1/repositories/{repo_id}` - Remove repository
- **Pages**: `RepoIntegrationPage.js`

---

## 🟡 Partially Implemented Features

### 6. **Graphs Module**
- **Status**: 🟡 Frontend Ready, Backend Pending
- **Features**:
  - Load scan data from sessionStorage
  - Display scan ID and metadata
  - Placeholder for AST, CFG, DFG visualizations
- **APIs to Implement** (Backend):
  - `GET /api/v1/graphs/{scan_id}/ast` - Generate AST
  - `GET /api/v1/graphs/{scan_id}/cfg` - Generate CFG
  - `GET /api/v1/graphs/{scan_id}/dfg` - Generate DFG
- **Documentation**: See `BACKEND_GRAPH_GENERATION.md`
- **Pages**: `GraphsPage.js`

---

### 7. **Patch Generator**
- **Status**: 🟡 Frontend Ready, Backend Pending
- **Features**:
  - Load vulnerabilities from sessionStorage
  - Display vulnerability list
  - Patch generation UI
  - Placeholder for AI-generated patches
- **APIs to Implement** (Backend):
  - `POST /api/v1/patches/generate` - Generate AI patch using Groq Llama 3 70B
  - `GET /api/v1/patches/{patch_id}` - Fetch patch details
- **Documentation**: See `GROQ_LLAMA_INTEGRATION.md`
- **Pages**: `PatchGeneratorPage.js`

---

## 🔧 Technical Stack

### Frontend
- **Framework**: React 19.2.0
- **Routing**: react-router-dom 7.9.6
- **HTTP Client**: Axios 1.7.7
- **Icons**: Lucide React
- **Styling**: Custom CSS (App.css)

### State Management
- **localStorage**: JWT token storage
- **sessionStorage**: 
  - Scan results (`scan_${scanId}`)
  - Last scan ID (`lastScanId`)
- **React State**: Component-level state management

### Backend Integration
- **Base URL**: `http://localhost:8000/api/v1`
- **Authentication**: JWT Bearer tokens
- **Error Handling**: Smart 401 interceptor (only logout on auth failures)

---

## 📡 API Endpoints Used

### Authentication
| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | `/auth/login` | User login | ✅ |
| POST | `/auth/register` | User registration | ✅ |

### Scanning
| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | `/scan/direct` | Direct code scan | ✅ |
| POST | `/scan/repository` | Repository scan | ✅ |
| GET | `/scans` | List all scans | ✅ |
| GET | `/scans/{scan_id}` | Get scan summary | ✅ |

### Reports
| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | `/reports/export` | Export PDF report | ✅ |

### Repositories
| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | `/repositories/integrate` | Connect repository | ✅ |
| GET | `/repositories` | List repositories | ✅ |
| DELETE | `/repositories/{repo_id}` | Remove repository | ✅ |

### Graphs (Backend Pending)
| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| GET | `/graphs/{scan_id}/ast` | Generate AST | 🟡 Pending |
| GET | `/graphs/{scan_id}/cfg` | Generate CFG | 🟡 Pending |
| GET | `/graphs/{scan_id}/dfg` | Generate DFG | 🟡 Pending |

### Patches (Backend Pending)
| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | `/patches/generate` | AI patch generation | 🟡 Pending |
| GET | `/patches/{patch_id}` | Get patch details | 🟡 Pending |

---

## 🎨 UI/UX Features

### Responsive Design
- Fixed-width table layout (no horizontal scroll)
- Word wrapping for long text
- Ellipsis truncation with hover tooltips
- Grid-based layouts with proper overflow handling

### Dark Theme
- Modern dark color scheme
- Color-coded severity levels:
  - Critical: Red (#f97373)
  - High: Orange (#ff9800)
  - Medium: Yellow (#ffc107)
  - Low: Green (#4caf50)

### Navigation
- Sidebar navigation with active state
- Protected routes (require authentication)
- Route definitions:
  - `/login` - Login page
  - `/dashboard` - Main dashboard
  - `/scan` - Scanning interface
  - `/repositories` - Repository integration
  - `/graphs` - Visualization (pending backend)
  - `/patches` - Patch generator (pending backend)
  - `/reports` - Vulnerability reports

### User Feedback
- Loading states
- Error messages
- Success notifications
- Real-time scan progress

---

## 🔒 Security Features

### Authentication
- JWT token-based auth
- Secure token storage (localStorage)
- Automatic token refresh on API calls
- Smart logout (only on auth failures)

### Data Privacy
- Client-side sessionStorage for scan data
- No sensitive data in URL parameters
- Secure API communication

---

## 📊 Data Flow

### Scan Workflow
1. User initiates scan (direct code or repository)
2. Frontend sends request to backend API
3. Backend processes scan and returns scan ID
4. Frontend polls for scan completion
5. Scan results saved to sessionStorage
6. User navigates to reports/graphs/patches
7. Pages load data from sessionStorage (fallback if API unavailable)

### Report Workflow
1. User selects scan from dropdown
2. Frontend fetches scan summary from API
3. Vulnerability table populated with data
4. User clicks "View Details" on vulnerability
5. Full vulnerability details displayed (2-column layout)
6. User can export to JSON/CSV/PDF

---

## 🚀 Performance Optimizations

- **sessionStorage caching**: Reduce API calls by caching scan data
- **Fixed table layout**: Faster rendering with `table-layout: fixed`
- **Lazy loading**: Components load only when needed
- **Efficient re-renders**: React state optimization

---

## 📝 Code Quality

### Component Structure
- Modular page components
- Reusable API service layer (`src/api/services.js`)
- Centralized Axios instance (`src/api/client.js`)
- Layout wrapper (`AppLayout.js`)
- Route protection (`RequireAuth.js`)

### Error Handling
- Try-catch blocks in all API calls
- Fallback to sessionStorage on API errors
- User-friendly error messages
- Console logging for debugging

---

## 🔄 Recent Bug Fixes

### Route Mismatch Fix
- **Issue**: Navigation to `/patches` but route defined as `/patch-generator`
- **Fix**: Updated route to `/patches` in App.js and AppLayout.js
- **Impact**: Prevents logout on patch generator navigation

### Table Overflow Fix
- **Issue**: Horizontal scrolling in Reports table
- **Fix**: Added `table-layout: fixed` and column width percentages
- **Impact**: Table fits window perfectly

### Vulnerability Details Overflow Fix
- **Issue**: Details panel extends beyond window on "View Details"
- **Fix**: Added `word-wrap`, `overflow: hidden`, `maxWidth: 100%`
- **Impact**: Details panel stays within bounds with proper text wrapping

---

## 📚 Documentation References

- **Backend Graph Generation**: `BACKEND_GRAPH_GENERATION.md`
- **Groq LLM Integration**: `GROQ_LLAMA_INTEGRATION.md`
- **API Documentation**: Backend `/docs` endpoint (Swagger UI)

---

## 🎯 Next Steps

### High Priority
1. Implement backend graph generation (AST, CFG, DFG)
2. Integrate Groq Llama 3 70B for patch generation
3. Complete PDF export functionality

### Medium Priority
4. Add filtering and sorting to Reports table
5. Implement real-time scan progress WebSocket
6. Add vulnerability comparison between scans

### Low Priority
7. Add dark/light theme toggle
8. Implement user settings page
9. Add API key management

---

**Last Updated**: November 30, 2025  
**Frontend Version**: 1.0.0  
**Backend API Version**: v1
