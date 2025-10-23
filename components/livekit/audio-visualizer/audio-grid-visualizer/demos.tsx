import { GridOptions } from './audio-grid-visualizer';

type SVGIconProps = React.SVGProps<SVGSVGElement>;

function SVGIcon({ className, children, ...props }: SVGIconProps) {
  return (
    <>
      <svg
        className={`${className || ''}`}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        {...props}
      >
        {children}
      </svg>
    </>
  );
}

function EyeSVG(props: SVGIconProps) {
  return (
    <SVGIcon {...props} viewBox="0 0 24 24" fill="none">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M22.6288 11.0551C20.0662 6.43919 16.0964 3.99997 12.0007 4C7.90507 4.00003 3.93525 6.4393 1.3727 11.0552C1.04764 11.6407 1.04764 12.3594 1.3727 12.9449C3.93525 17.5608 7.90508 20 12.0007 20C16.0964 20 20.0662 17.5607 22.6288 12.9448C22.9538 12.3593 22.9538 11.6406 22.6288 11.0551ZM11.5528 8.89443L10.7412 10.5176C10.6928 10.6144 10.6144 10.6928 10.5176 10.7412L8.89443 11.5528C8.5259 11.737 8.5259 12.263 8.89443 12.4472L10.5176 13.2588C10.6144 13.3072 10.6928 13.3856 10.7412 13.4824L11.5528 15.1056C11.737 15.4741 12.263 15.4741 12.4472 15.1056L13.2588 13.4824C13.3072 13.3856 13.3856 13.3072 13.4824 13.2588L15.1056 12.4472C15.4741 12.263 15.4741 11.737 15.1056 11.5528L13.4824 10.7412C13.3856 10.6928 13.3072 10.6144 13.2588 10.5176L12.4472 8.89443C12.263 8.5259 11.737 8.5259 11.5528 8.89443Z"
        fill="currentColor"
      />
    </SVGIcon>
  );
}

function PlusSVG(props: SVGIconProps) {
  return (
    <SVGIcon {...props} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 7V12M12 12V17M12 12H7M12 12H17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
      />
    </SVGIcon>
  );
}

export const gridVariants: GridOptions[] = [
  // 1
  {
    radius: 6,
    interval: 75,
    className: 'gap-4',
    baseClassName: 'size-1 rounded-full',
    offClassName: 'bg-foreground/10 scale-100',
    onClassName: 'bg-foreground scale-125 shadow-[0px_0px_10px_2px_rgba(255,255,255,0.4)]',
  },
  // 2
  {
    interval: 50,
    className: 'gap-2',
    baseClassName: 'w-4 h-1',
    offClassName: 'bg-foreground/10',
    onClassName: 'bg-[#F9B11F] shadow-[0px_0px_14.8px_2px_#F9B11F]',
  },
  // 3
  {
    className: 'gap-2',
    baseClassName: 'size-2 rounded-full',
    offClassName: 'bg-foreground/10',
    onClassName: 'bg-[#1FD5F9] shadow-[0px_0px_8px_3px_rgba(31,213,249,0.44)]',
  },
  // 4
  {
    className: 'gap-4',
    baseClassName: 'size-4 rounded-full',
    offClassName: 'bg-foreground/5',
    onClassName: 'bg-[#FF6352] shadow-[0px_0px_32px_8px_rgba(255,99,82,0.8)]',
  },
  // 5
  {
    className: 'gap-4',
    baseClassName: 'size-2 rounded-full',
    offClassName: 'bg-foreground/10',
    onClassName: 'bg-[#1F8CF9] shadow-[0px_0px_14.8px_2px_#1F8CF9]',
    transformer: (index: number, rowCount: number, columnCount: number) => {
      const rowMidPoint = Math.floor(rowCount / 2);
      const distanceFromCenter = Math.sqrt(
        Math.pow(rowMidPoint - (index % columnCount), 2) +
          Math.pow(rowMidPoint - Math.floor(index / columnCount), 2)
      );

      return {
        opacity: 1 - distanceFromCenter / columnCount,
        transform: `scale(${1 - (distanceFromCenter / (columnCount * 2)) * 1.75})`,
      };
    },
  },
  // 6
  {
    radius: 4,
    interval: 150,
    className: 'gap-2',
    baseClassName: 'size-2',
    offClassName: 'bg-foreground/8',
    onClassName: 'bg-[#F91F8C] shadow-[0px_0px_14.8px_4px_#F91F8C] scale-150',
    transformer: (index: number, rowCount: number, columnCount: number) => {
      const rowMidPoint = Math.floor(rowCount / 2);
      const distanceFromCenter = Math.sqrt(
        Math.pow(rowMidPoint - (index % columnCount), 2) +
          Math.pow(rowMidPoint - Math.floor(index / columnCount), 2)
      );

      return {
        opacity: 0.5 - distanceFromCenter / columnCount,
      };
    },
  },
  // 7
  {
    interval: 50,
    className: 'gap-4',
    baseClassName: 'size-2.5 rounded-1.5',
    offClassName: 'bg-foreground/15',
    onClassName: 'bg-[#FFB6C1] shadow-[0px_0px_24px_3px_rgba(255,182,193,0.8)]',
  },
  // 8
  {
    interval: 50,
    className: 'gap-8',
    baseClassName: 'size-2.5',
    offClassName: 'bg-foreground/5',
    onClassName: 'bg-[#FFB6C1] shadow-[0px_0px_8px_1px_rgba(255,182,193,0.8)]',
    transformer: (index: number, rowCount: number, columnCount: number) => {
      const rowMidPoint = Math.floor(rowCount / 2);
      const distanceFromCenter = Math.sqrt(
        Math.pow(rowMidPoint - (index % columnCount), 2) +
          Math.pow(rowMidPoint - Math.floor(index / columnCount), 2)
      );
      const maxDistance = Math.sqrt(4); // maximum distance in a normalized grid
      const scaleFactor = 1 + (maxDistance - distanceFromCenter / maxDistance);

      return {
        transform: `scale(${scaleFactor})`,
      };
    },
  },
  // 9
  {
    radius: 4,
    interval: 75,
    className: 'gap-2.5',
    baseClassName: 'w-1.5 h-px rotate-45',
    offClassName: 'bg-foreground/10 rotate-45 scale-100',
    onClassName:
      'bg-foreground drop-shadow-[0px_0px_8px_2px_rgba(255,182,193,0.4)] rotate-[405deg] scale-200',
  },
  // 10
  {
    radius: 4,
    interval: 75,
    GridComponent: PlusSVG,
    className: 'gap-2',
    baseClassName: 'size-2 rotate-45',
    offClassName: 'text-foreground/10 rotate-45',
    onClassName: 'text-[#F97A1F] drop-shadow-[0px_0px_3.2px_#F97A1F] rotate-[405deg] scale-250',
  },
  // 11
  {
    radius: 3,
    interval: 75,
    GridComponent: EyeSVG,
    className: 'gap-2',
    baseClassName: 'size-2',
    offClassName: 'text-foreground/10',
    onClassName: 'text-[#B11FF9] drop-shadow-[0px_0px_16px_2px_rgba(177,31,249,0.6)] scale-150',
    transformer: (index: number, rowCount: number, columnCount: number) => {
      const rowMidPoint = Math.floor(rowCount / 2);
      const distanceFromCenter = Math.sqrt(
        Math.pow(rowMidPoint - (index % columnCount), 2) +
          Math.pow(rowMidPoint - Math.floor(index / columnCount), 2)
      );

      return {
        opacity: 0.5 - distanceFromCenter / columnCount,
      };
    },
  },
  // 12
  {
    radius: 6,
    interval: 75,
    className: 'gap-2.5',
    baseClassName: 'w-3 h-px rotate-45',
    offClassName: 'bg-foreground/10 rotate-45 scale-100',
    onClassName:
      'bg-[#FFB6C1] shadow-[0px_0px_8px_2px_rgba(255,182,193,0.4)] rotate-[405deg] scale-200',
  },
];
