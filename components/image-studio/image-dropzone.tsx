"use client";

import { ImageIcon, UploadIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ACCEPTED_IMAGE_EXTENSIONS, ACCEPTED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES } from "@/lib/generation/product-photoshoot";
import { cn } from "@/lib/utils";

function formatFileSize(bytes: number) {
  const megabytes = bytes / (1024 * 1024);

  return `${megabytes.toFixed(megabytes < 1 ? 2 : 1)} MB`;
}

export function validateImageFile(file: File) {
  // Some browsers report an empty type for .heic, so fall back to the suffix.
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isAcceptedType =
    (ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type) ||
    (ACCEPTED_IMAGE_EXTENSIONS as readonly string[]).includes(extension);

  if (!isAcceptedType) {
    return "Unsupported file type. Use JPG, PNG, GIF, WEBP or HEIC.";
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return `Image is too large. The limit is ${formatFileSize(MAX_IMAGE_SIZE_BYTES)}.`;
  }

  return null;
}

interface ImageDropzoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

export function ImageDropzone({
  file, onFileChange, onError, disabled
}: ImageDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);

      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const selectFile = (candidate: File | undefined) => {
    if (!candidate) {
      return;
    }

    const validationError = validateImageFile(candidate);

    if (validationError) {
      onError(validationError);

      return;
    }

    onFileChange(candidate);
  };

  const clearFile = () => {
    onFileChange(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  if (file && previewUrl) {
    return (
      <div className="relative overflow-hidden rounded-lg border">
        <div className="relative aspect-video bg-muted">
          <Image
            src={previewUrl}
            alt="Selected product"
            fill
            unoptimized
            className="object-contain"
          />
        </div>
        <div className="flex items-center justify-between gap-3 border-t px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={clearFile}
            disabled={disabled}
            aria-label="Remove image"
          >
            <XIcon />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);

        if (!disabled) {
          selectFile(event.dataTransfer.files[0]);
        }
      }}
      className={cn(
        "rounded-lg border border-dashed transition-colors",
        isDragging ? "border-primary bg-accent/50" : "border-input",
        disabled && "opacity-50",
      )}
    >
      <label
        htmlFor={inputId}
        className={cn(
          "flex flex-col items-center gap-2 px-6 py-10 text-center",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-muted">
          {isDragging ? <UploadIcon className="size-5" /> : <ImageIcon className="size-5" />}
        </span>
        <span className="text-sm font-medium">Drop a product image, or click to browse</span>
        <span className="text-xs text-muted-foreground">
          JPG, PNG, GIF, WEBP or HEIC · up to {formatFileSize(MAX_IMAGE_SIZE_BYTES)}
        </span>
      </label>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_MIME_TYPES.join(",")}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => selectFile(event.target.files?.[0])}
      />
    </div>
  );
}
