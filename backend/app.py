from flask import Flask, request, jsonify
from flask_cors import CORS
import face_recognition
import numpy as np
import os
import json
import base64
from datetime import datetime
from PIL import Image
import io
import cv2
import dlib
import sys
import traceback

print("Starting server initialization...")

try:
    app = Flask(__name__)
    CORS(app)
    print("Flask app and CORS initialized")

    # Initialize dlib's face detector and facial landmark predictor
    print("Initializing face detector...")
    detector = dlib.get_frontal_face_detector()
    print("Face detector initialized successfully")

    # Check if model file exists
    MODEL_PATH = 'shape_predictor_68_face_landmarks.dat'
    if not os.path.exists(MODEL_PATH):
        print(f"Warning: Model file {MODEL_PATH} not found. Downloading...")
        try:
            import urllib.request
            import bz2
            
            # Download the model
            model_url = "http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2"
            print(f"Downloading model from {model_url}...")
            urllib.request.urlretrieve(model_url, MODEL_PATH + ".bz2")
            print("Model downloaded successfully")
            
            # Decompress the file
            print("Decompressing model file...")
            with bz2.open(MODEL_PATH + ".bz2", 'rb') as source, open(MODEL_PATH, 'wb') as dest:
                dest.write(source.read())
            print("Model decompressed successfully")
            
            # Remove the compressed file
            os.remove(MODEL_PATH + ".bz2")
            print("Compressed file removed")
        except Exception as e:
            print(f"Error downloading model: {str(e)}")
            print(f"Traceback: {traceback.format_exc()}")
            print("Please download the model manually from: http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2")
            sys.exit(1)

    try:
        print("Loading facial landmark predictor model...")
        predictor = dlib.shape_predictor(MODEL_PATH)
        print("Model loaded successfully!")
    except Exception as e:
        print(f"Error loading model: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        predictor = None

    # Create a directory to store user data
    if not os.path.exists('user_data'):
        print("Creating user_data directory...")
        os.makedirs('user_data')
        print("user_data directory created")

    # Create a directory to store profile pictures
    if not os.path.exists('user_data/profile_pictures'):
        print("Creating profile_pictures directory...")
        os.makedirs('user_data/profile_pictures')
        print("profile_pictures directory created")

    # File to store user information
    USER_DATA_FILE = 'user_data/users.json'
    print("Server initialization completed successfully")

except Exception as e:
    print(f"Error during server initialization: {str(e)}")
    print(f"Traceback: {traceback.format_exc()}")
    sys.exit(1)

def calculate_eye_aspect_ratio(eye_landmarks):
    try:
        # Calculate the vertical distance between eye landmarks
        vertical_dist1 = np.linalg.norm(eye_landmarks[1] - eye_landmarks[5])
        vertical_dist2 = np.linalg.norm(eye_landmarks[2] - eye_landmarks[4])
        # Calculate the horizontal distance between eye landmarks
        horizontal_dist = np.linalg.norm(eye_landmarks[0] - eye_landmarks[3])
        # Calculate the eye aspect ratio
        ear = (vertical_dist1 + vertical_dist2) / (2.0 * horizontal_dist)
        return ear
    except Exception as e:
        print(f"Error calculating eye aspect ratio: {str(e)}")
        print(f"Eye landmarks shape: {eye_landmarks.shape}")
        return 0.0

def calculate_face_alignment(landmarks):
    try:
        # Get the nose bridge points
        nose_bridge = landmarks[27:31]
        # Calculate the angle of the nose bridge relative to vertical
        angle = np.arctan2(nose_bridge[-1][1] - nose_bridge[0][1], 
                          nose_bridge[-1][0] - nose_bridge[0][0])
        angle_degrees = np.degrees(angle)
        print(f"Raw face angle: {angle_degrees}")
        # Normalize angle to be between -90 and 90 degrees
        if angle_degrees > 90:
            angle_degrees = angle_degrees - 180
        elif angle_degrees < -90:
            angle_degrees = angle_degrees + 180
        print(f"Normalized face angle: {angle_degrees}")
        return angle_degrees
    except Exception as e:
        print(f"Error calculating face alignment: {str(e)}")
        print(f"Landmarks shape: {landmarks.shape}")
        return 0.0

def detect_smile(landmarks):
    try:
        # Get mouth corner points
        mouth_left = landmarks[48]
        mouth_right = landmarks[54]
        # Get mouth height points
        mouth_top = landmarks[51]
        mouth_bottom = landmarks[57]
        
        # Calculate mouth width and height
        mouth_width = np.linalg.norm(mouth_right - mouth_left)
        mouth_height = np.linalg.norm(mouth_bottom - mouth_top)
        
        # Calculate smile ratio - lowered threshold from 0.2 to 0.15
        smile_ratio = mouth_height / mouth_width
        return smile_ratio > 0.15  # More lenient threshold for smile detection
    except Exception as e:
        print(f"Error detecting smile: {str(e)}")
        print(f"Landmarks shape: {landmarks.shape}")
        return False

def load_user_data():
    if os.path.exists(USER_DATA_FILE):
        with open(USER_DATA_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_user_data(data):
    with open(USER_DATA_FILE, 'w') as f:
        json.dump(data, f)

def base64_to_image(base64_string):
    # Remove the data URL prefix if present
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    
    # Decode base64 string to bytes
    image_bytes = base64.b64decode(base64_string)
    
    # Convert bytes to image
    image = Image.open(io.BytesIO(image_bytes))
    
    # Convert PIL Image to numpy array
    return np.array(image)

def check_lighting(image_array, face_rect):
    try:
        # Extract face region
        top, right, bottom, left = face_rect
        face_region = image_array[top:bottom, left:right]
        
        # Convert to grayscale if not already
        if len(face_region.shape) == 3:
            face_region = cv2.cvtColor(face_region, cv2.COLOR_RGB2GRAY)
        
        # Calculate average brightness
        avg_brightness = np.mean(face_region)
        
        # Define thresholds - adjusted for more accurate lighting detection
        MIN_BRIGHTNESS = 40  # Increased from 30 to 40
        IDEAL_BRIGHTNESS = 120  # Increased from 80 to 120
        
        print(f"Lighting check - Average brightness: {avg_brightness:.2f}")
        print(f"Lighting check - Minimum threshold: {MIN_BRIGHTNESS}")
        print(f"Lighting check - Ideal threshold: {IDEAL_BRIGHTNESS}")
        
        is_well_lit = avg_brightness >= MIN_BRIGHTNESS
        is_ideal_lighting = avg_brightness >= IDEAL_BRIGHTNESS
        
        print(f"Lighting check - Is well lit: {is_well_lit}")
        print(f"Lighting check - Is ideal lighting: {is_ideal_lighting}")
        
        return {
            'isWellLit': is_well_lit,
            'brightness': float(avg_brightness),  # Convert to float for JSON serialization
            'isIdealLighting': is_ideal_lighting
        }
    except Exception as e:
        print(f"Error in check_lighting: {str(e)}")
        return {
            'isWellLit': False,  # Changed default to False
            'brightness': 0,
            'isIdealLighting': False  # Changed default to False
        }

@app.route('/api/detect-face', methods=['POST'])
def detect_face():
    try:
        if predictor is None:
            return jsonify({
                'success': False,
                'message': 'Face detection model not loaded. Please check server logs.'
            }), 500

        data = request.json
        image_data = data.get('image')
        
        if not image_data:
            print("No image data received")
            return jsonify({
                'success': False,
                'message': 'Image is required'
            }), 400
        
        # Convert base64 image to numpy array
        image_array = base64_to_image(image_data)
        print(f"Image shape: {image_array.shape}")
        
        # Convert to grayscale for dlib
        gray = cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY)
        
        # Detect faces using dlib
        faces = detector(gray)
        print(f"Number of faces detected: {len(faces)}")
        
        if len(faces) == 0:
            return jsonify({
                'success': True,
                'faceDetected': False,
                'faceCount': 0,
                'message': 'No face detected'
            })
        
        if len(faces) > 1:
            return jsonify({
                'success': True,
                'faceDetected': True,
                'faceCount': len(faces),
                'message': 'Multiple faces detected'
            })
        
        try:
            # Get facial landmarks
            print("Getting facial landmarks...")
            landmarks = predictor(gray, faces[0])
            landmarks = np.array([[p.x, p.y] for p in landmarks.parts()])
            print(f"Landmarks shape: {landmarks.shape}")
            
            # Calculate face position relative to center
            face_rect = faces[0]
            image_center_x = image_array.shape[1] / 2
            image_center_y = image_array.shape[0] / 2
            face_center_x = (face_rect.left() + face_rect.right()) / 2
            face_center_y = (face_rect.top() + face_rect.bottom()) / 2
            
            # Calculate normalized position (-1 to 1)
            pos_x = (face_center_x - image_center_x) / image_center_x
            pos_y = (face_center_y - image_center_y) / image_center_y
            
            # Calculate face size relative to ideal size
            face_width = face_rect.right() - face_rect.left()
            face_height = face_rect.bottom() - face_rect.top()
            ideal_size = min(image_array.shape[0], image_array.shape[1]) * 0.4  # 40% of smaller dimension
            current_size = max(face_width, face_height)
            scale = current_size / ideal_size
            
            face_position = {
                'x': float(pos_x),
                'y': float(pos_y),
                'scale': float(scale)
            }
            
            # Calculate eye aspect ratios
            print("Calculating eye aspect ratios...")
            left_eye = landmarks[36:42]
            right_eye = landmarks[42:48]
            left_ear = calculate_eye_aspect_ratio(left_eye)
            right_ear = calculate_eye_aspect_ratio(right_eye)
            avg_ear = (left_ear + right_ear) / 2.0
            print(f"Eye aspect ratios - Left: {left_ear}, Right: {right_ear}, Average: {avg_ear}")
            
            # Detect smile
            print("Detecting smile...")
            is_smiling = detect_smile(landmarks)
            print(f"Is smiling: {is_smiling}")
            
            # Check lighting
            print("Checking lighting...")
            face_rect = (faces[0].top(), faces[0].right(), faces[0].bottom(), faces[0].left())
            lighting_info = check_lighting(image_array, face_rect)
            print(f"Lighting info: {lighting_info}")
            
            # Convert NumPy boolean to Python boolean
            eyes_open = bool(avg_ear > 0.15)  # Lowered threshold from 0.2 to 0.15
            is_smiling_bool = bool(is_smiling)
            
            print(f"Quality checks - Eyes open: {eyes_open} (threshold: 0.15)")
            print(f"Quality checks - Smiling: {is_smiling_bool}")
            print(f"Quality checks - Well lit: {lighting_info['isWellLit']}")
            
            # Prepare response
            response = {
                'success': True,
                'faceDetected': True,
                'faceCount': 1,
                'facePosition': face_position,
                'faceQuality': {
                    'eyesOpen': eyes_open,
                    'isSmiling': is_smiling_bool,
                    'isWellLit': bool(lighting_info['isWellLit']),
                    'isIdealLighting': bool(lighting_info['isIdealLighting'])
                }
            }
            
            # Add guidance messages
            messages = []
            if not response['faceQuality']['eyesOpen']:
                messages.append('Please open your eyes')
            if not response['faceQuality']['isSmiling']:
                messages.append('Please smile')
            if not response['faceQuality']['isWellLit']:
                messages.append('Please move to a well-lit area')
            elif not response['faceQuality']['isIdealLighting']:
                messages.append('Better lighting would improve face detection')
            
            if messages:
                response['message'] = ' | '.join(messages)
            
            print("Successfully processed face features")
            return jsonify(response)
            
        except Exception as e:
            print(f"Error processing face: {str(e)}")
            print(f"Error type: {type(e)}")
            print(f"Traceback: {traceback.format_exc()}")
            return jsonify({
                'success': True,
                'faceDetected': True,
                'faceCount': 1,
                'message': 'Face detected but could not analyze features'
            })
    
    except Exception as e:
        print(f"Error in detect_face: {str(e)}")
        print(f"Error type: {type(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400

@app.route('/api/register', methods=['POST'])
def register_user():
    try:
        data = request.json
        name = data.get('name')
        image_data = data.get('image')
        
        if not name or not image_data:
            return jsonify({
                'success': False,
                'message': 'Name and image are required'
            }), 400
        
        # Convert base64 image to numpy array
        image_array = base64_to_image(image_data)
        
        # Find face locations in the image
        face_locations = face_recognition.face_locations(image_array)
        
        if not face_locations:
            return jsonify({
                'success': False,
                'message': 'No face detected in the image'
            }), 400
        
        if len(face_locations) > 1:
            return jsonify({
                'success': False,
                'message': 'Multiple faces detected. Please ensure only one face is visible.'
            }), 400
        
        # Get face encoding
        face_encoding = face_recognition.face_encodings(image_array, face_locations)[0]
        
        # Load existing user data
        users = load_user_data()
        
        # Generate user ID
        user_id = str(len(users) + 1)
        
        # Save profile picture
        profile_pic_path = f'user_data/profile_pictures/{user_id}.jpg'
        profile_pic = Image.fromarray(image_array)
        profile_pic.save(profile_pic_path)
        
        # Store user data
        users[user_id] = {
            'name': name,
            'faceEncoding': face_encoding.tolist(),
            'registeredAt': datetime.now().isoformat(),
            'profilePicture': profile_pic_path
        }
        
        save_user_data(users)
        
        return jsonify({
            'success': True,
            'message': 'User registered successfully',
            'userId': user_id,
            'profilePicture': profile_pic_path
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400

@app.route('/api/verify', methods=['POST'])
def verify_user():
    try:
        data = request.json
        if not data:
            print("No data received in verify request")
            return jsonify({
                'success': False,
                'message': 'No data received'
            }), 400

        image_data = data.get('image')
        if not image_data:
            print("No image data in verify request")
            return jsonify({
                'success': False,
                'message': 'Image is required'
            }), 400
        
        print("Processing verification image...")
        # Convert base64 image to numpy array
        try:
            image_array = base64_to_image(image_data)
            print(f"Image converted successfully, shape: {image_array.shape}")
        except Exception as e:
            print(f"Error converting image: {str(e)}")
            return jsonify({
                'success': False,
                'message': 'Invalid image format'
            }), 400
        
        # Find face locations in the image
        try:
            face_locations = face_recognition.face_locations(image_array)
            print(f"Face locations found: {len(face_locations)}")
        except Exception as e:
            print(f"Error detecting faces: {str(e)}")
            return jsonify({
                'success': False,
                'message': 'Error detecting face in image'
            }), 400
        
        if not face_locations:
            print("No face detected in verification image")
            return jsonify({
                'success': False,
                'message': 'No face detected in the image'
            }), 400
        
        if len(face_locations) > 1:
            print(f"Multiple faces detected: {len(face_locations)}")
            return jsonify({
                'success': False,
                'message': 'Multiple faces detected. Please ensure only one face is visible.'
            }), 400
        
        # Get face encoding
        try:
            face_encoding = face_recognition.face_encodings(image_array, face_locations)[0]
            print("Face encoding generated successfully")
        except Exception as e:
            print(f"Error generating face encoding: {str(e)}")
            return jsonify({
                'success': False,
                'message': 'Error processing face features'
            }), 400
        
        # Load user data
        try:
            users = load_user_data()
            print(f"Loaded {len(users)} registered users")
        except Exception as e:
            print(f"Error loading user data: {str(e)}")
            return jsonify({
                'success': False,
                'message': 'Error accessing user database'
            }), 500
        
        if not users:
            print("No registered users found")
            return jsonify({
                'success': False,
                'message': 'No registered users found'
            }), 404
        
        # Compare with stored face encodings
        for user_id, user_data in users.items():
            try:
                stored_encoding = np.array(user_data['faceEncoding'])
                # Compare face encodings
                match = face_recognition.compare_faces([stored_encoding], face_encoding, tolerance=0.6)[0]
                
                if match:
                    print(f"Face verified successfully for user: {user_data['name']}")
                    return jsonify({
                        'success': True,
                        'message': 'Face verified successfully',
                        'userId': user_id,
                        'name': user_data['name']
                    })
            except Exception as e:
                print(f"Error comparing with user {user_id}: {str(e)}")
                continue
        
        print("No matching face found")
        return jsonify({
            'success': False,
            'message': 'Face not recognized'
        }), 404
    
    except Exception as e:
        print(f"Unexpected error in verify_user: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            'success': False,
            'message': 'An unexpected error occurred'
        }), 500

# Add new endpoint to get profile picture
@app.route('/api/profile-picture/<user_id>', methods=['GET'])
def get_profile_picture(user_id):
    try:
        users = load_user_data()
        if user_id not in users:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        profile_pic_path = users[user_id]['profilePicture']
        if not os.path.exists(profile_pic_path):
            return jsonify({
                'success': False,
                'message': 'Profile picture not found'
            }), 404
        
        # Read and encode the image
        with open(profile_pic_path, 'rb') as f:
            image_data = base64.b64encode(f.read()).decode('utf-8')
        
        return jsonify({
            'success': True,
            'image': f'data:image/jpeg;base64,{image_data}'
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400

if __name__ == '__main__':
    try:
        print("Starting Flask server...")
        app.run(debug=True, host='0.0.0.0', port=5000)
    except Exception as e:
        print(f"Error starting Flask server: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        sys.exit(1) 