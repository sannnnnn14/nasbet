#!/bin/bash
cd backend && npm start &
cd frontend && npm run build && npx serve -s dist -l 3000 &
wait
