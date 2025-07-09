
# CapsuleX Semantic Evaluation Report
**Generated:** 2025-07-09 15:11:43
**Service:** http://localhost:5001
**Total Test Cases:** 55

## Overall Performance
- **Accuracy:** 0.764 (76.4%)
- **Precision:** 1.000
- **Recall:** 0.740
- **F1-Score:** 0.851

### Confusion Matrix
|              | Predicted No | Predicted Yes |
|--------------|--------------|---------------|
| **Actual No**  |   5 (TN)    |   0 (FP)     |
| **Actual Yes** |  13 (FN)    |  37 (TP)     |

## Performance by Category

### Edge Cases
- Cases: 5
- Accuracy: 1.000 (100.0%)
- F1-Score: 1.000

### Exact Matches
- Cases: 3
- Accuracy: 1.000 (100.0%)
- F1-Score: 1.000

### Direct Synonyms
- Cases: 4
- Accuracy: 1.000 (100.0%)
- F1-Score: 1.000

### Obviously Wrong
- Cases: 5
- Accuracy: 1.000 (100.0%)
- F1-Score: 0.000

### Case Sensitivity
- Cases: 4
- Accuracy: 1.000 (100.0%)
- F1-Score: 1.000

### Descriptive Phrases
- Cases: 6
- Accuracy: 0.833 (83.3%)
- F1-Score: 0.909

### Partial Matches
- Cases: 5
- Accuracy: 0.200 (20.0%)
- F1-Score: 0.333

### Cultural References
- Cases: 4
- Accuracy: 0.750 (75.0%)
- F1-Score: 0.857

### Misspellings
- Cases: 4
- Accuracy: 0.750 (75.0%)
- F1-Score: 0.857

### Metaphors Idioms
- Cases: 5
- Accuracy: 0.600 (60.0%)
- F1-Score: 0.750

### Emoji Visual
- Cases: 5
- Accuracy: 0.200 (20.0%)
- F1-Score: 0.333

### Verbose Answers
- Cases: 5
- Accuracy: 1.000 (100.0%)
- F1-Score: 1.000

## Error Analysis

### False Positives (Should be NO, predicted YES)

### False Negatives (Should be YES, predicted NO)
- **cultural_references**: 'Breakpoint' → 'Solana Breakpoint Conference' (sim: 0.537)\n- **emoji_visual**: '🏃‍♂️' → 'Running a marathon' (sim: 0.513)\n- **emoji_visual**: '💻🚀' → 'Solana Mobile Hackathon' (sim: 0.144)\n- **emoji_visual**: '🎮🔗' → 'A blockchain-based game' (sim: 0.326)\n- **misspellings**: 'piza' → 'pizza' (sim: 0.435)\n