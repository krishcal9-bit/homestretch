'use client';
import { motion, type HTMLMotionProps } from 'motion/react';
import { forwardRef } from 'react';
import { spring } from '@/lib/motion';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'quiet';
type Props = Omit<HTMLMotionProps<'button'>, 'children'> & {
  variant?: Variant;
  loading?: boolean;
  full?: boolean;
  size?: 'md' | 'lg';
  children?: React.ReactNode;
};

const styles: Record<Variant, string> = {
  primary: 'bg-pine text-white hover:bg-pine-hover',
  secondary: 'bg-surface text-ink border border-line hover:bg-paper',
  quiet: 'bg-transparent text-pine hover:bg-pine-soft',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', loading, full, size = 'md', className = '', children, disabled, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      transition={spring.snappy}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`relative inline-flex select-none items-center justify-center gap-2 rounded-[8px] font-medium transition-colors duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50 ${
        size === 'lg' ? 'min-h-[52px] px-6 text-[16px]' : 'min-h-[44px] px-4 text-[15px]'
      } ${full ? 'w-full' : ''} ${styles[variant]} ${className}`}
      {...rest}
    >
      <span className={loading ? 'invisible inline-flex items-center gap-2' : 'inline-flex items-center gap-2'}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      )}
    </motion.button>
  );
});
