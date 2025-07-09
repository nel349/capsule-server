
# CapsuleX Semantic Evaluation Report
**Generated:** 2025-07-08 19:29:01
**Service:** http://localhost:5001
**Total Test Cases:** 55

## Overall Performance
- **Accuracy:** 0.309 (30.9%)
- **Precision:** 1.000
- **Recall:** 0.240
- **F1-Score:** 0.387

### Confusion Matrix
|              | Predicted No | Predicted Yes |
|--------------|--------------|---------------|
| **Actual No**  |   5 (TN)    |   0 (FP)     |
| **Actual Yes** |  38 (FN)    |  12 (TP)     |

## Performance by Category

### Edge Cases
- Cases: 5
- Accuracy: 0.400 (40.0%)
- F1-Score: 0.571

### Exact Matches
- Cases: 3
- Accuracy: 1.000 (100.0%)
- F1-Score: 1.000

### Misspellings
- Cases: 5
- Accuracy: 0.200 (20.0%)
- F1-Score: 0.333

### Case Sensitivity
- Cases: 2
- Accuracy: 1.000 (100.0%)
- F1-Score: 1.000

### Compound Concepts
- Cases: 2
- Accuracy: 0.000 (0.0%)
- F1-Score: 0.000

### Obviously Wrong
- Cases: 5
- Accuracy: 1.000 (100.0%)
- F1-Score: 0.000

### Contextual
- Cases: 1
- Accuracy: 0.000 (0.0%)
- F1-Score: 0.000

### Metaphors Idioms
- Cases: 5
- Accuracy: 0.000 (0.0%)
- F1-Score: 0.000

### Numbers Quantities
- Cases: 3
- Accuracy: 0.000 (0.0%)
- F1-Score: 0.000

### Direct Synonyms
- Cases: 5
- Accuracy: 0.800 (80.0%)
- F1-Score: 0.889

### Cultural References
- Cases: 5
- Accuracy: 0.000 (0.0%)
- F1-Score: 0.000

### Emoji Visual
- Cases: 5
- Accuracy: 0.000 (0.0%)
- F1-Score: 0.000

### Partial Matches
- Cases: 2
- Accuracy: 0.000 (0.0%)
- F1-Score: 0.000

### Descriptive Phrases
- Cases: 7
- Accuracy: 0.000 (0.0%)
- F1-Score: 0.000

## Error Analysis

### False Positives (Should be NO, predicted YES)

### False Negatives (Should be YES, predicted NO)
- **direct_synonyms**: 'happy' → 'joyful' (sim: 0.684)\n- **descriptive_phrases**: 'italian flatbread with cheese' → 'pizza' (sim: 0.444)\n- **descriptive_phrases**: 'big cat with stripes' → 'tiger' (sim: 0.415)\n- **descriptive_phrases**: 'round orange fruit' → 'orange' (sim: 0.675)\n- **descriptive_phrases**: 'tall building in New York' → 'skyscraper' (sim: 0.651)\n