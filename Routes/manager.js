import express from 'express';
import events from '../Controllers/ManagerOp';

// auth middlewares for admin
import isAdminMiddleware from '../Middlewares/isManager';
// auth middleware for user


const eventRouter = express.Router();

// eventRouter.post(
//     '/addProject',
//     isAdminMiddleware.isManagerOwner,
//     events.addProjects,
// );


// eventRouter.post(
//     '/email',
//     isAdminMiddleware.isManagerOwner,
//     events.emailInvite,
// );

// eventRouter.post('/move-months-screenshots-to-history', isAdminMiddleware.isManagerOwner, events.moveMonthsScreenshotsToHistory);

eventRouter.get('/dashboard', isAdminMiddleware.isManagerOwner, events.MangerDashboard);

eventRouter.get('/managed-users/:managerId', isAdminMiddleware.isManagerOwner, events.getManagedUsers);

eventRouter.get('/datebasedusers/user/:userId', isAdminMiddleware.isManagerOwner, events.getManagerHoursWorked);

eventRouter.get('/activity/:eid', isAdminMiddleware.isManagerOwner, events.getActivityData);

eventRouter.get('/history-emp', isAdminMiddleware.isManagerOwner, events.getMonthlyScreenshots);

// eventRouter.get('/history/:userId', isAdminMiddleware.isManagerOwner, events.getMonthlyScreenshots);

// eventRouter.get('/employees', isAdminMiddleware.isManagerOwner, events.getAllemployees);

// eventRouter.get('/allUsersStatuses', isAdminMiddleware.isManagerOwner, events.getUsersStatus);

// eventRouter.get('/allEmployeesworkinghour', isAdminMiddleware.isManagerOwner, events.getTotalHoursWorkedAllEmployees);

// eventRouter.get('/allUsersWorkinghours', isAdminMiddleware.isManagerOwner, events.getUsersWorkingToday);

// eventRouter.get('/:eid', events.getSingleEvent);

// eventRouter.get('/emp/:eid', events.getSingleEmployee);

// eventRouter.get('/activity/:eid', isAdminMiddleware.isManagerOwner, events.getActivityData);

// eventRouter.get('/sorted-screenshots/:userId', isAdminMiddleware.isManagerOwner, events.sortedScreenshotsEachEmployee);

// eventRouter.get('/sorted-datebased/:userId', isAdminMiddleware.isManagerOwner, events.getTotalHoursQ);

// eventRouter.get('/user/:id/time-records', events.getTotalHoursWorked);

// // only admin can delete
// eventRouter.delete(
//     '/delete/:id',
//     isAdminMiddleware.isManagerOwner,
//     events.deleteEvent,
// );


// only admin can delete
eventRouter.delete(
    '/deleteScreenshot/:screenshotId/TimeTracking/:timeTrackingId',
    isAdminMiddleware.isManagerOwner,
    events.deleteScreenshotAndDeductTime,
);



eventRouter.patch('/addEmployeesToProject/:pId', isAdminMiddleware.isManagerOwner, events.addEmployeeToProject);



eventRouter.delete(
    '/deleteProject/:pId',
    isAdminMiddleware.isManagerOwner,
    events.removeEmployeeFromProject,
);
// // only admin can delete
// eventRouter.delete(
//     '/deleteEmp/:id',
//     isAdminMiddleware.isManagerOwner,
//     events.deleteEmployee,
// );


// // only admin can delete
// eventRouter.delete(
//     '/deleteProject/:projectId',
//     isAdminMiddleware.isManagerOwner,
//     events.deleteProject,
// );

// eventRouter.patch('/assign-user-to-manager/:managerId', isAdminMiddleware.isManagerOwner, events.assignUserToManager);

// eventRouter.patch('/UpdateBillingInfo/:userId', events.updateBillingInfo);

// eventRouter.patch('/archived/:userId', isAdminMiddleware.isManagerOwner, events.updateUserArchiveStatus);

// eventRouter.patch('/settingsE/:userId', isAdminMiddleware.isManagerOwner, events.updateEmployeeSettings);

// eventRouter.patch('/editCompanyName/:id', isAdminMiddleware.isManagerOwner, events.editCompanyName);

// eventRouter.patch('/editProjectName/:projectId', isAdminMiddleware.isManagerOwner, events.editProject);

// eventRouter.patch('/archiveProject/:projectId', isAdminMiddleware.isManagerOwner, events.archiveProject);

// eventRouter.patch('/editCompanyNameForAllEmployee', isAdminMiddleware.isManagerOwner, events.updateCompanyNameForAllEmployees);

export default eventRouter;