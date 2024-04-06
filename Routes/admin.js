import express from 'express';
import events from '../Controllers/superAdminOp';

// auth middlewares for admin
import isAdminMiddleware from '../Middlewares/isSuperAdmin';
// auth middleware for user


const eventRouter = express.Router();

eventRouter.post(
    '/addProject',
    isAdminMiddleware.isManagerOwner,
    events.addProjects,
);

eventRouter.get('/', isAdminMiddleware.isManagerOwner, events.getProjects);

eventRouter.get('/:eid', events.getSingleEvent);

// only admin can delete
eventRouter.delete(
    '/delete/:id',
    isAdminMiddleware.isManagerOwner,
    events.deleteEvent,
);

eventRouter.patch('/edit/:id', events.editEvent);

export default eventRouter;