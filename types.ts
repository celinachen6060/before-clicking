
export enum Category {
  TOP = 'Top',
  BOTTOM = 'Bottom',
  OUTERWEAR = 'Outerwear',
  FOOTWEAR = 'Footwear',
  ACCESSORY = 'Accessory'
}

export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface ClothingItem {
  id: string;
  category: Category;
  description: string;
  imageBlob: string; // Base64 cropped image
  originalImage: string;
  boundingBox: BoundingBox;
}

export interface Outfit {
  [Category.TOP]?: ClothingItem;
  [Category.BOTTOM]?: ClothingItem;
  [Category.OUTERWEAR]?: ClothingItem;
  [Category.FOOTWEAR]?: ClothingItem;
  [Category.ACCESSORY]?: ClothingItem;
}

export type ViewState = 'main' | 'wardrobe';

export interface SmartOutfitSuggestion {
  description: string;
  reason: string;
}

export interface SmartOutfitResponse {
  style: string;
  outfit: {
    top?: SmartOutfitSuggestion;
    outerwear?: SmartOutfitSuggestion;
    bottom?: SmartOutfitSuggestion;
    footwear?: SmartOutfitSuggestion;
    accessory?: SmartOutfitSuggestion;
  };
  overall_vibe: string;
}
