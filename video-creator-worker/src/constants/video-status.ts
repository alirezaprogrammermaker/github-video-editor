export const VideoStatus = {
    PENDING: 'pending',
    BUILDING: 'building',
    READY: 'ready',
    READY_FOR_PUBLISH: 'ready_for_publish',
    PUBLISHED: 'published',
    FAILED: 'failed',
} as const;

export type VideoStatusType = (typeof VideoStatus)[keyof typeof VideoStatus];
