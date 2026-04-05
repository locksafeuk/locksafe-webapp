"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Check, RotateCcw } from "lucide-react";

interface SignaturePadProps {
  onSave: (signatureData: string) => void;
  signerName: string;
}

export function SignaturePad({ onSave, signerName }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    // Set drawing style
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Fill white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const signatureData = canvas.toDataURL("image/png");
    onSave(signatureData);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Digital Signature</h3>
          <p className="text-sm text-slate-500">Sign below to confirm</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearSignature}
          disabled={!hasDrawn}
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          Clear
        </Button>
      </div>

      <div className="border-2 border-slate-300 rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full h-48 cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        <div className="border-t border-slate-200 px-4 py-2 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eraser className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-500">
              {hasDrawn ? "Signature captured" : "Sign above with finger or mouse"}
            </span>
          </div>
        </div>
      </div>

      <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
        <p className="font-medium mb-1">By signing, {signerName} confirms:</p>
        <ul className="space-y-1 text-slate-500">
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            The work has been completed as described
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            The price charged is as quoted
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            Satisfaction with the service provided
          </li>
        </ul>
      </div>

      <Button
        onClick={saveSignature}
        disabled={!hasDrawn}
        className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg"
      >
        <Check className="w-5 h-5 mr-2" />
        Confirm & Sign
      </Button>
    </div>
  );
}
