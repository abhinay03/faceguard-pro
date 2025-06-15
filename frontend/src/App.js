import React, { useState, useRef, useEffect } from 'react';
import './App.css';

// API URL configuration
const API_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:9999/.netlify/functions/face-detection'
  : '/.netlify/functions/face-detection';

function App() {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [facePosition, setFacePosition] = useState({ x: 0, y: 0, scale: 1 });
  const [isFaceCentered, setIsFaceCentered] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionMessage, setDetectionMessage] = useState('');
  const [faceQuality, setFaceQuality] = useState({
    eyesOpen: false,
    isSmiling: false,
    isWellLit: false,
    isIdealLighting: false
  });
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectionInterval = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      startFaceDetection();
    } catch (err) {
      setMessage('Error accessing camera: ' + err.message);
    }
  };

  const startFaceDetection = async () => {
    if (!videoRef.current) return;
    
    setIsDetecting(true);
    setDetectionMessage('Starting face detection...');
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg');
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageData }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Face detection response:', data);
      
      setIsFaceDetected(data.faceDetected);
      if (data.faceQuality) {
        setFaceQuality(data.faceQuality);
        if (data.message) {
          setMessage(data.message);
        } else {
          setMessage('');
        }
      } else if (data.message) {
        setMessage(data.message);
      }

      // Update face position if detected
      if (data.facePosition) {
        setFacePosition(data.facePosition);
        // Check if face is centered (within 10% of center)
        const isCentered = 
          Math.abs(data.facePosition.x) < 0.1 && 
          Math.abs(data.facePosition.y) < 0.1 &&
          Math.abs(data.facePosition.scale - 1) < 0.1;
        setIsFaceCentered(isCentered);
      }
    } catch (err) {
      console.error('Face detection error:', err);
      setMessage(err.message || 'Error detecting face');
      setIsDetecting(false);
    }
  };

  const stopFaceDetection = () => {
    if (detectionInterval.current) {
      clearInterval(detectionInterval.current);
      detectionInterval.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopFaceDetection();
    };
  }, []);

  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    // Only capture if face is centered
    if (!isFaceCentered) {
      setMessage('Please center your face in the frame');
      return;
    }
    
    const context = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);
    
    // Get the image data as base64
    const imageData = canvasRef.current.toDataURL('image/jpeg');
    setCapturedImage(imageData);
    setShowConfirmation(true);
    stopFaceDetection();
  };

  const confirmRegistration = async () => {
    if (!capturedImage) return;
    
    setIsLoading(true);
    setMessage('Processing...');
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name,
          image: capturedImage,
          isRegistration: true
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setProfilePicture(capturedImage);
        setName('');
        setMessage('Registration successful! You can register another person now.');
        if (videoRef.current && videoRef.current.srcObject) {
          const tracks = videoRef.current.srcObject.getTracks();
          tracks.forEach(track => track.stop());
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      } else {
        setMessage(data.message);
      }
      setShowConfirmation(false);
      setCapturedImage(null);
      startFaceDetection();
    } catch (err) {
      setMessage('Error: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelRegistration = () => {
    setShowConfirmation(false);
    setCapturedImage(null);
    startFaceDetection();
  };

  const verifyFace = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsLoading(true);
    setMessage('Processing...');
    
    try {
      const context = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);
      
      const imageData = canvasRef.current.toDataURL('image/jpeg');
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageData,
          isRegistration: false
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setMessage(`Welcome back, ${data.matchedUser.name}!`);
        setProfilePicture(data.matchedUser.profilePicture);
      } else {
        setMessage(data.message);
      }
    } catch (err) {
      setMessage('Error: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>FaceGuard Pro</h1>
        <p className="app-subtitle">Advanced Face Recognition & Profile Management</p>
        
        {profilePicture && (
          <div className="profile-picture">
            <h2>Your Profile Picture</h2>
            <img src={profilePicture} alt="Profile" style={{ width: '200px', height: '200px', objectFit: 'cover', borderRadius: '50%' }} />
          </div>
        )}
        
        <div className="video-container">
          {showConfirmation ? (
            <div className="preview-container">
              <img src={capturedImage} alt="Captured face" />
              <div className="confirmation-buttons">
                <button onClick={confirmRegistration} disabled={isLoading}>
                  Confirm Registration
                </button>
                <button onClick={cancelRegistration} disabled={isLoading}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="video-wrapper">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  style={{ width: '640px', height: '480px' }}
                />
                <div className="alignment-grid" style={{
                  transform: `translate(${facePosition.x * 100}px, ${facePosition.y * 100}px) scale(${facePosition.scale})`
                }}>
                  <div className="face-outline"></div>
                  <div className="face-guide eyes"></div>
                  <div className="face-guide nose"></div>
                  <div className="face-guide mouth"></div>
                  <div className="face-guide cheeks left"></div>
                  <div className="face-guide cheeks right"></div>
                </div>
                {isFaceDetected && (
                  <div className="face-quality-indicators">
                    <div className={`quality-indicator ${faceQuality.eyesOpen ? 'active' : ''}`}>
                      👁️ Eyes Open
                    </div>
                    <div className={`quality-indicator ${faceQuality.isSmiling ? 'active' : ''}`}>
                      😊 Smiling
                    </div>
                    <div className={`quality-indicator ${faceQuality.isWellLit ? 'active' : ''}`}>
                      💡 {faceQuality.isIdealLighting ? 'Good Lighting' : 'Adequate Lighting'}
                    </div>
                    <div className={`quality-indicator ${isFaceCentered ? 'active' : ''}`}>
                      🎯 Face Centered
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        <div className="controls">
          <button onClick={startCamera} disabled={isLoading}>
            Start Camera
          </button>
          
          <div className="registration-form">
            <input
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
            <button
              onClick={captureImage}
              disabled={!name || isLoading || !isFaceDetected || 
                !faceQuality.eyesOpen || !faceQuality.isSmiling || 
                !faceQuality.isWellLit || !isFaceCentered}
            >
              Register Face
            </button>
          </div>

          <button onClick={verifyFace} disabled={isLoading || !isFaceDetected}>
            Verify Face
          </button>
        </div>

        {message && (
          <div className={`message ${message.includes('Error') ? 'error' : 'info'}`}>
            {message}
          </div>
        )}
      </header>
    </div>
  );
}

export default App; 