#!/usr/bin/env bash
# exit on error
set -o errexit

# Install system dependencies
apt-get update
apt-get install -y build-essential cmake pkg-config
apt-get install -y libx11-dev libatlas-base-dev
apt-get install -y libgtk-3-dev libboost-python-dev

# Install Python dependencies
pip install -r requirements.txt

# Download the face landmark model
if [ ! -f "shape_predictor_68_face_landmarks.dat" ]; then
    wget http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2
    bzip2 -d shape_predictor_68_face_landmarks.dat.bz2
fi 