import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './store';

/**
 * Typed Redux Hooks
 * 
 * Use these throughout the app instead of plain `useDispatch` and `useSelector`
 * for proper TypeScript inference.
 */

// Use throughout your app instead of plain `useDispatch`
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();

// Use throughout your app instead of plain `useSelector`
export const useAppSelector = useSelector.withTypes<RootState>();
