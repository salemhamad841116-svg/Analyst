export function formatDubaiTime(
  timestamp: number | string | Date | undefined | null,
  options: {
    showSeconds?: boolean;
    includeTimezone?: boolean;
    formatDate?: boolean;
  } = {}
): string {
  if (!timestamp) return '--:--';
  const date = new Date(timestamp);
  
  if (isNaN(date.getTime())) return '--:--';

  const enOpts: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Dubai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  };
  
  if (options.showSeconds) {
    enOpts.second = '2-digit';
  }
  if (options.formatDate) {
    enOpts.year = 'numeric';
    enOpts.month = '2-digit';
    enOpts.day = '2-digit';
  }

  let enFormatted = new Intl.DateTimeFormat('en-US', enOpts).format(date);
  
  enFormatted = enFormatted.replace(/AM/i, 'ص').replace(/PM/i, 'م');

  if (options.includeTimezone) {
    enFormatted += ' (Dubai)';
  }

  return enFormatted;
}

export function getDubaiTimeInterval(
  startTimestamp: number,
  timeframeMinutes: number
): string {
  if (!startTimestamp) return '--:--';
  const dStart = new Date(startTimestamp);
  const dEnd = new Date(startTimestamp + timeframeMinutes * 60 * 1000);
  
  return `${formatDubaiTime(dStart)} – ${formatDubaiTime(dEnd)}`;
}

export function parseTimeframeToMinutes(tf: string): number {
  if (tf.endsWith('m')) return parseInt(tf);
  if (tf.endsWith('h')) return parseInt(tf) * 60;
  if (tf.endsWith('d')) return parseInt(tf) * 60 * 24;
  return 5; // default 5m
}
