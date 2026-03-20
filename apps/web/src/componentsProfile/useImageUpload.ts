import { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const useImageUpload = (
  userId: string | undefined, 
  onUploadSuccess: (base64: string) => void
) => {
  const [isUploading, setUploading] = useState(false);

  const saveImageToFirestore = async (base64: string) => {
    if (!userId) return;
    setUploading(true);
    try {
      await setDoc(doc(db, 'users', userId, 'profile', 'image_data'), {
        imageId: base64,
        lastUpdated: serverTimestamp()
      });
      // Call the success function passed from the component
      onUploadSuccess(base64); 
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const handlePickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        saveImageToFirestore(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
    reader.readAsDataURL(file);
  };

  return {
    handlePickImage,
    isUploading
  };
};