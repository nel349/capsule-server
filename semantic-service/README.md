# CapsuleX Semantic Answer Checker

A lightweight Flask service that uses Sentence Transformers to check semantic similarity between game answers and player guesses.

## Features

- Uses `all-MiniLM-L6-v2` model (only ~90MB)
- Exact match check first (free)
- Semantic similarity with adjustable threshold
- Built-in test endpoints
- Ready for Render deployment

## API Endpoints

### `GET /`
Returns service info and health status.

### `POST /check-answer`
Check if a guess matches the correct answer.

**Request:**
```json
{
  "guess": "italian flatbread with cheese",
  "answer": "pizza",
  "threshold": 0.8
}
```

**Response:**
```json
{
  "is_correct": true,
  "similarity": 0.8234,
  "threshold": 0.8,
  "method": "semantic_similarity"
}
```

### `GET /test`
Run built-in test cases to verify the model is working.

## Local Development

1. Install uv (if not already installed):
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

2. Install dependencies:
```bash
uv pip install -r requirements.txt
# Or using pyproject.toml:
uv sync
```

3. Run locally:
```bash
python app.py
```

4. Test the service:
```bash
curl http://localhost:5000/test
```

## Deploy to Render

1. Connect your GitHub repo to Render
2. Select this directory as the root
3. Render will automatically use the `render.yaml` config
4. First deployment takes ~2-3 minutes (downloads model)

## Cost Estimation

- **Render Starter Plan**: $7/month
- **No per-request costs**: Unlimited answer checking
- **Model size**: 90MB (fast loading)
- **Memory usage**: ~200-300MB

## Integration with CapsuleX

```typescript
// From your backend
async function checkAnswer(guess: string, answer: string): Promise<boolean> {
  const response = await fetch('https://your-service.onrender.com/check-answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guess, answer })
  });
  
  const result = await response.json();
  return result.is_correct;
}
```