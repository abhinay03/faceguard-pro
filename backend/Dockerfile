FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    pkg-config \
    libx11-dev \
    libatlas-base-dev \
    libgtk-3-dev \
    libboost-python-dev \
    wget \
    bzip2 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download the face landmark model
RUN wget http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2 \
    && bzip2 -d shape_predictor_68_face_landmarks.dat.bz2 \
    && rm shape_predictor_68_face_landmarks.dat.bz2

# Copy the rest of the application
COPY . .

# Expose the port
EXPOSE 10000

# Start the application
CMD ["gunicorn", "--config", "gunicorn_config.py", "app:app"] 