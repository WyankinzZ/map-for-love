import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProvinceProgressBadge } from "@/components/HomeProgress";
import ProvinceMap from "@/components/ProvinceMap";
import { getCitiesByProvince } from "@/data/cities";
import { getProvinceCityTotal } from "@/data/provinceCityPlaces";
import { getProvince, provinces } from "@/data/provinces";

interface ProvincePageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return provinces.map((province) => ({ id: province.id }));
}

export default async function ProvincePage({ params }: ProvincePageProps) {
  const { id } = await params;
  const province = getProvince(id);

  if (!province) notFound();

  const provinceCities = getCitiesByProvince(province.id);
  const provinceCityTotal = getProvinceCityTotal(province.id);
  const cityTotal = provinceCityTotal || provinceCities.length;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#FAFBF7] text-[#5A6670]">
      <div className="map-mist-band" aria-hidden="true" />
      <span className="absolute left-[12%] top-[19%] h-2 w-2 bg-[#D4E8D0]" aria-hidden="true" />
      <span className="absolute right-[12%] top-[32%] h-2 w-2 bg-[#D6E8F0]" aria-hidden="true" />

      <div className="relative z-10 flex min-h-screen flex-col px-3.5 py-4 sm:px-9 sm:py-7">
        <header className="relative z-40 flex items-start justify-between gap-3 sm:gap-5">
          <div className="flex items-center gap-3 sm:gap-5">
            <Link
              className="grid h-9 w-9 sm:h-12 sm:w-12 place-items-center rounded-[8px] border border-[#5A6670]/35 bg-[#FAFBF7]/76 text-[#5A6670] shadow-[0_8px_24px_rgba(90,102,112,0.08)] backdrop-blur transition hover:border-[#A8C8DC] hover:text-[#A8C8DC]"
              href="/map"
              aria-label="返回全国地图"
            >
              <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </Link>
            <div className="flex items-baseline gap-2 sm:gap-3">
              <h1 className="text-xl sm:text-[28px] font-semibold tracking-[-0.01em] text-[#5A6670]">
                {province.name}
              </h1>
              <p className="text-xs sm:text-lg font-medium text-[#5A6670]/72">{province.nameEn}</p>
            </div>
            <ProvinceProgressBadge provinceId={province.id} total={cityTotal} />
          </div>

          <div aria-hidden="true" />
        </header>

        <section className="relative z-10 flex min-h-0 flex-1 items-center justify-center pb-20 pt-2 sm:pb-16 sm:pt-6">
          <ProvinceMap province={province} />
        </section>

        <div className="absolute bottom-4 left-3 z-40 rounded-[8px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/76 px-3 py-2 text-xs sm:text-sm text-[#5A6670]/78 shadow-[0_10px_28px_rgba(90,102,112,0.08)] backdrop-blur sm:bottom-8 sm:left-9 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-full bg-[#E8B8C2] shadow-[0_0_10px_rgba(232,184,194,0.55)]" />
            <span>已探索</span>
          </div>
          <div className="mt-2 sm:mt-3 flex items-center gap-2 sm:gap-3">
            <span className="h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-full bg-[#B9BEC3]" />
            <span>未探索</span>
          </div>
        </div>
      </div>
    </main>
  );
}
