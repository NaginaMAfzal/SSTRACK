import express from 'express';
import events from '../Controllers/superAdminOp';
import isLoggedInUser from '../Middlewares/loggedIn';
// auth middlewares for admin
import isAdminMiddleware from '../Middlewares/isSuperAdmin';
// auth middleware for user


const eventRouter = express.Router();

// Routes with Query
//  ############ REPORTS ###############
eventRouter.get('/totalDate', isAdminMiddleware.isManagerOwner, events.getDailyRecords);
eventRouter.get('/week', isAdminMiddleware.isManagerOwner, events.getWeeklyRecords);
eventRouter.get('/month',isAdminMiddleware.isManagerOwner, events.getMonthlyRecords);

eventRouter.get('/year',isAdminMiddleware.isManagerOwner, events.getYearlyRecords);


eventRouter.post(
    '/addProject',
    isAdminMiddleware.isManagerOwner,
    events.addProjects,
);

eventRouter.post(
    '/verifycode',
    events.checkPass,
);

eventRouter.post(
    '/resetpassword',
    events.forgotPassword,
);

eventRouter.post(
    '/email',
    // isLoggedInUser.isLoggedIn,
    events.emailInvite,
);

eventRouter.get(
    '/checkinvite/:gLink/:email',
    events.emailInviteExp
);

eventRouter.post(
    '/client-email',
    isLoggedInUser.isLoggedIn,
    events.emailInviteClient,
);

eventRouter.post('/offline-time/:userId', events.addOfflineTime);

eventRouter.post('/split-activity', events.splitActivity);

eventRouter.post('/move-months-screenshots-to-history', isAdminMiddleware.isManagerOwner, events.moveMonthsScreenshotsToHistory);

eventRouter.get('/', isAdminMiddleware.isManagerOwner, events.getProjects);

eventRouter.get('/historyChanges', isAdminMiddleware.isManagerOwner, events.getHistoryChanges);

eventRouter.get('/Clients', isAdminMiddleware.isManagerOwner, events.getAllClients);

eventRouter.get('/Settings/:userId', events.getEffectiveSettingsEachUser);

eventRouter.get('/history/:userId', isAdminMiddleware.isManagerOwner, events.getMonthlyScreenshots);

eventRouter.get('/employees', isAdminMiddleware.isManagerOwner, events.getAllemployeesr);

eventRouter.get('/allUsersStatuses', isAdminMiddleware.isManagerOwner, events.getUsersStatus);

eventRouter.get('/allEmployeesworkinghour', isAdminMiddleware.isManagerOwner, events.getTotalHoursWorkedAllEmployees);

eventRouter.get('/allUsersWorkinghours', isAdminMiddleware.isManagerOwner, events.getUsersWorkingToday);

eventRouter.get('/allWorkinghours', isAdminMiddleware.isManagerOwner, events.getWorkingHoursSummary);

eventRouter.get('/:eid', events.getSingleEvent);

eventRouter.get('/project/:projectId', events.countEmployeesInProject);

eventRouter.get('/emp/:eid', events.getSingleEmployee);

eventRouter.get('/activity/:eid', isAdminMiddleware.isManagerOwner, events.getActivityData);

eventRouter.get('/sorted-screenshots/:userId', isAdminMiddleware.isManagerOwner, events.sortedScreenshotsEachEmployee);

eventRouter.get('/hoursbyday/:userId', isAdminMiddleware.isManagerOwner, events.getTotalHoursByDay);

eventRouter.get('/sorted-datebased/:userId', isAdminMiddleware.isManagerOwner, events.getTotalHoursAndScreenshote);

eventRouter.get('/user/:id/time-records', events.getTotalHoursWorked);

// eventRouter.post('/totalDate', isAdminMiddleware.isManagerOwner, events.getCustomDateRangeRecords);

// eventRouter.get('/month', isAdminMiddleware.isManagerOwner, events.getMonthlyRecords);

// eventRouter.get('/monthlyrecord', isAdminMiddleware.isManagerOwner, events.getMonthlyRecords);

eventRouter.get('/monthlyrecordofAll/:monthspecifier',isAdminMiddleware.isManagerOwner,events.getTotalMonthlyWorkingHours);

// eventRouter.get('/yearRecords', isAdminMiddleware.isManagerOwner, events.getTotalYearlyWorkingHours);
// new 
eventRouter.get('/annualRecord/:year',isAdminMiddleware.isManagerOwner,events.getTotalAnnualWorkingHours);

eventRouter.get('/week/:weekSpecifier', isAdminMiddleware.isManagerOwner, events.getWeeklyRecords);

// only admin can delete
eventRouter.delete(
    '/delete/:id',
    events.deleteEvent,
);


// only admin can delete
eventRouter.delete(
    '/deleteScreenshot/:screenshotId/TimeTracking/:timeTrackingId',
    events.deleteScreenshotAndDeductTime,
);

// only admin can delete
eventRouter.delete(
    '/deleteEmp/:id',
    events.deleteEmployee,
);


// only admin can delete
eventRouter.delete(
    '/deleteProject/:projectId',
    isAdminMiddleware.isManagerOwner,
    events.deleteProject,
);



// only admin can delete
eventRouter.delete(
    '/time-tracking/:timeTrackingId/activity/:activityId',
    events.deleteActivity,
);

eventRouter.patch('/assign-user-to-manager/:managerId', isAdminMiddleware.isManagerOwner, events.assignUserToManager);

eventRouter.patch('/trim-activity/:userId/:timeEntryId', events.trimActivityInTimeEntry);

eventRouter.patch('/UpdateBillingInfo/:userId', events.updateBillingInfo);

eventRouter.patch('/archived/:userId', events.updateUserArchiveStatus);

eventRouter.patch('/settingsE/', isAdminMiddleware.isManagerOwner, events.updateEmployeeSettings);

eventRouter.patch('/editCompanyName/:id', isAdminMiddleware.isManagerOwner, events.editCompanyName);

eventRouter.patch('/editProjectName/:projectId', isAdminMiddleware.isManagerOwner, events.editProject);

eventRouter.patch('/archiveProject/:projectId', isAdminMiddleware.isManagerOwner, events.archiveProject);



eventRouter.patch('/editCompanyNameForAllEmployee', isAdminMiddleware.isManagerOwner, events.updateCompanyNameForAllEmployees);

// eventRouter.patch('/usersSplit/:userId/time-trackings/:timeTrackingId/time-entries/:timeEntryId/split-screenshots', isAdminMiddleware.isManagerOwner, events.splitActivity);

export default eventRouter;