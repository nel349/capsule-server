#!/usr/bin/env python3
"""
Direct GPT-4o testing to see if our prompts are the issue
"""

from openai import OpenAI
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

client = OpenAI()

def test_direct_gpt4o(text1, text2):
    """Test GPT-4o with a simple, direct prompt"""
    
    simple_prompt = f"""Are "{text1}" and "{text2}" the same thing or equivalent? 
    
Answer YES or NO and briefly explain why."""
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": simple_prompt}],
        max_tokens=100,
        temperature=0
    )
    
    return response.choices[0].message.content

def test_our_complex_prompt(text1, text2):
    """Test with our actual complex prompt"""
    
    complex_prompt = f"""Are these two things the same? Answer only YES or NO.

Thing 1: {text1}
Thing 2: {text2}

Use your advanced knowledge and reasoning to consider:

**People & Personalities:**
- Founders, CEOs, creators (e.g., "Apple's founder" = "Steve Jobs", "Solana's founder" = "Anatoly Yakovenko")
- Tech leaders, blockchain pioneers, industry figures
- Nicknames and informal references to well-known people

**Events & Conferences:**
- Tech conferences and their abbreviations (e.g., "Breakpoint" = "Solana Breakpoint Conference")
- Hackathons, summits, developer events
- Conference nicknames and shortened names

**Crypto/Web3 Specific:**
- Blockchain platforms and their ecosystems (Solana, Ethereum, etc.)
- DeFi protocols, crypto projects, and their common names
- Web3 terminology and cultural references
- Crypto events, conferences, and community gatherings

**Tech Industry:**
- Startups, companies, and their alternative names
- Project descriptions vs specific implementations
- Technical terminology and industry jargon
- Platform names and their descriptive equivalents

**Cultural & Contextual:**
- Industry-specific slang and common references
- Metaphors and idioms within tech/crypto communities
- Abbreviated forms vs full names
- Context-dependent meanings

Answer:"""
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": complex_prompt}],
        max_tokens=5,
        temperature=0
    )
    
    return response.choices[0].message.content

if __name__ == "__main__":
    test_cases = [
        ("Hackathon", "Coding competition"),
        ("Web3 workshop", "Blockchain seminar"),
        ("Built a decentralized app", "A blockchain-based game"),
        ("The Web3 capital", "A hidden Web3 startup hub"),
    ]
    
    for text1, text2 in test_cases:
        print(f"\n{'='*60}")
        print(f"Testing: '{text1}' vs '{text2}'")
        print(f"{'='*60}")
        
        print("\n🔹 SIMPLE PROMPT:")
        try:
            simple_result = test_direct_gpt4o(text1, text2)
            print(simple_result)
        except Exception as e:
            print(f"Error: {e}")
        
        print("\n🔹 OUR COMPLEX PROMPT:")
        try:
            complex_result = test_our_complex_prompt(text1, text2)
            print(complex_result)
        except Exception as e:
            print(f"Error: {e}")