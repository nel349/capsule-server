
# CapsuleX Semantic Evaluation Report
**Generated:** 2025-07-08 22:27:36
**Service:** http://localhost:5001
**Total Test Cases:** 50

## Overall Performance
- **Accuracy:** 0.720 (72.0%)
- **Precision:** 1.000
- **Recall:** 0.689
- **F1-Score:** 0.816

### Confusion Matrix
|              | Predicted No | Predicted Yes |
|--------------|--------------|---------------|
| **Actual No**  |   5 (TN)    |   0 (FP)     |
| **Actual Yes** |  14 (FN)    |  31 (TP)     |

## Performance by Category

### Emoji Visual
- Cases: 5
- Accuracy: 0.400 (40.0%)
- F1-Score: 0.571

### Case Sensitivity
- Cases: 4
- Accuracy: 1.000 (100.0%)
- F1-Score: 1.000

### Direct Synonyms
- Cases: 4
- Accuracy: 1.000 (100.0%)
- F1-Score: 1.000

### Exact Matches
- Cases: 3
- Accuracy: 1.000 (100.0%)
- F1-Score: 1.000

### Partial Matches
- Cases: 5
- Accuracy: 0.200 (20.0%)
- F1-Score: 0.333

### Metaphors Idioms
- Cases: 5
- Accuracy: 0.200 (20.0%)
- F1-Score: 0.333

### Cultural References
- Cases: 4
- Accuracy: 0.750 (75.0%)
- F1-Score: 0.857

### Descriptive Phrases
- Cases: 6
- Accuracy: 0.833 (83.3%)
- F1-Score: 0.909

### Misspellings
- Cases: 4
- Accuracy: 0.750 (75.0%)
- F1-Score: 0.857

### Obviously Wrong
- Cases: 5
- Accuracy: 1.000 (100.0%)
- F1-Score: 0.000

### Edge Cases
- Cases: 5
- Accuracy: 1.000 (100.0%)
- F1-Score: 1.000

## Error Analysis

### False Positives (Should be NO, predicted YES)

### False Negatives (Should be YES, predicted NO)
- **cultural_references**: 'Breakpoint' → 'Solana Breakpoint Conference' (sim: 0.553)\n- **emoji_visual**: '💻🚀' → 'Solana Mobile Hackathon' (sim: 0.157)\n- **emoji_visual**: '🎮🔗' → 'A blockchain-based game' (sim: 0.347)\n- **misspellings**: 'piza' → 'pizza' (sim: 0.462)\n- **metaphors_idioms**: 'Reached the finish line' → 'Running a marathon' (sim: 0.208)\n