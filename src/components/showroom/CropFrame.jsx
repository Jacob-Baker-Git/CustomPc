const MARK = 'absolute h-4 w-4 border-line-strong'

export default function CropFrame({ children, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      {children}
      <span data-crop-mark className={`${MARK} left-2 top-2 border-l border-t`} />
      <span data-crop-mark className={`${MARK} right-2 top-2 border-r border-t`} />
      <span data-crop-mark className={`${MARK} bottom-2 left-2 border-b border-l`} />
      <span data-crop-mark className={`${MARK} bottom-2 right-2 border-b border-r`} />
    </div>
  )
}
