'use client';

/** "만들어야 할 화면 (목표 이미지)" — always shows the actual target image. */
export function TargetImagePreview({
  imageUrl,
  description,
}: {
  imageUrl: string;
  description?: string;
}) {
  return (
    <div className="flex w-44 shrink-0 flex-col">
      <span className="hud-label mb-1.5">만들어야 할 화면 (목표 이미지)</span>
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg ring-1 ring-white/15">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="목표 이미지" className="h-full w-full object-cover" />
      </div>
      {description && (
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-white/55">{description}</p>
      )}
    </div>
  );
}
