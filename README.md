# CashUs

A React + TypeScript + Bun frontend application for the Billsplittr expense sharing platform.

## Features

- **Authentication**: User registration and login
- **Dashboard**: Overview of friends, transactions, and balances
- **Friend Management**: Add and manage friends (anonymous and registered)
- **Debt Tracking**: Create and track debt transactions
- **Responsive Design**: Mobile-friendly interface using Tailwind CSS

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Bun** - Package manager and runtime
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Axios** - HTTP client for API calls
- **Tailwind CSS** - Utility-first CSS framework
- **date-fns** - Date manipulation library

## API Integration

This frontend connects to the Go backend API with the following endpoints:

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login

### Protected Routes (require Bearer token)
- `GET /api/v1/profile` - Get user profile
- `POST /api/v1/friendships` - Create anonymous friendship
- `GET /api/v1/friendships` - Get all friendships
- `GET /api/v1/transfer-methods` - Get transfer methods
- `POST /api/v1/debts` - Create debt transaction
- `GET /api/v1/debts` - Get all debt transactions

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed on your system
- The Billsplittr Go backend running on `http://localhost:8080`

### Installation

1. Install dependencies:
   ```bash
   bun install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure the backend API URL:
   ```
   VITE_API_BASE_URL=http://localhost:8080
   ```

3. Start the development server:
   ```bash
   bun run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

### Available Scripts

- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun run preview` - Preview production build
- `bun run lint` - Run ESLint

## Project Structure

```
src/
├── components/          # Reusable UI components
│   └── ProtectedRoute.tsx
├── contexts/           # React contexts
│   └── AuthContext.tsx
├── pages/              # Page components
│   ├── Dashboard.tsx
│   ├── Login.tsx
│   └── Register.tsx
├── services/           # API services
│   └── api.ts
├── types/              # TypeScript type definitions
│   └── api.ts
├── App.tsx             # Main app component
└── main.tsx           # App entry point
```

## Configuration

The application uses environment variables for configuration:

- `VITE_API_BASE_URL`: Backend API base URL (default: `http://localhost:8080`)
- `VITE_CURRENCY_CODE`: Currency code for formatting (default: `IDR`)
- `VITE_CURRENCY_SYMBOL`: Currency symbol to display (default: `Rp`)

Environment variables can be configured in:
- `.env` - Local development (not committed to git)
- `.env.local` - Local overrides (not committed to git)
- `.env.production` - Production environment variables

The API client automatically uses the configured base URL from `VITE_API_BASE_URL`, and currency formatting uses the configured currency settings.

## Authentication

The app uses JWT tokens for authentication:
- Tokens are stored in localStorage
- Automatic token inclusion in API requests
- Automatic redirect to login on 401 responses
- Protected routes require authentication

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the MIT License.
