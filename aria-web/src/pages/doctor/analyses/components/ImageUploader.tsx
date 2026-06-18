import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Image as File } from 'lucide-react';

interface ImageUploaderProps {
  onImageSelect: (file: File) => void;
  onImageRemove: () => void;
  selectedImage: File | null;
  previewUrl: string | null;
  isLoading?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageSelect,
  onImageRemove,
  selectedImage,
  previewUrl,
  isLoading = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onImageSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onImageSelect(files[0]);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300
          ${isDragging ? 'border-primary-500 bg-primary-500/10' : 'border-gray-700/50 hover:border-gray-600'}
          ${previewUrl ? 'p-0' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        <AnimatePresence mode="wait">
          {previewUrl ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative"
            >
              <img
                src={previewUrl}
                alt="Radiographie"
                className="w-full max-h-96 object-contain rounded-xl"
              />
              <button
                onClick={onImageRemove}
                disabled={isLoading}
                className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 rounded-lg text-white transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 px-3 py-1 bg-black/60 backdrop-blur rounded-lg">
                <p className="text-xs text-white">{selectedImage?.name}</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-8"
            >
              {isLoading ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-400">Upload en cours...</p>
                </div>
              ) : (
                <>
                  <div className="inline-flex p-4 bg-primary-500/10 rounded-full mb-4">
                    <Upload className="w-8 h-8 text-primary-400" />
                  </div>
                  <p className="text-gray-300 font-medium">Glissez une image ou cliquez</p>
                  <p className="text-gray-500 text-sm mt-1">JPEG, PNG, DICOM supportés</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
                  >
                    Choisir une image
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {selectedImage && !previewUrl && (
        <div className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg">
          <File className="w-5 h-5 text-primary-400" />
          <span className="text-sm text-gray-300">{selectedImage.name}</span>
          <span className="text-xs text-gray-500 ml-auto">
            {(selectedImage.size / 1024).toFixed(1)} KB
          </span>
        </div>
      )}
    </div>
  );
};