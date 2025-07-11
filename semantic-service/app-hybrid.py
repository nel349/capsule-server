from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer
import numpy as np
import os
import time
from openai import OpenAI
from typing import Optional, Tuple
import logging
import emoji
from dotenv import load_dotenv
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization
import secrets
import base64

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load local model once at startup
print("Loading local Sentence Transformer model...")
local_model = SentenceTransformer('all-MiniLM-L12-v2')  # Back to smaller/faster model
print("Local model loaded successfully!")

# Initialize OpenAI client (will use OPENAI_API_KEY env var)
openai_client = None
try:
    openai_client = OpenAI()
    print("✅ OpenAI client initialized (hybrid mode enabled)")
except Exception as e:
    print(f"⚠️  OpenAI not available: {e} (falling back to local-only mode)")

# Initialize Oracle signing key
oracle_private_key = None
oracle_public_key_bytes = None
try:
    # Try to load existing key from file
    if os.path.exists('oracle_private_key.pem'):
        with open('oracle_private_key.pem', 'rb') as f:
            oracle_private_key = serialization.load_pem_private_key(f.read(), password=None)
        print("✅ Loaded existing oracle private key")
    else:
        # Generate new key pair
        oracle_private_key = Ed25519PrivateKey.generate()
        
        # Save private key to file
        with open('oracle_private_key.pem', 'wb') as f:
            f.write(oracle_private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ))
        print("🔑 Generated new oracle private key and saved to oracle_private_key.pem")
    
    # Get public key bytes for Solana
    oracle_public_key = oracle_private_key.public_key()
    oracle_public_key_bytes = oracle_public_key.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw
    )
    
    # Print public key for Solana program
    oracle_public_key_hex = oracle_public_key_bytes.hex()
    print(f"🔑 Oracle Public Key (for Solana): {oracle_public_key_hex}")
    print(f"🔑 Oracle Public Key (Base64): {base64.b64encode(oracle_public_key_bytes).decode()}")
    
except Exception as e:
    print(f"❌ Failed to initialize oracle signing: {e}")
    oracle_private_key = None

def create_oracle_signature(guess: str, answer: str, is_correct: bool, timestamp: int, nonce: str) -> Optional[str]:
    """Create an oracle signature for the semantic validation result."""
    if not oracle_private_key:
        return None
    
    try:
        # Create message to sign (must match Solana program format)
        message = f"{guess}:{answer}:{is_correct}:{timestamp}:{nonce}"
        message_bytes = message.encode('utf-8')
        
        # Sign the message
        signature_bytes = oracle_private_key.sign(message_bytes)
        
        # Return as base64 string
        return base64.b64encode(signature_bytes).decode('utf-8')
    except Exception as e:
        logger.error(f"Failed to create oracle signature: {e}")
        return None

def preprocess_text(text: str) -> str:
    """Preprocess text by converting emojis to readable descriptions."""
    # Convert emojis to text descriptions without colons
    processed = emoji.demojize(text, delimiters=(" ", " "))
    return processed.strip()

def calculate_local_similarity(text1: str, text2: str) -> float:
    """Calculate similarity using local sentence transformer model."""
    # Preprocess both texts to handle emojis
    processed_text1 = preprocess_text(text1)
    processed_text2 = preprocess_text(text2)
    
    embeddings = local_model.encode([processed_text1, processed_text2])
    similarity = float(np.dot(embeddings[0], embeddings[1]) / 
                      (np.linalg.norm(embeddings[0]) * np.linalg.norm(embeddings[1])))
    return similarity

def should_use_premium_llm(text1: str, text2: str, local_similarity: float) -> bool:
    """
    Determine if we should use premium LLM for complex semantic matching.
    Triggers for cases that need advanced reasoning, cultural knowledge, or creative interpretation.
    """
    # Check for indicators that premium LLM might help
    complex_indicators = [
        # People and personalities
        "founder", "ceo", "creator", "inventor", "author", "director",
        # Events and places
        "conference", "event", "summit", "festival", "competition", "hackathon",
        # Cultural and industry terms
        "known as", "called", "nickname", "aka", "also known",
        # Technology and recent developments
        "startup", "company", "platform", "project", "protocol",
        # Descriptive phrases that might need contextual understanding
        "built", "created", "developed", "pioneered", "launched"
    ]
    
    combined_text = f"{text1} {text2}".lower()
    has_complex_content = any(indicator in combined_text for indicator in complex_indicators)
    
    # Additional triggers for premium LLM
    emoji_pattern = r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF\U00002702-\U000027B0\U000024C2-\U0001F251]'
    import re
    
    # Check for cases that need premium reasoning
    needs_premium = (
        # 1. Has complex content (original logic)
        has_complex_content or
        # 2. Contains emojis (visual-to-text understanding)
        bool(re.search(emoji_pattern, text1 + text2)) or
        # 3. Potential misspellings (similar length, low similarity)
        (abs(len(text1) - len(text2)) <= 2 and 0.3 <= local_similarity <= 0.7) or
        # 4. Idiomatic expressions (common phrases)
        any(phrase in combined_text for phrase in [
            "piece of cake", "break a leg", "hit the road", "finish line",
            "king of pop", "big apple", "reached the", "ran a race"
        ]) or
        # 5. Very low similarity but some connection (metaphors, cultural refs)
        (0.05 <= local_similarity <= 0.3)
    )
    
    # Use premium LLM if needs premium reasoning and similarity suggests possible connection
    return needs_premium and 0.05 <= local_similarity <= 0.8

def ask_llm_semantic_match(text1: str, text2: str) -> Optional[bool]:
    """Ask LLM directly if two things are semantically the same."""
    if not openai_client:
        return None
    
    try:
        # Preprocess texts to convert emojis for LLM
        processed_text1 = preprocess_text(text1)
        processed_text2 = preprocess_text(text2)
        
        prompt = f"""Are these two things the same? Answer only YES or NO.

Thing 1: {processed_text1}
Thing 2: {processed_text2}

Consider:
- Synonyms (car = automobile)
- Descriptions (italian flatbread with cheese = pizza) 
- Cultural references (The King of Pop = Michael Jackson)
- Common misspellings (piza = pizza)
- Idioms with same meaning (break a leg = good luck)

Answer:"""

        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=5,  # Just need YES/NO
            temperature=0  # Consistent answers
        )
        
        answer = response.choices[0].message.content.strip().upper()
        logger.info(f"LLM response for '{text1}' vs '{text2}': {answer}")
        
        return answer == "YES"
        
    except Exception as e:
        logger.error(f"OpenAI LLM error: {e}")
        return None

def ask_premium_llm_semantic_match(text1: str, text2: str) -> Optional[bool]:
    """Ask premium LLM (GPT-4o) for complex semantic matching requiring advanced reasoning and domain knowledge."""
    if not openai_client:
        return None
    
    try:
        # Preprocess texts to convert emojis for LLM
        processed_text1 = preprocess_text(text1)
        processed_text2 = preprocess_text(text2)
        
        prompt = f"""Are these two things the same? Answer only YES or NO.

Thing 1: {processed_text1}
Thing 2: {processed_text2}

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

        response = openai_client.chat.completions.create(
            model="gpt-4o",  # Full GPT-4o for maximum knowledge and reasoning
            messages=[{"role": "user", "content": prompt}],
            max_tokens=5,  # Just need YES/NO
            temperature=0  # Consistent answers
        )
        
        answer = response.choices[0].message.content.strip().upper()
        logger.info(f"Premium LLM response for '{text1}' vs '{text2}': {answer}")
        
        return answer == "YES"
        
    except Exception as e:
        logger.error(f"Premium LLM error: {e}")
        return None

def hybrid_check_answer(guess: str, answer: str, threshold: float = 0.8) -> dict:
    """
    Hybrid answer checking with four-tier approach:
    1. Exact match (free, instant)
    2. Local model (fast, good for synonyms)  
    3. GPT-3.5-turbo (cheap LLM for standard cases)
    4. GPT-4o (premium LLM for crypto/complex cases requiring deep knowledge)
    """
    guess_clean = guess.strip().lower()
    answer_clean = answer.strip().lower()
    
    # Early validation: Empty or whitespace-only guesses are always wrong
    if not guess_clean or len(guess_clean) == 0:
        return {
            "is_correct": False,
            "similarity": 0.0,
            "method": "empty_string_validation",
            "tier": 1
        }
    
    # Early validation: Empty answer (shouldn't happen but defensive)
    if not answer_clean or len(answer_clean) == 0:
        return {
            "is_correct": False,
            "similarity": 0.0,
            "method": "empty_answer_validation",
            "tier": 1
        }
    
    # Tier 1: Exact match check (free and instant)
    if guess_clean == answer_clean:
        return {
            "is_correct": True,
            "similarity": 1.0,
            "method": "exact_match",
            "tier": 1
        }
    
    # Tier 2: Local model check
    local_similarity = calculate_local_similarity(guess_clean, answer_clean)
    
    # If local model is confident (high or very low), trust it
    if local_similarity >= threshold:
        return {
            "is_correct": True,
            "similarity": round(local_similarity, 4),
            "method": "local_model",
            "tier": 2
        }
    elif local_similarity <= 0.05:  # Only trust very low confidence - send more to LLM
        return {
            "is_correct": False,
            "similarity": round(local_similarity, 4),
            "method": "local_model",
            "tier": 2
        }
    
    # Tier 3: Uncertain cases (0.05 < similarity < threshold) -> Ask Standard LLM
    if openai_client and 0.05 < local_similarity < threshold:
        logger.info(f"Local model uncertain (sim={local_similarity:.3f}), asking LLM...")
        
        llm_result = ask_llm_semantic_match(guess, answer)
        if llm_result is not None:
            # If standard LLM says NO but case might benefit from premium reasoning, try premium LLM
            if not llm_result and should_use_premium_llm(guess, answer, local_similarity):
                logger.info("Standard LLM said NO but complex content detected, trying premium LLM...")
                premium_result = ask_premium_llm_semantic_match(guess, answer)
                if premium_result is not None:
                    return {
                        "is_correct": premium_result,
                        "similarity": 1.0 if premium_result else round(local_similarity, 4),
                        "method": "premium_llm_reasoning",
                        "tier": 4,
                        "local_similarity": round(local_similarity, 4),
                        "standard_llm_says": "NO",
                        "premium_llm_says": "YES" if premium_result else "NO"
                    }
            
            return {
                "is_correct": llm_result,
                "similarity": 1.0 if llm_result else round(local_similarity, 4),
                "method": "llm_reasoning",
                "tier": 3,
                "local_similarity": round(local_similarity, 4),
                "llm_says": "YES" if llm_result else "NO"
            }
    
    # Fallback: Use local model result
    return {
        "is_correct": local_similarity >= threshold,
        "similarity": round(local_similarity, 4),
        "method": "local_model_fallback",
        "tier": 2
    }

@app.route('/', methods=['GET'])
def hello():
    return jsonify({
        "message": "CapsuleX Hybrid Semantic Answer Checker",
        "status": "healthy",
        "local_model": "all-MiniLM-L6-v2",
        "openai_available": openai_client is not None,
        "approach": "3-tier hybrid"
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "openai_available": openai_client is not None
    })

@app.route('/check-answer', methods=['POST'])
def check_answer():
    try:
        data = request.get_json()
        
        if not data or 'guess' not in data or 'answer' not in data:
            return jsonify({
                "error": "Missing 'guess' or 'answer' in request body"
            }), 400
        
        guess = data['guess']
        answer = data['answer']
        threshold = data.get('threshold', 0.8)
        # Use provided timestamp (from Solana validator) or current system time
        timestamp = data.get('timestamp', int(time.time()))
        
        result = hybrid_check_answer(guess, answer, threshold)
        result['threshold'] = threshold
        
        # Add oracle signature for security
        nonce = secrets.token_urlsafe(16)  # 128-bit random nonce
        
        signature = create_oracle_signature(
            guess, 
            answer, 
            result['is_correct'], 
            timestamp, 
            nonce
        )
        
        # Add oracle fields to response
        result['oracle_timestamp'] = timestamp
        result['oracle_nonce'] = nonce
        result['oracle_signature'] = signature
        result['oracle_enabled'] = signature is not None
        
        if signature is None:
            logger.warning("Oracle signature generation failed - running in insecure mode")
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            "error": f"Internal server error: {str(e)}"
        }), 500

@app.route('/test', methods=['GET'])
def test():
    """Test endpoint with challenging cases."""
    try:
        test_cases = [
            {"guess": "pizza", "answer": "pizza"},  # Exact match
            {"guess": "automobile", "answer": "car"},  # Synonym  
            {"guess": "italian flatbread with cheese", "answer": "pizza"},  # Description
            {"guess": "The King of Pop", "answer": "Michael Jackson"},  # Cultural
            {"guess": "completely wrong", "answer": "pizza"}  # Obviously wrong
        ]
        
        results = []
        for case in test_cases:
            result = hybrid_check_answer(case["guess"], case["answer"])
            results.append({
                "guess": case["guess"],
                "answer": case["answer"],
                **result
            })
        
        return jsonify({
            "test_results": results,
            "hybrid_model": "MiniLM + OpenAI"
        })
        
    except Exception as e:
        return jsonify({
            "error": f"Test failed: {str(e)}"
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))  # Different port to avoid conflicts
    print(f"Starting hybrid semantic server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)