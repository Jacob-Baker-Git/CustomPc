import PartArt, { HAS_ART } from './PartArt'
import CategoryIcon from '../../lib/categoryIcons'
import { Package } from 'lucide-react'

// The image slot beside a product.
//
// A framed tile rather than a bare SVG, because the frame is what makes a list
// scan: every row gets a box of exactly the same size in exactly the same
// place, so the eye runs down one column of pictures instead of down ragged
// artwork of different widths. It also means a category with no drawing yet
// degrades to its icon inside the same box rather than collapsing the row.
//
// ⚠️ The tile sets its own width AND height and marks itself shrink-0. Both are
// load-bearing in a flex row: without the width a long part name squeezes the
// picture to nothing, and without shrink-0 it is the picture that gives way
// rather than the text, which is backwards — the text can wrap and the drawing
// cannot.
//
// LANDSCAPE, not square. The drawings are authored in a 64x40 box, and a
// square tile letterboxed every one of them: at 48px square the artwork got
// 40x25 of a 48x48 tile and read as a smudge. These are 8:5 to match, so the
// drawing fills the frame. It suits the subject too — a graphics card, a stick
// of memory and a motherboard are all wider than they are tall, and a square
// crop is the shopping convention for shoes, not for hardware.
const SIZE = {
  sm: { box: 'w-14 h-9', pad: 'p-1', icon: 14 },
  md: { box: 'w-16 h-10', pad: 'p-1', icon: 18 },
  lg: { box: 'w-20 h-12', pad: 'p-1.5', icon: 24 },
  xl: { box: 'w-32 h-20', pad: 'p-2', icon: 36 },
}

export default function PartThumb({ category, seed, size = 'md', className = '', title }) {
  const s = SIZE[size] ?? SIZE.md
  const art = HAS_ART(category)

  return (
    <div
      data-part-thumb={category}
      className={`${s.box} ${s.pad} shrink-0 grid place-items-center rounded-lg border border-line bg-ground overflow-hidden ${className}`}
    >
      {/* Three steps down, and the last one is the one that matters:
          CategoryIcon returns NULL for an id it does not know, so a category
          with neither a drawing nor an icon rendered an empty box. In a list
          where every other row has a picture that reads as an image which
          failed to load, not as a category nobody has drawn yet. */}
      {art ? (
        <PartArt category={category} seed={seed} title={title} className="w-full h-full" />
      ) : (
        <CategoryIcon id={category} size={s.icon} className="text-muted" fallback={Package} />
      )}
    </div>
  )
}
