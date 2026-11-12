"use client";

import Image, { type ImageProps } from "next/image";
import { useCallback, useState } from "react";
import { mediaVersion } from "@/lib/mediaVersion";

type Props = Omit<ImageProps, "src" | "loader" | "placeholder" | "blurDataURL"> & { src: string };

const OPTIMIZED = /\.(jpe?g|png|webp|gif|avif)$/i;
const OUT_FOLDER = process.env.nextImageExportOptimizer_exportFolderName || "nextImageExportOptimizer";

/** Same URL next-image-export-optimizer writes: <dir>/nextImageExportOptimizer/<name>-opt-<w>.WEBP */
const optimizedUrl = (src: string, width: number, v?: string) => {
  const i = src.lastIndexOf("/");
  const name = src.slice(i + 1).replace(/\.[^.]+$/, "");
  const ext = /\.(webp|avif)$/i.test(src) ? src.split(".").pop()!.toUpperCase() : "WEBP";
  return `${src.slice(0, i + 1)}${OUT_FOLDER}/${name}-opt-${width}.${ext}${v ? `?v=${v}` : ""}`;
};

/**
 * ExportedImage (next-image-export-optimizer) with cache busting: every optimized size, the blur
 * placeholder and the fallback original carry `?v=<content hash>`, so replacing a project image
 * under the same file name reaches returning visitors despite the 30-day cache on /images.
 */
export default function MediaImage({ src, alt, style, onLoad, onError, unoptimized, ...rest }: Props) {
  const v = mediaVersion(src);
  const optimize = !unoptimized && OPTIMIZED.test(src);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loader = useCallback(
    ({ width }: { width: number }) => (optimize && !failed ? optimizedUrl(src, width, v) : `${src}${v ? `?v=${v}` : ""}`),
    [src, v, optimize, failed]
  );

  const blur =
    optimize && !failed && !loaded
      ? {
          backgroundImage: `url("${optimizedUrl(src, 10, v)}")`,
          backgroundSize: style?.objectFit || "cover",
          backgroundPosition: style?.objectPosition || "50% 50%",
          backgroundRepeat: "no-repeat",
        }
      : undefined;

  return (
    <Image
      {...rest}
      alt={alt}
      {...(optimize ? { src, loader } : { src: v ? `${src}?v=${v}` : src, unoptimized: true })}
      style={{ ...style, ...blur }}
      onLoad={(e) => {
        if ((e.target as HTMLImageElement).naturalWidth === 0) setFailed(true);
        setLoaded(true);
        onLoad?.(e);
      }}
      onError={(e) => {
        setFailed(true);
        setLoaded(true);
        onError?.(e);
      }}
    />
  );
}
