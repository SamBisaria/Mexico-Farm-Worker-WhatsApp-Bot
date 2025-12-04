# San Quintin Jobs

Job matching platform for agricultural workers.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   Copy `.env.example` to `.env` and fill in your values.
   ```bash
   cp .env.example .env
   ```

3. Run the server:
   ```bash
   npm start
   ```

   For development with nodemon:
   ```bash
   npm run dev
   ```

## Environment Variables

- `PORT`: Server port (default: 3000). 
- `BASE_URL`: Base URL of the application
- `JWT_SECRET`: Secret key for JWT authentication
- `TWILIO_ACCOUNT_SID`: Twilio Account SID
- `TWILIO_AUTH_TOKEN`: Twilio Auth Token
- `TWILIO_WHATSAPP_NUMBER`: Twilio WhatsApp sender number

## Project Structure

- `server.js`: Entry point
- `routes/`: API routes
- `middleware/`: Express middleware
- `database/`: Database configuration
- `utils/`: Utility functions
- `public/`: Static files

## Important Notes

* The `BASE_URL` environment variable **must point to a public-facing URL**. This is required for the WhatsApp bot to work correctly, as Twilio needs a webhook endpoint it can reach. Localhost URLs will not work unless you use a tunnel service like [ngrok](https://ngrok.com/).

## Screenshots

Employer Portal Sign-in page: <img width="1919" height="965" alt="image" src="https://github.com/user-attachments/assets/620e74fe-fe27-4a60-8e66-5cfe06c4e31c" />
Job Posting Form: <img width="1899" height="966" alt="image" src="https://github.com/user-attachments/assets/27643f8e-34b1-4ede-8359-9c2b096f409c" />
Worker Sign-up: <img width="1900" height="965" alt="image" src="https://github.com/user-attachments/assets/c2d318d4-6881-462e-be1d-3e6d31e96591" />
Worker WhatsApp: <img width="740" height="1600" alt="image" src="https://github.com/user-attachments/assets/54046290-8955-4cc1-b254-0aa35860a89b" />

