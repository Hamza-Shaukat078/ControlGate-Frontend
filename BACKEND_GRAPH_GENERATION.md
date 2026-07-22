# Backend Graph Generation Guide (AST, CFG, DFG)

## Problem Statement

The scan is completing successfully and detecting vulnerabilities, but the graph endpoints are returning empty `nodes` and `edges`:

```json
{
    "type": "AST",
    "nodes": [],
    "edges": [],
    "error": "Scan not found",
    "detail": "No scan found with ID: scan-123"
}
```

## Root Cause

The backend is **not generating graph data structures** during the scan process. You need to:

1. Parse the scanned code into AST/CFG/DFG representations
2. Store graph data in the database during scan processing
3. Return graph data via the `/graphs/{scan_id}/file/{file_id}` endpoint

## Solution Overview

### 1. Graph Generation During Scan

When processing a scan (direct code or repository), generate all three graph types:

```python
# In process_direct_code_scan() or process_repository_scan()

async def process_direct_code_scan(
    scan_id: str,
    code: str,
    language: str,
    scan_mode: str
):
    try:
        await update_scan_status(scan_id, "RUNNING", progress=0)
        
        # Create temp file
        ext_map = {"python": ".py", "javascript": ".js", "java": ".java"}
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
            await update_scan_status(scan_id, "RUNNING", progress=25)
            
            # ===== GENERATE GRAPHS =====
            file_id = "file-1"  # For direct code, use single file ID
            
            # Generate AST (Abstract Syntax Tree)
            ast_graph = await generate_ast(tmp_path, language)
            await save_graph(scan_id, file_id, "AST", ast_graph)
            
            # Generate CFG (Control Flow Graph)
            cfg_graph = await generate_cfg(tmp_path, language)
            await save_graph(scan_id, file_id, "CFG", cfg_graph)
            
            # Generate DFG (Data Flow Graph)
            dfg_graph = await generate_dfg(tmp_path, language)
            await save_graph(scan_id, file_id, "DFG", dfg_graph)
            
            await update_scan_status(scan_id, "RUNNING", progress=50)
            
            # Run vulnerability detection
            vulnerabilities = await run_semantic_engines(
                file_path=tmp_path,
                language=language,
                scan_mode=scan_mode
            )
            
            await update_scan_status(scan_id, "RUNNING", progress=75)
            await save_scan_results(scan_id, vulnerabilities)
            
            await update_scan_status(
                scan_id,
                "COMPLETED",
                progress=100,
                vulnerabilities_found=len(vulnerabilities)
            )
            
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
                
    except Exception as e:
        await update_scan_status(scan_id, "FAILED", error=str(e))
```

### 2. Graph Generation Functions

Use Python AST library for Python code, and similar tools for other languages:

#### Python AST Generation

```python
import ast
import json

async def generate_ast(file_path: str, language: str) -> dict:
    """Generate Abstract Syntax Tree"""
    if language != "python":
        return {"nodes": [], "edges": []}
    
    with open(file_path, 'r') as f:
        code = f.read()
    
    try:
        tree = ast.parse(code)
        nodes = []
        edges = []
        node_id = 0
        
        def visit_node(node, parent_id=None):
            nonlocal node_id
            current_id = f"ast-{node_id}"
            node_id += 1
            
            # Extract node info
            nodes.append({
                "id": current_id,
                "label": node.__class__.__name__,
                "type": "ast_node",
                "node_type": node.__class__.__name__,
                "line": getattr(node, 'lineno', None),
                "col": getattr(node, 'col_offset', None),
                "code": ast.get_source_segment(code, node) if hasattr(ast, 'get_source_segment') else ""
            })
            
            # Create edge from parent
            if parent_id:
                edges.append({
                    "from": parent_id,
                    "to": current_id,
                    "type": "contains"
                })
            
            # Visit children
            for child in ast.iter_child_nodes(node):
                visit_node(child, current_id)
        
        visit_node(tree)
        
        return {
            "nodes": nodes,
            "edges": edges,
            "metadata": {
                "total_nodes": len(nodes),
                "total_edges": len(edges)
            }
        }
        
    except SyntaxError as e:
        return {
            "nodes": [],
            "edges": [],
            "error": f"Syntax error: {str(e)}"
        }

async def generate_cfg(file_path: str, language: str) -> dict:
    """Generate Control Flow Graph"""
    if language != "python":
        return {"nodes": [], "edges": []}
    
    # For Python, you can use libraries like:
    # - staticfg
    # - pycfg
    # - or build your own CFG generator
    
    # Simplified example:
    with open(file_path, 'r') as f:
        code = f.read()
    
    try:
        tree = ast.parse(code)
        nodes = []
        edges = []
        node_id = 0
        
        # Extract function definitions and control flow
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                func_id = f"cfg-func-{node_id}"
                node_id += 1
                
                nodes.append({
                    "id": func_id,
                    "label": node.name,
                    "type": "function",
                    "line": node.lineno,
                    "code": f"def {node.name}(...)"
                })
                
                # Add basic blocks for if/while/for statements
                for stmt in ast.walk(node):
                    if isinstance(stmt, (ast.If, ast.While, ast.For)):
                        block_id = f"cfg-block-{node_id}"
                        node_id += 1
                        
                        nodes.append({
                            "id": block_id,
                            "label": stmt.__class__.__name__,
                            "type": "control_block",
                            "line": stmt.lineno
                        })
                        
                        edges.append({
                            "from": func_id,
                            "to": block_id,
                            "type": "control_flow"
                        })
        
        return {
            "nodes": nodes,
            "edges": edges,
            "metadata": {
                "total_nodes": len(nodes),
                "total_edges": len(edges)
            }
        }
        
    except Exception as e:
        return {"nodes": [], "edges": [], "error": str(e)}

async def generate_dfg(file_path: str, language: str) -> dict:
    """Generate Data Flow Graph"""
    if language != "python":
        return {"nodes": [], "edges": []}
    
    with open(file_path, 'r') as f:
        code = f.read()
    
    try:
        tree = ast.parse(code)
        nodes = []
        edges = []
        node_id = 0
        variables = {}  # Track variable definitions
        
        for node in ast.walk(tree):
            # Variable assignments
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        var_id = f"dfg-var-{node_id}"
                        node_id += 1
                        
                        nodes.append({
                            "id": var_id,
                            "label": target.id,
                            "type": "variable",
                            "line": node.lineno,
                            "code": ast.unparse(node) if hasattr(ast, 'unparse') else target.id
                        })
                        
                        variables[target.id] = var_id
                        
                        # Check if assignment uses other variables
                        for name_node in ast.walk(node.value):
                            if isinstance(name_node, ast.Name) and name_node.id in variables:
                                edges.append({
                                    "from": variables[name_node.id],
                                    "to": var_id,
                                    "type": "data_flow"
                                })
            
            # Function calls
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    call_id = f"dfg-call-{node_id}"
                    node_id += 1
                    
                    nodes.append({
                        "id": call_id,
                        "label": node.func.id,
                        "type": "function_call",
                        "line": node.lineno
                    })
                    
                    # Connect variables passed as arguments
                    for arg in node.args:
                        if isinstance(arg, ast.Name) and arg.id in variables:
                            edges.append({
                                "from": variables[arg.id],
                                "to": call_id,
                                "type": "data_flow"
                            })
        
        return {
            "nodes": nodes,
            "edges": edges,
            "metadata": {
                "total_nodes": len(nodes),
                "total_edges": len(edges)
            }
        }
        
    except Exception as e:
        return {"nodes": [], "edges": [], "error": str(e)}
```

### 3. Database Schema for Graphs

```sql
CREATE TABLE graphs (
    id SERIAL PRIMARY KEY,
    scan_id VARCHAR(50) NOT NULL,
    file_id VARCHAR(50) NOT NULL,
    graph_type VARCHAR(10) NOT NULL,  -- 'AST', 'CFG', 'DFG'
    nodes JSONB NOT NULL,
    edges JSONB NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scan_id) REFERENCES scans(scan_id),
    UNIQUE (scan_id, file_id, graph_type)
);

-- Index for faster queries
CREATE INDEX idx_graphs_scan_file ON graphs(scan_id, file_id);
```

### 4. Save Graph Function

```python
async def save_graph(
    scan_id: str,
    file_id: str,
    graph_type: str,
    graph_data: dict
):
    """Save graph to database"""
    # Using SQLAlchemy or raw SQL
    query = """
        INSERT INTO graphs (scan_id, file_id, graph_type, nodes, edges, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (scan_id, file_id, graph_type)
        DO UPDATE SET
            nodes = EXCLUDED.nodes,
            edges = EXCLUDED.edges,
            metadata = EXCLUDED.metadata
    """
    
    await db.execute(
        query,
        scan_id,
        file_id,
        graph_type,
        json.dumps(graph_data.get("nodes", [])),
        json.dumps(graph_data.get("edges", [])),
        json.dumps(graph_data.get("metadata", {}))
    )
```

### 5. Graph Endpoint Implementation

```python
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

@router.get("/graphs/{scan_id}/file/{file_id}")
async def get_graph(
    scan_id: str,
    file_id: str,
    type: str = Query("AST", regex="^(AST|CFG|DFG)$")
):
    """
    Get graph data for a specific scan and file
    """
    # First check if scan exists
    scan = await get_scan_by_id(scan_id)
    if not scan:
        raise HTTPException(
            status_code=404,
            detail=f"No scan found with ID: {scan_id}"
        )
    
    # Fetch graph from database
    query = """
        SELECT nodes, edges, metadata, graph_type
        FROM graphs
        WHERE scan_id = $1 AND file_id = $2 AND graph_type = $3
    """
    
    result = await db.fetchrow(query, scan_id, file_id, type)
    
    if not result:
        # If no graph exists, generate it on-demand (fallback)
        return {
            "type": type,
            "nodes": [],
            "edges": [],
            "error": "Graph not generated during scan",
            "detail": "Please re-run the scan to generate graph data"
        }
    
    return {
        "type": type,
        "scan_id": scan_id,
        "file_id": file_id,
        "nodes": result['nodes'],
        "edges": result['edges'],
        "metadata": result['metadata']
    }
```

### 6. Advanced Graph Libraries (Optional)

For production-quality graphs, consider these Python libraries:

#### For Python Code Analysis:
```bash
pip install astroid  # Advanced AST analysis
pip install staticfg  # CFG generation
pip install libsa4py  # Static analysis for Python
```

#### For JavaScript/TypeScript:
```bash
npm install @babel/parser  # AST generation
npm install esprima  # JavaScript parser
```

#### For Java:
```bash
# Use JavaParser library
# Or Eclipse JDT for AST
```

## Testing Graph Generation

```bash
# After implementing, test with:
curl -X GET "http://localhost:8000/api/v1/graphs/scan-7a20936e45af/file/file-1?type=AST" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response:
```json
{
    "type": "AST",
    "scan_id": "scan-7a20936e45af",
    "file_id": "file-1",
    "nodes": [
        {
            "id": "ast-0",
            "label": "Module",
            "type": "ast_node",
            "line": 1
        },
        {
            "id": "ast-1",
            "label": "FunctionDef",
            "type": "ast_node",
            "line": 5,
            "code": "def vulnerable_function():"
        }
    ],
    "edges": [
        {
            "from": "ast-0",
            "to": "ast-1",
            "type": "contains"
        }
    ],
    "metadata": {
        "total_nodes": 25,
        "total_edges": 24
    }
}
```

## Quick Implementation Checklist

- [ ] Install required libraries (`pip install astroid staticfg`)
- [ ] Create `graphs` table in database
- [ ] Implement `generate_ast()`, `generate_cfg()`, `generate_dfg()` functions
- [ ] Add `save_graph()` function to persist graph data
- [ ] Update `process_direct_code_scan()` to call graph generators
- [ ] Update `process_repository_scan()` to generate graphs for each file
- [ ] Implement `/graphs/{scan_id}/file/{file_id}` endpoint
- [ ] Test with direct code scan
- [ ] Verify frontend receives and displays graph data

## Frontend Integration Note

The frontend is already configured to call the graph endpoint and render nodes/edges. Once you implement the backend graph generation, the visualization will work automatically!

Current frontend call:
```javascript
const res = await graphService.getGraph(scanId, fileId, graphType);
// Expects: { nodes: [...], edges: [...] }
```
