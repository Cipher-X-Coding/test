import type { Transition, Variants } from 'framer-motion';

/**
 * Unified Noir Mastering Console motion tokens.
 * Smooth, clean, responsive physics across every page, modal, filter, and control.
 */
export const STUDIO_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const SPRING_SNAPPY: Transition = {
  type: 'spring',
  stiffness: 480,
  damping: 34,
  mass: 0.78,
};

export const SPRING_SOFT: Transition = {
  type: 'spring',
  stiffness: 340,
  damping: 29,
  mass: 0.88,
};

export const SPRING_GENTLE: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 26,
};

export const pageTransition = {
  initial: { opacity: 0, y: 12, filter: 'blur(3px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.28, ease: STUDIO_EASE },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: 'blur(2px)',
    transition: { duration: 0.18, ease: STUDIO_EASE },
  },
};

export const tabPanelMotion = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: STUDIO_EASE },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.15, ease: STUDIO_EASE },
  },
};

export const modalBackdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2, ease: 'easeOut' as const } },
  exit: { opacity: 0, transition: { duration: 0.16, ease: 'easeIn' as const } },
};

export const modalPanelMotion = {
  initial: { opacity: 0, scale: 0.94, y: 18 },
  animate: { opacity: 1, scale: 1, y: 0, transition: SPRING_SNAPPY },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 10,
    transition: { duration: 0.16, ease: STUDIO_EASE },
  },
};

export const cardGridItem: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  visible: (idx: number = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      delay: Math.min(idx * 0.035, 0.22),
      ease: STUDIO_EASE,
    },
  }),
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.16, ease: STUDIO_EASE },
  },
};

export const iconSwapMotion = {
  initial: { opacity: 0, scale: 0.55, rotate: -18 },
  animate: { opacity: 1, scale: 1, rotate: 0, transition: SPRING_SNAPPY },
  exit: { opacity: 0, scale: 0.55, rotate: 18, transition: { duration: 0.12 } },
};

export const collapseMotion = {
  initial: { opacity: 0, height: 0 },
  animate: {
    opacity: 1,
    height: 'auto',
    transition: { duration: 0.26, ease: STUDIO_EASE },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: { duration: 0.18, ease: STUDIO_EASE },
  },
};
