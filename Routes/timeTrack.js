import express from 'express';
import multer from 'multer';
import events from '../Controllers/Timetracking';

// auth middlewares for admin
// import isAdminMiddleware from '../Middlewares/isManager';
// auth middleware for user
import isLoggedInUser from '../Middlewares/loggedIn';

import IsUserArchived from '../Middlewares/isArchived';
// validations
// import eventValidator from '../validations/event';

const storage = multer.memoryStorage();
const upload = multer({ storage });

const eventRouter = express.Router();

// ####################   Reports ######################### //

eventRouter.get('/totalDate', isLoggedInUser.isLoggedIn, events.getDailyRecords);
eventRouter.get('/week', isLoggedInUser.isLoggedIn, events.getWeeklyRecords);
eventRouter.get('/month', isLoggedInUser.isLoggedIn, events.getMonthlyRecords);
eventRouter.get('/year', isLoggedInUser.isLoggedIn, events.getYearlyRecords);

eventRouter.post(
    '/add',
    isLoggedInUser.isLoggedIn,
    IsUserArchived,

    events.addNewTracking,
);

eventRouter.delete(
    '/deleteScreenshot/:screenshotId/TimeTracking/:timeTrackingId',
    isLoggedInUser.isLoggedIn,
    events.deleteScreenshotAndDeductTime,
);

eventRouter.get('/history', isLoggedInUser.isLoggedIn, events.getMonthlyScreenshots);

// eventRouter.get('/screenShotcap', events.screesnhotcapture);

eventRouter.post('/split-activity', isLoggedInUser.isLoggedIn, events.splitActivity);

eventRouter.get('/', isLoggedInUser.isLoggedIn, IsUserArchived, events.getDailyTimetracking);

eventRouter.get('/Activities', isLoggedInUser.isLoggedIn, IsUserArchived, events.getActivityData);

eventRouter.get('/sorted-screenshot', isLoggedInUser.isLoggedIn, events.getTotalHoursWithOfflineAndScreenshotse);

eventRouter.get('/hours', isLoggedInUser.isLoggedIn, events.getTotalHoursWorked);

// eventRouter.get('/totalDate', isLoggedInUser.isLoggedIn, events.getCustomDateRangeRecords);

// eventRouter.get('/month/:monthSpecifier', isLoggedInUser.isLoggedIn, events.getMonthlyRecords);

// eventRouter.get('/year/:year', isLoggedInUser.isLoggedIn, events.getTotalWorkingHoursForYear);

// eventRouter.get('/week', isLoggedInUser.isLoggedIn, events.getWeeklyRecords);

// eventRouter.get('/:eid', isLoggedInUser.isLoggedIn, events.getSingleEvent);

// // only admin can delete
// eventRouter.delete(
//     '/delete/:id',
//     isAdminMiddleware.isManagerOwner,
//     events.deleteEvent,
// );

eventRouter.delete(
    '/time-tracking/:timeTrackingId/activity/:activityId',
    isLoggedInUser.isLoggedIn,
    events.deleteActivity,
);


eventRouter.patch('/capture-screenshot/:timeEntryId/screenshots', isLoggedInUser.isLoggedIn, upload.single('file'), events.addScreenshotab);
eventRouter.patch('/edit/:timeEntryId', isLoggedInUser.isLoggedIn, events.stopTracking);
eventRouter.patch('/time-entries/:timeEntryId/screenshots', isLoggedInUser.isLoggedIn, upload.single('file'), events.addScreenshot);
eventRouter.patch('/url/time-entry/:timeEntryId', isLoggedInUser.isLoggedIn, events.visitedurlSave);
eventRouter.patch('/ReportActivity', isLoggedInUser.isLoggedIn, events.updateActivityData);
//updation file api's
eventRouter.post('/updateAppurl', upload.single('file'),  events.updateAppUrl);
eventRouter.get('/updatedFile', events.updatedFile);
eventRouter.get('/hoursbyday', isLoggedInUser.isLoggedIn, events.getTotalHoursByDay);

eventRouter.get('/online-status', events.getUserOnlineStatus);

export default eventRouter;