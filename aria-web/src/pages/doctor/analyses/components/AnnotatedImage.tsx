import React, { useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Download, AlertCircle } from 'lucide-react';

interface AnnotatedImageProps {
  imageUrl: string;
  alt?: string;
  isLoading?: boolean;
}

export const AnnotatedImage: React.FC<AnnotatedImageProps> = ({
  imageUrl,
  alt = 'Image annotée',
  isLoading = false,
}) => {
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5));
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `aria_annotated_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-gray-800/50 rounded-xl border border-gray-700/50">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-400">Génération de l'image annotée...</p>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-gray-800/50 rounded-xl border border-gray-700/50">
        <AlertCircle className="w-12 h-12 text-gray-500 mb-4" />
        <p className="text-gray-400">Image annotée non disponible</p>
        <p className="text-gray-500 text-sm mt-1">L'annotation n'a pas pu être générée</p>
      </div>
    );
  }

  return (
    <div className="relative bg-gray-900/50 rounded-xl border border-gray-700/50 overflow-hidden">
      {/* Contrôles */}
      <div className="absolute top-3 right-3 flex gap-1 z-10">
        <button
          onClick={handleZoomOut}
          disabled={zoom <= 0.5}
          className="p-2 bg-black/60 hover:bg-black/80 rounded-lg text-white transition-colors disabled:opacity-40"
          title="Zoom arrière"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={handleZoomIn}
          disabled={zoom >= 3}
          className="p-2 bg-black/60 hover:bg-black/80 rounded-lg text-white transition-colors disabled:opacity-40"
          title="Zoom avant"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={toggleFullscreen}
          className="p-2 bg-black/60 hover:bg-black/80 rounded-lg text-white transition-colors"
          title="Plein écran"
        >
          <Maximize2 size={16} />
        </button>
        <button
          onClick={handleDownload}
          className="p-2 bg-black/60 hover:bg-black/80 rounded-lg text-white transition-colors"
          title="Télécharger"
        >
          <Download size={16} />
        </button>
      </div>

      {/* Image */}
      <div className="relative overflow-hidden" style={{ height: isFullscreen ? '80vh' : '500px' }}>
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-contain transition-transform duration-300"
          style={{ transform: `scale(${zoom})` }}
        />
      </div>

      {/* Légende */}
      <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center px-3 py-1.5 bg-black/60 backdrop-blur rounded-lg">
        <span className="text-xs text-gray-300">Image annotée - ARIA</span>
        <span className="text-xs text-gray-400">Zoom: {(zoom * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
};