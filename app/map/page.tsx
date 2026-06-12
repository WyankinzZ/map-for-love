import Image from "next/image";
import ChinaMap, { SouthChinaSeaInset } from "@/components/ChinaMap";
import BackToLoginButton from "@/components/BackToLoginButton";
import { LegendProgress, ProgressBadge, StatsPanel } from "@/components/HomeProgress";
import RandomPhotoCard from "@/components/RandomPhotoCard";

function BrandMark() {
  return (
    <svg className="h-11 w-11 pixelated" viewBox="0 0 22 22" aria-hidden="true">
      <path
        d="M5 3h4v2h2V3h4v2h2v6h-2v2h-2v2h-2v2H9v-2H7v-2H5v-2H3V5h2z"
        fill="#F5DCE0"
      />
      <path
        d="M5 3h4v2H5v6H3V5h2zm10 0v2h2v6h-2V5h-4V3zm0 8v2h-2v2h-2v2H9v-2H7v-2H5v-2h2v2h2v2h2v-2h2v-2z"
        fill="#E8B8C2"
      />
      <path d="M7 5h2v2H7zm8 2h-2V5h2z" fill="#FAFBF7" />
    </svg>
  );
}

function Cloud({
  src,
  className,
}: Readonly<{
  src: string;
  className: string;
}>) {
  return (
    <Image
      className={`pointer-events-none absolute pixelated opacity-24 ${className}`}
      src={src}
      alt=""
      width={132}
      height={54}
      priority
      unoptimized
    />
  );
}

function PixelSparkle({ className }: Readonly<{ className: string }>) {
  return (
    <span
      className={`pointer-events-none absolute h-4 w-4 opacity-75 ${className}`}
      aria-hidden="true"
    >
      <span className="absolute left-1.5 top-0 h-1.5 w-1.5 bg-[#D4E8D0]" />
      <span className="absolute left-1.5 bottom-0 h-1.5 w-1.5 bg-[#D4E8D0]" />
      <span className="absolute left-0 top-1.5 h-1.5 w-1.5 bg-[#D4E8D0]" />
      <span className="absolute right-0 top-1.5 h-1.5 w-1.5 bg-[#D4E8D0]" />
    </span>
  );
}

function Legend() {
  return (
    <div className="space-y-5">
      <div className="w-fit rounded-[8px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/70 px-5 py-4 text-sm text-[#5A6670]/78 shadow-[0_10px_28px_rgba(90,102,112,0.08)] backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 rounded-[2px] border border-[#E8B8C2] bg-[#F5DCE0] shadow-[0_0_10px_rgba(232,184,194,0.42)]" />
          <span>已点亮</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="h-4 w-4 rounded-[2px] border border-[#C8CEC8] bg-[#D8DDD8]/55" />
          <span>未点亮</span>
        </div>
      </div>
      <LegendProgress />
    </div>
  );
}

export default function MapPage() {
  return (
    <main className="relative h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#FAFBF7] text-[#5A6670]">
      <div className="map-mist-band" aria-hidden="true" />
      <Cloud src="/sprites/decorations/cloud-medium.png" className="left-[18%] top-[12%] w-28" />
      <Cloud src="/sprites/decorations/cloud-large.png" className="left-[43%] top-[11%] w-36" />
      <Cloud src="/sprites/decorations/cloud-small.png" className="left-[7%] top-[61%] w-24" />
      <Cloud src="/sprites/decorations/cloud-small.png" className="right-[25%] top-[55%] w-24" />
      <Cloud src="/sprites/decorations/cloud-medium.png" className="bottom-[8%] right-[28%] w-24" />
      <PixelSparkle className="left-[7%] top-[22%]" />
      <PixelSparkle className="left-[19%] bottom-[16%]" />
      <PixelSparkle className="right-[24%] top-[42%]" />
      <span className="absolute left-[28%] bottom-[7%] h-2 w-2 bg-[#D4E8D0]" aria-hidden="true" />
      <span className="absolute right-[11%] top-[19%] h-2 w-2 bg-[#D6E8F0]" aria-hidden="true" />

      <div className="relative z-10 flex h-full">
        <section className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden px-6 py-7 sm:px-9">
          <header className="flex items-start justify-between gap-5">
            <div className="flex items-start gap-4">
              <BrandMark />
              <div>
                <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-[#5A6670]">
                  Map For Everyone
                </h1>
                <p className="mt-1 text-base font-medium text-[#5A6670]/62">所有人的地图</p>
              </div>
              <ProgressBadge />
            </div>
            <BackToLoginButton />
          </header>

          <div className="flex min-h-0 flex-1 items-center justify-center pb-28 pt-0 sm:pb-20 lg:pb-6">
            <ChinaMap className="w-[min(100%,1100px)] max-w-[1100px]" width={1100} height={860} />
          </div>

          <RandomPhotoCard />

          <div className="absolute bottom-7 left-6 flex flex-col gap-4 sm:left-9">
            <SouthChinaSeaInset />
            <Legend />
          </div>
        </section>
        <StatsPanel>{null}</StatsPanel>
      </div>
    </main>
  );
}
