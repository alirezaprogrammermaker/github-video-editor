export const VideoStatus = {
    PENDING: 'pending',
    BUILDING: 'building',
    READY_FOR_CREATE_VIDEO: 'ready_for_create_video',
    WAIT_FOR_PUBLISH: 'wait_for_publish',
    PUBLISHED: 'published',
    FAILED: 'failed',
} as const;

export type VideoStatusType = (typeof VideoStatus)[keyof typeof VideoStatus];
