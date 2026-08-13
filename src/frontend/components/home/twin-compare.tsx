"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BlockButton, BlockPanel } from "@/frontend/components/mc";
import {
  renderVoxelTwin,
  type VoxelPreset,
} from "@/frontend/lib/voxel/image-to-voxel";
import { cn } from "@/frontend/lib/utils";

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PRESETS: Array<{ value: VoxelPreset; label: string }> = [
  { value: "fine", label: "Fine" },
  { value: "balanced", label: "Balanced" },
  { value: "chunky", label: "Chunky" },
];

type GeneratorStatus = "idle" | "processing" | "ready";

/**
 * The theme's central interaction: a visitor supplies the physical image and
 * the browser builds its voxel twin locally. No upload request is made, and
 * refreshing the page clears both images.
 */
export function TwinCompare() {
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLCanvasElement>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const outputBlobRef = useRef<Blob | null>(null);
  const operationRef = useRef(0);

  const [preset, setPreset] = useState<VoxelPreset>("balanced");
  const [status, setStatus] = useState<GeneratorStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [outputReady, setOutputReady] = useState(false);

  const paintOutput = useCallback((source: HTMLCanvasElement) => {
    const destination = outputRef.current;
    if (!destination) return;
    destination.width = source.width;
    destination.height = source.height;
    const context = destination.getContext("2d");
    if (!context) throw new Error("The generated image could not be displayed.");
    context.clearRect(0, 0, destination.width, destination.height);
    context.drawImage(source, 0, 0);
  }, []);

  const generate = useCallback(
    async (
      bitmap: ImageBitmap,
      nextPreset: VoxelPreset,
      operation: number,
    ) => {
      await nextAnimationFrame();
      const result = await renderVoxelTwin({
        image: bitmap,
        preset: nextPreset,
        outputSize: 1024,
      });
      if (operation !== operationRef.current) return null;
      paintOutput(result.canvas);
      outputBlobRef.current = result.blob;
      return result;
    },
    [paintOutput],
  );

  const processFile = useCallback(
    async (file: File) => {
      const validationError = validateImage(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      const operation = operationRef.current + 1;
      operationRef.current = operation;
      setError(null);
      setStatus("processing");

      let nextBitmap: ImageBitmap | null = null;
      let nextPreviewUrl: string | null = null;
      try {
        if (typeof createImageBitmap !== "function") {
          throw new Error("This browser cannot process images locally.");
        }
        nextBitmap = await createImageBitmap(file);
        nextPreviewUrl = URL.createObjectURL(file);
        const result = await generate(nextBitmap, preset, operation);
        if (!result || operation !== operationRef.current) {
          nextBitmap.close();
          URL.revokeObjectURL(nextPreviewUrl);
          return;
        }

        bitmapRef.current?.close();
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        bitmapRef.current = nextBitmap;
        previewUrlRef.current = nextPreviewUrl;
        setPreviewUrl(nextPreviewUrl);
        setFileName(file.name);
        setOutputReady(true);
        setStatus("ready");
      } catch (cause) {
        nextBitmap?.close();
        if (nextPreviewUrl) URL.revokeObjectURL(nextPreviewUrl);
        if (operation === operationRef.current) {
          setStatus(bitmapRef.current ? "ready" : "idle");
          setError(
            cause instanceof Error
              ? cause.message
              : "The image could not be converted.",
          );
        }
      }
    },
    [generate, preset],
  );

  const changePreset = async (nextPreset: VoxelPreset) => {
    setPreset(nextPreset);
    const bitmap = bitmapRef.current;
    if (!bitmap || nextPreset === preset) return;

    const operation = operationRef.current + 1;
    operationRef.current = operation;
    setError(null);
    setStatus("processing");
    try {
      const result = await generate(bitmap, nextPreset, operation);
      if (result && operation === operationRef.current) {
        setOutputReady(true);
        setStatus("ready");
      }
    } catch (cause) {
      if (operation === operationRef.current) {
        setStatus("ready");
        setError(
          cause instanceof Error
            ? cause.message
            : "The new block preset could not be rendered.",
        );
      }
    }
  };

  const reset = () => {
    operationRef.current += 1;
    bitmapRef.current?.close();
    bitmapRef.current = null;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    outputBlobRef.current = null;
    setPreviewUrl(null);
    setFileName(null);
    setPreset("balanced");
    setStatus("idle");
    setError(null);
    setOutputReady(false);
    if (inputRef.current) inputRef.current.value = "";
    const canvas = outputRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const download = () => {
    const blob = outputBlobRef.current;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${downloadBaseName(fileName)}-voxel-twin.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  useEffect(
    () => () => {
      operationRef.current += 1;
      bitmapRef.current?.close();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  const statusMessage =
    status === "processing"
      ? "Building your voxel twin."
      : status === "ready"
        ? `Voxel twin ready from ${fileName}.`
        : "Choose an image to create a voxel twin.";

  return (
    <div className="flex flex-col gap-[calc(var(--mc-unit)*1.5)]">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        aria-label="Upload an image for voxel conversion"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void processFile(file);
        }}
      />

      <div className="flex flex-col items-stretch gap-[var(--mc-unit)] md:flex-row md:items-center md:justify-center">
        <BlockPanel
          variant="slot"
          padded="sm"
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setDragActive(false);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            const file = event.dataTransfer.files[0];
            if (file) void processFile(file);
          }}
          className={cn(
            "flex flex-1 flex-col items-center gap-[var(--mc-unit)] transition-colors md:max-w-[320px]",
            dragActive && "border-mc-emerald bg-mc-emerald/10",
          )}
        >
          <button
            type="button"
            onClick={() => {
              if (!inputRef.current) return;
              inputRef.current.value = "";
              inputRef.current.click();
            }}
            className="group relative aspect-square w-full max-w-[256px] cursor-pointer overflow-hidden border-[length:var(--mc-bevel)] border-dashed border-mc-border bg-mc-panel-dark bevel-inset focus-visible:z-10"
            aria-label={previewUrl ? "Replace physical image" : "Upload physical image"}
          >
            {previewUrl ? (
              <>
                {/* A local blob URL cannot benefit from Next's image pipeline. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={`Preview of ${fileName ?? "uploaded image"}`}
                  className="h-full w-full object-contain"
                />
                <span className="absolute inset-x-0 bottom-0 bg-black/75 px-[var(--mc-unit)] py-[calc(var(--mc-unit)*0.75)] font-pixel text-[8px] uppercase tracking-[0.12em] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  Replace image
                </span>
              </>
            ) : (
              <span className="flex h-full flex-col items-center justify-center gap-[var(--mc-unit)] p-[calc(var(--mc-unit)*2)] text-center">
                <UploadGlyph />
                <span className="font-pixel text-[9px] uppercase leading-relaxed text-mc-accent">
                  Drop an image here
                </span>
                <span className="text-[15px] leading-snug text-mc-text-dim">
                  or press to browse · PNG, JPEG, WebP · 10 MB max
                </span>
              </span>
            )}
          </button>

          <PanelCaption
            label="Physical"
            caption={fileName ?? "The object as it exists"}
          />
        </BlockPanel>

        <div
          className="flex shrink-0 flex-row items-center justify-center gap-[calc(var(--mc-unit)*0.5)] py-[var(--mc-unit)] md:flex-col md:py-0"
          aria-hidden
        >
          <span className="font-pixel text-[8px] uppercase tracking-[0.16em] text-mc-info md:text-[9px]">
            Live data
          </span>
          <span className="font-pixel text-[14px] text-mc-info md:text-[18px]">
            <span className="md:hidden">▼</span>
            <span className="hidden md:inline">▶</span>
          </span>
        </div>

        <BlockPanel
          variant="slot"
          padded="sm"
          className="flex flex-1 flex-col items-center gap-[var(--mc-unit)] md:max-w-[320px]"
        >
          <div className="relative aspect-square w-full max-w-[256px] overflow-hidden border-[length:var(--mc-bevel)] border-mc-border bg-mc-panel-dark bevel-inset">
            <canvas
              ref={outputRef}
              width={1024}
              height={1024}
              role="img"
              aria-label="Generated isometric voxel twin"
              className={cn(
                "pixelated h-full w-full transition-opacity",
                status === "idle" ? "opacity-0" : "opacity-100",
              )}
            />

            {status === "idle" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-[var(--mc-unit)] p-[calc(var(--mc-unit)*2)] text-center">
                <IsoCubeGlyph />
                <p className="font-pixel text-[8px] uppercase leading-relaxed tracking-[0.12em] text-mc-info">
                  Your digital twin forms here
                </p>
              </div>
            ) : null}

            {status === "processing" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-[var(--mc-unit)] bg-black/65 text-center">
                <span aria-hidden className="animate-pulse font-pixel text-[20px] text-mc-emerald-light">
                  ▖▘▝▗
                </span>
                <span className="font-pixel text-[8px] uppercase tracking-[0.12em] text-white">
                  Building blocks
                </span>
              </div>
            ) : null}
          </div>

          <PanelCaption
            label="Digital twin"
            caption="Generated locally on your device"
          />
        </BlockPanel>
      </div>

      <div className="mx-auto flex w-full max-w-[760px] flex-col items-center gap-[var(--mc-unit)]">
        <fieldset className="flex flex-wrap items-center justify-center gap-[calc(var(--mc-unit)*0.75)]">
          <legend className="sr-only">Voxel block size</legend>
          {PRESETS.map((option) => (
            <BlockButton
              key={option.value}
              size="sm"
              variant={preset === option.value ? "portal" : "ghost"}
              aria-pressed={preset === option.value}
              disabled={status === "processing"}
              onClick={() => void changePreset(option.value)}
            >
              {option.label}
            </BlockButton>
          ))}
        </fieldset>

        <div className="flex flex-wrap justify-center gap-[var(--mc-unit)]">
          <BlockButton
            size="sm"
            variant="emerald"
            disabled={!outputReady || status === "processing"}
            onClick={download}
          >
            Download PNG
          </BlockButton>
          <BlockButton
            size="sm"
            variant="stone"
            disabled={!previewUrl && status !== "processing"}
            onClick={reset}
          >
            Reset
          </BlockButton>
        </div>

        <p className="text-center text-[15px] leading-snug text-mc-text-dim">
          Processed privately in your browser. Nothing is uploaded or saved.
        </p>
        {error ? (
          <p
            role="alert"
            className="w-full border-[length:var(--mc-bevel)] border-mc-redstone bg-mc-redstone/10 px-[var(--mc-unit)] py-[calc(var(--mc-unit)*0.75)] text-center text-[16px] text-mc-danger"
          >
            {error}
          </p>
        ) : null}
        <p className="sr-only" aria-live="polite">
          {statusMessage}
        </p>
      </div>
    </div>
  );
}

function PanelCaption({ label, caption }: { label: string; caption: string }) {
  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-[calc(var(--mc-unit)*0.25)] pb-[calc(var(--mc-unit)*0.5)] text-center">
      <p className="font-pixel text-[9px] uppercase tracking-[0.14em] text-mc-accent md:text-[10px]">
        {label}
      </p>
      <p className="max-w-full truncate text-[16px] leading-snug text-mc-text-dim">
        {caption}
      </p>
    </div>
  );
}

function UploadGlyph() {
  return (
    <span
      aria-hidden
      className="grid h-[56px] w-[56px] place-items-center bg-mc-slot text-mc-emerald-light bevel-inset"
    >
      <svg
        viewBox="0 0 16 16"
        width="32"
        height="32"
        fill="currentColor"
        shapeRendering="crispEdges"
      >
        <path d="M7 2h2v2h2v2h-2v4H7V6H5V4h2V2Zm-4 9h10v3H3v-3Z" />
      </svg>
    </span>
  );
}

function IsoCubeGlyph() {
  return (
    <span aria-hidden className="text-mc-emerald-light">
      <svg
        viewBox="0 0 64 64"
        width="96"
        height="96"
        shapeRendering="crispEdges"
      >
        <path fill="#7ec850" d="M32 6 58 20 32 34 6 20 32 6Z" />
        <path fill="#3d6b28" d="m6 20 26 14v24L6 44V20Z" />
        <path fill="#1f4f26" d="m58 20-26 14v24l26-14V20Z" />
        <path fill="#a4e36a" d="m32 12 15 8-15 8-15-8 15-8Z" />
      </svg>
    </span>
  );
}

function validateImage(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return "Choose a PNG, JPEG, or WebP image.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return "That image is larger than 10 MB.";
  }
  return null;
}

function downloadBaseName(fileName: string | null): string {
  const base = (fileName ?? "image").replace(/\.[^.]+$/, "");
  return (
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "image"
  );
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}
