# Nvidia Client Timeout Fixes

## Problem
The application was experiencing timeout errors when calling Nvidia NIM API models, causing the entire pipeline to fail.

## Root Causes
1. **Slow/unresponsive models**: Some models (qwen/qwen2.5-coder-32b-instruct, meta/llama-3.3-70b-instruct) were timing out after 300 seconds
2. **Poor fallback logic**: The retry mechanism wasn't properly moving to next models after timeouts
3. **No exponential backoff**: Retries happened immediately without delays
4. **Long initial timeout**: 300s timeout was too long, causing delays before fallbacks

## Solutions Implemented

### 1. Reduced Timeout (300s → 60s)
- Changed default timeout from 5 minutes to 1 minute
- Faster failure detection allows quicker fallback to alternative models

### 2. Fixed Fallback Logic
- Properly moves to next model after max retries exceeded
- Uses `while` loop instead of confusing `range()` logic
- Clear separation between timeout retries and model fallbacks

### 3. Exponential Backoff
- Adds delays between retries: 1s, 2s, 4s
- Increases timeout progressively: 60s → 90s → 135s (max 180s)
- Reduces API hammering during temporary issues

### 4. Better Model Priority
Changed default models to faster, more reliable options:
- **CODE_MODEL**: `qwen/qwen2.5-coder-32b-instruct` → `meta/llama-3.1-70b-instruct`
- **REASONING_MODEL**: `nvidia/nemotron-3-super-120b-a12b` → `meta/llama-3.1-70b-instruct`

### 5. Improved Fallback Chains
Reordered to prioritize faster models:
```python
CODE_MODEL_FALLBACKS = [
    "meta/llama-3.1-70b-instruct",  # Fast and reliable ✓
    "meta/llama-3.1-8b-instruct",   # Smaller fallback ✓
    "meta/llama-3.3-70b-instruct",  # May be slower
    "qwen/qwen2.5-coder-32b-instruct",
    "qwen/qwen2.5-coder-7b-instruct",
]
```

### 6. Connection Retry Strategy
- Added HTTP session with automatic retry for connection errors
- Handles 429, 500, 502, 503, 504 status codes
- Backoff factor of 1 second between retries

### 7. Better Error Messages
- Clear indicators: ✓ (success), ⚠ (warning), ✗ (error)
- Shows current timeout and attempt number
- Explains why each fallback is triggered

### 8. Model Testing Utility
Created `test_nvidia_models.py` to check model availability before running main pipeline.

## Verification
Tested that `meta/llama-3.1-8b-instruct` responds successfully with 30s timeout.

## Usage
Just run `py main.py` - the fixes are automatic. The client will now:
1. Try the primary model with 60s timeout
2. If it times out, retry with exponential backoff
3. If all retries fail, move to next model in fallback chain
4. Continue until a working model is found

## Files Modified
- `clients/nvidia_client.py` - Main fixes
- `.env` - Updated default models
- `test_nvidia_models.py` - New testing utility (created)
