import { cn } from "@/lib/utils";

export function WaxSeal({ className, letter = "أ" }: { className?: string, letter?: string }) {
  return (
    <div className={cn("relative flex items-center justify-center shrink-0", className)}>
      {/* Outer shadow / drop */}
      <div className="absolute inset-0 bg-[#8b1c1c] rounded-full blur-[2px] opacity-70 translate-y-1" />
      
      {/* Main wax body */}
      <div className="relative w-full h-full rounded-full bg-gradient-to-br from-[#b32424] via-[#8b1c1c] to-[#5a1010] border-[3px] border-[#D4AF37]/80 shadow-[inset_0_4px_10px_rgba(255,255,255,0.2),0_4px_10px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden">
        
        {/* Inner depressed area */}
        <div className="absolute inset-1.5 rounded-full border border-[#5a1010] bg-gradient-to-br from-[#8b1c1c] to-[#701515] shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)] flex items-center justify-center">
          
          {/* Embossed Letter */}
          <span className="font-display text-[#D4AF37] text-opacity-90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] text-3xl font-bold translate-y-[-2px]">
            {letter}
          </span>
          
        </div>
        
        {/* Wax drips (decorative) */}
        <div className="absolute -bottom-1 left-1/4 w-3 h-2 bg-[#5a1010] rounded-full blur-[1px]" />
        <div className="absolute -top-0.5 right-1/4 w-4 h-1.5 bg-[#b32424] rounded-full blur-[1px] opacity-60" />
      </div>
    </div>
  );
}
