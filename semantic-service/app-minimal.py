from flask import Flask, request, jsonify
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import os

app = Flask(__name__)

# Initialize TF-IDF vectorizer
vectorizer = TfidfVectorizer(stop_words='english', ngram_range=(1, 2))

def calculate_similarity(text1, text2):
    """Calculate cosine similarity using TF-IDF vectors"""
    texts = [text1.lower().strip(), text2.lower().strip()]
    tfidf_matrix = vectorizer.fit_transform(texts)
    similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
    return float(similarity)

@app.route('/', methods=['GET'])
def hello():
    return jsonify({
        "message": "CapsuleX Semantic Answer Checker (Minimal)",
        "status": "healthy",
        "method": "TF-IDF + Cosine Similarity"
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
        threshold = data.get('threshold', 0.7)  # Lower threshold for TF-IDF
        
        # Exact match check first
        if guess == answer:
            return jsonify({
                "is_correct": True,
                "similarity": 1.0,
                "method": "exact_match"
            })
        
        # TF-IDF similarity check
        similarity = calculate_similarity(guess, answer)
        is_correct = similarity >= threshold
        
        return jsonify({
            "is_correct": is_correct,
            "similarity": round(similarity, 4),
            "threshold": threshold,
            "method": "tfidf_cosine"
        })
        
    except Exception as e:
        return jsonify({
            "error": f"Internal server error: {str(e)}"
        }), 500

@app.route('/test', methods=['GET'])
def test():
    """Quick test endpoint"""
    try:
        test_cases = [
            {"guess": "pizza", "answer": "pizza"},
            {"guess": "italian flatbread with cheese", "answer": "pizza"},
            {"guess": "automobile", "answer": "car"},
            {"guess": "completely wrong", "answer": "pizza"}
        ]
        
        results = []
        for case in test_cases:
            similarity = calculate_similarity(case["guess"], case["answer"])
            
            results.append({
                "guess": case["guess"],
                "answer": case["answer"],
                "similarity": round(similarity, 4),
                "is_correct": similarity >= 0.7
            })
        
        return jsonify({
            "test_results": results,
            "method": "TF-IDF + Cosine Similarity"
        })
        
    except Exception as e:
        return jsonify({
            "error": f"Test failed: {str(e)}"
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"Starting minimal semantic server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)