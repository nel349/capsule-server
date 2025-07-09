import os

# Server socket
bind = f"0.0.0.0:{os.environ.get('PORT', 5001)}"
backlog = 2048

# Worker processes
workers = 1  # Single worker to save memory
worker_class = "sync"
worker_connections = 1000
timeout = 120
keepalive = 2

# Memory optimization
max_requests = 100  # Restart worker after 100 requests to prevent memory leaks
max_requests_jitter = 10
preload_app = True  # Load app before forking workers

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# Process naming
proc_name = 'capsulex-semantic-service'

# Server mechanics
daemon = False
pidfile = None
user = None
group = None
tmp_upload_dir = None