"""
Quick test script to check which Nvidia models are available and working.
Run this before starting the main automation to avoid surprises.
"""
import os
from dotenv import load_dotenv
from clients.nvidia_client import NvidiaClient

# Load environment variables
load_dotenv()

def main():
    print("=" * 60)
    print("Testing Nvidia NIM Models")
    print("=" * 60)
    
    client = NvidiaClient()
    results = client.test_models()
    
    print("\n" + "=" * 60)
    print("Test Results Summary")
    print("=" * 60)
    
    available = []
    timeout = []
    unavailable = []
    
    for model, status in results.items():
        if "✓" in status:
            available.append(model)
        elif "⚠" in status:
            timeout.append(model)
        else:
            unavailable.append(model)
    
    print(f"\n✓ Available models ({len(available)}):")
    for model in available:
        print(f"  - {model}")
    
    if timeout:
        print(f"\n⚠ Slow/Timeout models ({len(timeout)}) - may work with retries:")
        for model in timeout:
            print(f"  - {model}")
    
    if unavailable:
        print(f"\n✗ Unavailable models ({len(unavailable)}):")
        for model in unavailable:
            print(f"  - {model}")
    
    print("\n" + "=" * 60)
    if available:
        print("✓ At least some models are working. You can proceed.")
    else:
        print("✗ No models are currently available. Check your API key or try again later.")
    print("=" * 60)

if __name__ == "__main__":
    main()
