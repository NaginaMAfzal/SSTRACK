import express from 'express';
import events from '../Controllers/userGroup';

// auth middlewares for admin
import isAdminMiddleware from '../Middlewares/isSuperAdmin';


const eventRouter = express.Router();

eventRouter.post(
    '/add',

    events.addUserGroup,
);

eventRouter.get('/', isAdminMiddleware.isManagerOwner, events.getUserGroups);

eventRouter.get('/:projectId/employees/count', isAdminMiddleware.isManagerOwner, events.countEmployeesInProject);

eventRouter.get('/:eid', isAdminMiddleware.isManagerOwner, events.getSingleEvent);

// only admin can delete
eventRouter.delete(
    '/delete/:gId',
    isAdminMiddleware.isManagerOwner,
    events.removeEmployeeFromUserGroup,
);

// only admin can delete
eventRouter.delete(
    '/deleteProject/:pId',
    isAdminMiddleware.isManagerOwner,
    events.removeEmployeeFromProject,
);

eventRouter.delete(
    '/deleteG/:id',
    isAdminMiddleware.isManagerOwner,
    events.deleteEvent,
);

eventRouter.patch('/edit/:id', events.EmployeeRoleUpdate);


eventRouter.patch('/allowTracking/:projectId/user/:userId', events.allowUserToTrackTime);

eventRouter.patch('/addEmployeesToGroup/:groupId', events.addEmployeeToUserGroup);

eventRouter.patch('/addEmployeesToProject/:pId', events.addEmployeeToProject);


eventRouter.patch('/addClientToProject/:projectId', events.addClientToProject);

export default eventRouter;