# Backend Integration Guide for Dual-Mode Scan Endpoint

## Frontend Implementation Summary

The frontend ScanPage now supports **two input modes**:

1. **Direct Code Scan** - Paste code directly (up to 400 lines)
2. **Repository Scan** - Select from integrated repositories

## Backend API Requirements

### Endpoint: `POST /api/v1/scans/start`

The backend must accept **both** direct code input and repository-based scans in a single unified endpoint.

### Request Schema (Pydantic Model)

```python
from pydantic import BaseModel, Field, validator
from typing import Optional
from enum import Enum

class ScanMode(str, Enum):
    QUICK = "QUICK"
    DEEP = "DEEP"
    CUSTOM = "CUSTOM"

class Language(str, Enum):
    PYTHON = "python"
    JAVASCRIPT = "javascript"
    JAVA = "java"
    C = "c"
    CPP = "cpp"
    GO = "go"
    PHP = "php"

class ScanRequest(BaseModel):
    # Direct code scan fields
    code: Optional[str] = Field(None, description="Direct code input (max 400 lines)")
    language: Optional[Language] = Field(None, description="Programming language for direct code")
    
    # Repository scan fields
    repo_id: Optional[str] = Field(None, description="Repository ID from database")
    branch: Optional[str] = Field("main", description="Git branch to scan")
    
    # Common fields
    scan_mode: ScanMode = Field(ScanMode.DEEP, description="Scan depth/mode")
    
    @validator('code')
    def validate_code_length(cls, v):
        if v is not None:
            line_count = len(v.split('\n'))
            if line_count > 400:
                raise ValueError(f"Code exceeds 400-line limit (got {line_count} lines)")
        return v
    
    @validator('repo_id', always=True)
    def validate_input_mode(cls, v, values):
        code = values.get('code')
        # Either code OR repo_id must be provided, not both
        if code and v:
            raise ValueError("Provide either 'code' or 'repo_id', not both")
        if not code and not v:
            raise ValueError("Either 'code' or 'repo_id' must be provided")
        return v
```

### Response Schema

```python
class ScanResponse(BaseModel):
    scan_id: str = Field(..., description="Unique scan identifier for polling")
    status: str = Field("PENDING", description="Initial scan status")
    message: str = Field("Scan initiated successfully")
    created_at: str = Field(..., description="ISO timestamp of scan creation")
```

### FastAPI Route Implementation Example

```python
from fastapi import APIRouter, HTTPException, BackgroundTasks
from uuid import uuid4
from datetime import datetime

router = APIRouter()

@router.post("/scans/start", response_model=ScanResponse)
async def start_scan(
    request: ScanRequest,
    background_tasks: BackgroundTasks
):
    """
    Start a vulnerability scan with dual input modes:
    - Direct code: Analyze code snippet directly
    - Repository: Clone and scan repository from database
    """
    scan_id = f"scan-{uuid4().hex[:8]}"
    
    try:
        if request.code:
            # DIRECT CODE SCAN MODE
            # 1. Save code to temporary file/storage
            # 2. Detect language (use request.language)
            # 3. Run semantic analysis engines
            scan_data = {
                "scan_id": scan_id,
                "input_type": "DIRECT_CODE",
                "language": request.language,
                "code_length": len(request.code.split('\n')),
                "scan_mode": request.scan_mode,
                "status": "PENDING"
            }
            
            # Add background task for async processing
            background_tasks.add_task(
                process_direct_code_scan,
                scan_id=scan_id,
                code=request.code,
                language=request.language,
                scan_mode=request.scan_mode
            )
            
        else:
            # REPOSITORY SCAN MODE
            # 1. Fetch repository from database using repo_id
            # 2. Clone repository (if not cached)
            # 3. Checkout specified branch
            # 4. Run scan on repository
            scan_data = {
                "scan_id": scan_id,
                "input_type": "REPOSITORY",
                "repo_id": request.repo_id,
                "branch": request.branch,
                "scan_mode": request.scan_mode,
                "status": "PENDING"
            }
            
            # Add background task for async processing
            background_tasks.add_task(
                process_repository_scan,
                scan_id=scan_id,
                repo_id=request.repo_id,
                branch=request.branch,
                scan_mode=request.scan_mode
            )
        
        # Store scan metadata in database
        await save_scan_to_db(scan_data)
        
        return ScanResponse(
            scan_id=scan_id,
            status="PENDING",
            message="Scan initiated successfully",
            created_at=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start scan: {str(e)}"
        )
```

### Background Processing Functions

```python
import tempfile
import os
from pathlib import Path

async def process_direct_code_scan(
    scan_id: str,
    code: str,
    language: str,
    scan_mode: str
):
    """Process direct code scan asynchronously"""
    try:
        # Update status to RUNNING
        await update_scan_status(scan_id, "RUNNING", progress=0)
        
        # 1. Create temporary file with appropriate extension
        ext_map = {
            "python": ".py",
            "javascript": ".js",
            "java": ".java",
            "c": ".c",
            "cpp": ".cpp",
            "go": ".go",
            "php": ".php"
        }
        ext = ext_map.get(language, ".txt")
        
        with tempfile.NamedTemporaryFile(
            mode='w',
            suffix=ext,
            delete=False,
            encoding='utf-8'
        ) as tmp_file:
            tmp_file.write(code)
            tmp_path = tmp_file.name
        
        try:
            # 2. Run semantic analysis engines
            await update_scan_status(scan_id, "RUNNING", progress=25)
            
            # Your semantic analysis logic here
            # - AST generation
            # - CFG/DFG construction
            # - Vulnerability detection
            # - Pattern matching
            
            vulnerabilities = await run_semantic_engines(
                file_path=tmp_path,
                language=language,
                scan_mode=scan_mode
            )
            
            await update_scan_status(scan_id, "RUNNING", progress=75)
            
            # 3. Store results
            await save_scan_results(scan_id, vulnerabilities)
            
            # 4. Mark as complete
            await update_scan_status(
                scan_id,
                "COMPLETED",
                progress=100,
                vulnerabilities_found=len(vulnerabilities)
            )
            
        finally:
            # Clean up temporary file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
                
    except Exception as e:
        await update_scan_status(
            scan_id,
            "FAILED",
            error=str(e)
        )

async def process_repository_scan(
    scan_id: str,
    repo_id: str,
    branch: str,
    scan_mode: str
):
    """Process repository scan asynchronously"""
    try:
        # Update status to RUNNING
        await update_scan_status(scan_id, "RUNNING", progress=0)
        
        # 1. Get repository from database
        repo = await get_repository_by_id(repo_id)
        if not repo:
            raise ValueError(f"Repository {repo_id} not found")
        
        await update_scan_status(scan_id, "RUNNING", progress=10)
        
        # 2. Clone/fetch repository
        repo_path = await clone_or_update_repository(
            repo_url=repo.url,
            branch=branch
        )
        
        await update_scan_status(scan_id, "RUNNING", progress=30)
        
        # 3. Run semantic analysis on all files
        vulnerabilities = await run_semantic_engines_on_repo(
            repo_path=repo_path,
            scan_mode=scan_mode
        )
        
        await update_scan_status(scan_id, "RUNNING", progress=80)
        
        # 4. Store results
        await save_scan_results(scan_id, vulnerabilities)
        
        # 5. Mark as complete
        await update_scan_status(
            scan_id,
            "COMPLETED",
            progress=100,
            vulnerabilities_found=len(vulnerabilities)
        )
        
    except Exception as e:
        await update_scan_status(
            scan_id,
            "FAILED",
            error=str(e)
        )
```

## Frontend Request Examples

### Direct Code Scan Request

```javascript
POST /api/v1/scans/start
Content-Type: application/json

{
  "code": "import os\n\npassword = os.getenv('PASSWORD')\nprint(password)",
  "language": "python",
  "scan_mode": "DEEP"
}
```

### Repository Scan Request

```javascript
POST /api/v1/scans/start
Content-Type: application/json

{
  "repo_id": "repo-abc123",
  "branch": "main",
  "scan_mode": "QUICK"
}
```

## Polling Endpoints (Already Implemented)

After starting a scan, frontend polls these endpoints:

1. **GET /api/v1/scans/{scan_id}/status** - Get current progress
2. **GET /api/v1/scans/{scan_id}/logs** - Get real-time logs
3. **GET /api/v1/scans/{scan_id}/summary** - Get final results

## Database Schema for Scans Table

```sql
CREATE TABLE scans (
    scan_id VARCHAR(50) PRIMARY KEY,
    input_type VARCHAR(20) NOT NULL,  -- 'DIRECT_CODE' or 'REPOSITORY'
    
    -- For direct code scans
    code_hash VARCHAR(64),  -- SHA256 of code for caching
    language VARCHAR(20),
    code_length INT,
    
    -- For repository scans
    repo_id VARCHAR(50),
    branch VARCHAR(100),
    
    -- Common fields
    scan_mode VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,  -- PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
    progress INT DEFAULT 0,
    vulnerabilities_found INT DEFAULT 0,
    ai_confidence FLOAT DEFAULT 0.0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);
```

## Testing the Integration

### Test Direct Code Scan

```bash
curl -X POST http://localhost:8000/api/v1/scans/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "code": "eval(input())",
    "language": "python",
    "scan_mode": "DEEP"
  }'
```

### Test Repository Scan

```bash
curl -X POST http://localhost:8000/api/v1/scans/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "repo_id": "repo-123",
    "branch": "main",
    "scan_mode": "QUICK"
  }'
```

## Error Handling

The backend should return clear error messages:

```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body", "code"],
      "msg": "Code exceeds 400-line limit (got 450 lines)"
    }
  ]
}
```

```json
{
  "detail": "Either 'code' or 'repo_id' must be provided"
}
```

## Implementation Checklist

- [ ] Update `ScanRequest` Pydantic model with optional `code` and `language` fields
- [ ] Add validator to enforce 400-line limit on direct code
- [ ] Add validator to ensure either `code` OR `repo_id` is provided (not both)
- [ ] Implement `process_direct_code_scan()` background task
- [ ] Create temporary file handling for direct code
- [ ] Integrate semantic analysis engines for direct code
- [ ] Update database schema to support `input_type` and code metadata
- [ ] Add proper cleanup for temporary files
- [ ] Test with 400-line code samples
- [ ] Test with repository scans
- [ ] Verify polling endpoints work for both modes
- [ ] Add logging for debugging

## Notes

- Direct code is limited to **400 lines** to prevent abuse and ensure performance
- Temporary files are created for direct code and cleaned up after processing
- Both modes share the same polling/status endpoints
- Background tasks ensure the API responds immediately
- Use FastAPI's `BackgroundTasks` for async processing
- Store `input_type` in database to differentiate scan sources
