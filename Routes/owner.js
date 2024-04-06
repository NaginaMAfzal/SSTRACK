import express from 'express';
// import SystemAdmin from '../Controllers/systemAdminSignin';
import events from '../Controllers/OwnerOp';
import middleware from '../Middlewares/loggedIn';

// auth middlewares for admin
// import isAdminMiddleware from '../Middlewares/isSuperAdmin';
// auth middleware for user


const eventRouter = express.Router();

// Routes with Query
//  ############ REPORTS ###############
eventRouter.get('/totalDate', middleware.isLoggedIn, events.getDailyRecords);
eventRouter.get('/week', middleware.isLoggedIn, events.getWeeklyRecords);
eventRouter.get('/month',middleware.isLoggedIn, events.getMonthlyRecords);

eventRouter.get('/year',middleware.isLoggedIn, events.getYearlyRecords);


eventRouter.post('/addEmployee', events.addEmployeeToCompany);
eventRouter.post('/updateemployee', events.updateEmployeeToCompany);
eventRouter.get('/companies',middleware.isLoggedIn ,events.getEvents);
eventRouter.patch('/archived/:userId',middleware.isLoggedIn,  events.updateUserArchiveStatus);
eventRouter.get('/getDisabledEmployee',middleware.isLoggedIn, events.getcompanyemployees);
eventRouter.get('/getCompanyemployee',middleware.isLoggedIn, events.getTotalHoursWorkedAllEmployeesT);
eventRouter.get('/settingsE/:userId', middleware.isLoggedIn, events.updateEmployeeSettings);
eventRouter.get('/sorted-datebased/:userId', middleware.isLoggedIn, events.getTotalHoursAndScreenshots);

eventRouter.get('/hoursbyday/:userId', middleware.isLoggedIn, events.getTotalHoursByDay);

// eventRouter.post(
//     '/addProject',
//     isAdminMiddleware.isManagerOwner,
//     events.addProjects,
// );

// eventRouter.get('/', isAdminMiddleware.isManagerOwner, events.getProjects);

eventRouter.get('/:eid',  middleware.isLoggedIn,events.getSingleEmployee);

// eventRouter.delete(
//     '/deleteEmp/:id',
//     middleware.isLoggedIn,
//     events.deleteEmployee,
// );

eventRouter.patch('/archived/:userId', middleware.isLoggedIn, events.deleteEmployee);

// eventRouter.patch('/edit/:id', events.editEvent);

export default eventRouter;