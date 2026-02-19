import React, { useRef, useState, useEffect } from 'react';
import { Outfit, Category, ClothingItem } from '../types';
import { generateTryOn } from '../services/geminiService';

interface ModelViewerProps {
  outfit: Outfit;
  baseModelImage?: string;
  onModelUpload: (base64: string) => void;
}

const ModelViewer: React.FC<ModelViewerProps> = ({ outfit, baseModelImage, onModelUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUploadPrompt, setShowUploadPrompt] = useState(false);

  // Automatically trigger generation when outfit changes and a model photo exists
  useEffect(() => {
    const selectedImages = (Object.values(outfit) as (ClothingItem | undefined)[])
      .filter((item): item is ClothingItem => item !== undefined);

    if (selectedImages.length > 0) {
      if (baseModelImage) {
        handleGenerate(selectedImages.map(item => item.imageBlob));
        setShowUploadPrompt(false);
      } else {
        setShowUploadPrompt(true);
      }
    }
  }, [outfit, baseModelImage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onModelUpload(event.target?.result as string);
        setGeneratedImage(null);
        setError(null);
        setShowUploadPrompt(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async (selectedImages: string[]) => {
    if (!baseModelImage) return;

    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateTryOn(baseModelImage, selectedImages);
      setGeneratedImage(result);
    } catch (err) {
      console.error(err);
      setError("Failed to generate try-on. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!baseModelImage) {
    return (
      <div 
        onClick={() => fileInputRef.current?.click()}
        className="group relative photo-container flex-1 min-h-0 flex flex-col items-center justify-center border-2 border-dashed border-[#EEECE8] hover:border-[#1A1A1A] hover:bg-[#FAF9F7] transition-all cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.03)]"
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleFileChange} 
        />
        <div className="w-12 h-12 bg-[#FAF9F7] rounded-full flex items-center justify-center group-hover:bg-white transition-all duration-300">
          <i className="fas fa-camera text-lg text-[#D1CFCA] group-hover:text-[#1A1A1A]"></i>
        </div>
        <div className="mt-4 text-center px-6">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]">Add Portrait</h3>
          <p className="text-[#888888] mt-1 text-[8px] font-medium leading-relaxed">Upload a photo to start virtually trying on clothes.</p>
        </div>
        {showUploadPrompt && (
          <div className="absolute top-6 bg-[#1A1A1A] text-white px-4 py-1.5 rounded-full text-[8px] font-bold shadow-xl animate-bounce">
            Upload photo to start styling
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative photo-container flex-1 min-h-0 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EEECE8] bg-white">
      
      {/* Loading Spinner Overlay */}
      {isGenerating && (
        <div className="absolute inset-0 z-30 bg-white/70 backdrop-blur-[1px] flex flex-col items-center justify-center transition-all duration-300">
          <div className="w-6 h-6 border-2 border-[#EEECE8] border-t-[#1A1A1A] rounded-full animate-spin mb-2"></div>
          <p className="text-[#1A1A1A] text-[8px] font-bold uppercase tracking-widest text-center">Rendering Style</p>
        </div>
      )}

      {/* Hero Image Element */}
      <img 
        src={generatedImage || baseModelImage} 
        alt="Styling Portrait" 
        className={`transition-opacity duration-700 ease-in-out ${isGenerating ? 'opacity-40' : 'opacity-100'}`}
      />

      {/* Error Message */}
      {error && (
        <div className="absolute top-3 left-3 right-3 bg-white/95 backdrop-blur-md text-red-600 px-3 py-1.5 rounded-lg text-[8px] font-bold shadow-lg border border-red-100 z-40 text-center">
          {error}
        </div>
      )}

      {/* Change Photo Floating Button */}
      <div className="absolute top-3 right-3 z-20">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="bg-white/90 backdrop-blur-md hover:bg-white text-[#1A1A1A] w-8 h-8 rounded-full shadow-md border border-[#EEECE8] transition-all flex items-center justify-center"
        >
          <i className="fas fa-camera text-[10px]"></i>
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleFileChange} 
        />
      </div>
    </div>
  );
};

export default ModelViewer;