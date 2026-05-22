import { getMdaById, getMdaShortName } from '@/lib/mdas';
import { cn } from '@/lib/utils';

type MdaLogoProps = {
  mdaId?: string | null;
  className?: string;
  imageClassName?: string;
};

export function MdaLogo({ mdaId, className, imageClassName }: MdaLogoProps) {
  const mda = getMdaById(mdaId);
  const shortName = getMdaShortName(mdaId);

  return (
    <span
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#2e2e2e] bg-[#f8fafc] text-[10px] font-semibold text-[#141414] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.65)]',
        className,
      )}
      title={mda?.name || shortName}
    >
      {mda?.logoUrl ? (
        <img
          src={mda.logoUrl}
          alt={`${mda.name} logo`}
          className={cn('h-full w-full object-contain p-1', imageClassName)}
          loading="lazy"
        />
      ) : (
        shortName
      )}
    </span>
  );
}
