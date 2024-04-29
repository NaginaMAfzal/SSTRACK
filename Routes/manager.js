import express from 'express';
import events from '../Controllers/ManagerOp';

// auth middlewares for admin
import isAdminMiddleware from '../Middlewares/isManager';
// auth middleware for user


const eventRouter = express.Router();

//  ############ REPORTS ###############
eventRouter.get('/day', isAdminMiddleware.isManagerOwner, events.getDailyRecords);
eventRouter.get('/week', isAdminMiddleware.isManagerOwner, events.getWeeklyRecords);
eventRouter.get('/month',isAdminMiddleware.isManagerOwner, events.getMonthlyRecords);
eventRouter.get('/year',isAdminMiddleware.isManagerOwner, events.getYearlyRecords);



eventRouter.get('/dashboard', isAdminMiddleware.isManagerOwner, events.MangerDashboard);

eventRouter.post('/offline-time/:userId', isAdminMiddleware.isManagerOwner, events.addOfflineTime);

eventRouter.get('/managed-users/:managerId', isAdminMiddleware.isManagerOwner, events.getManagedUsers);

eventRouter.get('/employees', isAdminMiddleware.isManagerOwner, events.getAllemployeesr);

eventRouter.get('/sorted-datebased/:userId', isAdminMiddleware.isManagerOwner, events.getManagerHoursWorked);

eventRouter.get('/activity/:eid', isAdminMiddleware.isManagerOwner, events.getActivityData);

eventRouter.get('/history-emp', isAdminMiddleware.isManagerOwner, events.getMonthlyScreenshots);

eventRouter.get('/hoursbyday/:userId', isAdminMiddleware.isManagerOwner, events.getTotalHoursByDay);


// only admin can delete
eventRouter.delete(
    '/deleteScreenshot/:screenshotId/TimeTracking/:timeTrackingId',
    isAdminMiddleware.isManagerOwner,
    events.deleteScreenshotAndDeductTime,
);

eventRouter.post('/split-activity', events.splitActivity);

eventRouter.patch('/trim-activity/:userId/:timeEntryId', events.trimActivityInTimeEntry);


eventRouter.patch('/addEmployeesToProject/:pId', isAdminMiddleware.isManagerOwner, events.addEmployeeToProject);



eventRouter.delete(
    '/deleteProject/:pId',
    isAdminMiddleware.isManagerOwner,
    events.removeEmployeeFromProject,
);

export default eventRouter;