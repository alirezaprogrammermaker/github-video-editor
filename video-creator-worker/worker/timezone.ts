export function nowTehran(): string {
    return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tehran' }).replace(' ', 'T');
}

export function nowTehranDate(): string {
    return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tehran' }).split(' ')[0];
}

export function tehranTime() {
    const now = new Date();
    const tehranStr = now.toLocaleString('en-US', { timeZone: 'Asia/Tehran', hour12: false });
    const parts = tehranStr.split(', ');
    const timePart = parts[1] || parts[0];
    const [hourStr, minuteStr] = timePart.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    // Get day of week in Tehran
    const dayStr = now.toLocaleDateString('en-US', { timeZone: 'Asia/Tehran', weekday: 'short' });
    const dayMap: Record<string, string> = {
        'Sun': '1', 'Mon': '2', 'Tue': '3', 'Wed': '4',
        'Thu': '5', 'Fri': '6', 'Sat': '7',
    };
    const dayOfWeek = dayMap[dayStr] || '1';

    return { hour, minute, dayOfWeek };
}
