import { generatePraise } from './grokApi';
import { seedPraises } from '../data/seedPraises';

let praiseIndex = 0;

export async function getPraise(
  activityType: 'speak' | 'write' | 'type',
  quoteText: string
): Promise<string> {
  try {
    return await generatePraise(activityType, quoteText);
  } catch {
    return getOfflinePraise();
  }
}

function getOfflinePraise(): string {
  const praise = seedPraises[praiseIndex % seedPraises.length];
  praiseIndex++;
  return praise;
}
