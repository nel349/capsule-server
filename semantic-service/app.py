from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer
import numpy as np
import os

app = Flask(__name__)

# Load model once at startup
print("Loading Sentence Transformer model...")
model = SentenceTransformer('all-MiniLM-L6-v2')
print("Model loaded successfully!")

@app.route('/', methods=['GET'])
def hello():
    return jsonify({
        "message": "CapsuleX Semantic Answer Checker",
        "status": "healthy",
        "model": "all-MiniLM-L6-v2"
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"})

@app.route('/check-answer', methods=['POST'])
def check_answer():
    try:
        data = request.get_json()
        
        if not data or 'guess' not in data or 'answer' not in data:
            return jsonify({
                "error": "Missing 'guess' or 'answer' in request body"
            }), 400
        
        guess = data['guess'].strip().lower()
        answer = data['answer'].strip().lower()
        threshold = data.get('threshold', 0.8)
        
        # Exact match check first (free)
        if guess == answer:
            return jsonify({
                "is_correct": True,
                "similarity": 1.0,
                "method": "exact_match"
            })
        
        # Semantic similarity check
        embeddings = model.encode([guess, answer])
        similarity = float(np.dot(embeddings[0], embeddings[1]) / 
                          (np.linalg.norm(embeddings[0]) * np.linalg.norm(embeddings[1])))
        
        is_correct = similarity >= threshold
        
        return jsonify({
            "is_correct": is_correct,
            "similarity": round(similarity, 4),
            "threshold": threshold,
            "method": "semantic_similarity"
        })
        
    except Exception as e:
        return jsonify({
            "error": f"Internal server error: {str(e)}"
        }), 500

@app.route('/test', methods=['GET'])
def test():
    """Quick test endpoint"""
    try:
        # Test with pizza example
        test_cases = [
            {"guess": "pizza", "answer": "pizza"},
            {"guess": "italian flatbread with cheese", "answer": "pizza"},
            {"guess": "automobile", "answer": "car"},
            {"guess": "completely wrong", "answer": "pizza"}
        ]
        
        results = []
        for case in test_cases:
            embeddings = model.encode([case["guess"], case["answer"]])
            similarity = float(np.dot(embeddings[0], embeddings[1]) / 
                              (np.linalg.norm(embeddings[0]) * np.linalg.norm(embeddings[1])))
            
            results.append({
                "guess": case["guess"],
                "answer": case["answer"],
                "similarity": round(similarity, 4),
                "is_correct": similarity >= 0.8
            })
        
        return jsonify({
            "test_results": results,
            "model": "all-MiniLM-L6-v2"
        })
        
    except Exception as e:
        return jsonify({
            "error": f"Test failed: {str(e)}"
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"Starting server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)