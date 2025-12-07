# Project Structure

## Root Layout

```
/
├── backend/          # Express.js backend server
├── frontend/         # Vue 3 frontend application (商品管理 + Gemini 管理后台)
└── PRODUCT_ACTIONS_FEATURE.md  # Feature documentation
```

## Backend Structure

```
backend/
├── src/
│   ├── app.ts                    # Main Express application and routes
│   ├── config.ts                 # Environment configuration
│   ├── db/
│   │   └── index.ts              # SQLite database setup and schema
│   ├── queue/
│   │   └── index.ts              # Task queue implementation (BullMQ)
│   └── services/
│       ├── gemini-image.ts       # AI image optimization service
│       ├── gemini-text.ts        # AI text/category service
│       └── pinhaopin.ts          # Pinhaopin platform API client
├── scripts/
│   ├── analyze_products.ts       # Utility scripts
│   └── test_login.ts
├── uploads/                      # Static file storage
├── products.db                   # SQLite database file
├── .env                          # Environment variables
├── package.json
└── tsconfig.json
```

### Backend Key Files

- **app.ts**: All REST API endpoints (`/api/*`)
- **db/index.ts**: Database schema with `products` and `tasks` tables
- **queue/index.ts**: Background worker for `sync`, `image_opt`, and `cat_rec` tasks
- **services/pinhaopin.ts**: Authentication and product API integration

## Frontend Structure

```
frontend/
├── src/
│   ├── main.ts                   # Application entry point
│   ├── App.vue                   # Root component
│   ├── style.css                 # Global Tailwind styles
│   ├── api/
│   │   ├── pinhaopin.ts          # API client functions
│   │   └── admin.ts              # Admin API client (Gemini management)
│   ├── components/
│   │   ├── AddProductModal.vue
│   │   └── HelloWorld.vue
│   ├── router/
│   │   └── index.ts              # Vue Router configuration
│   └── views/
│       ├── Layout.vue            # Main layout with navigation
│       ├── Login.vue             # SMS login page
│       ├── Home.vue              # Dashboard home
│       ├── Dashboard.vue         # Product list and management
│       ├── CategoryManagement.vue
│       ├── GeminiAdminLayout.vue # Admin panel layout
│       └── admin/                # Admin panel views
│           ├── AdminLogin.vue    # Admin login page
│           ├── ConfigManagement.vue
│           ├── KeyManagement.vue
│           ├── LogViewer.vue
│           ├── BenchmarkTool.vue
│           └── StatisticsDashboard.vue
├── public/                       # Static assets
├── index.html                    # HTML entry point
├── vite.config.ts                # Vite configuration with proxies
├── tailwind.config.js            # Tailwind CSS configuration
├── postcss.config.js
└── package.json
```

### Frontend Key Files

- **router/index.ts**: Route definitions with auth guards for both main app and admin panel
- **api/pinhaopin.ts**: Centralized API calls to backend and gateway
- **api/admin.ts**: Admin API client with Authorization header authentication
- **views/Dashboard.vue**: Main product management interface
- **views/Login.vue**: SMS-based authentication flow (Pinhaopin)
- **views/admin/AdminLogin.vue**: Independent admin authentication
- **views/GeminiAdminLayout.vue**: Admin panel layout with navigation

## Database Schema

### products table
- `platform_id`: Unique product ID from Pinhaopin
- `title`, `category_id`, `category_name`, `image_url`: Original product data
- `opt_image_url`, `opt_category_id`, `opt_category_name`: AI-optimized data
- `status`: Product state (pending, synced, auditing, etc.)
- `diagnosis_tags`: AI analysis results

### tasks table
- `type`: Task type (sync, image_opt, cat_rec)
- `status`: Task state (pending, processing, completed, failed)
- `payload`, `result`, `error`: Task data and results

## Conventions

- Backend uses CommonJS modules
- Frontend uses ES modules
- All TypeScript with strict mode
- API routes prefixed with `/api/`
- Gateway proxy routes prefixed with `/gateway/`
- Admin routes prefixed with `/admin` (integrated in main frontend)
- Main frontend authentication via cookies (HttpOnly token from Pinhaopin)
- Admin panel authentication via localStorage (independent from main app)
- Chinese language used in UI and comments

