# Technology Stack

## Backend

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js 5.x
- **Database**: SQLite3 with sqlite wrapper
- **Queue System**: BullMQ for background task processing
- **AI Services**: Google Generative AI (@google/generative-ai)
- **HTTP Client**: Axios
- **Module System**: CommonJS (`"type": "commonjs"`)

### Backend Configuration

- TypeScript target: ES2020
- Strict mode enabled with exact optional properties
- Source maps and declarations generated

## Frontend

- **Framework**: Vue 3 with Composition API
- **Build Tool**: Vite 7.x
- **Router**: Vue Router 4.x
- **Styling**: Tailwind CSS 3.x with PostCSS
- **Icons**: lucide-vue-next
- **HTTP Client**: Axios
- **Module System**: ES Modules (`"type": "module"`)

### Frontend Configuration

- TypeScript with project references (tsconfig.app.json, tsconfig.node.json)
- Vite dev server with proxy configuration for `/api` and `/gateway` endpoints

## Common Commands

### Backend

```bash
# Development (no script defined - use ts-node or nodemon manually)
cd backend
npx ts-node src/app.ts

# Or with nodemon for auto-reload
npx nodemon --exec ts-node src/app.ts
```

### Frontend

```bash
cd frontend

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Variables

Backend uses `.env` file for configuration (see `backend/src/config.ts`):
- `PORT`: Server port (default: 3000)
- `MOCK_MODE`: Enable mock data for testing
- `PINHAOPIN_API_BASE`: Pinhaopin API base URL
- `GATEWAY_BASE`: Gateway endpoint path
- Google Gemini API credentials

## API Architecture

- Backend runs on port 3000
- Frontend dev server proxies:
  - `/api/*` → `http://localhost:3000` (backend API)
  - `/gateway/*` → `https://shop.pinhaopin.com` (Pinhaopin platform)
