
import React, { useState, useRef } from 'react';
import { extractClothingMetadata, generateSmartOutfit } from '../services/geminiService';
import { Category, ClothingItem, BoundingBox, SmartOutfitResponse } from '../types';
import { CATEGORY_COLORS } from '../constants';

interface WardrobeProps {
  onSelectItem: (item: ClothingItem) => void;
  wardrobeItems: ClothingItem[];
  setWardrobeItems: React.Dispatch<React.SetStateAction<ClothingItem[]>>;
  onBack: () => void;
}

const STYLES = [
  { id: 'Minimalist', title: 'Minimalist', description: 'Clean lines, neutral tones, effortless' },
  { id: 'Old Money', title: 'Old Money', description: 'Classic, polished, timeless elegance' },
  { id: 'Soft Girl', title: 'Soft Girl', description: 'Pastel, feminine, dreamy layers' },
  { id: 'Resort', title: 'Resort', description: 'Breezy, vacation-ready, effortless chic' },
];

const Wardrobe: React.FC<WardrobeProps> = ({ onSelectItem, wardrobeItems, setWardrobeItems, onBack }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<Category | 'All'>('All');
  const [showGenerator, setShowGenerator] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [isGeneratingOutfit, setIsGeneratingOutfit] = useState(false);
  const [generatedOutfit, setGeneratedOutfit] = useState<SmartOutfitResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cropImage = (imageSrc: string, box: BoundingBox): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve('');

        const x = (box.xmin / 100) * img.width;
        const y = (box.ymin / 100) * img.height;
        const width = ((box.xmax - box.xmin) / 100) * img.width;
        const height = ((box.ymax - box.ymin) / 100) * img.height;

        const padding = 0.05; 
        const px = Math.max(0, x - width * padding);
        const py = Math.max(0, y - height * padding);
        const pw = Math.min(img.width - px, width * (1 + padding * 2));
        const ph = Math.min(img.height - py, height * (1 + padding * 2));

        canvas.width = pw;
        canvas.height = ph;
        ctx.drawImage(img, px, py, pw, ph, 0, 0, pw, ph);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = imageSrc;
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      const items = await extractClothingMetadata(base64);

      const newItems: ClothingItem[] = [];
      for (const item of items) {
        const cropped = await cropImage(base64, item.boundingBox);
        newItems.push({
          id: Math.random().toString(36).substr(2, 9),
          category: item.category as Category,
          description: `${item.color} ${item.subcategory}`,
          imageBlob: cropped,
          originalImage: base64,
          boundingBox: item.boundingBox,
        });
      }

      setWardrobeItems((prev) => [...newItems, ...prev]);
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
    if (event.target) event.target.value = '';
  };

  const handleGenerateOutfit = async () => {
    if (!selectedStyle || wardrobeItems.length === 0) return;
    setIsGeneratingOutfit(true);
    try {
      const result = await generateSmartOutfit(wardrobeItems, selectedStyle);
      setGeneratedOutfit(result);
    } catch (error) {
      console.error(error);
      alert("Failed to generate outfit recommendations.");
    } finally {
      setIsGeneratingOutfit(false);
    }
  };

  const tryLook = () => {
    if (!generatedOutfit) return;
    
    // Find matching items from wardrobe by ID
    const findItem = (category: string, suggestion?: any) => {
      if (!suggestion || !suggestion.id) return null;
      return wardrobeItems.find(i => i.id === suggestion.id);
    };

    const top = findItem('top', generatedOutfit.outfit.top);
    const outerwear = findItem('outerwear', generatedOutfit.outfit.outerwear);
    const bottom = findItem('bottom', generatedOutfit.outfit.bottom);
    const footwear = findItem('footwear', generatedOutfit.outfit.footwear);

    // Select all available items
    if (top) onSelectItem(top);
    if (outerwear) onSelectItem(outerwear);
    if (bottom) onSelectItem(bottom);
    if (footwear) onSelectItem(footwear);
    
    setShowGenerator(false);
    setGeneratedOutfit(null);
    onBack();
  };

  const filteredItems = activeFilter === 'All' 
    ? wardrobeItems 
    : wardrobeItems.filter(item => item.category === activeFilter);

  const getItemById = (id?: string) => wardrobeItems.find(i => i.id === id);

  return (
    <div className="flex flex-col h-full bg-[#FAF9F7] p-6 md:p-10 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-white text-[#1A1A1A] hover:bg-[#F0EDE8] transition-all border border-[#EEECE8]"
          >
            <i className="fas fa-chevron-left text-xs"></i>
          </button>
          <div>
            <h2 className="text-xl font-bold text-[#1A1A1A] tracking-tight">Archive</h2>
            <p className="text-[#888888] font-medium text-xs">Manage your digital assets</p>
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={() => {
              setShowGenerator(true);
              setGeneratedOutfit(null);
            }}
            className="flex-1 md:flex-none bg-white border border-[#1A1A1A] hover:bg-[#F0EDE8] text-[#1A1A1A] px-6 py-2.5 rounded-lg transition-all flex items-center justify-center gap-3 font-bold text-xs uppercase tracking-widest"
          >
            <span>✨ Generate Outfit</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 md:flex-none bg-[#1A1A1A] hover:opacity-90 text-white px-6 py-2.5 rounded-lg transition-all flex items-center justify-center gap-3 font-bold text-xs uppercase tracking-widest shadow-sm"
            disabled={isProcessing}
          >
            {isProcessing ? (
              <i className="fas fa-circle-notch fa-spin"></i>
            ) : (
              <i className="fas fa-plus"></i>
            )}
            <span>{isProcessing ? 'Importing' : 'Import'}</span>
          </button>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleFileUpload}
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-10 overflow-x-auto pb-2 scrollbar-hide">
        {['All', ...Object.values(Category)].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat as any)}
            className={`px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap border ${
              activeFilter === cat
                ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                : 'bg-white text-[#888888] border-[#EEECE8] hover:border-[#1A1A1A] hover:text-[#1A1A1A]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {filteredItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-20 text-center">
            <p className="font-bold text-xs uppercase tracking-[0.2em] text-[#888888]">No assets found</p>
            <p className="text-[#888888] mt-2 text-[10px]">Start by importing images of your clothing</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectItem(item)}
                className="group relative bg-white rounded-xl overflow-hidden cursor-pointer border border-[#EEECE8] hover:border-[#1A1A1A] transition-all shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
              >
                <div className="aspect-square w-full bg-white flex items-center justify-center p-4">
                  <img
                    src={item.imageBlob}
                    alt={item.description}
                    className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-700"
                  />
                </div>
                <div className="p-4 border-t border-[#EEECE8]">
                  <span className={`text-[8px] uppercase tracking-widest font-bold px-2 py-0.5 rounded bg-[#F0EDE8] text-[#1A1A1A]`}>
                    {item.category}
                  </span>
                  <p className="text-[10px] text-[#1A1A1A] mt-2 line-clamp-1 font-bold tracking-tight">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Smart Outfit Generator Overlay */}
      {showGenerator && (
        <div className="absolute inset-0 z-[60] bg-[#FAF9F7] flex flex-col p-6 md:p-10 overflow-hidden">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-2xl font-black text-[#1A1A1A] uppercase tracking-tighter">Smart Stylist</h2>
            <button 
              onClick={() => setShowGenerator(false)}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-white border border-[#EEECE8] text-[#1A1A1A]"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          {!generatedOutfit ? (
            <div className="flex-1 flex flex-col">
              <p className="text-[#888888] font-bold text-xs uppercase tracking-widest mb-6">Choose a Style Direction</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                {STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`text-left p-6 rounded-2xl border-2 transition-all ${
                      selectedStyle === style.id 
                        ? 'bg-white border-[#1A1A1A] shadow-lg' 
                        : 'bg-white border-[#EEECE8] hover:border-[#888888]'
                    }`}
                  >
                    <h3 className="font-bold text-lg text-[#1A1A1A]">{style.title}</h3>
                    <p className="text-[#888888] text-sm mt-1">{style.description}</p>
                  </button>
                ))}
              </div>

              <div className="mt-auto flex justify-center">
                <button
                  onClick={handleGenerateOutfit}
                  disabled={!selectedStyle || isGeneratingOutfit || wardrobeItems.length === 0}
                  className="w-full md:w-64 bg-[#1A1A1A] text-white py-4 rounded-2xl font-bold uppercase tracking-[0.2em] text-xs shadow-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {isGeneratingOutfit ? (
                    <span className="flex items-center justify-center gap-3">
                      <i className="fas fa-circle-notch fa-spin"></i>
                      Styling...
                    </span>
                  ) : (
                    'Generate'
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
              <div className="bg-white rounded-[2.5rem] border border-[#EEECE8] p-8 md:p-12 shadow-2xl mb-8">
                <div className="flex flex-col md:flex-row gap-12">
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-[#888888] uppercase tracking-widest mb-2">Curated Look</h3>
                    <h4 className="text-3xl font-black text-[#1A1A1A] uppercase tracking-tighter mb-8">{generatedOutfit.style}</h4>
                    
                    <div className="space-y-6">
                      {(Object.entries(generatedOutfit.outfit) as [string, any][]).map(([key, data]) => {
                        const matchedItem = getItemById(data.id);
                        return (
                          <div key={key} className="flex gap-4 items-start">
                            <div className="w-16 h-16 rounded-xl bg-[#FAF9F7] border border-[#EEECE8] flex-shrink-0 flex items-center justify-center overflow-hidden p-2">
                              {matchedItem ? (
                                <img src={matchedItem.imageBlob} className="max-w-full max-h-full object-contain" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-[#EEECE8] rounded-md">
                                  <i className="fas fa-question text-[#888888] text-xs"></i>
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]">{key}</p>
                              <p className="text-xs font-bold text-[#1A1A1A] mt-1">{data.description}</p>
                              <p className="text-[10px] text-[#888888] mt-1 italic">{data.reason}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-12 pt-8 border-t border-[#EEECE8]">
                      <p className="text-sm text-[#1A1A1A] italic leading-relaxed">"{generatedOutfit.overall_vibe}"</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col justify-end">
                    <button
                      onClick={tryLook}
                      className="w-full md:w-64 bg-[#1A1A1A] text-white py-5 rounded-2xl font-bold uppercase tracking-[0.2em] text-xs shadow-2xl transition-all hover:scale-[1.02] active:scale-95"
                    >
                      Try This Look →
                    </button>
                    <button
                      onClick={() => setGeneratedOutfit(null)}
                      className="mt-4 text-[#888888] text-xs font-bold uppercase tracking-widest hover:text-[#1A1A1A] transition-colors"
                    >
                      Try Another Style
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Wardrobe;
