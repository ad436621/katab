import { cn } from "@/lib/utils";

export function ArabesqueDivider({ className }: { className?: string }) {
  return (
    <div className={cn("w-full flex items-center justify-center py-6 opacity-80", className)}>
      <div className="h-px bg-gradient-to-l from-transparent via-[#C9A84C] to-transparent flex-1" />
      <div className="px-4 text-[#C9A84C]">
        <svg width="40" height="20" viewBox="0 0 40 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 0C20 0 25 10 35 10C25 10 20 20 20 20C20 20 15 10 5 10C15 10 20 0 20 0Z" fill="currentColor"/>
          <circle cx="20" cy="10" r="3" fill="#FAF7F0"/>
        </svg>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A84C] to-transparent flex-1" />
    </div>
  );
}
