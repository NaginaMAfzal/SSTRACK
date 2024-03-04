import express from 'express';
// import SystemAdmin from '../Controllers/systemAdminSignin';
import events from '../Controllers/SystemAdminOp';
import middleware from '../Middlewares/isSystemAdmin';

// auth middlewares for admin
// import isAdminMiddleware from '../Middlewares/isSuperAdmin';
// auth middleware for user


const eventRouter = express.Router();


// eventRouter.post('/signIn', SystemAdmin);
eventRouter.get('/companies',middleware.isSystemOwner ,events.getEvents);
eventRouter.get('/disbledCompanies',middleware.isSystemOwner ,events.getDisabledEvents);
eventRouter.patch('/archived/:company',middleware.isSystemOwner,  events.updateUserArchiveStatus);
eventRouter.get('/getCompany/:com',middleware.isSystemOwner, events.getcompanyemployees);

// eventRouter.post(
//     '/addProject',
//     isAdminMiddleware.isManagerOwner,
//     events.addProjects,
// );

// eventRouter.get('/', isAdminMiddleware.isManagerOwner, events.getProjects);

// eventRouter.get('/:eid', events.getSingleEvent);

// // only admin can delete
// eventRouter.delete(
//     '/delete/:id',
//     isAdminMiddleware.isManagerOwner,
//     events.deleteEvent,
// );

// eventRouter.patch('/edit/:id', events.editEvent);

export default eventRouter;