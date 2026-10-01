// Static film grain over the whole page: a pre-rendered PNG tile (no SVG filter, no animation,
// no blend mode). Hidden on phones, where a full-screen fixed layer costs more than it adds.
export default function Backdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 hidden opacity-[0.035] md:block"
      style={{ backgroundImage: "url(/noise.png)", backgroundSize: "96px 96px" }}
    />
  );
}
