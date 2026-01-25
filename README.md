# VideoMeet

Premium video conferencing application built with modern web technologies, providing a seamless meeting experience for users across devices.

![VideoMeet Screenshot](https://github.com/Ananta025/VIDEO_MEET/blob/574fb3c62bfd211917ec66ec7c9cf2dddca2f74a/Frontend/public/screenshot.png)

## 🚀 Features

- **User Authentication** - Secure registration and login system with JWT
- **Real-time Video Meetings** - High-quality video and audio communication
- **Screen Sharing** - Share your screen with meeting participants
- **In-Meeting Chat** - Text communication during video calls
- **Meeting Recording** - Record meetings with automatic upload to server
- **AI-Powered Transcription** - Automated transcript generation using OpenAI Whisper
- **Meeting History** - View all past meetings with recordings and transcripts
- **Responsive Design** - Works on desktop and mobile devices
- **Meeting Security** - Only authorized users can join meetings
- **Meeting Feedback** - Collect user feedback after meetings

## 🛠️ Technology Stack

### Frontend
- React 19 with TypeScript
- Redux Toolkit for state management
- React Router v7 for navigation
- Socket.io client for real-time communication
- WebRTC for peer-to-peer video streaming
- TailwindCSS v4 for styling
- Material UI v6 components
- Vite v6 for build tooling

### Backend
- Node.js 20 LTS
- Express.js v4
- MongoDB with Mongoose v8
- Socket.io v4 for WebSocket connections
- JWT for authentication
- bcrypt for password hashing
- FFmpeg for audio/video processing
- OpenAI API for transcription

### DevOps & Deployment
- Docker with multi-stage builds
- Docker Compose for local development
- Kubernetes (K8s) manifests for production
- AWS ECR for container registry
- Nginx for frontend serving

## 📋 Project Structure

```
VIDEO_MEET/
├── Frontend/               # React frontend application
│   ├── src/
│   │   ├── app/            # Redux store & hooks
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/       # React context providers
│   │   ├── features/       # Redux slices (media, meeting, participants)
│   │   ├── pages/          # Application pages
│   │   ├── routes/         # Routing configuration
│   │   ├── services/       # Socket service
│   │   ├── types/          # TypeScript type definitions
│   │   ├── scripts/        # Utility scripts
│   │   ├── styles/         # CSS stylesheets
│   │   └── utils/          # Helper functions
│   ├── Dockerfile          # Multi-stage production build
│   └── nginx.conf          # Nginx configuration for SPA
├── Backend/                # Node.js backend application
│   ├── src/
│   │   ├── controllers/    # Request handlers & socket manager
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic & transcription
│   │   ├── middlewares/    # Express middlewares
│   │   └── Db/             # Database connection
│   ├── uploads/            # Recording & transcript storage
│   │   ├── recordings/     # Video recordings
│   │   └── transcripts/    # Generated transcripts
│   └── Dockerfile          # Production-ready container
├── k8s/                    # Kubernetes manifests
│   ├── backend-deployment.yaml
│   ├── backend-service.yaml
│   ├── frontend-deployment.yaml
│   └── frontend-service.yaml
├── docker-compose.yml      # Local development setup
└── RECORDING_FEATURE.md    # Recording feature documentation
```

## 🔧 Installation

### Prerequisites
- Node.js (v20.x or higher)
- MongoDB (v6.x or higher) or MongoDB Atlas
- npm or yarn
- Docker & Docker Compose (for containerized deployment)
- kubectl (for Kubernetes deployment)

### Option 1: Local Development

#### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd Backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the Backend directory:
   ```env
   PORT=3000
   MONGO_URL=mongodb://localhost:27017/videomeet
   JWT_SECRET=your_jwt_secret
   OPENAI_API_KEY=your_openai_api_key  # Optional, for transcription
   ```

4. Start the server:
   ```bash
   npm start
   ```

#### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd Frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the Frontend directory:
   ```env
   VITE_BASE_URL=http://localhost:3000
   VITE_SERVER_URL=http://localhost:3000
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

### Option 2: Docker Compose (Recommended for Development)

1. Create a `.env` file in the root directory:
   ```env
   MONGO_URL=mongodb+srv://your-mongodb-atlas-uri
   JWT_SECRET=your-super-secret-jwt-key
   OPENAI_API_KEY=your_openai_api_key
   VITE_BASE_URL=http://localhost:3001
   VITE_SERVER_URL=http://localhost:3001
   ```

2. Run with Docker Compose:
   ```bash
   docker-compose up --build
   ```

3. Access the application:
   - Frontend: http://localhost
   - Backend API: http://localhost:3001

### Option 3: Kubernetes Deployment

1. Create secrets and configmaps:
   ```bash
   # Create backend secrets
   kubectl create secret generic backend-secrets \
     --from-literal=MONGO_URL="your-mongodb-uri" \
     --from-literal=JWT_SECRET="your-jwt-secret"

   # Create ECR pull secret (for AWS ECR)
   kubectl create secret docker-registry ecr-secret \
     --docker-server=851725228571.dkr.ecr.ap-south-1.amazonaws.com \
     --docker-username=AWS \
     --docker-password=$(aws ecr get-login-password --region ap-south-1)
   ```

2. Apply Kubernetes manifests:
   ```bash
   kubectl apply -f k8s/
   ```

3. Check deployment status:
   ```bash
   kubectl get pods
   kubectl get svc
   ```

## 📱 Usage

1. **Register/Login**: Create an account or login with existing credentials
2. **Create a Meeting**: 
   - Click on "New meeting" button from the home page
   - Share the generated meeting link with others
3. **Join a Meeting**: 
   - Enter the meeting code or link in the input field
   - Click "Join" button
4. **During the Meeting**:
   - Toggle video/audio using the control buttons
   - Share your screen with the screen sharing button
   - Use the chat feature to send messages to participants
   - **Record the meeting** using the recording button (host only)
   - End the meeting using the red button
5. **View Meeting History**:
   - Navigate to the history page from the navbar
   - Download recordings and transcripts
   - View transcript previews

## 🎥 Recording Feature

The application supports meeting recording with AI-powered transcription:

- **Start/Stop Recording**: Host can control recording during meetings
- **Automatic Upload**: Recordings are uploaded to the server automatically
- **AI Transcription**: Generates transcripts using OpenAI Whisper API
- **Download Options**: Download recordings (WebM/MP4) and transcripts (TXT/VTT)
- **History Integration**: View all recordings in the meeting history page

See [RECORDING_FEATURE.md](RECORDING_FEATURE.md) for detailed documentation.

## 🔒 Security Features

- JWT authentication for secure API access
- Encrypted password storage with bcrypt
- WebRTC encrypted peer-to-peer connections
- Meeting access validation
- Blacklisted token handling for secure logouts
- Kubernetes secrets for sensitive data
- Non-root container execution

## 💻 API Endpoints

### User Routes
- `POST /users/register` - Register a new user
- `POST /users/login` - Login existing user
- `GET /users/profile` - Get user profile
- `POST /users/logout` - Logout user
- `GET /users/history` - Get user's meeting history
- `POST /users/history` - Add meeting to history

### Meeting Routes
- `POST /meetings/create` - Create a new meeting
- `POST /meetings/join` - Join an existing meeting
- `POST /meetings/leave` - Leave a meeting
- `POST /meetings/end` - End a meeting
- `GET /meetings/:meetingId` - Get meeting details
- `PUT /meetings/:meetingId` - Update meeting status
- `POST /meetings/:meetingId/recording` - Upload recording
- `GET /meetings/:meetingId/recording` - Download recording
- `POST /meetings/:meetingId/transcript` - Generate transcript
- `GET /meetings/:meetingId/transcript` - Get transcript

## 🐳 Docker Images

The application uses multi-stage Docker builds for optimized production images:

- **Frontend**: `nginx:alpine` (~25MB) - Serves static React build
- **Backend**: `node:20-alpine` (~150MB) - Node.js with FFmpeg for transcription

## ☸️ Kubernetes Resources

| Resource | Type | Description |
|----------|------|-------------|
| video-meet-backend | Deployment | Backend API server |
| video-meet-frontend | Deployment | Nginx serving React app |
| video-meet-backend | Service (ClusterIP) | Internal backend service |
| video-meet-frontend | Service (LoadBalancer) | External frontend access |

## 📝 License

This project is licensed under the MIT License.

## 👥 Contributors

- Ananta Chandra Das - Fullstack Developer

## 🤝 Collaboration

We welcome contributions to the VideoMeet project! Here's how you can collaborate:

### Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/VIDEO_MEET.git`
3. Add the original repository as upstream: `git remote add upstream https://github.com/Ananta025/VIDEO_MEET.git`
4. Create a new branch for your feature: `git checkout -b feature/your-feature-name`

### Development Process

1. Make your changes following the code style guidelines
2. Keep your branch updated with upstream: `git pull upstream main`
3. Write tests for your changes when applicable
4. Ensure all tests pass before submitting

### Code Style Guidelines

- Follow the existing coding style in the project
- Use meaningful variable and function names
- Write comments for complex logic
- Follow TypeScript best practices on frontend
- Follow ES6+ standards for backend JavaScript

### Pull Request Process

1. Update the README.md with details of changes if applicable
2. Push to your fork: `git push origin feature/your-feature-name`
3. Open a pull request against the main branch
4. Clearly describe your changes and link any related issues
5. Wait for code review and address feedback

### Reporting Issues

- Use the issue tracker to report bugs or suggest features
- Check existing issues before opening a new one
- Provide detailed information when reporting bugs:
  - Expected behavior
  - Actual behavior
  - Steps to reproduce
  - Screenshots if applicable

---

Made with ❤️ by Ananta
