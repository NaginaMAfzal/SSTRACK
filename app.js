/* eslint-disable func-names */
import express from 'express';
import cors from 'cors';
import status from 'http-status';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import passport from 'passport';
import dbConnection from './Connection/dbConnect';
import Router from './Routes/Router';
import errorHandler from './Middlewares/errorHandler';
import verifyToken from './Middlewares/verifyToken';
import User from './Models/userSchema';
import Pusher from "pusher";
import timeTracking from './Models/timeSchema';
import Timetracking from './Controllers/Timetracking';
// const robot = require('robotjs');
// const schedule = require('node-schedule');

dbConnection();


const pusher = new Pusher({
    appId: "1689786",
    key: "334425b3c859ed2f1d2b",
    secret: "4f194ad6603392f77f20",
    cluster: "ap2",
    useTLS: true
});

const app = express();
app.use((req, res, next) => {
    // Make the 'pusher' instance available to all routes via the 'res.locals' object
    res.locals.pusher = pusher;
    next();
});
// initialize passport
app.use(passport.initialize());
app.use(passport.session());

app.use(morgan('dev'));
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(
    express.urlencoded({
        extended: false,
    }),
);
// Enable CORS for all routes
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});
// will decode token from each request in {req.user}
app.use(verifyToken.verifyTokenSetUser);

// app.use(express.json());
// const pusher = new Pusher({
//     appId: "1689786",
//     key: "334425b3c859ed2f1d2b",
//     secret: "4f194ad6603392f77f20",
//     cluster: "ap2",
//     useTLS: true
//   });
app.get('/', (req, res) => {
    res.status(status.OK).send({ Message: 'Connected', status: status.OK });
});

app.use('/api/v1/signup', Router.SignupRouter);

app.use('/api/v1/signin', Router.SigninRouter);

app.use('/api/v1/event', Router.EventRouter);

app.use('/api/v1/superAdmin', Router.SuperAdmin);

app.use('/api/v1/timetrack', Router.TimeTracking);

app.use('/api/v1/userGroup', Router.UserGroup);

app.use('/api/v1/owner', Router.OwnerRoute);

app.use('/api/v1/manager', Router.Manager);

app.use('/api/v1/SystemAdmin', Router.SystemAdmin);


pusher.trigger("ss-track", "my-event", {
    message: "hello world"
});
// i have implemented it in signup controller like this {next(new Error('Image is required'))}
app.use(errorHandler);

async function deleteTimeTrackingsNotInUsers() {
    try {
        // Step 1: Fetch all data from the timetracking and users collections
        const timeTrackings = await timeTracking.find();
        const users = await User.find();

        // Step 2: Identify userId values from timetracking that do not exist in users
        const userIdsInTimetracking = timeTrackings.map(entry => entry.userId);
        const userIdsInUsers = users.map(user => user.userId);

        const userIdsToDelete = userIdsInTimetracking.filter(userId => !userIdsInUsers.includes(userId));

        // Step 3: Delete data from timetracking for userIds that do not exist in users
        const deleteResult = await TimeTracking.deleteMany({ userId: { $in: userIdsToDelete } });

        console.log(`${deleteResult.deletedCount} documents deleted from TimeTracking`);
    } catch (error) {
        console.error('Error:', error);
    }
}

const { MongoClient } = require('mongodb');

async function getDatabaseStats() {
    const client = new MongoClient(process.env.DB_URI);
    await client.connect();
    const database = client.db('testdb');
    const stats = await database.stats();
    console.log(stats);
    await client.close();
}

// getDatabaseStats();

getusers()
async function getusers() {
    try {

        // Query the "user" table to retrieve all users
        const users = await User.find();
        for (const user of users) {
            // Get the current time
            const currentTime = new Date();

            // Define the time range (5 minutes ago)
            const fiveMinutesAgo = new Date(currentTime.getTime() - 5 * 60 * 1000); // 5 minutes in milliseconds

            // Filter users whose 'lastActive' time is older than 5 minutes ago

            const lastActive = new Date(user.lastActive); // Check if 'lastActive' is older than 5 minutes ago
            // const deleteResult = await timeTracking.deleteMany({ userId: '658ecc216b6b393708f3e12c' });

            // const timeTrackings = await timeTracking.find({ userId: '65408e5e8471cc001db7c0ae' });

            // for (const timeTracking of timeTrackings) {
            //     for (const timeEntry of timeTracking.timeEntries) {
            //         // Assuming 'screenshots' and 'visitedUrls' arrays exist
            //         if (timeEntry.screenshots && timeEntry.screenshots.length > 0) {
            //             for (const screenshot of timeEntry.screenshots) {
            //                 if (screenshot.visitedUrls && screenshot.visitedUrls.length > 0) {
            //                     screenshot.visitedUrls[0].url = "Google Chrome";
            //                 }
            //             }
            //         }
            //     }
            // }

            // // Save the updated data back to the database
            // await Promise.all(timeTrackings.map(timeTracking => timeTracking.save()));

            if (lastActive < fiveMinutesAgo) {
                if (user.isActive) {

                    user.isActive = false;
                    await user.save();
                    // Query timeTrackings for entries related to the user
                    const lastTimeEntry = await timeTracking.findOne({ userId: user._id })
                        .sort({ 'timeEntries.startTime': -1 }) // Sort in descending order
                        .limit(1) // Limit to the first result

                    if (lastTimeEntry) {
                        // You have the last time entry
                        const lastTimeEntryDetails = lastTimeEntry.timeEntries.slice(-1)[0]; // Get the last time entry
                        if (!lastTimeEntryDetails.endTime) {
                            let endTime = 0;
                            const lastScreenshot = lastTimeEntryDetails.screenshots.slice(-1)[0]; // Get the last time entry
                            if (lastScreenshot && lastScreenshot.createdAt) {
                                endTime = new Date(lastScreenshot.createdAt)
                            }
                            else {
                                endTime = new Date(lastTimeEntryDetails.startTime);
                            }

                            lastTimeEntryDetails.endTime = endTime;
                            await lastTimeEntry.save();
                        }
                    }

                }; // Check if 'lastActive' is less than 5 minutes ago
            }

        }

        // You can do something with the "users" data here
        // console.log('Retrieved users:', users);

    } catch (error) {
        console.error('Database connection error:', error);
    }
}
setInterval(getusers, 60000); // 60000 milliseconds = 1 minute

// Check if the mouse has moved
// const mousePos = robot.getMousePos();
// console.log(`Mouse position: x=${mousePos.x} y=${mousePos.y}`);

// // Check if any key is pressed
// const isAnyKeyPressed = robot.keyIsPressed();
// console.log(`Any key state: ${isAnyKeyPressed ? 'pressed' : 'not pressed'}`);
const port = process.env.PORT || 5000;

app.listen(port, () =>
    console.log(`App listening On port http://localhost:${port}`),
);