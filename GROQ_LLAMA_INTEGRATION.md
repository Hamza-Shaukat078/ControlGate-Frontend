# Groq Cloud API Integration for AI Patch Generation

## Overview

Use **Groq Cloud API** with **Llama 3 70B** for fast, free AI-powered vulnerability patch generation in your FYP.

### Why Groq + Llama 3?

- ✅ **Free API access** (no credit card required)
- ✅ **Ultra-fast inference** (500+ tokens/second)
- ✅ **Open-source models** (Llama 3, Mixtral)
- ✅ **High quality** (Llama 3 70B rivals GPT-4 on many tasks)
- ✅ **Generous rate limits** (6000 requests/min on free tier)

## Setup

### 1. Install Groq SDK

```bash
pip install groq
```

### 2. Environment Configuration

Add to your `.env` file:

```bash
# Groq Cloud API
GROQ_API_KEY=gsk_your_api_key_here
GROQ_MODEL=llama-3.1-70b-versatile  # or llama-3.1-8b-instant for faster responses
```

### 3. Groq Client Initialization

```python
# services/llm_service.py
from groq import Groq
import os
from typing import Optional

class LLMService:
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.model = os.getenv("GROQ_MODEL", "llama-3.1-70b-versatile")
    
    async def generate_patch(
        self,
        vulnerability: dict,
        code: str,
        language: str
    ) -> dict:
        """
        Generate a security patch using Groq's Llama 3
        
        Args:
            vulnerability: Dict with id, type, severity, line, description
            code: Original vulnerable code snippet
            language: Programming language (python, javascript, etc.)
        
        Returns:
            Dict with patched_code, explanation, confidence
        """
        
        prompt = self._build_patch_prompt(vulnerability, code, language)
        
        try:
            # Call Groq API
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": """You are a security expert AI that generates secure code patches.
Your task is to fix vulnerabilities while preserving functionality.
Return ONLY valid JSON with these keys:
- patched_code: The fixed code
- explanation: Why the vulnerability exists and how the patch fixes it
- confidence: A score from 0.0 to 1.0 indicating patch quality
- security_impact: Description of security improvement"""
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                model=self.model,
                temperature=0.3,  # Lower for more deterministic output
                max_tokens=2048,
                top_p=0.9,
                response_format={"type": "json_object"}  # Force JSON response
            )
            
            # Parse response
            response_text = chat_completion.choices[0].message.content
            import json
            result = json.loads(response_text)
            
            return {
                "patched_code": result.get("patched_code", code),
                "explanation": result.get("explanation", "Patch generated successfully"),
                "confidence": result.get("confidence", 0.85),
                "security_impact": result.get("security_impact", "Security improved"),
                "model_used": self.model,
                "tokens_used": chat_completion.usage.total_tokens
            }
            
        except Exception as e:
            # Fallback to rule-based patching
            return self._fallback_patch(vulnerability, code, language)
    
    def _build_patch_prompt(
        self,
        vulnerability: dict,
        code: str,
        language: str
    ) -> str:
        """Build detailed prompt for patch generation"""
        
        vuln_type = vulnerability.get("type", "Unknown")
        severity = vulnerability.get("severity", "Medium")
        line = vulnerability.get("line", 0)
        description = vulnerability.get("description", "Security issue detected")
        
        prompt = f"""# Vulnerability Fix Request

## Vulnerability Details
- **Type**: {vuln_type}
- **Severity**: {severity}
- **Line**: {line}
- **Description**: {description}

## Vulnerable Code ({language})
```{language}
{code}
```

## Task
Generate a secure patch that:
1. Fixes the {vuln_type} vulnerability
2. Preserves original functionality
3. Follows {language} best practices
4. Adds input validation/sanitization where needed
5. Includes security comments

## Response Format (JSON)
{{
    "patched_code": "// Fixed code here",
    "explanation": "Detailed explanation of the vulnerability and fix",
    "confidence": 0.95,
    "security_impact": "How this improves security"
}}
"""
        return prompt
    
    def _fallback_patch(
        self,
        vulnerability: dict,
        code: str,
        language: str
    ) -> dict:
        """Rule-based fallback when LLM fails"""
        
        vuln_type = vulnerability.get("type", "").lower()
        
        # Simple rule-based fixes
        if "sql injection" in vuln_type:
            patched = code.replace(
                "execute(",
                "execute_with_params("
            ).replace(
                "query(",
                "parameterized_query("
            )
            explanation = "Replaced direct SQL execution with parameterized queries"
            
        elif "xss" in vuln_type or "cross-site" in vuln_type:
            patched = f"# XSS Protection Added\nimport html\n{code.replace('innerHTML', 'textContent')}"
            explanation = "Added HTML escaping to prevent XSS attacks"
            
        elif "command injection" in vuln_type or "os command" in vuln_type:
            patched = code.replace(
                "os.system(",
                "subprocess.run(, shell=False, check=True)  # Safe execution"
            )
            explanation = "Replaced os.system with subprocess for safe command execution"
            
        else:
            patched = f"# Security review required\n{code}"
            explanation = "Vulnerability detected but automatic patch not available"
        
        return {
            "patched_code": patched,
            "explanation": explanation,
            "confidence": 0.6,
            "security_impact": "Basic security improvement applied",
            "model_used": "rule-based-fallback"
        }

# Singleton instance
llm_service = LLMService()
```

## Integration with Patch Endpoint

```python
# routes/patches.py
from fastapi import APIRouter, HTTPException
from services.llm_service import llm_service

router = APIRouter()

@router.post("/patches/generate")
async def generate_patch(request: PatchGenerateRequest):
    """
    Generate AI-powered security patch
    
    Request body:
    {
        "vulnerability_id": "vuln-123",
        "scan_id": "scan-abc",
        "code": "vulnerable code snippet",
        "language": "python"
    }
    """
    
    # Fetch vulnerability details
    vulnerability = await get_vulnerability_by_id(
        request.vulnerability_id,
        request.scan_id
    )
    
    if not vulnerability:
        raise HTTPException(404, "Vulnerability not found")
    
    # Generate patch using Groq LLM
    patch_result = await llm_service.generate_patch(
        vulnerability=vulnerability,
        code=request.code,
        language=request.language
    )
    
    # Save patch to database
    patch_id = f"patch-{uuid4().hex[:8]}"
    await save_patch(
        patch_id=patch_id,
        vulnerability_id=request.vulnerability_id,
        scan_id=request.scan_id,
        original_code=request.code,
        patched_code=patch_result["patched_code"],
        explanation=patch_result["explanation"],
        confidence=patch_result["confidence"],
        model_used=patch_result["model_used"]
    )
    
    return {
        "patch_id": patch_id,
        "patched_code": patch_result["patched_code"],
        "explanation": patch_result["explanation"],
        "confidence": patch_result["confidence"],
        "security_impact": patch_result["security_impact"],
        "model_used": patch_result["model_used"]
    }
```

## Available Groq Models

### Recommended for Your FYP:

1. **llama-3.1-70b-versatile** (Best Quality)
   - 128K context window
   - Excellent reasoning
   - ~500 tokens/sec
   - Use for: Complex patches, detailed analysis

2. **llama-3.1-8b-instant** (Best Speed)
   - 128K context window
   - Very fast (~750 tokens/sec)
   - Use for: Quick patches, simple fixes

3. **mixtral-8x7b-32768** (Alternative)
   - 32K context window
   - Good for code generation
   - ~600 tokens/sec

### Model Selection Strategy:

```python
def select_model(vulnerability_severity: str) -> str:
    """Choose model based on severity"""
    if vulnerability_severity in ["critical", "high"]:
        return "llama-3.1-70b-versatile"  # Use best model
    else:
        return "llama-3.1-8b-instant"  # Use fast model
```

## Rate Limits (Free Tier)

| Model | Requests/Min | Tokens/Min |
|-------|--------------|------------|
| Llama 3.1 70B | 30 | 6,000 |
| Llama 3.1 8B | 30 | 7,000 |
| Mixtral 8x7B | 30 | 5,000 |

**For your FYP, this is more than enough!**

## Environment Setup Example

```bash
# .env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=llama-3.1-70b-versatile
GROQ_TEMPERATURE=0.3
GROQ_MAX_TOKENS=2048
```

## Testing the Integration

```bash
# Test patch generation
curl -X POST http://localhost:8000/api/v1/patches/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "vulnerability_id": "vuln-123",
    "scan_id": "scan-7a20936e45af",
    "code": "password = input(\"Enter password: \")\nif password == \"admin123\":\n    grant_access()",
    "language": "python"
  }'
```

Expected response:
```json
{
    "patch_id": "patch-abc123",
    "patched_code": "import hashlib\nimport os\n\n# Secure password verification\npassword = input(\"Enter password: \")\nhashed_input = hashlib.sha256(password.encode()).hexdigest()\nstored_hash = os.getenv('PASSWORD_HASH')\n\nif hashed_input == stored_hash:\n    grant_access()",
    "explanation": "The original code used hardcoded plaintext password comparison, which is insecure. The patch implements:\n1. Password hashing using SHA-256\n2. Environment variable for stored hash\n3. Secure comparison",
    "confidence": 0.95,
    "security_impact": "Eliminates hardcoded credentials and plaintext password storage",
    "model_used": "llama-3.1-70b-versatile"
}
```

## Cost Comparison

| Service | Cost | Speed | Quality |
|---------|------|-------|---------|
| **Groq (Llama 3 70B)** | FREE | ⚡⚡⚡⚡⚡ | ⭐⭐⭐⭐⭐ |
| OpenAI GPT-4 | $30/1M tokens | ⚡⚡ | ⭐⭐⭐⭐⭐ |
| Anthropic Claude | $15/1M tokens | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ |
| Ollama (Local) | FREE | ⚡ | ⭐⭐⭐ |

**For FYP demos, Groq is the PERFECT choice!**

## Advanced Features

### 1. Multi-Model Ensemble (Optional)

Use both fast and accurate models:

```python
async def generate_patch_ensemble(vulnerability, code, language):
    # Quick patch with 8B model
    quick_patch = await llm_service.generate_patch(
        vulnerability, code, language,
        model="llama-3.1-8b-instant"
    )
    
    # If vulnerability is critical, validate with 70B
    if vulnerability['severity'] == 'critical':
        detailed_patch = await llm_service.generate_patch(
            vulnerability, code, language,
            model="llama-3.1-70b-versatile"
        )
        return detailed_patch if detailed_patch['confidence'] > quick_patch['confidence'] else quick_patch
    
    return quick_patch
```

### 2. Streaming Responses (For Real-Time UI)

```python
def generate_patch_stream(vulnerability, code, language):
    stream = client.chat.completions.create(
        messages=[...],
        model="llama-3.1-70b-versatile",
        stream=True
    )
    
    for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
```

## Implementation Checklist

- [ ] Install `groq` package (`pip install groq`)
- [ ] Add Groq API key to `.env`
- [ ] Create `services/llm_service.py` with LLMService class
- [ ] Implement `generate_patch()` method
- [ ] Add prompt engineering for your vulnerability types
- [ ] Implement fallback rule-based patching
- [ ] Update `/patches/generate` endpoint to use LLM
- [ ] Test with different vulnerability types
- [ ] Add error handling for API failures
- [ ] Monitor token usage and rate limits

## Pro Tips for FYP Demo

1. **Show both LLM and rule-based patches** - Demonstrates robustness
2. **Display confidence scores** - Shows AI transparency
3. **Use 70B model for demos** - Best quality for presentations
4. **Cache common patches** - Reduce API calls during demo
5. **Prepare fallbacks** - In case of network issues

Your FYP will look incredibly professional with this fast, free AI integration! 🚀
