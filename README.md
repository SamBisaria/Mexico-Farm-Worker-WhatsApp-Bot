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

### Important Notes

* The `BASE_URL` environment variable **must point to a public-facing URL**. This is required for the WhatsApp bot to work correctly, as Twilio needs a webhook endpoint it can reach. Localhost URLs will not work unless you use a tunnel service like [ngrok](https://ngrok.com/).
