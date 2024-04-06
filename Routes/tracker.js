import express from 'express';
import multer from 'multer';
import tracker from '../Controllers/trackerOp';

// auth middlewares for admin
// import isAdminMiddleware from '../Middlewares/isManager';
// auth middleware for user
import isLoggedInUser from '../Middlewares/loggedIn';

import IsUserArchived from '../Middlewares/isArchived';
// validations
// import eventValidator from '../validations/event';

const storage = multer.memoryStorage();
const upload = multer({ storage });

const trackerRouter = express.Router();

trackerRouter.post(
    '/startTrack',
    isLoggedInUser.isLoggedIn,
    IsUserArchived,
    tracker.startTracker,
);
trackerRouter.post(
    '/updateLocations',
    isLoggedInUser.isLoggedIn,
    IsUserArchived,
    tracker.updateLocations,
)

trackerRouter.post(
    '/pauseTracker',
    isLoggedInUser.isLoggedIn,
    IsUserArchived,
    tracker.pauseTracker,
)

trackerRouter.get(
    '/getTrackerData',
    isLoggedInUser.isLoggedIn,
    IsUserArchived,
    tracker.getTrackerData
)
export default trackerRouter;