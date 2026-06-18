'use client';

import { useRef, useState } from 'react';

interface TeamProfileSetupProps {
  initialName: string;
  initialImage: string | null;
  onChange: (name: string, imageUrl: string | null) => void;
}

/** Circular avatar upload + team name field shown above the start button. */
export function TeamProfileSetup({ initialName, initialImage, onChange }: TeamProfileSetupProps) {
  const [name, setName] = useState(initialName);
  const [image, setImage] = useState<string | null>(initialImage);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setImage(url);
      onChange(name, url);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="group relative h-20 w-20 overflow-hidden rounded-full border-2 border-white/25 bg-black/40 backdrop-blur-md transition-colors hover:border-action"
        aria-label="팀 이미지 업로드"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="팀 이미지" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-3xl text-white/40">
            👤
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-[10px] text-white/80 opacity-0 transition-opacity group-hover:opacity-100">
          업로드
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div className="relative w-64">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            onChange(e.target.value, image);
          }}
          placeholder="팀명을 입력하세요"
          maxLength={20}
          className="w-full rounded-xl border border-white/15 bg-black/45 px-4 py-2.5 text-center text-sm font-medium text-white placeholder:text-white/35 backdrop-blur-md focus:border-action/70 focus:outline-none"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/30">
          ✎
        </span>
      </div>
    </div>
  );
}
