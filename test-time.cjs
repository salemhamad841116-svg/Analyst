const { format } = require('util');
const date = new Date('2024-01-01T15:45:00Z'); // 15:45 UTC is 19:45 Dubai
let enFormatted = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', hour12: true }).format(date);
console.log(enFormatted.replace(/AM/i, 'ص').replace(/PM/i, 'م'));

// Let's check 23:59 Dubai time
const d2 = new Date('2024-01-01T19:59:00Z'); // 23:59 Dubai
console.log(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', hour12: true }).format(d2).replace(/AM/i, 'ص').replace(/PM/i, 'م'));
