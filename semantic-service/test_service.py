#!/usr/bin/env python3
"""
Simple test script to verify the semantic service works locally
"""

import requests
import json

def test_local_service(base_url="http://localhost:5001"):
    print(f"Testing semantic service at {base_url}")
    
    # Test health endpoint
    print("\n1. Testing health endpoint...")
    try:
        response = requests.get(f"{base_url}/")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")
        return False
    
    # Test the built-in test endpoint
    print("\n2. Testing built-in test cases...")
    try:
        response = requests.get(f"{base_url}/test")
        if response.status_code == 200:
            results = response.json()
            print("Test results:")
            for result in results["test_results"]:
                print(f"  '{result['guess']}' vs '{result['answer']}': {result['similarity']:.3f} ({'✓' if result['is_correct'] else '✗'})")
        else:
            print(f"Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test custom answer checking
    print("\n3. Testing custom answer checking...")
    test_cases = [
        {"guess": "car", "answer": "automobile"},
        {"guess": "big cat with stripes", "answer": "tiger"},
        {"guess": "completely unrelated", "answer": "pizza"},
        {"guess": "pizza", "answer": "pizza"},  # exact match
    ]
    
    for case in test_cases:
        try:
            response = requests.post(f"{base_url}/check-answer", 
                                   json=case,
                                   headers={"Content-Type": "application/json"})
            
            if response.status_code == 200:
                result = response.json()
                print(f"  '{case['guess']}' vs '{case['answer']}': {result['similarity']:.3f} ({'✓' if result['is_correct'] else '✗'})")
            else:
                print(f"  Error: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"  Error: {e}")
    
    print("\n✅ Testing complete!")
    return True

if __name__ == "__main__":
    test_local_service()