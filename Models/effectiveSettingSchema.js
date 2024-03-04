import mongoose from 'mongoose';

const employeeSettingsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'

    },
    screenshots: {
        enabled: { type: Boolean, default: true },
        frequency: { type: String, default: 12 }, // 12 per hour
        allowBlur: { type: Boolean, default: false },
    },
    activityLevelTracking: { type: Boolean, default: true },
    urlTracking: { type: Boolean, default: true },
    weeklyTimeLimit: { type: Number, default: 0 }, // Set in hours
    autoPauseTrackingAfter: { type: Number, default: 0 }, // Set in minutes
    allowAddingOfflineTime: { type: Boolean, default: true },
    notifyWhenScreenshotTaken: { type: Boolean, default: false },
});

export default mongoose.model('EffectiveSettings', employeeSettingsSchema);