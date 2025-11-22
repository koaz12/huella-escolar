// src/hooks/useCamera.js
import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';

export function useCamera() {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [flashOn, setFlashOn] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomCap, setZoomCap] = useState(null); 

  const videoRef = useRef(null);

  // Conectar video al abrir
  useEffect(() => {
    if (isCameraOpen && videoRef.current && cameraStream) {
        videoRef.current.srcObject = cameraStream;
    }
  }, [isCameraOpen, cameraStream]);

  const startCamera = async (mode = 'photo') => {
    try {
      if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
              facingMode: facingMode, 
              width: { ideal: 1280 }, 
              height: { ideal: 720 } 
          },
          audio: mode === 'video'
      });

      setCameraStream(stream);
      setIsCameraOpen(true);

      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if (capabilities.zoom) setZoomCap(capabilities.zoom); else setZoomCap(null);

    } catch (err) {
      console.error(err);
      toast.error("No se pudo acceder a la cámara");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
    setCameraStream(null);
  };

  const toggleFacingMode = () => {
      setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  // Reiniciar si cambia la cámara (frontal/trasera)
  useEffect(() => {
      if(isCameraOpen && !cameraStream) startCamera();
  }, [facingMode]);

  const handleZoom = (value) => {
      setZoom(value);
      if (cameraStream) {
          const track = cameraStream.getVideoTracks()[0];
          if (track.applyConstraints) track.applyConstraints({ advanced: [{ zoom: value }] }).catch(() => {});
      }
  };

  const toggleFlash = () => {
      if (!cameraStream) return;
      const track = cameraStream.getVideoTracks()[0];
      const newStatus = !flashOn;
      setFlashOn(newStatus);
      if (track.applyConstraints) track.applyConstraints({ advanced: [{ torch: newStatus }] }).catch(() => toast("Flash no disponible"));
  };

  return {
    isCameraOpen,
    cameraStream,
    videoRef,
    startCamera,
    stopCamera,
    toggleFacingMode,
    handleZoom,
    toggleFlash,
    zoom,
    zoomCap,
    flashOn,
    facingMode
  };
}