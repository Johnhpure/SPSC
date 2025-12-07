# Product Overview

This is a product management system for the Pinhaopin e-commerce platform. It provides AI-powered optimization tools for merchants to manage their product listings.

## Core Features

- **Product Synchronization**: Sync products from Pinhaopin platform to local database
- **AI Image Optimization**: Use Google Gemini AI to enhance product images
- **AI Category Recommendations**: Automatically suggest product categories using AI
- **Batch Operations**: Process multiple products simultaneously
- **Product Actions**: Publish products, revert audits, and manage product lifecycle
- **Task Queue System**: Background processing for AI operations

## User Workflow

1. Login with SMS verification (Pinhaopin platform credentials)
2. Sync products from Pinhaopin platform
3. View and manage products in dashboard
4. Apply AI optimizations (images, categories)
5. Review and apply changes back to Pinhaopin platform
6. Publish or manage product status

## Authentication

The system uses cookie-based authentication with the Pinhaopin platform. The frontend proxies requests through the backend to handle CORS and maintain session state.
