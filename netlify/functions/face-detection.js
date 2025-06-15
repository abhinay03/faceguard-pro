const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Create user_data directory if it doesn't exist
const userDataDir = path.join(__dirname, '../../user_data');
if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
}

exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Parse the request body
        const body = JSON.parse(event.body);
        const { image } = body;

        if (!image) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No image data provided' })
            };
        }

        // Save the image temporarily
        const tempImagePath = path.join(userDataDir, 'temp_face.jpg');
        const imageData = image.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(tempImagePath, Buffer.from(imageData, 'base64'));

        // Run face detection using Python
        const pythonProcess = spawn('python', [
            path.join(__dirname, '../../backend/face_detection.py'),
            tempImagePath
        ]);

        let result = '';
        let error = '';

        pythonProcess.stdout.on('data', (data) => {
            result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            error += data.toString();
        });

        return new Promise((resolve, reject) => {
            pythonProcess.on('close', (code) => {
                // Clean up temporary file
                fs.unlinkSync(tempImagePath);

                if (code !== 0) {
                    resolve({
                        statusCode: 500,
                        body: JSON.stringify({
                            error: 'Face detection failed',
                            details: error
                        })
                    });
                    return;
                }

                try {
                    const detectionResult = JSON.parse(result);
                    resolve({
                        statusCode: 200,
                        body: JSON.stringify(detectionResult)
                    });
                } catch (e) {
                    resolve({
                        statusCode: 500,
                        body: JSON.stringify({
                            error: 'Failed to parse detection result',
                            details: e.message
                        })
                    });
                }
            });
        });
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Internal server error',
                details: error.message
            })
        };
    }
}; 