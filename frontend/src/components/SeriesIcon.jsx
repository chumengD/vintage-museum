export default function SeriesIcon({ series, large = false }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center border border-ink bg-[#ddd2b9] font-serif italic ${large ? "h-20 w-20 text-4xl" : "h-16 w-16 text-3xl"}`}
    >
      {series?.iconImage ? (
        <img src={series.iconImage} alt="" className="h-full w-full object-cover" />
      ) : (
        series?.icon || "藏"
      )}
    </span>
  );
}
