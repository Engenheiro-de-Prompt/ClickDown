
export const parseTimeTextToSeconds = (timeText: string): number => {
    if (!timeText || typeof timeText !== 'string') {
        return 0;
    }

    let totalSeconds = 0;
    const hourMatches = timeText.match(/(\d+)\s*h/);
    const minuteMatches = timeText.match(/(\d+)\s*m/);
    const secondMatches = timeText.match(/(\d+)\s*s/);

    if (hourMatches) {
        totalSeconds += parseInt(hourMatches[1], 10) * 3600;
    }
    if (minuteMatches) {
        totalSeconds += parseInt(minuteMatches[1], 10) * 60;
    }
    if (secondMatches) {
        totalSeconds += parseInt(secondMatches[1], 10);
    }
    
    // Fallback for raw numbers (treat as seconds)
    if (!hourMatches && !minuteMatches && !secondMatches && !isNaN(Number(timeText))) {
        return Number(timeText);
    }

    return totalSeconds;
};

export const formatSecondsToTimeText = (totalSeconds: number): string => {
    if (isNaN(totalSeconds) || totalSeconds < 0) {
        return "0 m";
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    const parts = [];
    if (hours > 0) {
        parts.push(`${hours} h`);
    }
    if (minutes > 0 || hours === 0) { // Always show minutes if hours are 0
        parts.push(`${minutes} m`);
    }
    
    return parts.join(' ') || "0 m";
};
