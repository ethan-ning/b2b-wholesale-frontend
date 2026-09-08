import { dealerHandlers } from './dealerHandlers';
import { adminHandlers } from './adminHandlers';

export const handlers = [...dealerHandlers, ...adminHandlers];
