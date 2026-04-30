#!/bin/bash
echo "Campfire Dev — membersihkan cache..."
rm -rf .next node_modules/.cache
echo "Cache bersih. Menjalankan Next.js..."
npm run dev
