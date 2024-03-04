import mongoose from 'mongoose';

const HistoryScreenshotSchema = new mongoose.Schema({
    screenshot: [{
        type: String,

    }],
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
    type: {
        type: String,
        enum: ['deleted', 'month'],
        required: true,
    },
    originalTimeTrackingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TimeTracking',
    },
    originalTimeEntryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TimeEntry',
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    deletedAt: {
        type: Date,
    },
    deductedTime: {
        type: Number,
        default: 0,
    },
    originalActivity: {
        startTime: {
            type: Date,
            required: true,
        },
        endTime: {
            type: Date,
            required: true,
        },
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project',
        },
        note: String,

    },
});

export default mongoose.model('HistoryScreenshot', HistoryScreenshotSchema);