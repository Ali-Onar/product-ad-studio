"use client";

import { AlertCircleIcon, DownloadIcon, Loader2Icon } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { isActiveGeneration, type GenerationOutput, type GenerationView } from "@/lib/generation/types";

function formatCreatedAt(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

interface OutputMediaProps {
  output: GenerationOutput;
  alt: string;
  /** Thumbnails fill their container; the dialog sizes to the viewport. */
  variant: "thumbnail" | "full";
}

function OutputMedia({ output, alt, variant }: OutputMediaProps) {
  const isThumbnail = variant === "thumbnail";

  if (output.isVideo) {
    return (
      <video
        src={output.url}
        controls={!isThumbnail}
        muted={isThumbnail}
        playsInline
        preload="metadata"
        className={isThumbnail ? "size-full object-contain" : "max-h-[70vh] w-full object-contain"}
      />
    );
  }

  // `fill` inside a container of known size, both here and in the dialog: the
  // output dimensions are unknown server-side, so intrinsic width/height would
  // have to be guessed and the box would not match the image.
  return (
    <div className={isThumbnail ? "absolute inset-0" : "relative h-[70vh] w-full"}>
      <Image
        src={output.url}
        alt={alt}
        fill
        unoptimized
        sizes={isThumbnail ? "(min-width: 1024px) 20rem, (min-width: 640px) 45vw, 90vw" : "90vw"}
        className="object-contain"
      />
    </div>
  );
}

interface GenerationCardProps {
  generation: GenerationView;
}

export function GenerationCard({ generation }: GenerationCardProps) {
  const isActive = isActiveGeneration(generation.status);
  const parameterEntries = Object.entries(generation.parameters);
  const preview = generation.outputs[0];
  const createdAt = formatCreatedAt(generation.createdAt);

  return (
    <Card className="overflow-hidden py-0">
      <div className="relative aspect-square bg-muted">
        {isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" />
            <span className="text-xs">Generating...</span>
          </div>
        )}

        {!isActive && preview && (
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label="Open full size preview"
                className="absolute inset-0 cursor-zoom-in rounded-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <OutputMedia output={preview} alt="Generated product photo" variant="thumbnail" />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-4xl">
              <DialogTitle className="sr-only">Generated product photo — {createdAt}</DialogTitle>
              <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto">
                {generation.outputs.map((output, index) => (
                  <OutputMedia
                    key={output.url}
                    output={output}
                    alt={`Generated product photo ${index + 1}`}
                    variant="full"
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">{createdAt}</span>
                <div className="flex flex-wrap gap-2">
                  {generation.outputs.map((output, index) => (
                    <Button key={output.url} asChild variant="outline" size="sm">
                      <a href={output.url} download target="_blank" rel="noreferrer">
                        <DownloadIcon />
                        {generation.outputs.length > 1 ? `Download ${index + 1}` : "Download"}
                      </a>
                    </Button>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {!isActive && !preview && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
            <AlertCircleIcon className="size-5" />
            <span className="text-xs">{generation.errorMessage ?? "No output was produced."}</span>
          </div>
        )}
      </div>

      <CardContent className="flex flex-col gap-3 px-4 pb-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{createdAt}</span>
          <Badge variant={generation.status === "completed" ? "default" : "secondary"}>
            {generation.status}
          </Badge>
        </div>

        {parameterEntries.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {parameterEntries.map(([key, value]) => (
              <Badge key={key} variant="outline" className="font-normal">
                {value}
              </Badge>
            ))}
          </div>
        )}

        {generation.outputs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {generation.outputs.map((output, index) => (
              <Button key={output.url} asChild variant="outline" size="sm">
                <a href={output.url} download target="_blank" rel="noreferrer">
                  <DownloadIcon />
                  {generation.outputs.length > 1 ? `Download ${index + 1}` : "Download"}
                </a>
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
