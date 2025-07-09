#!/usr/bin/env python3
"""
CapsuleX Semantic Answer Checking Evaluation Framework

This module provides comprehensive evaluation capabilities for semantic similarity models
used in CapsuleX games. It implements standard ML evaluation metrics and provides
detailed analysis of model performance across different categories of test cases.
"""

import json
import requests
import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import confusion_matrix, classification_report, roc_curve, auc
import warnings
warnings.filterwarnings('ignore')

@dataclass
class EvaluationResult:
    """Container for evaluation results of a single test case."""
    test_id: int
    category: str
    guess: str
    answer: str
    expected: bool
    predicted: bool
    similarity: float
    confidence: str
    correct: bool

@dataclass
class ModelPerformance:
    """Container for overall model performance metrics."""
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    true_positives: int
    false_positives: int
    true_negatives: int
    false_negatives: int
    threshold: float
    total_cases: int

class SemanticEvaluator:
    """
    Comprehensive evaluation framework for semantic answer checking models.
    
    This class provides methods to:
    - Load and validate test datasets
    - Run evaluations against semantic services
    - Calculate standard ML metrics
    - Generate detailed reports and visualizations
    - Optimize decision thresholds
    """
    
    def __init__(self, service_url: str = "http://localhost:5001"):
        self.service_url = service_url
        self.test_dataset = None
        self.results = []
        
    def load_test_dataset(self, dataset_path: str) -> Dict:
        """Load and validate the test dataset from JSON file."""
        try:
            with open(dataset_path, 'r') as f:
                self.test_dataset = json.load(f)
            
            print(f"✅ Loaded {len(self.test_dataset['test_cases'])} test cases")
            print(f"📊 Categories: {', '.join(self.test_dataset['metadata']['categories'])}")
            return self.test_dataset
            
        except Exception as e:
            print(f"❌ Error loading dataset: {e}")
            raise
    
    def check_service_health(self) -> bool:
        """Verify that the semantic service is running and healthy."""
        try:
            response = requests.get(f"{self.service_url}/health", timeout=5)
            if response.status_code == 200:
                print(f"✅ Service is healthy at {self.service_url}")
                return True
            else:
                print(f"❌ Service returned status {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Service health check failed: {e}")
            return False
    
    def evaluate_single_case(self, test_case: Dict, threshold: float = 0.8) -> EvaluationResult:
        """Evaluate a single test case against the semantic service."""
        try:
            # Make request to semantic service
            response = requests.post(
                f"{self.service_url}/check-answer",
                json={
                    "guess": test_case["guess"],
                    "answer": test_case["answer"],
                    "threshold": threshold
                },
                timeout=10
            )
            
            if response.status_code == 200:
                result_data = response.json()
                similarity = result_data["similarity"]
                predicted = result_data["is_correct"]
                expected = test_case["expected"]
                
                # Determine confidence level
                if similarity >= 0.9:
                    confidence = "high"
                elif similarity >= 0.7:
                    confidence = "medium"
                elif similarity >= 0.5:
                    confidence = "low"
                else:
                    confidence = "very_low"
                
                return EvaluationResult(
                    test_id=test_case["id"],
                    category=test_case["category"],
                    guess=test_case["guess"],
                    answer=test_case["answer"],
                    expected=expected,
                    predicted=predicted,
                    similarity=similarity,
                    confidence=confidence,
                    correct=(predicted == expected)
                )
            else:
                print(f"❌ API error for case {test_case['id']}: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ Error evaluating case {test_case['id']}: {e}")
            return None
    
    def run_full_evaluation(self, threshold: float = 0.8) -> List[EvaluationResult]:
        """Run evaluation on all test cases in the dataset."""
        if not self.test_dataset:
            raise ValueError("No test dataset loaded. Call load_test_dataset() first.")
        
        if not self.check_service_health():
            raise ValueError("Semantic service is not available.")
        
        print(f"🚀 Starting evaluation with threshold={threshold}")
        print(f"📝 Evaluating {len(self.test_dataset['test_cases'])} test cases...")
        
        self.results = []
        
        for i, test_case in enumerate(self.test_dataset['test_cases'], 1):
            result = self.evaluate_single_case(test_case, threshold)
            if result:
                self.results.append(result)
            
            # Progress indicator
            if i % 10 == 0 or i == len(self.test_dataset['test_cases']):
                print(f"  Progress: {i}/{len(self.test_dataset['test_cases'])} ({i/len(self.test_dataset['test_cases'])*100:.1f}%)")
        
        print(f"✅ Evaluation complete! {len(self.results)} cases processed.")
        return self.results
    
    def calculate_metrics(self, results: List[EvaluationResult] = None) -> ModelPerformance:
        """Calculate comprehensive performance metrics."""
        if results is None:
            results = self.results
        
        if not results:
            raise ValueError("No evaluation results available.")
        
        # Extract predictions and ground truth
        y_true = [r.expected for r in results]
        y_pred = [r.predicted for r in results]
        
        # Calculate confusion matrix components
        cm = confusion_matrix(y_true, y_pred)
        if cm.shape == (1, 1):
            # Only one class present in predictions
            if y_true[0]:  # All true cases
                tp, fn, fp, tn = cm[0, 0], 0, 0, 0
            else:  # All false cases  
                tp, fn, fp, tn = 0, 0, 0, cm[0, 0]
        else:
            tn, fp, fn, tp = cm.ravel()
        
        # Calculate metrics
        accuracy = (tp + tn) / (tp + tn + fp + fn)
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        
        return ModelPerformance(
            accuracy=accuracy,
            precision=precision,
            recall=recall,
            f1_score=f1_score,
            true_positives=int(tp),
            false_positives=int(fp),
            true_negatives=int(tn),
            false_negatives=int(fn),
            threshold=results[0].similarity if results else 0.8,  # Approximate
            total_cases=len(results)
        )
    
    def analyze_by_category(self) -> Dict[str, ModelPerformance]:
        """Analyze performance by test case category."""
        if not self.results:
            raise ValueError("No evaluation results available.")
        
        categories = {}
        for category in set(r.category for r in self.results):
            category_results = [r for r in self.results if r.category == category]
            categories[category] = self.calculate_metrics(category_results)
        
        return categories
    
    def find_optimal_threshold(self, thresholds: List[float] = None) -> Tuple[float, float]:
        """Find optimal threshold that maximizes F1 score."""
        if thresholds is None:
            thresholds = [i/10 for i in range(1, 10)]  # 0.1 to 0.9
        
        if not self.test_dataset:
            raise ValueError("No test dataset loaded.")
        
        print(f"🔍 Testing {len(thresholds)} thresholds: {thresholds}")
        
        best_threshold = 0.8
        best_f1 = 0
        threshold_results = []
        
        for threshold in thresholds:
            print(f"  Testing threshold {threshold}...")
            results = []
            
            for test_case in self.test_dataset['test_cases']:
                result = self.evaluate_single_case(test_case, threshold)
                if result:
                    results.append(result)
            
            if results:
                metrics = self.calculate_metrics(results)
                threshold_results.append((threshold, metrics.f1_score, metrics))
                
                if metrics.f1_score > best_f1:
                    best_f1 = metrics.f1_score
                    best_threshold = threshold
                
                print(f"    F1: {metrics.f1_score:.3f}, Acc: {metrics.accuracy:.3f}")
        
        print(f"🎯 Optimal threshold: {best_threshold} (F1: {best_f1:.3f})")
        return best_threshold, best_f1
    
    def generate_report(self, save_path: str = None) -> str:
        """Generate a comprehensive evaluation report."""
        if not self.results:
            raise ValueError("No evaluation results available. Run evaluation first.")
        
        overall_metrics = self.calculate_metrics()
        category_metrics = self.analyze_by_category()
        
        report = f"""
# CapsuleX Semantic Evaluation Report
**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**Service:** {self.service_url}
**Total Test Cases:** {len(self.results)}

## Overall Performance
- **Accuracy:** {overall_metrics.accuracy:.3f} ({overall_metrics.accuracy*100:.1f}%)
- **Precision:** {overall_metrics.precision:.3f}
- **Recall:** {overall_metrics.recall:.3f}
- **F1-Score:** {overall_metrics.f1_score:.3f}

### Confusion Matrix
|              | Predicted No | Predicted Yes |
|--------------|--------------|---------------|
| **Actual No**  | {overall_metrics.true_negatives:3d} (TN)    | {overall_metrics.false_positives:3d} (FP)     |
| **Actual Yes** | {overall_metrics.false_negatives:3d} (FN)    | {overall_metrics.true_positives:3d} (TP)     |

## Performance by Category
"""
        
        for category, metrics in category_metrics.items():
            report += f"""
### {category.replace('_', ' ').title()}
- Cases: {metrics.total_cases}
- Accuracy: {metrics.accuracy:.3f} ({metrics.accuracy*100:.1f}%)
- F1-Score: {metrics.f1_score:.3f}
"""
        
        # Add detailed error analysis
        report += """
## Error Analysis

### False Positives (Should be NO, predicted YES)
"""
        false_positives = [r for r in self.results if not r.expected and r.predicted]
        for fp in false_positives[:5]:  # Show first 5
            report += f"- **{fp.category}**: '{fp.guess}' → '{fp.answer}' (sim: {fp.similarity:.3f})\\n"
        
        report += """
### False Negatives (Should be YES, predicted NO)
"""
        false_negatives = [r for r in self.results if r.expected and not r.predicted]
        for fn in false_negatives[:5]:  # Show first 5
            report += f"- **{fn.category}**: '{fn.guess}' → '{fn.answer}' (sim: {fn.similarity:.3f})\\n"
        
        if save_path:
            with open(save_path, 'w') as f:
                f.write(report)
            print(f"📄 Report saved to {save_path}")
        
        return report
    
    def save_results_csv(self, filepath: str = "evaluation_results.csv"):
        """Save detailed results to CSV for further analysis."""
        if not self.results:
            raise ValueError("No evaluation results available.")
        
        df = pd.DataFrame([
            {
                'test_id': r.test_id,
                'category': r.category,
                'guess': r.guess,
                'answer': r.answer,
                'expected': r.expected,
                'predicted': r.predicted,
                'similarity': r.similarity,
                'confidence': r.confidence,
                'correct': r.correct
            }
            for r in self.results
        ])
        
        df.to_csv(filepath, index=False)
        print(f"💾 Results saved to {filepath}")
        return df

def main():
    """Main evaluation script."""
    print("🎯 CapsuleX Semantic Evaluation Framework")
    print("=" * 50)
    
    # Initialize evaluator
    evaluator = SemanticEvaluator()
    
    try:
        # Load test dataset
        evaluator.load_test_dataset("test_dataset.json")
        
        # Run evaluation
        evaluator.run_full_evaluation(threshold=0.8)
        
        # Generate and display report
        report = evaluator.generate_report("evaluation_report.md")
        print(report)
        
        # Save detailed results
        evaluator.save_results_csv("evaluation_results.csv")
        
        print("\\n🎉 Evaluation complete!")
        
    except Exception as e:
        print(f"❌ Evaluation failed: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())