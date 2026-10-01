import ExportedImage from "next-image-export-optimizer";
import type { CardMedia } from "@/lib/media";
import ProjectCover from "./ProjectCover";
import AgentGraphCover from "./AgentGraphCover";
import HoverVideo from "./HoverVideo";
import { cn } from "@/lib/utils";

type Props = {
  media: CardMedia;
  title: string;
  kind: string;
  index?: number;
  /** Designed cover used when there is no still (see Project.cover). */
  cover?: "agent-graph";
  /** Project slug, for covers built from its case study. */
  slug?: string;
  sizes: string;
  priority?: boolean;
  /** Hover-play preview (cards). The case-study page plays its video differently. */
  hoverVideo?: boolean;
  className?: string;
};

/**
 * The 16:10 media frame used by every card: still (cover, top-center; or contain on the surface
 * colour when the image isn't 16:10) with the hover video laid exactly over it.
 */
export default function CardMediaView({ media, title, kind, index, cover, slug, sizes, priority, hoverVideo = true, className }: Props) {
  return (
    <div className={cn("relative aspect-[16/10] overflow-hidden bg-surface", className)}>
      {media.still ? (
        <ExportedImage
          src={media.still}
          alt={media.alt}
          fill
          sizes={sizes}
          priority={priority}
          className={media.fit === "contain" ? "object-contain object-center" : "object-cover object-[50%_0%]"}
        />
      ) : cover === "agent-graph" && slug ? (
        <AgentGraphCover slug={slug} title={title} />
      ) : (
        <ProjectCover title={title} kind={kind} index={index} />
      )}
      {hoverVideo && media.video && <HoverVideo {...media.video} />}
    </div>
  );
}
