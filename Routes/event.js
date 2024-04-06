import express from 'express';
import events from '../Controllers/event.js';

// auth middlewares for admin
import isAdminMiddleware from '../Middlewares/isManager.js';
// auth middleware for user
import isLoggedInUser from '../Middlewares/loggedIn.js';
// validations
import eventValidator from '../validations/event.js';

const eventRouter = express.Router();

eventRouter.post(
	'/add',
	isLoggedInUser.isLoggedIn,
	eventValidator.addEvent,
	events.addEvent,
);

eventRouter.get('/', isLoggedInUser.isLoggedIn, events.getEvents);

eventRouter.get('/:eid', isLoggedInUser.isLoggedIn, events.getSingleEvent);

// only admin can delete
eventRouter.delete(
	'/delete/:id',
	events.deleteEvent,
);

eventRouter.patch('/edit/:id', isLoggedInUser.isLoggedIn, events.editEvent);

export default eventRouter;
