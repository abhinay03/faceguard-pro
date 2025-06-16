import React, { useState, useRef, useEffect } from 'react';
import './App.css';

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
  const [serverPort, setServerPort] = useState(8000);
  const [faceQuality, setFaceQuality] = useState({
    eyesOpen: false,
    isSmiling: false,
    isWellLit: false,
    isIdealLighting: false
  });
  const [previewTransform, setPreviewTransform] = useState({ x: 0, y: 0, scale: 1 });
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

  // Function to try different ports
  const tryServerPort = async (port) => {
    try {
      const response = await fetch(`http://localhost:${port}/api/detect-face`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: 'test' })
      });
      return response.ok;
    } catch (e) {
      return false;
    }
  };

  // Detect server port on component mount
  useEffect(() => {
    const detectPort = async () => {
      const ports = [8000, 8080, 8888, 9000, 9090];
      for (const port of ports) {
        if (await tryServerPort(port)) {
          setServerPort(port);
          console.log(`Server detected on port ${port}`);
          break;
        }
      }
    };
    detectPort();
  }, []);

  const startFaceDetection = () => {
    if (detectionInterval.current) {
      clearInterval(detectionInterval.current);
    }

    detectionInterval.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) {
        console.log('Video or canvas ref not available');
        return;
      }

      try {
        const context = canvasRef.current.getContext('2d');
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);

        const imageData = canvasRef.current.toDataURL('image/jpeg', 0.8);
        console.log('Sending image for detection, size:', imageData.length);

        const response = await fetch(`http://localhost:${serverPort}/api/detect-face`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image: imageData
          })
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
          // Check if face is centered (within 30% of center)
          const isCentered = 
            Math.abs(data.facePosition.x) < 0.3 && 
            Math.abs(data.facePosition.y) < 0.3 &&
            Math.abs(data.facePosition.scale - 1) < 0.3;
          
          console.log('Face position:', data.facePosition);
          console.log('Is centered:', isCentered);
          
          setIsFaceCentered(isCentered);
        }
      } catch (err) {
        console.error('Face detection error:', err);
        if (err.message.includes('Failed to fetch') || err.message.includes('ERR_CONNECTION_REFUSED')) {
          setMessage(`Cannot connect to server on port ${serverPort}. Please make sure the backend server is running.`);
          stopFaceDetection();
        } else {
          setIsFaceDetected(false);
          setMessage(err.message || 'Error detecting face');
        }
      }
    }, 500);
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
    
    const context = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);
    
    // Calculate the centering transform
    const newTransform = {
      x: -facePosition.x * 50,
      y: -facePosition.y * 50,
      scale: 1/facePosition.scale
    };
    setPreviewTransform(newTransform);
    
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
      const response = await fetch(`http://localhost:${serverPort}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name,
          image: capturedImage
        })
      });
      
      const data = await response.json();
      if (data.success) {
        // Fetch and display profile picture
        const picResponse = await fetch(`http://localhost:${serverPort}/api/profile-picture/${data.userId}`);
        const picData = await picResponse.json();
        if (picData.success) {
          setProfilePicture(picData.image);
        }
        // Reset form for new registration
        setName('');
        setMessage('Registration successful! You can register another person now.');
        // Stop the current video stream
        if (videoRef.current && videoRef.current.srcObject) {
          const tracks = videoRef.current.srcObject.getTracks();
          tracks.forEach(track => track.stop());
        }
        // Clear the video element
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
      
      const response = await fetch(`http://localhost:${serverPort}/api/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageData
        })
      });
      
      const data = await response.json();
      setMessage(data.message);
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
              <div className="preview-image-container">
                <img 
                  src={capturedImage} 
                  alt="Captured face" 
                  style={{
                    transform: `translate(${previewTransform.x}%, ${previewTransform.y}%) scale(${previewTransform.scale})`,
                    transition: 'transform 0.5s ease-out'
                  }}
                />
                <div className="preview-face-outline"></div>
              </div>
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
                  transform: `translate(${facePosition.x * 50}%, ${facePosition.y * 50}%) scale(${facePosition.scale})`
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
                !faceQuality.isWellLit}
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