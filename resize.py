from PIL import Image
import os

def resize_pwa_screenshots():
    # Paths to your images (adjust if they are in web/screenshots/)
    images = {
        "mobile.png": (1080, 1920),
        "desktop.png": (1920, 1016)
    }

    for filename, size in images.items():
        if os.path.exists(filename):
            with Image.open(filename) as img:
                # Use Lanczos resampling for high quality
                new_img = img.resize(size, Image.Resampling.LANCZOS)
                new_img.save(filename)
                print(f"Successfully resized {filename} to {size}")
        else:
            print(f"Error: {filename} not found.")

if __name__ == "__main__":
    resize_pwa_screenshots()