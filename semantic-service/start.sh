#!/bin/bash
# Render startup script for CapsuleX Semantic Service

echo "Starting CapsuleX Semantic Service..."
echo "Installing dependencies..."
pip install -r requirements.txt

echo "Starting gunicorn server..."
gunicorn --bind 0.0.0.0:$PORT app:app