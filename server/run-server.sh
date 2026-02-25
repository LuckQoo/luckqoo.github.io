#!/usr/bin/env bash
set -euo pipefail

# 讀取本目錄的 .env（如果存在）
if [ -f ".env" ]; then
  # 將鍵值匯入環境變數
  set -a
  source .env
  set +a
fi

# 啟動後端
npm start
