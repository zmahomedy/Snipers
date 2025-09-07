python -X faulthandler
-m uvicorn mt5_bridge_fastapi:app --host 127.0.0.1 --port 5001 --workers 1 --log
-level info
