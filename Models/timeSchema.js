/* eslint-disable no-underscore-dangle */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable func-names */
import mongoose from 'mongoose';

const screenshotSchema = new mongoose.Schema({
    key: { type: String, },
    description: { type: String },
    time: { type: String },
    startTime: { type: String },
    endTime: { type: String },
    visitedUrls: [{
        url: String,
        visitCount: Number,
        visitDuration: Number,
        activityPercentage: Number,
    }],
}, { timestamps: true });

const activitySchema = new mongoose.Schema({
    startTime: { type: String },
    endTime: { type: String },
    changeTime: { type: Date },
    editedBy: { type: String },
    scope: { type: String },
    change: { type: String },
    screenshots: [screenshotSchema],
    historyChanges: [{
        changeTime: { type: String },
        editedBy: { type: String },
        previousData: { type: mongoose.Schema.Types.Mixed },
    }],
    offline: Boolean
});
const timeEntrySchema = new mongoose.Schema({
    startTime: { type: Date },
    endTime: { type: Date },
    description: { type: String },

    screenshots: [screenshotSchema],
    
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    deletedAt: {
        type: Date,
    },
    deductedTime: {
        type: Number,
    },
    activities: [activitySchema]
});

const timeTrackingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',

    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',

    },
    timeEntries: [timeEntrySchema],

    totalHoursWorked: { type: Number, default: 0 }
}, { timestamps: true });



timeTrackingSchema.virtual('computedHours').get(function() {
    const totalMilliseconds = this.timeEntries.reduce((total, timeEntry) => {
        return total + (timeEntry.endTime - timeEntry.startTime);
    }, 0);
    return totalMilliseconds / (1000 * 60 * 60);
});







export default mongoose.model('TimeTrack', timeTrackingSchema);