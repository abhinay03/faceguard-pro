import urllib.request
import os

def download_model():
    model_url = "http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2"
    model_path = "shape_predictor_68_face_landmarks.dat"
    
    if not os.path.exists(model_path):
        print("Downloading facial landmark predictor model...")
        urllib.request.urlretrieve(model_url, model_path + ".bz2")
        
        # Decompress the file
        import bz2
        with bz2.open(model_path + ".bz2", 'rb') as source, open(model_path, 'wb') as dest:
            dest.write(source.read())
        
        # Remove the compressed file
        os.remove(model_path + ".bz2")
        print("Model downloaded and extracted successfully!")
    else:
        print("Model already exists!")

if __name__ == "__main__":
    download_model() 