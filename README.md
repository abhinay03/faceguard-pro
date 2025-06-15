# FaceGuard Pro

An advanced face recognition system with real-time face tracking, quality checks, and profile management.

## Features

- Real-time face detection and tracking
- Automatic face centering and alignment
- Quality checks for:
  - Eye openness
  - Smile detection
  - Lighting conditions
  - Face positioning
- Profile picture management
- User registration and verification
- Modern, responsive UI

## Tech Stack

- Frontend: React.js
- Backend: Python Flask
- Face Detection: dlib, face_recognition
- Image Processing: OpenCV

## Prerequisites

- Python 3.7+
- Node.js 14+
- npm or yarn
- Webcam

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/faceguard-pro.git
cd faceguard-pro
```

2. Set up the backend:

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. Set up the frontend:

```bash
cd frontend
npm install
```

## Running the Application

1. Start the backend server:

```bash
cd backend
python app.py
```

2. Start the frontend development server:

```bash
cd frontend
npm start
```

3. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Click "Start Camera" to begin
2. Enter your name
3. Position your face within the alignment grid
4. Wait for all quality indicators to turn green
5. Click "Register Face" when ready
6. Confirm the captured image
7. Your profile picture will be displayed after successful registration

## Project Structure

```
faceguard-pro/
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   └── user_data/
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── README.md
└── README.md
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- dlib for face detection and landmark prediction
- face_recognition library for face encoding
- React.js for the frontend framework
- Flask for the backend framework
