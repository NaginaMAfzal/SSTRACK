/* eslint-disable no-loop-func */
/* eslint-disable no-useless-escape */
// import { chromium } from 'playwright';
// import puppeteer from 'puppeteer-core';
import status from 'http-status';
import moment from 'moment-timezone';
// import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import TimeTracking from '../Models/timeSchema';

import ProjectSchema from '../Models/projectSchema';
import User from '../Models/userSchema';
import ScreenshotHistory from '../Models/screenshotHistorySchema';
import aws from './aws';
import updationSchema from '../Models/updationSchema';

/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-unused-vars */
/* eslint-disable radix */
/* eslint-disable no-shadow */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-use-before-define */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-param-reassign */
/* eslint-disable no-underscore-dangle */

const getDailyTimetracking = async (req, res) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const formatHours = (hoursDecimal) => {
        const hours = Math.floor(hoursDecimal);
        const minutes = Math.round((hoursDecimal - hours) * 60);
        return `${hours}h ${minutes}m`;
    };

    const calculateBillingAmount = (ratePerHour, hours) => {
        return ratePerHour * hours;
    };

    try {
        const timeTrackings = await TimeTracking.find({
            userId: req.user._id,
        }).populate('userId');

        const filteredTimeTrackings = timeTrackings
            .filter((timeTracking) => {
                const anyTimeEntryToday = timeTracking.timeEntries.some(
                    (timeEntry) =>
                        (timeEntry.startTime >= startOfToday && timeEntry.startTime < endOfToday) ||
                        (timeEntry.endTime && timeEntry.endTime >= startOfToday && timeEntry.endTime < endOfToday) ||
                        !timeEntry.endTime
                );
                return anyTimeEntryToday;
            })
            .map((timeTracking) => {
                const filteredTimeEntries = timeTracking.timeEntries.filter(
                    (timeEntry) =>
                        (timeEntry.startTime >= startOfToday && timeEntry.startTime < endOfToday) ||
                        (timeEntry.endTime && timeEntry.endTime >= startOfToday && timeEntry.endTime < endOfToday) ||
                        !timeEntry.endTime
                );

                // Calculate the total daily working hours
                const totalDailyHoursDecimal = filteredTimeEntries.reduce((total, timeEntry) => {
                    const endTime = timeEntry.endTime ? new Date(timeEntry.endTime) : new Date();
                    const hoursWorked = (endTime - timeEntry.startTime) / (1000 * 60 * 60);
                    return total + hoursWorked;
                }, 0);

                const totalDailyHours = formatHours(totalDailyHoursDecimal);

                // Calculate the billing amount
                const billingAmount = Number(calculateBillingAmount(timeTracking.userId.billingInfo.ratePerHour, totalDailyHoursDecimal));
                const totalBilling = parseInt(billingAmount);

                // Get activity IDs and screenshots
                const activityIds = filteredTimeEntries.flatMap((timeEntry) =>
                    timeEntry.activities.map((activity) => activity._id)
                );

                const screenshots = filteredTimeEntries.flatMap((timeEntry) =>
                    timeEntry.activities.flatMap((activity) => activity.screenshots)
                );

                return {
                    ...timeTracking.toObject(),
                    timeEntries: filteredTimeEntries,
                    totalDailyHours,
                    totalBilling,
                    activityIds,
                    screenshots,
                };
            });

        res.status(status.OK).send(filteredTimeTrackings);
    } catch (error) {
        res.status(status.INTERNAL_SERVER_ERROR).send({
            Message: 'No Events!',
            error,
        });
        console.error('Error finding time tracking data:', error);
    }
};






function parseTimezoneOffset(timezoneStr) {
    const offsetRegex = /\((GMT|UTC)([+-])(\d{1,2}):(\d{2})\)\s.+/;
    const match = timezoneStr.match(offsetRegex);
    if (!match) {
        return null;
    }

    const sign = match[2] === '-' ? -1 : 1;
    const hours = parseInt(match[3], 10);
    const minutes = parseInt(match[4], 10);
    return sign * (hours * 60 + minutes) * 60000; // Offset in milliseconds
}


const addNewTracking = async (req, res) => {
    try {
        const { projectId, description, activities } = req.body;
        const project = await ProjectSchema.findById(projectId);

        // Get the user's timezone offset from the req.user object (assuming it's available)
        const userTimezoneOffset = req.user.timezoneOffset; // Replace 'timezoneOffset' with the actual field name in req.user

        console.log(req.user);

        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        if (project.isArchived) {
            return res.status(400).json({ success: false, message: 'Cannot track time for an archived project' });
        }

        // Find an existing time tracking document for the current day
        const timeTracking = await TimeTracking.findOne({
            userId: req.user._id,
            projectId,
        });

        const user = await User.findById(req.user._id);

        if (user) {
            // Update the user's isActive field to false
            user.isActive = true;
            await user.save();
        }

        // Check if user timezone offset is available
        if (!req.user || !req.user.timezoneOffset) {
            return res.status(400).json({ success: false, message: 'User timezone offset not provided' });
        }

        // Convert the current time to the user's timezone
        // const startTimeInUserTimezone = new Date();
        // Get current time in UTC+0
        const startTimeInUserTimezone = new Date().toUTCString();

        // Add the new time entry to the time tracking document with the user's timezone start time
        const newTimeEntry = {
            startTime: startTimeInUserTimezone,
            description,
            activities: Array.isArray(activities)
                ? activities.map((activity) => ({
                    startTime: startTimeInUserTimezone,
                    description: activity.description,
                }))
                : [], // Ensure activities is an array and set start time only
        };

        // Check if activities is empty and add a default activity
        if (newTimeEntry.activities.length === 0) {
            const defaultActivity = {
                startTime: startTimeInUserTimezone,
                description: 'Default Activity',
                screenshots: [],
            };
            newTimeEntry.activities.push(defaultActivity);
        }

        // Update or create the time tracking document
        const updatedTimeTracking = await TimeTracking.findOneAndUpdate(
            {
                userId: req.user._id,
                projectId,
            },
            { $push: { timeEntries: newTimeEntry } },
            { upsert: true, new: true }
        );

        await User.findByIdAndUpdate(req.user._id, { lastActive: new Date(), isActive: true });

        res.status(200).json({ success: true, data: updatedTimeTracking });
    } catch (error) {
        console.error('Error adding time entry:', error);
        res.status(500).json({ success: false, message: 'Failed to add time entry' });
    }
};


// const deleteEvent = (req, res) => {
//     const { id } = req.params;
//     EventSchema.findByIdAndRemove(id, (err, result) => {
//         if (result) {
//             res.status(status.OK).send({
//                 Message: 'Event Deleted Successfully.',
//             });
//         } else {
//             res.status(status.INTERNAL_SERVER_ERROR).send({
//                 Message: 'Unable to Delete.',
//                 err,
//             });
//         }
//     });
// };
const updatedFile = async (req, res) => {
    try {
        // Find the most recent record in the 'updationSchema' collection
        const mostRecentRecord = await updationSchema.findOne().sort({ createdAt: -1 });

        if (!mostRecentRecord) {
            // Handle the case where no records are found
            res.status(404).json({ success: false, message: 'No records found' });
        } else {
            // Do something with the most recent record
            res.status(200).json({ success: true, data: mostRecentRecord });
        }
    } catch (error) {
        console.error('Error finding the most recent record:', error);
        res.status(500).json({ success: false, message: 'Failed to find the most recent record' });
    }
}

const updateAppUrl = async (req, res) => {
    const version = req.body.version;
    const file = req.file;

    try {
        // Use the findOne method to find a document with the given version
        const existVersion = await updationSchema.findOne({ version });

        if (existVersion) {
            res.status(400).json({ success: false, message: 'Version already exists' });
        } else {
            const url = await aws.UploadUpdationToAws(file);
            // const url = "https://timetracker-09.s3.amazonaws.com/screenshot_12-22-57-PM_10-16-2023_651a7277c83e99001cf2637e.png"

            // Save the new version and URL in the database
            const newVersion = new updationSchema({
                version,
                url,
            });

            await newVersion.save();

            res.status(200).json({ success: true, data: newVersion });
        }
    } catch (error) {
        console.error('Error updating app URL:', error);
        res.status(500).json({ success: false, message: 'Failed to update app URL', error });
    }
}


const addScreenshotab = async (req, res) => {
    console.log(req.method, "request received")
    if (req.method === 'OPTIONS') {
        // Handle OPTIONS request separately
        res.status(200).end();
        return;
    }
    const { timeEntryId } = req.params;
    const { description } = req.body;
    const file = req.body.file;
    const { activityPercentage } = req.body;
    const description2 = req.body.description2;
    const endTime = 0;
    let url;
    let fileBuffer;

    let visitedUrls = [];
    try {
        // Check if a file (screenshot) is provided in the request
        if (!file) {
            return res.status(400).json({ success: false, message: 'No file provided' });
        }
        const startTime = new Date(req.body.startTime)

        // Find the time tracking document with the given time entry
        const timeTrack = await TimeTracking.findOne({ 'timeEntries._id': timeEntryId });
        if (!timeTrack) {
            return res.status(404).json({ success: false, message: 'Time entry not found' });
        }

        // Get the specific time entry from the time tracking document
        const timeEntry = timeTrack.timeEntries.id(timeEntryId);
        if (!timeEntry) {
            return res.status(404).json({ success: false, message: 'Time entry not found' });
        }
        else {
            const MINIMUM_FILE_SIZE_BYTES = 100 * 1024; // 100 kilobytes

            // Inside your addScreenshotab function, after checking if a file is provided
            if (!file || file.length < MINIMUM_FILE_SIZE_BYTES) {
                return res.status(400).json({ success: false, message: 'File size too small' });
            }
            if (file !== null && file !== undefined && file.length > MINIMUM_FILE_SIZE_BYTES) {
                fileBuffer = Buffer.from(file, 'base64');
                fileBuffer.originalname = `screenshot_${startTime}_${req.user._id}.jpeg`;
                const filename = "https://timetracker-09.s3.amazonaws.com/" + fileBuffer.originalname;
                // Check if the filename already exists in any of the screenshots
                if (timeEntry.screenshots.some(screenshot => screenshot.key == filename)) {
                    return res.status(202).json({ success: true, message: 'Filename already exists in one of the screenshots', filename: file.originalname, data: timeEntry });
                }
                else {

                    // Upload the screenshot to AWS and get the URL
                    url = await aws.UploadToAws(fileBuffer);
                }
            }
        }


        // Get the current date and time in the user's local time zone
        const userLocalNow = new Date(req.body.createdAt);

        // Get the current time as a string in 'hour:minute' format
        const currentTime = userLocalNow.toLocaleTimeString([], { hour: 'numeric', minute: 'numeric' });

        const createdAt = userLocalNow;

        const newVisitedUrl = {
            activityPercentage, // Use the provided activityPercentage
            url: description2,
            // You can add other properties as needed
        };
        visitedUrls.push(newVisitedUrl);
        // Create an object for the added screenshot
        const addedScreenshot = {
            startTime: startTime,
            endTime: userLocalNow,
            key: url,
            description,
            time: currentTime,
            createdAt,
            visitedUrls,
        };
        console.log(addedScreenshot);
        // Push the screenshot to the time entry's screenshots array
        timeEntry.screenshots.push(addedScreenshot);
        if (timeEntry.endTime) {
            timeEntry.endTime = userLocalNow;
        }

        // Filter activities that overlap with the screenshot's createdAt time
        const splitActivities = timeEntry.activities.filter((activity) => {
            return activity.startTime <= createdAt && activity.endTime >= createdAt;
        });

        // If there are overlapping activities, update their endTime to the screenshot's createdAt time
        if (splitActivities.length > 0) {
            splitActivities.forEach((activity) => {
                activity.endTime = createdAt;
            });
        }

        // Save the updated time tracking document
        await timeTrack.save();

        var newTimeEntry = {
            key: url,
            description: description,
            time: currentTime,
            createdAt: createdAt,
            visitedUrls: visitedUrls,
            user_id: req.user._id,
            timeEntryId: timeEntryId
        };


        // Update the user's lastActive field to the current time
        await User.findByIdAndUpdate(
            req.user._id, {
            lastActive: userLocalNow,
            isActive: true,
        }, { new: true });
        const addedScreenshotId = timeEntry.screenshots[timeEntry.screenshots.length - 1]._id;
        // Return the success response with the screenshot URL and time


        return res.status(200).json({
            success: true,
            id: addedScreenshotId,
            screenshot: url,
            time: currentTime,
            data: timeEntry,
            filename: file.originalname,
            message: 'Screenshot added successfullyy',
        });
    } catch (error) {
        console.error('Error adding screenshot:', error);
        return res.status(500).json({ success: false, message: 'Failed to add screenshot' });
    }
};


const addScreenshott = async (req, res) => {
    const pusher = res.locals.pusher;
    const { timeEntryId } = req.params;
    const { description } = req.body;
    const file = req.file;
    const { activityPercentage } = req.body;
    let visitedUrls = [];
    try {
        // Find the time tracking document with the given time entry
        const timeTrack = await TimeTracking.findOne({ 'timeEntries._id': timeEntryId });
        if (!timeTrack) {
            return res.status(404).json({ success: false, message: 'Time entry not found' });
        }

        // Get the specific time entry from the time tracking document
        const timeEntry = timeTrack.timeEntries.id(timeEntryId);
        if (!timeEntry) {
            return res.status(404).json({ success: false, message: 'Time entry not found' });
        }

        // Check if a file (screenshot) is provided in the request
        if (!file) {
            return res.status(400).json({ success: false, message: 'No file provided' });
        }

        // Upload the screenshot to AWS and get the URL
        const url = await aws.UploadToAws(file);

        // Get the current date and time in the user's local time zone
        const userLocalNow = new Date();

        // Get the current time as a string in 'hour:minute' format
        const currentTime = userLocalNow.toLocaleTimeString([], { hour: 'numeric', minute: 'numeric' });

        const createdAt = userLocalNow;

        const newVisitedUrl = {
            activityPercentage, // Use the provided activityPercentage
            // You can add other properties as needed
        };
        visitedUrls.push(newVisitedUrl);
        // Create an object for the added screenshot
        const addedScreenshot = {
            key: url,
            description,
            time: currentTime,
            createdAt,
            visitedUrls,
        };
        console.log(addedScreenshot);
        // Push the screenshot to the time entry's screenshots array
        timeEntry.screenshots.push(addedScreenshot);

        // Filter activities that overlap with the screenshot's createdAt time
        const splitActivities = timeEntry.activities.filter((activity) => {
            return activity.startTime <= createdAt && activity.endTime >= createdAt;
        });

        // If there are overlapping activities, update their endTime to the screenshot's createdAt time
        if (splitActivities.length > 0) {
            splitActivities.forEach((activity) => {
                activity.endTime = createdAt;
            });
        }

        // Save the updated time tracking document
        await timeTrack.save();

        var newTimeEntry = {
            key: url,
            description: description,
            time: currentTime,
            createdAt: createdAt,
            visitedUrls: visitedUrls,
            user_id: req.user._id,
            timeEntryId: timeEntryId
        };


        // Update the user's lastActive field to the current time
        await User.findByIdAndUpdate(req.user._id, { lastActive: new Date() });
        const addedScreenshotId = timeEntry.screenshots[timeEntry.screenshots.length - 1]._id;
        // Return the success response with the screenshot URL and time
        // applying real time
        pusher.trigger("ss-track", "new-ss", {
            message: "new screenshots",
            data: newTimeEntry,
        });

        return res.status(200).json({
            success: true,
            id: addedScreenshotId,
            screenshot: url,
            time: currentTime,
            data: timeTrack,
            message: 'Screenshot added successfully',
        });
    } catch (error) {
        console.error('Error adding screenshot:', error);
        return res.status(500).json({ success: false, message: 'Failed to add screenshot' });
    }
};


const addScreenshot = async (req, res) => {
    const pusher = res.locals.pusher;
    const { timeEntryId } = req.params;
    const { description } = req.body;
    const file = req.file;
    const { activityPercentage } = req.body;
    const endTime = 0;
    let visitedUrls = [];
    const filename = "https://timetracker-09.s3.amazonaws.com/" + file.originalname;
    try {
        // Find the time tracking document with the given time entry
        const timeTrack = await TimeTracking.findOne({ 'timeEntries._id': timeEntryId });
        if (!timeTrack) {
            return res.status(404).json({ success: false, message: 'Time entry not found' });
        }
        // hwello 
        // Get the specific time entry from the time tracking document
        const timeEntry = timeTrack.timeEntries.id(timeEntryId);
        if (!timeEntry) {
            return res.status(404).json({ success: false, message: 'Time entry not found' });
        }
        else {
            // Check if the filename already exists in any of the screenshots
            if (timeEntry.screenshots.some(screenshot => screenshot.key == filename)) {
                return res.status(200).json({ success: true, message: 'Filename already exists in one of the screenshots', filename: file.originalname, data: timeEntry });
            }
        }

        // Check if a file (screenshot) is provided in the request
        if (!file) {
            return res.status(400).json({ success: false, message: 'No file provided' });
        }

        // Upload the screenshot to AWS and get the URL
        const url = await aws.UploadToAws(file);
        const startTime = new Date(req.body.startTime)
        // Get the current date and time in the user's local time zone
        const userLocalNow = new Date(req.body.createdAt);

        // Get the current time as a string in 'hour:minute' format
        const currentTime = userLocalNow.toLocaleTimeString([], { hour: 'numeric', minute: 'numeric' });

        const createdAt = userLocalNow;

        const newVisitedUrl = {
            activityPercentage, // Use the provided activityPercentage
            // You can add other properties as needed
        };
        visitedUrls.push(newVisitedUrl);
        // Create an object for the added screenshot
        const addedScreenshot = {
            startTime: startTime,
            endTime: userLocalNow,
            key: url,
            description,
            time: currentTime,
            createdAt,
            visitedUrls,
        };
        console.log(addedScreenshot);
        // Push the screenshot to the time entry's screenshots array
        timeEntry.screenshots.push(addedScreenshot);
        if (timeEntry.endTime) {
            timeEntry.endTime = userLocalNow;
        }

        // Filter activities that overlap with the screenshot's createdAt time
        const splitActivities = timeEntry.activities.filter((activity) => {
            return activity.startTime <= createdAt && activity.endTime >= createdAt;
        });

        // If there are overlapping activities, update their endTime to the screenshot's createdAt time
        if (splitActivities.length > 0) {
            splitActivities.forEach((activity) => {
                activity.endTime = createdAt;
            });
        }

        // Save the updated time tracking document
        await timeTrack.save();

        var newTimeEntry = {
            key: url,
            description: description,
            time: currentTime,
            createdAt: createdAt,
            visitedUrls: visitedUrls,
            user_id: req.user._id,
            timeEntryId: timeEntryId
        };


        // Update the user's lastActive field to the current time
        await User.findByIdAndUpdate(
            req.user._id, {
            lastActive: userLocalNow,
            isActive: true,
        }, { new: true });

        const addedScreenshotId = timeEntry.screenshots[timeEntry.screenshots.length - 1]._id;
        // Return the success response with the screenshot URL and time
        // applying real time
        pusher.trigger("ss-track", "new-ss", {
            message: "new screenshots",
            data: newTimeEntry,
        });

        return res.status(200).json({
            success: true,
            id: addedScreenshotId,
            screenshot: url,
            time: currentTime,
            data: timeEntry,
            filename: file.originalname,
            message: 'Screenshot added successfully',
        });
    } catch (error) {
        console.error('Error adding screenshot:', error);
        return res.status(500).json({ success: false, message: 'Failed to add screenshot' });
    }
};


// The main API function to add a screenshot to a time entry
const addScreenshotold = async (req, res) => {
    const { timeEntryId } = req.params;
    const { description } = req.body;
    const file = req.file;

    try {
        // Find the time tracking document with the given time entry
        const timeTrack = await TimeTracking.findOne({ 'timeEntries._id': timeEntryId });
        if (!timeTrack) {
            return res.status(404).json({ success: false, message: 'Time entry not found' });
        }

        // Get the specific time entry from the time tracking document
        const timeEntry = timeTrack.timeEntries.id(timeEntryId);
        if (!timeEntry) {
            return res.status(404).json({ success: false, message: 'Time entry not found' });
        }

        // Check if a file (screenshot) is provided in the request
        if (!file) {
            return res.status(400).json({ success: false, message: 'No file provided' });
        }

        // Upload the screenshot to AWS and get the URL
        const url = await aws.UploadToAws(file);

        // Get the current date and time in the user's local time zone
        const userLocalNow = new Date();

        // Get the current time as a string in 'hour:minute' format
        const currentTime = userLocalNow.toLocaleTimeString([], { hour: 'numeric', minute: 'numeric' });

        const createdAt = userLocalNow;

        // Create an object for the added screenshot
        const addedScreenshot = {
            key: url,
            description,
            time: currentTime,
            createdAt,
        };
        console.log(addedScreenshot);
        // Push the screenshot to the time entry's screenshots array
        timeEntry.screenshots.push(addedScreenshot);

        // Filter activities that overlap with the screenshot's createdAt time
        const splitActivities = timeEntry.activities.filter((activity) => {
            return activity.startTime <= createdAt && activity.endTime >= createdAt;
        });

        // If there are overlapping activities, update their endTime to the screenshot's createdAt time
        if (splitActivities.length > 0) {
            splitActivities.forEach((activity) => {
                activity.endTime = createdAt;
            });
        }

        // Save the updated time tracking document
        await timeTrack.save();

        // Update the user's lastActive field to the current time
        await User.findByIdAndUpdate(req.user._id, { lastActive: new Date() });
        const addedScreenshotId = timeEntry.screenshots[timeEntry.screenshots.length - 1]._id;
        // Return the success response with the screenshot URL and time
        // io.emit('new_screenshot', addedScreenshot);
        return res.status(200).json({
            success: true,
            id: addedScreenshotId,
            screenshot: url,
            time: currentTime,
            message: 'Screenshot added successfully',
        });
    } catch (error) {
        console.error('Error adding screenshot:', error);
        return res.status(500).json({ success: false, message: 'Failed to add screenshot' });
    }
};








const getUserOnlineStatus = async (req, res) => {
    const userId = req.user._id;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    try {
        const timeTracking = await TimeTracking.findOne({
            userId,
            'timeEntries.startTime': { $gte: startOfToday, $lt: endOfToday },
        });

        if (!timeTracking) {
            return res.status(status.OK).json({ online: false });
        }

        const activeTimeEntry = timeTracking.timeEntries.find(entry => !entry.endTime);

        res.status(status.OK).json({ online: !!activeTimeEntry });
    } catch (error) {
        res.status(status.INTERNAL_SERVER_ERROR).json({
            Message: 'Error fetching online status',
            error,
        });
        console.error('Error finding online status:', error);
    }
};

const newDayEntry = async (req, res) => {

    const timeTracking = await TimeTracking.findOne({
        userId: req.user._id,
        'timeEntries._id': req.params.timeEntryId,
    });

    if (!timeTracking) {
        return res.status(404).json({ success: false, message: 'Time entry not found' });
    }

    // Find and update the specified time entry
    const activeTimeEntry = timeTracking.timeEntries.id(req.params.timeEntryId);
    if (!activeTimeEntry.endTime) {
        // Set the endTime to the current time (server-side)
        activeTimeEntry.endTime = new Date();

        if (activeTimeEntry.activities.length > 0) {
            const lastActivity = activeTimeEntry.activities[activeTimeEntry.activities.length - 1];
            // Set the endTime of the last activity to the current time (server-side)
            lastActivity.endTime = new Date();
        }

        // Save the time tracking document
        await timeTracking.save();
    }
}


const stopTracking = async (req, res) => {

    try {
        // Find the time tracking document containing the specified time entry
        const timeTracking = await TimeTracking.findOne({
            userId: req.user._id,
            'timeEntries._id': req.params.timeEntryId,
        });

        const user = await User.findById(req.user._id);

        if (!timeTracking) {
            return res.status(404).json({ success: false, message: 'Time entry not found' });
        }

        // Find and update the specified time entry
        const activeTimeEntry = timeTracking.timeEntries.id(req.params.timeEntryId);
        const lastScreenshot = activeTimeEntry.screenshots.slice(-1)[0]; // Get the last time entry
        if (!activeTimeEntry.endTime) {

            let endTime = new Date();;
            if (lastScreenshot) {
                endTime = new Date(lastScreenshot.createdAt)
            }
            else {
                endTime = new Date(activeTimeEntry.startTime)
            }

            if (endTime) {
                const endTimeValue = new Date(req.body.endTime);
                if (!isNaN(endTimeValue.getTime())) { // Check if endTimeValue is a valid date
                    activeTimeEntry.endTime = endTimeValue;
                } else {
                    activeTimeEntry.endTime = endTime;
                    // Handle the invalid format case accordingly
                }
            }
            else {
                activeTimeEntry.endTime = new Date(user.lastActive);
            }


            if (activeTimeEntry.activities.length > 0) {
                const lastActivity = activeTimeEntry.activities[activeTimeEntry.activities.length - 1];
                // Set the endTime of the last activity to the current time (server-side)
                if (endTime) {
                    lastActivity.endTime = new Date(req.body.endTime) ? new Date(req.body.endTime) : endTime;
                }
                else {
                    lastActivity.endTime = new Date(user.lastActive);
                }

            }

            // Save the time tracking document
            await timeTracking.save();

            // Assuming you have a User model defined in Mongoose
            // Find the user associated with this time entry


            if (user) {
                // Update the user's isActive field to false
                user.isActive = false;
                await user.save();
            }
            res.status(200).json({ success: true, data: timeTracking });
        } else {
            let endTime = 0;
            if (lastScreenshot) {
                endTime = new Date(lastScreenshot.createdAt)
            }
            // if (endTime) {
            //     activeTimeEntry.endTime = new Date(req.body.endTime) ? new Date(req.body.endTime) : endTime;
            // }
            activeTimeEntry.endTime = new Date(req.body.endTime) ? new Date(req.body.endTime) : endTime;
            await timeTracking.save();
            res.status(200).json({ success: true, message: 'Time entry already ended' });
        }
    } catch (error) {
        console.error('Error stopping time entry:', error);
        res.status(500).json({ success: false, message: 'Failed to stop time entry' });
    }
};


const getTimeAgo = (lastActiveTime) => {
    const currentTime = new Date();
    const timeDiffInMs = currentTime.getTime() - lastActiveTime.getTime();
    const minutesAgo = Math.floor(timeDiffInMs / (1000 * 60));
    const hoursAgo = Math.floor(timeDiffInMs / (1000 * 60 * 60));
    const daysAgo = Math.floor(timeDiffInMs / (1000 * 60 * 60 * 24));
    const monthsAgo = Math.floor(daysAgo / 30); // Calculate months

    if (minutesAgo < 60) {
        return minutesAgo !== 1 && minutesAgo >= 0 ? `${minutesAgo} minutes ago` : `a minute ago`;
    } else if (hoursAgo < 24) {
        return hoursAgo > 1 ? `${hoursAgo} hours ago` : `${hoursAgo} hour ago`;
    } else if (daysAgo < 30) {
        return daysAgo > 1 ? `${daysAgo} days ago` : `${daysAgo} day ago`;
    } else if (monthsAgo < 12) {
        return monthsAgo > 1 ? `${monthsAgo} months ago` : `${monthsAgo} month ago`;
    } else {
        const yearsAgo = Math.floor(monthsAgo / 12);
        return yearsAgo > 1 ? `${yearsAgo} years ago` : `${yearsAgo} year ago`;
    }
};



// const getSingleEvent = (req, res) => {
//     const { eid } = req.params;

//     EventSchema.findOne({ _id: eid })
//         .then(event => {
//             if (!event) {
//                 return res.status(status.NOT_FOUND).send({
//                     Message: 'Boat not found',
//                 });
//             }
//             return res.status(status.OK).send(event);
//         })
//         .catch(err => {
//             return res.status(status.INTERNAL_SERVER_ERROR).send({
//                 Message: 'Internal Server Error',
//                 err,
//             });
//         });
// };
const getMinutesAgo = (time) => {
    const currentTime = new Date().getTime();
    const timeDiff = currentTime - time;
    const minutesAgo = Math.abs(Math.round(timeDiff / (1000 * 60)));
    return minutesAgo;
};

async function retrieveScreenshotsForUser(userId) {
    try {
        let latestScreenshot = null
        const user = await User.findById(userId);

        const timeEntries = await TimeTracking.find({ userId })
            .populate({
                path: 'timeEntries',
                options: { sort: { startTime: -1 }, limit: 5 },
                populate: {
                    path: 'screenshots',
                }
            });
        if (timeEntries[0].timeEntries) {

        }

        if (!timeEntries[0].timeEntries || timeEntries[0].timeEntries.length === 0) {
            return null; // No time entries found for the user
        }
        timeEntries[0].timeEntries.sort((a, b) => {
            return new Date(b.startTime) - new Date(a.startTime);
        });

        for (const timeEntry of timeEntries[0].timeEntries) {
            if (timeEntry.screenshots && timeEntry.screenshots.length > 0) {
                // Get the last screenshot from the time entry
                const lastScreenshot = timeEntry.screenshots[timeEntry.screenshots.length - 1];
                latestScreenshot = lastScreenshot;

                // If the last screenshots are found, return and exit the loop
                return latestScreenshot;
            }
        }

        return latestScreenshot; // Return the latest screenshot or null if none found
    } catch (error) {
        console.error(error);
        return null; // Return null in case of any error
    }
}

const getUserScreenshot = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            console.log('User not found');
            return [];
        }

        const timeEntries = await TimeTracking.find({ userId })
            .populate({
                path: 'timeEntries',
                populate: {
                    path: 'screenshots',
                    options: { sort: { startTime: -1 }, limit: 2 }
                }
            });

        console.log('Time entries:', timeEntries);

        const endTime = 0;
        const allScreenshots = [];

        timeEntries.forEach((entry) => {
            entry.timeEntries.forEach((timeEntry) => {
                if (timeEntry.screenshots && timeEntry.screenshots.length > 0) {
                    const obj = {
                        allScreenshots: timeEntry.screenshots,
                        endTime: timeEntry.endTime || endTime, // Use timeEntry.endTime if available, otherwise use the default endTime
                    };
                    allScreenshots.push(obj);
                }
            });
        });

        console.log('All screenshots:', allScreenshots);

        if (allScreenshots.length === 0) {
            console.log('No screenshots found for the user');
            return [];
        }

        console.log('Most recent screenshot:', allScreenshots[0]);
        return [allScreenshots[0]]; // Return an array containing the most recent screenshot
    } catch (error) {
        console.error(error);
        return [];
    }
};


const getTotalHoursWorked = async (req, res) => {
    const userId = req.user._id;

    try {
        // Check if the user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const project = await ProjectSchema.findOne({ userId });

        let totalhours = 0;
        let hoursWorked = 0;
        let newHoursWorked = 0;
        let newTimeEntry = []
        let minutesAgo = 'Awaiting'
        // Get the user's last active time
        if (user.lastActive > user.createdAt) {
            const lastActiveTime = user.lastActive;
            minutesAgo = getTimeAgo(lastActiveTime);
        }

        console.log('idpassed:', userId);
        const lastScreenshot = await retrieveScreenshotsForUser(userId);
        // const lastScreenshot = await getUserScreenshot(userId);
        if (lastScreenshot) {
            console.log('Recent screenshot:', lastScreenshot);
        } else {
            console.log('No recent screenshot found.');
        }
        const ratePerHour = user.billingInfo ? user.billingInfo.ratePerHour : 0;

        const currentTime = new Date().getTime();
        const inactiveThreshold = 5 * 60 * 1000; // 5 minutes in milliseconds
        const isActive = user.isActive;


        // Get the start and end times for the current day, week, and month
        const now = new Date();
        const userDateTime = setHoursDifference(now, req.user.timezoneOffset, req.user.timezone)

        // Perform calculations in the standard time zone
        const startOfToday = userDateTime.startOf('day');
        const endOfToday = userDateTime.endOf('day');
        const startOfThisWeek = userDateTime.startOf('week');
        const startOfThisMonth = userDateTime.startOf('month');

        const startOfYesterday = userDateTime.minus({ days: 1 }).startOf('day'); // Subtract 1 day for yesterday
        const endOfYesterday = startOfYesterday.endOf('day'); // Start of today is the end of yesterday
        // Calculate endOfThisWeek
        const endOfThisWeek = userDateTime.endOf('week');

        // Calculate endOfThisMonth
        const endOfThisMonth = userDateTime.endOf('month');

        // const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        // const endOfToday = new Date(startOfToday);
        // endOfToday.setDate(startOfToday.getDate() + 1);
        // const startOfYesterday = new Date(startOfToday);
        // startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        // const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        // const endOfThisWeek = new Date(startOfThisWeek);
        // endOfThisWeek.setDate(startOfThisWeek.getDate() + 7); // 6 days added to the start of the week
        // const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        // const endOfThisMonth = new Date(startOfThisMonth);
        // endOfThisMonth.setMonth(startOfThisMonth.getMonth() + 1); // 1 month added to the start of the month
        // 0 day of the next month, which gives the last day of the current month

        // Get the timeTrackings
        const timeTrackings = await TimeTracking.find({ userId });

        // If there is no time tracking data for the user, return 0 for total hours and billing amounts
        if (!timeTrackings || timeTrackings.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    totalHours: {
                        daily: '0h 0m',
                        weekly: '0h 0m',
                        monthly: '0h 0m',
                        yesterday: '0h 0m'
                    },
                    billingAmounts: {
                        daily: 0,
                        weekly: 0,
                        monthly: 0,
                        yesterday: 0
                    },
                    lastActiveTime: `${minutesAgo}`,
                    lastScreenshot,
                    timezone: user.timezone,
                    isActive,
                    company: user.company,
                    email: user.email,
                    name: user.name,

                }
            });
        }

        const totalHoursWorked = {
            daily: 0,
            weekly: 0,
            monthly: 0,
            yesterday: 0,
        };

        for (const timeTracking of timeTrackings) {
            for (const timeEntry of timeTracking.timeEntries) {

                let startTime = DateTime.fromJSDate(timeEntry.startTime, { zone: req.user.timezone });

                let endTime = 0;
                if (timeEntry.endTime) {
                    endTime = DateTime.fromJSDate(timeEntry.endTime, { zone: req.user.timezone });
                } else {
                    const lastScreenshot = timeEntry.screenshots.slice(-1)[0];

                    if (lastScreenshot) {
                        endTime = DateTime.fromJSDate(lastScreenshot.createdAt, { zone: req.user.timezone });
                    } else {
                        // No screenshots in this timeEntry, skip it
                        continue;
                    }
                }
                if (startTime == endTime) {
                    continue;
                }
                if (startTime >= startOfToday && startTime < endOfToday && endTime > endOfToday) {
                    // Create a new time entry for the next day starting at 12:00 AM
                    newTimeEntry = { ...timeEntry };
                    newTimeEntry.startTime = endTime.startOf('day');

                    newTimeEntry.endTime = new Date(endTime);

                    // Modify the endTime of the original time entry to be 11:59:59.999 PM of the current day
                    // timeEntry.startTime = new Date(startTime);
                    // startTime = setHoursDifference(timeEntry.startTime, req.user.timezoneOffset, req.user.timezone)
                    timeEntry.endTime = startTime.endOf('day');
                    endTime = DateTime.fromJSDate(timeEntry.endTime, { zone: req.user.timezone });

                    // Calculate the hours worked for both time entries
                    hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                    newHoursWorked = (newTimeEntry.endTime - newTimeEntry.startTime) / (1000 * 60 * 60);

                    // Add hours worked to the appropriate time range (daily, weekly, monthly)
                    if (startTime >= startOfToday && startTime < endOfToday) {
                        totalHoursWorked.daily += hoursWorked;
                    }
                    if (newTimeEntry.startTime >= startOfToday && newTimeEntry.startTime < endOfToday) {
                        totalHoursWorked.daily += newHoursWorked;
                    }
                } else if (startTime < startOfToday && endTime >= startOfToday && endTime < endOfToday) {
                    newTimeEntry = { ...timeEntry };
                    newTimeEntry.startTime = new Date(startTime);
                    newTimeEntry.endTime = startTime.endOf('day');

                    // Modify the endTime of the original time entry to be 11:59:59.999 PM of the current day

                    timeEntry.startTime = endTime.startOf('day');
                    startTime = DateTime.fromJSDate(timeEntry.startTime, { zone: req.user.timezone });
                    // Calculate the hours worked for both time entries
                    hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                    //  (endTime - timeEntry.startTime) / (1000 * 60 * 60);

                    newHoursWorked = (newTimeEntry.endTime - newTimeEntry.startTime) / (1000 * 60 * 60);

                    // Add hours worked to the appropriate time range (daily, weekly, monthly)
                    if (newTimeEntry.startTime >= startOfToday && newTimeEntry.startTime < endOfToday) {
                        totalHoursWorked.daily += newHoursWorked;
                    }
                    // Add hours worked to the appropriate time range (daily, weekly, monthly)
                    if (startTime >= startOfToday && startTime < endOfToday) {
                        totalHoursWorked.daily += hoursWorked;
                    }

                } else {
                    // Calculate the hours worked using the corrected start and end times
                    hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                    newHoursWorked = 0;
                    // Add hours worked to the appropriate time range (daily, weekly, monthly)
                    if (startTime >= startOfToday && startTime < endOfToday) {
                        totalHoursWorked.daily += hoursWorked;
                    }
                }

                if (newTimeEntry.startTime >= startOfThisWeek && newTimeEntry.startTime < endOfThisWeek) {
                    totalHoursWorked.weekly += newHoursWorked;
                }

                if (startTime >= startOfThisWeek && startTime < endOfThisWeek) {
                    totalHoursWorked.weekly += hoursWorked;
                }

                if (startTime >= startOfThisMonth && startTime < endOfThisMonth) {
                    totalHoursWorked.monthly += hoursWorked;
                }
                if (newTimeEntry.startTime >= startOfThisMonth && newTimeEntry.startTime < endOfThisMonth) {
                    totalHoursWorked.monthly += newHoursWorked;
                }

                if (startTime >= startOfYesterday && startTime < endOfYesterday) {
                    totalHoursWorked.yesterday += hoursWorked;
                }
                if (newTimeEntry.startTime >= startOfYesterday && newTimeEntry.startTime < endOfYesterday) {
                    totalHoursWorked.yesterday += newHoursWorked;
                }
            }
        }
        const formatHours = (time) => {
            const hours = Math.floor(time);
            const minutes = Math.floor((time - hours) * 60);
            if (minutes === 60) {
                // If minutes are 60, increment the hour and set minutes to 0
                return `${hours + 1}h 0m`;
            } else {
                return `${hours}h ${minutes}m`;
            }
        };

        const formattedTotalHoursWorked = {
            daily: formatHours(totalHoursWorked.daily),
            weekly: formatHours(totalHoursWorked.weekly),
            monthly: formatHours(totalHoursWorked.monthly),
            yesterday: formatHours(totalHoursWorked.yesterday),
        };

        const billingAmounts = {
            daily: Math.abs(parseInt(ratePerHour * totalHoursWorked.daily)),
            weekly: Math.abs(parseInt(ratePerHour * totalHoursWorked.weekly)),
            monthly: Math.abs(parseInt(ratePerHour * totalHoursWorked.monthly)),
            yesterday: Math.abs(parseInt(ratePerHour * totalHoursWorked.yesterday)),
        };

        return res.status(200).json({
            success: true,
            data: {
                totalHours: formattedTotalHoursWorked,
                billingAmounts,
                lastActiveTime: `${minutesAgo}`,
                lastScreenshot,
                project,
                timezone: user.timezone,
                isActive,
                company: user.company,
                email: user.email,
                name: user.name,

            }
        });
    } catch (error) {
        console.error('Error getting total hours worked:', error);
        return res.status(500).json({ success: false, message: 'Failed to get total hours worked' });
    }
};
const getActivityData = async (req, res) => {
    const userId = req.user._id;

    try {
        // Check if the user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Get the start and end times for the current day, week, and month
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        const endOfThisWeek = new Date(startOfThisWeek);
        endOfThisWeek.setDate(startOfThisWeek.getDate() + 7); // 6 days added to the start of the week

        const startOfThisMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const endOfThisMonth = new Date(startOfThisMonth);
        endOfThisMonth.setMonth(startOfThisMonth.getMonth() + 1); // 1 month added to the start of the month
        // 0 day of the next month, which gives the last day of the current month

        // Get the timeTrackings
        const timeTrackings = await TimeTracking.find({ userId }).populate('timeEntries.screenshots timeEntries.visitedUrls');

        const activityData = {
            daily: { visitedUrls: [] },
            weekly: { visitedUrls: [] },
            monthly: { visitedUrls: [] },
            yesterday: { visitedUrls: [] },
        };

        for (const timeTracking of timeTrackings) {
            for (const timeEntry of timeTracking.timeEntries) {
                const startTime = new Date(timeEntry.startTime);

                if (startTime >= startOfToday) {
                    // activityData.daily.screenshots.push(...timeEntry.screenshots);
                    activityData.daily.visitedUrls.push(...timeEntry.visitedUrls);
                }

                if (startTime >= startOfThisWeek && startTime < endOfThisWeek) {
                    // activityData.weekly.screenshots.push(...timeEntry.screenshots);
                    activityData.weekly.visitedUrls.push(...timeEntry.visitedUrls);
                }

                if (startTime >= startOfThisMonth && startTime < endOfThisMonth) {
                    // activityData.monthly.screenshots.push(...timeEntry.screenshots);
                    activityData.monthly.visitedUrls.push(...timeEntry.visitedUrls);
                }

                if (startTime >= startOfYesterday && startTime < startOfToday) {
                    // activityData.yesterday.screenshots.push(...timeEntry.screenshots);
                    activityData.yesterday.visitedUrls.push(...timeEntry.visitedUrls);
                }
            }
        }

        return res.status(200).json({ success: true, data: activityData });
    } catch (error) {
        console.error('Error getting activity data:', error);
        return res.status(500).json({ success: false, message: 'Failed to get activity data' });
    }
};



const sortedScreenshots = async (req, res) => {
    try {
        const userId = req.user._id;
        const queryDate = req.query.date ? new Date(req.query.date) : new Date(); // Get the query date or default to today

        // Get the start and end times for the specified date
        const startOfDate = new Date(queryDate.getFullYear(), queryDate.getMonth(), queryDate.getDate());
        const endOfDate = new Date(startOfDate.getTime() + 24 * 60 * 60 * 1000);

        // Query the database to retrieve all timeEntries for the specific user
        const timeTrackings = await TimeTracking.find({ userId }).populate('userId');

        const allScreenshots = [];
        const userMap = new Map();

        timeTrackings.forEach((timeTracking) => {
            const user = timeTracking.userId;

            timeTracking.timeEntries.forEach((timeEntry) => {
                // Check if the time entry falls within the specified date
                if (timeEntry.startTime >= startOfDate && timeEntry.startTime < endOfDate) {
                    timeEntry.screenshots.forEach((screenshot) => {
                        const screenshotTime = screenshot.createdAt;
                        const screenshotHours = screenshotTime.getHours();
                        const screenshotMinutes = screenshotTime.getMinutes();
                        const amOrPmScreenshot = screenshotHours < 12 ? 'A.M' : 'P.M';
                        const adjustedScreenshotHours = screenshotHours % 12 || 12;

                        const screenshotWithTime = {
                            ...screenshot.toObject(),
                            time: `${String(adjustedScreenshotHours).padStart(2, '0')}:${String(screenshotMinutes).padStart(2, '0')} ${amOrPmScreenshot}`,
                        };

                        allScreenshots.push(screenshotWithTime);

                        if (!userMap.has(user._id)) {
                            userMap.set(user._id, {
                                userId: user._id,
                                userName: user.name,
                                userEmail: user.email,
                                timezone: user.timezone,
                                totalHours: {
                                    daily: { hours: 0, minutes: 0 },
                                    weekly: { hours: 0, minutes: 0 },
                                    monthly: { hours: 0, minutes: 0 },
                                },
                            });
                        }

                        const totalHoursWorked = userMap.get(user._id).totalHours;
                        const startTime = new Date(timeEntry.startTime);
                        const endTime = timeEntry.endTime ? new Date(timeEntry.endTime) : new Date();
                        const hoursWorked = (endTime - startTime) / (1000 * 60 * 60);

                        if (startTime >= startOfDate) {
                            totalHoursWorked.daily.hours += Math.floor(hoursWorked);
                            totalHoursWorked.daily.minutes += Math.round((hoursWorked % 1) * 60);
                        }

                        // Update the weekly and monthly hours based on the start time of the time entry
                        if (startTime >= startOfDate) {
                            totalHoursWorked.weekly.hours += Math.floor(hoursWorked);
                            totalHoursWorked.weekly.minutes += Math.round((hoursWorked % 1) * 60);
                        }

                        if (startTime >= startOfDate) {
                            totalHoursWorked.monthly.hours += Math.floor(hoursWorked);
                            totalHoursWorked.monthly.minutes += Math.round((hoursWorked % 1) * 60);
                        }
                    });
                }
            });
        });

        const timeSlotDurationInMinutes = 180;
        const groupedScreenshots = groupScreenshotsByTimeSlots(allScreenshots, timeSlotDurationInMinutes);

        // Return the grouped screenshots and user information separately in the response
        res.status(200).json({
            success: true,
            data: {
                screenshots: groupedScreenshots,
                users: [...userMap.values()],
            },
        });
    } catch (error) {
        console.error('Error getting sorted screenshots:', error);
        res.status(500).json({ success: false, message: 'Failed to get sorted screenshots' });
    }
};



function groupScreenshotsByTimeSlots(screenshots) {
    const groupedScreenshots = [];

    if (screenshots.length === 0) {
        return groupedScreenshots;
    }

    const firstScreenshot = screenshots[0];
    const lastScreenshot = screenshots[screenshots.length - 1];
    const startTime = new Date(firstScreenshot.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: 'numeric' });
    const endTime = new Date(lastScreenshot.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: 'numeric' });

    groupedScreenshots.push({
        time: `${startTime} - ${endTime}`,
        screenshots,
    });

    return groupedScreenshots;
}

function formatTimeFrame(startTime, endTime) {
    const formatHoursAndMinutes = (date) => {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const amOrPm = hours < 12 ? 'A.M' : 'P.M';
        const adjustedHours = hours % 12 || 12;
        return `${String(adjustedHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${amOrPm}`;
    };

    return `${formatHoursAndMinutes(startTime)} - ${formatHoursAndMinutes(endTime)}`;
}



function addHours(time, hours) {
    const [timeHours, timeMinutes] = time.split('h:');
    const [hoursToAdd, minutesToAdd] = getHoursAndMinutes(hours);
    const newHours = Number(timeHours) + hoursToAdd;
    const newMinutes = Number(timeMinutes) + minutesToAdd;
    return `${String(newHours).padStart(2, '0')}h:${String(newMinutes).padStart(2, '0')}m`;
}


function getHoursAndMinutes(decimalHours) {
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    return [hours, minutes];
}


const updateActivityData = async (req, res) => {
    const { visitedUrls } = req.body;
    const userId = req.user._id;
    try {
        const timeTracking = await TimeTracking.findOne({ userId });

        if (!timeTracking) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const currentTimeEntry = timeTracking.timeEntries[timeTracking.timeEntries.length - 1];
        currentTimeEntry.visitedUrls = visitedUrls;


        await timeTracking.save();

        res.status(200).json({ success: true, message: 'Activity data updated successfully' });
    } catch (error) {
        console.error('Error updating activity data:', error);
        res.status(500).json({ success: false, message: 'Failed to update activity data' });
    }
};

const calculateTotalHoursWorkedForDay = (timeTracking) => {
    let totalHoursWorked = 0;
    for (const entry of timeTracking.timeEntries) {
        for (const activity of entry.activities) {
            // Calculate the duration of the activity in milliseconds
            const activityDuration = new Date(activity.endTime) - new Date(activity.startTime);

            // Add the activity duration to the total time tracked for the day
            totalHoursWorked += activityDuration / (1000 * 60 * 60);
        }
    }
    return totalHoursWorked;
};

const deleteScreenshotAndDeductTime = async (req, res) => {
    try {
        const { screenshotId, timeTrackingId } = req.params;
        console.log(screenshotId, timeTrackingId);
        const timeTracking = await TimeTracking.findById(timeTrackingId);

        if (!timeTracking) {
            return res.status(404).json({ success: false, message: 'Time tracking not found' });
        }

        // Find the time entry containing the screenshot
        const timeEntry = timeTracking.timeEntries.find((entry) => {
            return entry.screenshots.some((screenshot) => screenshot._id.toString() === screenshotId);
        });

        if (!timeEntry) {
            return res.status(404).json({ success: false, message: 'Screenshot not found' });
        }

        // Find the screenshot and remove it from the time entry
        const screenshotIndex = timeEntry.screenshots.findIndex(
            (screenshot) => screenshot._id.toString() === screenshotId
        );

        if (screenshotIndex === -1) {
            return res.status(404).json({ success: false, message: 'Screenshot not found' });
        }

        const screenshot = timeEntry.screenshots[screenshotIndex];

        // Calculate the duration of the deleted screenshot in milliseconds
        const screenshotDuration = new Date(screenshot.endTime) - new Date(screenshot.startTime);

        // Create a deleted activity with the necessary fields
        const deletedActivity = {
            startTime: screenshot.startTime,
            endTime: screenshot.endTime,
            changeTime: new Date(),
            editedBy: req.user._id,
            scope: 'deleted',
            change: 'Screenshot deleted',
            historyChanges: [],
            offline: false,
            screenshots: screenshot,
        };

        // Add the deleted activity to the time entry
        timeEntry.activities.push(deletedActivity);

        // Find the index of the screenshot that is just before the specified index
        const indexBeforeSplit = screenshotIndex - 1;

        // Find the index of the screenshot that is just after the specified index
        const indexAfterSplit = screenshotIndex + 1;

        // Set endTime for the first part of the split
        const startTime = indexBeforeSplit >= 0 ? timeEntry.screenshots[indexBeforeSplit].endTime : timeEntry.startTime;

        // Set startTime for the second part of the split
        let endTime = indexAfterSplit < timeEntry.screenshots.length ? timeEntry.screenshots[indexAfterSplit].startTime : timeEntry.endTime;
        if (endTime == 'Invalid Date') {
            endTime = timeEntry.screenshots[indexAfterSplit].createdAt;
        }
        // Remove the screenshot from the time entry
        timeEntry.screenshots.splice(screenshotIndex, 1);

        let newTimeEntry = [];
        if (screenshotIndex !== -1) {

            newTimeEntry = { ...timeEntry };
            newTimeEntry.startTime = new Date(timeEntry.startTime);
            newTimeEntry.screenshots = timeEntry.screenshots.slice(0, screenshotIndex);
            newTimeEntry.endTime = new Date(startTime)

            // Adjust the endTime of the original timeEntry
            timeEntry.startTime = new Date(endTime);
            timeEntry.screenshots = timeEntry.screenshots.slice(screenshotIndex);
            // Now, foundTimeEntry contains screenshots up to endTime, and newTimeEntry contains screenshots after endTime

            timeTracking.timeEntries.push(newTimeEntry)
            timeTracking.timeEntries.sort((a, b) => a.startTime - b.startTime);
        }
        else {
            foundTimeEntry.startTime = null,
                foundTimeEntry.endTime = null
        }

        // Calculate the total time tracked for the day after deducting the screenshot duration
        let totalHoursWorked = calculateTotalHoursWorkedForDay(timeTracking);

        // Handle ongoing time entry
        if (!timeEntry.endTime) {
            let lastss = timeEntry.screenshots.slice(-1)[0];
            // Add 1 minute to the timeEntry.endTime to account for the screenshot deduction
            timeEntry.endTime = new Date(new Date(lastss.createdAt).getTime() + 60000);

            await timeTracking.save();

            return res.status(200).json({
                success: true,
                message: 'Screenshot deleted. The deducted time will be available when the ongoing session ends.',
                deletedActivity,
                deductedTime: null,
            });
        }

        // Handle completed time entry
        // Deduct the screenshot duration and 1 minute from the total time tracked for the day
        // eslint-disable-next-line no-const-assign
        totalHoursWorked -= (screenshotDuration + 60000) / (1000 * 60 * 60);

        // Save the updated time tracking document
        await timeTracking.save();

        return res.status(200).json({
            success: true,
            message: 'Screenshot deleted and time deducted',
            deletedActivity,
            deductedTime: formatTime(totalHoursWorked),
        });
    } catch (error) {
        console.error('Error deleting screenshot and deducting time:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete screenshot and deduct time', error: error });
    }
};

const formatTime = (time) => {
    const hours = Math.floor(time);
    const minutes = Math.round((time - hours) * 60);
    return `${hours}h ${minutes}m`;
};








const getMonthlyScreenshots = async (req, res) => {
    const userId = req.user._id;
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    try {
        const historyItems = await ScreenshotHistory.find({
            userId,
            createdAt: {
                $gte: startOfMonth,
                $lte: endOfMonth,
            },
        });

        const monthlyScreenshots = historyItems.map(item => item.screenshot);

        res.status(200).send(monthlyScreenshots);
    } catch (error) {
        console.error('Error retrieving monthly screenshots:', error);
        res.status(500).send({ message: 'Internal server error.' });
    }
};

// Helper function to format time in user's timezone
const formatTimeInUserTimezone = (time, userOffset) => {
    const timeInUserTimezone = new Date(time.getTime() + userOffset);
    const hours = timeInUserTimezone.getHours();
    const minutes = String(timeInUserTimezone.getMinutes()).padStart(2, '0');
    const period = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${formattedHours}:${minutes} ${period}`;
};


const deductScreenshotTime = (timeTracking, screenshotDuration) => {
    // Calculate the total time tracked for the day after deducting the screenshot duration
    const totalHoursWorked = calculateTotalHoursWorkedForDay(timeTracking);

    // Deduct the screenshot duration and 1 minute from the total time tracked for the day
    return totalHoursWorked - (screenshotDuration + 60000) / (1000 * 60 * 60);
};


const getTotalHoursWithOfflineAndScreenshots = async (req, res) => {
    const userId = req.user._id;
    const date = req.query.date ? new Date(req.query.date) : new Date();
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const ratePerHour = user.billingInfo ? user.billingInfo.ratePerHour : 0;

        const startOfToday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const endOfToday = new Date(startOfToday);
        endOfToday.setDate(startOfToday.getDate() + 1);
        const startOfThisWeek = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
        const endOfThisWeek = new Date(startOfThisWeek);
        endOfThisWeek.setDate(startOfThisWeek.getDate() + 7); // 6 days added to the start of the week

        const startOfThisMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const endOfThisMonth = new Date(startOfThisMonth);
        endOfThisMonth.setMonth(startOfThisMonth.getMonth() + 1); // 1 month added to the start of the month
        // 0 day of the next month, which gives the last day of the current month

        const timeTrackings = await TimeTracking.find({ userId });

        const totalHoursWorked = {
            daily: 0,
            weekly: 0,
            monthly: 0,
            offline: 0,
        };

        const groupedScreenshots = [];

        const now = new Date(); // Current time for handling ongoing time entries

        for (const timeTracking of timeTrackings) {
            for (const timeEntry of timeTracking.timeEntries) {
                let startTime = new Date(timeEntry.startTime);
                let endTime = timeEntry.endTime ? new Date(timeEntry.endTime) : now; // Use current time for ongoing entry

                // Check if endTime is earlier than startTime, and if so, swap them
                if (endTime < startTime) {
                    [startTime, endTime] = [endTime, startTime];
                }

                // Calculate the hours worked using the corrected start and end times
                const hoursWorked = (endTime - startTime) / (1000 * 60 * 60);

                // Check if the time entry is within today
                if (startTime >= startOfToday && startTime < endOfToday) {
                    totalHoursWorked.daily += hoursWorked;

                    // Check if the time entry has offline activities
                    // if (timeEntry.activities && timeEntry.activities.length > 0) {
                    //     const offlineActivities = timeEntry.activities.filter((activity) => activity.offline);
                    //     if (offlineActivities.length > 0) {
                    //         const offlineDuration = offlineActivities.reduce((total, activity) => {
                    //             const activityStartTime = new Date(activity.startTime);
                    //             const activityEndTime = new Date(activity.endTime);

                    //             // Only consider offline activities within today's range
                    //             if (activityStartTime >= startTime && activityEndTime >= startTime && activityEndTime < endTime) {
                    //                 return total + (activityEndTime - activityStartTime);
                    //             }

                    //             return total;
                    //         }, 0);

                    //         // Add the offline duration to the daily hours worked
                    //         totalHoursWorked.daily += offlineDuration / (1000 * 60 * 60);

                    //         for (const activity of offlineActivities) {
                    //             const activityStartTime = new Date(activity.startTime);
                    //             const activityEndTime = new Date(activity.endTime);
                    //             const timeRange = `${activityStartTime.toLocaleTimeString()} - ${activityEndTime.toLocaleTimeString()} (offline)`;

                    //             groupedScreenshots.push({ time: timeRange });
                    //         }
                    //     }
                    // }

                    // Check if the time entry has screenshots taken today
                    if (timeEntry.screenshots && timeEntry.screenshots.length > 0) {
                        const screenshotsToday = timeEntry.screenshots.filter((screenshot) => {
                            const screenshotTime = new Date(screenshot.createdAt);
                            return screenshotTime >= startOfToday && screenshotTime < endOfToday;
                        });

                        if (screenshotsToday.length > 0) {
                            const screenshotStartTime = startTime.toLocaleTimeString([], { hour: 'numeric', minute: 'numeric' });
                            const screenshotEndTime = endTime.toLocaleTimeString([], { hour: 'numeric', minute: 'numeric' });

                            const screenshotTimeRange = `${screenshotStartTime} - ${screenshotEndTime}`;


                            groupedScreenshots.push({
                                time: screenshotTimeRange,
                                timeentryId: timeEntry._id,
                                screenshots: screenshotsToday.map((screenshot) => ({
                                    _id: screenshot._id,
                                    key: screenshot.key,
                                    description: screenshot.description,
                                    time: new Date(screenshot.createdAt).toLocaleString([], { hour: 'numeric', minute: 'numeric', hour12: true }),
                                    trackingId: timeTracking._id,
                                    visitedUrls: screenshot.visitedUrls,
                                    activities: timeEntry.activities,
                                })),
                            });
                        }


                    }

                }

                if (startTime >= startOfThisWeek && startTime < endOfThisWeek) {
                    totalHoursWorked.weekly += hoursWorked;
                }

                if (startTime >= startOfThisMonth && startTime < endOfThisMonth) {
                    totalHoursWorked.monthly += hoursWorked;
                }
            }
        }
        // Check if a screenshot was deleted and deduct time if needed
        if (req.query.screenshotDeleted === 'true' && req.query.screenshotDuration) {
            const screenshotDuration = parseInt(req.query.screenshotDuration, 10);
            totalHoursWorked.daily = deductScreenshotTime(timeTrackings, screenshotDuration);
        }
        totalHoursWorked.daily = Math.max(totalHoursWorked.daily, 0);
        totalHoursWorked.weekly = Math.max(totalHoursWorked.weekly, 0);
        totalHoursWorked.monthly = Math.max(totalHoursWorked.monthly, 0);


        const formatTime = (time) => {
            const hours = Math.floor(time);
            const minutes = Math.floor((time - hours) * 60);
            if (minutes === 60) {
                // If minutes are 60, increment the hour and set minutes to 0
                return `${hours + 1}h 0m`;
            } else {
                return `${hours}h ${minutes}m`;
            }
        }

        const formattedTotalHoursWorked = {
            daily: formatTime(totalHoursWorked.daily),
            weekly: formatTime(totalHoursWorked.weekly),
            monthly: formatTime(totalHoursWorked.monthly),
        };

        return res.status(200).json({
            success: true,
            data: {
                totalHours: formattedTotalHoursWorked,
                billingAmounts: {
                    daily: Math.round(totalHoursWorked.daily * ratePerHour),
                    weekly: Math.round(totalHoursWorked.weekly * ratePerHour),
                    monthly: Math.round(totalHoursWorked.monthly * ratePerHour),
                },
                groupedScreenshots,
                timezone: user.timezone,
                name: user.name,
            },
        });
    } catch (error) {
        console.error('Error getting total hours and screenshots:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};












const splitActivity = async (req, res) => {
    try {
        const { timeEntryId, activityId, splitTime } = req.body;

        const timeTracking = await TimeTracking.findOne({
            _id: req.user._id,
            'timeEntries._id': timeEntryId,
        });

        if (!timeTracking) {
            return res.status(404).json({ success: false, message: 'Time entry not found' });
        }

        const timeEntry = timeTracking.timeEntries.id(timeEntryId);
        if (!timeEntry) {
            return res.status(404).json({ success: false, message: 'Time entry not found' });
        }

        const activity = timeEntry.activities.id(activityId);
        if (!activity) {
            return res.status(404).json({ success: false, message: 'Activity not found' });
        }

        const splitMoment = moment(splitTime, 'h:mm A');
        if (!splitMoment.isValid()) {
            return res.status(400).json({ success: false, message: 'Invalid split time format' });
        }
        const splitTimeISO = splitMoment.toISOString();

        const firstPartActivity = {
            startTime: activity.startTime,
            endTime: splitTimeISO,
            description: activity.description,
            changeTime: activity.changeTime,
            editedBy: req.user._id,
            scope: activity.scope,
            change: activity.change,
            projectId: activity.projectId,
            screenshots: activity.screenshots,
            historyChanges: [],
        };

        const secondPartActivity = {
            startTime: splitTimeISO,
            endTime: activity.endTime,
            description: activity.description,
            projectId: activity.projectId,
            screenshots: activity.screenshots,
            changeTime: activity.changeTime,
            editedBy: req.user._id,
            scope: activity.scope,
            change: activity.change,
            historyChanges: [],
        };

        activity.endTime = splitTimeISO;

        const currentTime = moment().format('h:mm A');

        const activityIndex = timeEntry.activities.findIndex((act) => act._id.equals(activityId));
        timeEntry.activities.splice(activityIndex, 1, firstPartActivity, secondPartActivity);

        const originalActivityChange = {
            changeTime: moment().toDate(),
            editedBy: req.user.name,
            previousData: {
                startTime: activity.startTime,
                endTime: activity.endTime,
                changeTime: activity.changeTime,
                editedBy: req.user._id,
                scope: activity.scope,
                change: activity.change,
                screenshots: activity.screenshots,
            },
        };

        activity.historyChanges.push(originalActivityChange);

        // Add history changes for the split activities
        const splitActivityChange = {
            changeTime: moment().toDate(),
            editedBy: req.user.name,
            previousData: {
                startTime: activity.startTime,
                endTime: splitTimeISO,
                changeTime: activity.changeTime,
                editedBy: req.user._id,
                scope: activity.scope,
                change: activity.change,
                screenshots: activity.screenshots,
            },
        };

        firstPartActivity.historyChanges.push(splitActivityChange);
        secondPartActivity.historyChanges.push(splitActivityChange);

        await timeTracking.save();

        return res.status(200).json({
            success: true,
            message: 'Activity split successfully',
            originalActivity: {
                startTime: activity.startTime,
                endTime: splitTimeISO,
                description: activity.description,
                projectId: activity.projectId,
                screenshots: activity.screenshots,
            },
            splitActivities: [firstPartActivity, secondPartActivity],
        });
    } catch (error) {
        console.error('Error splitting activity:', error);
        return res.status(500).json({ success: false, message: 'Failed to split activity' });
    }
};




const deleteActivity = async (req, res) => {
    try {
        const { timeTrackingId, activityId } = req.params;

        // Find the time tracking document by ID
        const timeTracking = await TimeTracking.findById(timeTrackingId);

        if (!timeTracking) {
            return res.status(404).json({ success: false, message: 'Time tracking document not found' });
        }

        // Find the activity to be deleted by ID
        const activity = timeTracking.timeEntries.find((activity) => activity._id.toString() === activityId);

        if (!activity) {
            return res.status(404).json({ success: false, message: 'Activity not found' });
        }

        // Remove the activity from the time tracking document
        timeTracking.timeEntries.pull(activityId);

        // Save the updated time tracking document
        await timeTracking.save();

        // Return success response
        res.json({ success: true, message: 'Activity deleted successfully' });
    } catch (error) {
        console.error('Error deleting activity:', error);
        res.status(500).json({ success: false, message: 'Failed to delete activity' });
    }
};

const getMonthlyRecordsold = async (req, res) => {
    const userId = req.user._id;
    const currentDate = new Date();

    const monthSpecifier = req.params.monthSpecifier; // Get the monthSpecifier from the URL parameter

    let monthStartDate; let monthEndDate;

    if (monthSpecifier === 'previous') {
        // Calculate the previous month number
        const previousMonthNumber = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        // Calculate the first and last dates of the previous month
        monthStartDate = new Date(currentYear, previousMonthNumber - 1, 1);
        monthEndDate = new Date(currentYear, previousMonthNumber, 0);
    } else if (monthSpecifier === 'this') {
        // Calculate the month number of the current date
        const currentMonthNumber = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        // Calculate the first and last dates of the current month
        monthStartDate = new Date(currentYear, currentMonthNumber, 1);
        monthEndDate = new Date(currentYear, currentMonthNumber + 1, 0);
    } else {
        return res.status(400).json({ success: false, message: 'Invalid month specifier' });
    }

    try {
        const totalMonthHours = await getTotalHoursForMonth(userId, monthStartDate, monthEndDate);

        return res.status(200).json({
            success: true,
            data: {
                monthSpecifier,
                totalMonth: formatTime(totalMonthHours),
            },
        });
    } catch (error) {
        console.error('Error getting monthly records:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getTotalHoursForMonthold = async (userId, monthStartDate, monthEndDate) => {
    const timeTrackings = await TimeTracking.find({ userId });

    let totalHours = 0;

    for (const timeTracking of timeTrackings) {
        for (const timeEntry of timeTracking.timeEntries) {
            const startTime = new Date(timeEntry.startTime);
            const endTime = timeEntry.endTime ? new Date(timeEntry.endTime) : new Date();

            // Check if the time entry overlaps with the specified month
            if (startTime <= monthEndDate && endTime >= monthStartDate) {
                const intervalStart = startTime < monthStartDate ? monthStartDate : startTime;
                const intervalEnd = endTime > monthEndDate ? monthEndDate : endTime;

                // Calculate the hours worked for this interval
                const hoursWorked = (intervalEnd - intervalStart) / (1000 * 60 * 60);
                totalHours += hoursWorked;
            }
        }
    }

    return totalHours;
};

const getTotalWorkingHoursForYear = async (req, res) => {

    try {
        const yearSpecifier = req.params.year || 'current'; // Default to current year if no year parameter is provided
        const userId = req.user._id;

        const year = (yearSpecifier.toLowerCase() === 'previous')
            ? new Date().getFullYear() - 1 // Calculate for the previous year
            : parseInt(yearSpecifier); // Use the provided year if it's a number

        console.log(year);
        const totalWorkingHoursByDay = await calculateTotalWorkingHoursForYear(userId, parseInt(year));
        return res.json({
            success: true,
            totalWorkingHoursByDay,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

const calculateTotalWorkingHoursForYear = async (userId, year) => {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year + 1, 0, 1);

    const timeTrackings = await TimeTracking.find({ userId });
    let totalWorkingHours = 0;

    for (const timeTracking of timeTrackings) {
        for (const timeEntry of timeTracking.timeEntries) {
            const startTime = new Date(timeEntry.startTime);
            const endTime = timeEntry.endTime ? new Date(timeEntry.endTime) : new Date();

            if (startTime >= startOfYear && startTime < endOfYear) {
                const hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                totalWorkingHours += hoursWorked;
            }
        }
    }

    const totalHours = Math.floor(totalWorkingHours);
    const totalMinutes = Math.round((totalWorkingHours - totalHours) * 60);
    const formattedTotalTime = `${totalHours}h ${totalMinutes}m`;

    return formattedTotalTime;

};

// Function to get the ISO week number of a date
const getWeekNumber = (date) => {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const jan4 = new Date(target.getFullYear(), 0, 4);
    const dayDiff = (target - jan4) / 86400000;
    return 1 + Math.ceil(dayDiff / 7);
};

// Function to get the first date of a week
const getFirstDateOfWeek = (year, week) => {
    const date = new Date(year, 0, 1);
    const daysToFirstDay = 1 - (date.getDay() || 7);
    const firstMonday = new Date(date.getTime() + daysToFirstDay * 24 * 60 * 60 * 1000);
    return new Date(firstMonday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
};

// Function to get the last date of a week
const getLastDateOfWeek = (year, week) => {
    const firstDate = getFirstDateOfWeek(year, week);
    const lastDate = new Date(firstDate.getTime() + 6 * 24 * 60 * 60 * 1000);
    return lastDate;
};

const getWeekRecords = async (userId, weekStartDate, weekEndDate) => {
    const timeTrackings = await TimeTracking.find({ userId });

    let totalWeeklyHours = 0;

    for (const timeTracking of timeTrackings) {
        for (const timeEntry of timeTracking.timeEntries) {
            const startTime = new Date(timeEntry.startTime);
            const endTime = timeEntry.endTime ? new Date(timeEntry.endTime) : new Date();

            if (startTime >= weekStartDate && endTime <= weekEndDate) {
                const hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                totalWeeklyHours += hoursWorked;
            }
        }
    }

    return totalWeeklyHours;
};

const getWeeklyRecordsold = async (req, res) => {
    const userId = req.user._id;
    const currentDate = new Date();

    const weekSpecifier = req.query.weekSpecifier; // Get the weekSpecifier from the URL parameter

    let weekStartDate; let weekEndDate;

    if (weekSpecifier === 'previous') {
        // Calculate the previous week number
        const previousWeekNumber = getWeekNumber(currentDate) - 1;
        const currentYear = currentDate.getFullYear();

        // Calculate the first and last dates of the previous week
        weekStartDate = getFirstDateOfWeek(currentYear, previousWeekNumber);
        weekEndDate = getLastDateOfWeek(currentYear, previousWeekNumber);
    } else if (weekSpecifier === 'this') {
        // Calculate the week number of the current date
        const currentWeekNumber = getWeekNumber(currentDate);
        const currentYear = currentDate.getFullYear();

        // Calculate the first and last dates of the current week
        weekStartDate = getFirstDateOfWeek(currentYear, currentWeekNumber);
        weekEndDate = getLastDateOfWeek(currentYear, currentWeekNumber);
    } else {
        return res.status(400).json({ success: false, message: 'Invalid week specifier' });
    }

    try {
        const totalWeekHours = await getTotalHoursForWeek(userId, weekStartDate, weekEndDate);

        return res.status(200).json({
            success: true,
            data: {
                weekSpecifier,
                totalWeek: formatTime(totalWeekHours),
            },
        });
    } catch (error) {
        console.error('Error getting weekly records:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getTotalHoursForWeekold = async (userId, weekStartDate, weekEndDate) => {
    const timeTrackings = await TimeTracking.find({ userId });

    let totalHours = 0;

    for (const timeTracking of timeTrackings) {
        for (const timeEntry of timeTracking.timeEntries) {
            const startTime = new Date(timeEntry.startTime);
            const endTime = timeEntry.endTime ? new Date(timeEntry.endTime) : new Date();

            // Check if the time entry overlaps with the specified week
            if (startTime <= weekEndDate && endTime >= weekStartDate) {
                const intervalStart = startTime < weekStartDate ? weekStartDate : startTime;
                const intervalEnd = endTime > weekEndDate ? weekEndDate : endTime;

                // Calculate the hours worked for this interval
                const hoursWorked = (intervalEnd - intervalStart) / (1000 * 60 * 60);
                totalHours += hoursWorked;
            }
        }
    }

    return totalHours;
};

const setHoursDifference = (starttToday, timezoneOffset, timezone) => {
    // var startOToday = '2023-10-20T00:00:00.000Z'
    var currentOffset = starttToday.getTimezoneOffset();
    var targetTimezoneOffset = timezoneOffset * 60;
    var timezoneDifference = targetTimezoneOffset + currentOffset;
    starttToday.setMinutes(starttToday.getMinutes() - timezoneDifference);
    const originalTime = DateTime.fromJSDate(starttToday);
    const convertedTime = originalTime.setZone(timezone);
    //  // Log the original and converted times
    return convertedTime;
}

const getTotalHoursWithOfflineAndScreenshotse = async (req, res) => {
    const userId = req.user._id;
    const date = req.query.date ? new Date(req.query.date) : new Date();

    const converttimezone = (time, timezone) => {

        const originalTime = DateTime.fromJSDate(time);
        const convertedTime = originalTime.setZone(timezone);
        return convertedTime;
    };

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const ratePerHour = user.billingInfo ? user.billingInfo.ratePerHour : 0;

        // Convert user input to the application's standard time zone
        const userDateTime = setHoursDifference(date, req.user.timezoneOffset, req.user.timezone)

        // Perform calculations in the standard time zone
        const startOfToday = userDateTime.startOf('day');
        const endOfToday = userDateTime.endOf('day');
        const startOfThisWeek = userDateTime.startOf('week');
        const startOfThisMonth = userDateTime.startOf('month');

        // Format and display the results in the user's preferred time zone
        const startOfTodayFormatted = startOfToday.setZone(req.user.timezone).toLocaleString();
        const endOfTodayFormatted = endOfToday.setZone(req.user.timezone).toLocaleString();
        // Calculate endOfThisWeek
        const endOfThisWeek = userDateTime.endOf('week');

        // Calculate endOfThisMonth
        const endOfThisMonth = userDateTime.endOf('month');
        // ...and so on for other calculations

        const timeTrackings = await TimeTracking.find({ userId });
        const activityData = {
            daily: { visitedUrls: [] },
            weekly: { visitedUrls: [] },
            monthly: { visitedUrls: [] },
        };
        const totalHoursWorked = {
            daily: 0,
            weekly: 0,
            monthly: 0,
            offline: 0,
        };
        let activityCount = 0;
        let totalActivity = 0;
        let newHoursWorked = 0;
        let TimeTrackingId = 0;
        let hoursWorked = 0;
        const groupedScreenshots = [];
        var newTimeEntry = [];

        // const now = new Date();
        const now = user.lastActive; // Current time for handling ongoing time entries

        for (const timeTracking of timeTrackings) {
            for (const timeEntry of timeTracking.timeEntries) {
                TimeTrackingId = timeTracking._id;
                let startTime = DateTime.fromJSDate(timeEntry.startTime, { zone: req.user.timezone });

                let endTime = 0;
                if (timeEntry.endTime) {
                    endTime = DateTime.fromJSDate(timeEntry.endTime, { zone: req.user.timezone });
                } else {
                    const lastScreenshot = timeEntry.screenshots.slice(-1)[0];

                    if (lastScreenshot) {
                        endTime = DateTime.fromJSDate(lastScreenshot.createdAt, { zone: req.user.timezone });
                    } else {
                        // No screenshots in this timeEntry, skip it
                        continue;
                    }
                }
                if (startTime == endTime) {
                    continue;
                }
                // let startTime = new Date(startconv);
                if (startTime >= startOfToday && startTime < endOfToday && endTime > endOfToday) {
                    // Create a new time entry for the next day starting at 12:00 AM
                    newTimeEntry = { ...timeEntry };
                    newTimeEntry.startTime = endTime.startOf('day');

                    newTimeEntry.endTime = new Date(endTime);

                    // Modify the endTime of the original time entry to be 11:59:59.999 PM of the current day
                    // timeEntry.startTime = new Date(startTime);
                    // startTime = setHoursDifference(timeEntry.startTime, req.user.timezoneOffset, req.user.timezone)
                    timeEntry.endTime = startTime.endOf('day');
                    endTime = DateTime.fromJSDate(timeEntry.endTime, { zone: req.user.timezone });

                    // Calculate the hours worked for both time entries
                    hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                    newHoursWorked = (newTimeEntry.endTime - newTimeEntry.startTime) / (1000 * 60 * 60);

                    // Add hours worked to the appropriate time range (daily, weekly, monthly)
                    if (startTime >= startOfToday && startTime < endOfToday) {
                        totalHoursWorked.daily += hoursWorked;
                    }
                    if (newTimeEntry.startTime >= startOfToday && newTimeEntry.startTime < endOfToday) {
                        totalHoursWorked.daily += newHoursWorked;
                    }
                } else if (startTime < startOfToday && endTime >= startOfToday && endTime < endOfToday) {
                    newTimeEntry = { ...timeEntry };
                    newTimeEntry.startTime = new Date(startTime);
                    newTimeEntry.endTime = startTime.endOf('day');

                    // Modify the endTime of the original time entry to be 11:59:59.999 PM of the current day

                    timeEntry.startTime = endTime.startOf('day');
                    startTime = DateTime.fromJSDate(timeEntry.startTime, { zone: req.user.timezone });
                    // Calculate the hours worked for both time entries
                    hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                    //  (endTime - timeEntry.startTime) / (1000 * 60 * 60);

                    newHoursWorked = (newTimeEntry.endTime - newTimeEntry.startTime) / (1000 * 60 * 60);

                    // Add hours worked to the appropriate time range (daily, weekly, monthly)
                    if (newTimeEntry.startTime >= startOfToday && newTimeEntry.startTime < endOfToday) {
                        totalHoursWorked.daily += newHoursWorked;
                    }
                    // Add hours worked to the appropriate time range (daily, weekly, monthly)
                    if (startTime >= startOfToday && startTime < endOfToday) {
                        totalHoursWorked.daily += hoursWorked;
                    }

                } else {
                    // Calculate the hours worked using the corrected start and end times
                    hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                    newHoursWorked = 0;
                    // Add hours worked to the appropriate time range (daily, weekly, monthly)
                    if (startTime >= startOfToday && startTime < endOfToday) {
                        totalHoursWorked.daily += hoursWorked;
                    }
                }
                let screenshotTimeRange = 0
                if (newTimeEntry.startTime >= startOfToday && newTimeEntry.startTime < endOfToday) {
                    const screenshotStartTime = startTime.toFormat('h:mm a');
                    const screenshotEndTime = endTime.toFormat('h:mm a');

                    if (timeEntry.description == 'offline') {
                        screenshotTimeRange = `${screenshotStartTime} - ${screenshotEndTime} (${timeEntry.description})`;
                        console.log('Range', screenshotTimeRange);
                        groupedScreenshots.push({
                            time: screenshotTimeRange,
                            description: 'This is manually added offline time',
                            timeentryId: timeEntry._id,
                        })
                    }

                }
                else if (startTime >= startOfToday && startTime < endOfToday) {
                    const screenshotStartTime = startTime.toFormat('h:mm a');
                    const screenshotEndTime = endTime.toFormat('h:mm a');

                    if (timeEntry.description == 'offline') {
                        screenshotTimeRange = `${screenshotStartTime} - ${screenshotEndTime} (${timeEntry.description})`;
                        console.log('Range', screenshotTimeRange);
                        groupedScreenshots.push({
                            time: screenshotTimeRange,
                            description: 'This is manually added offline time',
                            timeentryId: timeEntry._id,
                        })
                    }

                }
                // Check if the time entry has offline activities
                // if (timeEntry.activities && timeEntry.activities.length > 0) {
                //     const offlineActivities = timeEntry.activities.filter((activity) => activity.offline);
                //     if (offlineActivities.length > 0) {
                //         const offlineDuration = offlineActivities.reduce((total, activity) => {
                //             const activityStartTime = new Date(activity.startTime);
                //             const activityEndTime = new Date(activity.endTime);

                //             // Only consider offline activities within today's range
                //             if (activityStartTime >= startTime && activityEndTime >= startTime && activityEndTime < endTime) {
                //                 return total + (activityEndTime - activityStartTime);
                //             }

                //             return total;
                //         }, 0);

                //         // Add the offline duration to the daily hours worked
                //         totalHoursWorked.daily += offlineDuration / (1000 * 60 * 60);

                //         for (const activity of offlineActivities) {
                //             const activityStartTime = new Date(activity.startTime);
                //             const activityEndTime = new Date(activity.endTime);
                //             const timeRange = `${activityStartTime.toString()} - ${activityEndTime.toString()} (offline)`;
                //             // const timerangeconv = converttimezone(timeRange, usertimezone)

                //             groupedScreenshots.push({ time: timeRange });
                //         }

                //     }
                // }

                // Check if the time entry has screenshots taken today
                if (timeEntry.screenshots && timeEntry.screenshots.length > 0) {
                    console.log('Screenshots are available for processing.');
                    const screenshotsToday = timeEntry.screenshots.filter((screenshot) => {
                        const screenshotTime = converttimezone(screenshot.createdAt, req.user.timezone);

                        return screenshotTime >= startOfToday && screenshotTime < endOfToday;
                    });

                    console.log('Screenshots Today:', screenshotsToday); // Log the screenshots for debugging
                    console.log('visitedUrl', timeEntry.visitedUrls);

                    if (screenshotsToday.length > 0) {
                        console.log('Length of screenshotsToday:', screenshotsToday.length);

                        const screenshotStartTime = startTime.toFormat('h:mm a');
                        const screenshotEndTime = endTime.toFormat('h:mm a');

                        const screenshotTimeRange = `${screenshotStartTime} - ${screenshotEndTime}`;
                        console.log('Range', screenshotTimeRange);

                        // Map screenshots to screenshotDetails
                        const screenshotDetails = screenshotsToday.map((screenshot) => {
                            // console.log('Processing screenshot:', screenshot); // Log each screenshot for debugging
                            const convertedCreatedAt = converttimezone(screenshot.createdAt, req.user.timezone);

                            // Calculate the total activity for this screenshot
                            if (screenshot.visitedUrls && screenshot.visitedUrls.length > 0) {
                                totalActivity += screenshot.visitedUrls[0].activityPercentage || 0;
                                activityCount += 1;
                            }

                            return {
                                _id: screenshot._id,
                                key: screenshot.key,
                                description: screenshot.description,
                                time: convertedCreatedAt.toFormat('h:mm a'),
                                visitedUrls: screenshot.visitedUrls,
                            };
                        });
                        let totalcount = 0;
                        const totalActivityForScreenshots = screenshotDetails.reduce((total, screenshot) => {
                            // Check if visitedUrls and activityPercentage are defined
                            if (screenshot.visitedUrls && screenshot.visitedUrls[0] && screenshot.visitedUrls[0].activityPercentage !== undefined) {
                                return total + screenshot.visitedUrls[0].activityPercentage;
                            }
                            return total;
                        }, 0);

                        const maxPossibleActivity = 100 * screenshotDetails.length; // Assuming each screenshot can have a maximum activity of 100%

                        const totalActivityAsPercentage = totalActivityForScreenshots / screenshotDetails.length;

                        // Push screenshot data to groupedScreenshots along with totalactivity as a percentage
                        groupedScreenshots.push(
                            {
                                time: screenshotTimeRange,
                                screenshots: screenshotDetails,
                                totalactivity: totalActivityAsPercentage,
                                timeentryId: timeEntry._id,
                            }
                        );
                    }
                }

                // if (startTime >= startOfThisWeek && startTime < endOfThisWeek) {
                //     totalHoursWorked.weekly += hoursWorked;
                // }

                // if (startTime >= startOfThisMonth && startTime < endOfThisMonth) {
                //     totalHoursWorked.monthly += hoursWorked;
                // }
                if (startTime >= startOfThisWeek && startTime < endOfThisWeek) {
                    totalHoursWorked.weekly += hoursWorked;
                }
                if (newTimeEntry.startTime >= startOfThisWeek && newTimeEntry.startTime < endOfThisWeek) {
                    totalHoursWorked.weekly += newHoursWorked;
                }

                if (startTime >= startOfThisMonth && startTime < endOfThisMonth) {
                    totalHoursWorked.monthly += hoursWorked;
                }
                if (newTimeEntry.startTime >= startOfThisMonth && newTimeEntry.startTime < endOfThisMonth) {
                    totalHoursWorked.monthly += newHoursWorked;
                }


            }
        }

        totalHoursWorked.daily = Math.max(totalHoursWorked.daily, 0);
        totalHoursWorked.weekly = Math.max(totalHoursWorked.weekly, 0);
        totalHoursWorked.monthly = Math.max(totalHoursWorked.monthly, 0);


        const formatTime = (time) => {
            const hours = Math.floor(time);
            const minutes = Math.floor((time - hours) * 60);
            if (minutes === 60) {
                // If minutes are 60, increment the hour and set minutes to 0
                return `${hours + 1}h 0m`;
            } else {
                return `${hours}h ${minutes}m`;
            }
        };

        const formattedTotalHoursWorked = {
            daily: formatTime(totalHoursWorked.daily),
            weekly: formatTime(totalHoursWorked.weekly),
            monthly: formatTime(totalHoursWorked.monthly),
        };

        const totalActivityToday = activityCount > 0 ? (totalActivity / activityCount) : 0;
        console.log('Total Activity Today:', totalActivityToday + '%');

        return res.status(200).json({
            success: true,
            data: {
                totalHours: formattedTotalHoursWorked,
                billingAmounts: {
                    daily: Math.round(totalHoursWorked.daily * ratePerHour),
                    weekly: Math.round(totalHoursWorked.weekly * ratePerHour),
                    monthly: Math.round(totalHoursWorked.monthly * ratePerHour),
                },
                groupedScreenshots,
                totalactivity: totalActivityToday,
                timezone: user.timezone,
                name: user.name,
                email: user.email,
                usertype: user.userType,
                startOfToday: startOfToday,
                endOfToday: endOfToday,
                startOfThisWeek: startOfThisWeek,
                TimeTrackingId: TimeTrackingId,
            },
        });
    } catch (error) {
        console.error('Error getting total hours and screenshots:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const visitedurlSave = async (req, res) => {
    const timeEntryId = req.params.timeEntryId;
    const screenshotId = req.body.screenshotId; // Add a screenshotId to the request body
    const { activityPercentage } = req.body;

    try {
        // Find the specific time entry by its _id
        const timeTrack = await TimeTracking.findOne({ 'timeEntries._id': timeEntryId });

        if (!timeTrack) {
            return res.status(404).json({ success: false, message: 'Time entry not found' });
        }

        // Find the index of the time entry in the array
        const timeEntryIndex = timeTrack.timeEntries.findIndex(entry => entry._id.toString() === timeEntryId);

        if (timeEntryIndex === -1) {
            return res.status(404).json({ success: false, message: 'Time entry not found' });
        }

        // Find the specific screenshot within the time entry by its _id
        const screenshotIndex = timeTrack.timeEntries[timeEntryIndex].screenshots.findIndex(
            screenshot => screenshot._id.toString() === screenshotId
        );

        if (screenshotIndex === -1) {
            return res.status(404).json({ success: false, message: 'Screenshot not found' });
        }

        // Create a new visitedUrl object
        const newVisitedUrl = {
            activityPercentage, // Use the provided activityPercentage
            // You can add other properties as needed
        };

        // Push the newVisitedUrl to the visitedUrls array within the screenshot
        timeTrack.timeEntries[timeEntryIndex].screenshots[screenshotIndex].visitedUrls.push(newVisitedUrl);

        // Save the updated timeTrack document
        await timeTrack.save();

        return res.status(200).json({ success: true, data: newVisitedUrl });
    } catch (error) {
        console.error('Error updating visited URLs:', error);
        return res.status(500).json({ success: false, message: 'Failed to update visited URLs' });
    }
};

const getTotalHoursByDay = async (req, res) => {
    const userId = req.user._id;
    const date = req.query.date ? new Date(req.query.date) : new Date();

    const converttimezone = (time, timezone) => {

        const originalTime = DateTime.fromJSDate(time);
        const convertedTime = originalTime.setZone(timezone);
        return convertedTime;
    };

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Convert user input to the application's standard time zone
        const userDateTime = setHoursDifference(date, req.user.timezoneOffset, req.user.timezone)

        // Perform calculations in the standard time zone
        const startOfToday = userDateTime.startOf('day');
        const endOfToday = userDateTime.endOf('day');

        const timeTrackings = await TimeTracking.find({ userId });

        var newTimeEntry = [];
        const totalHoursByDay = [];

        const formatTime = (time) => {
            const hours = Math.floor(time);
            const minutes = Math.floor((time - hours) * 60);
            if (minutes === 60) {
                // If minutes are 60, increment the hour and set minutes to 0
                return `${hours + 1}h 0m`;
            } else {
                return `${hours}h ${minutes}m`;
            }
        };
        // const now = new Date();
        for (let i = 1; i <= userDateTime.daysInMonth; i++) {
            const currentDay = userDateTime.set({ day: i });

            // Calculate start and end of the current day
            const startOfDay = currentDay.startOf('day');
            const endOfDay = currentDay.endOf('day');

            // Initialize total hours worked for the current day
            let totalHoursForDay = 0;

            for (const timeTracking of timeTrackings) {
                for (const timeEntry of timeTracking.timeEntries) {
                    let startTime = DateTime.fromJSDate(timeEntry.startTime, { zone: req.user.timezone });

                    let endTime = 0;
                    if (timeEntry.endTime) {
                        endTime = DateTime.fromJSDate(timeEntry.endTime, { zone: req.user.timezone });
                    } else {
                        const lastScreenshot = timeEntry.screenshots.slice(-1)[0];

                        if (lastScreenshot) {
                            endTime = DateTime.fromJSDate(lastScreenshot.createdAt, { zone: req.user.timezone });
                        } else {
                            // No screenshots in this timeEntry, skip it
                            continue;
                        }
                    }
                    if (startTime == endTime) {
                        continue;
                    }
                    // let startTime = new Date(startconv);
                    if (startTime >= startOfToday && startTime < endOfToday && endTime > endOfToday) {
                        // Create a new time entry for the next day starting at 12:00 AM
                        newTimeEntry = { ...timeEntry };
                        newTimeEntry.startTime = endTime.startOf('day');

                        newTimeEntry.endTime = new Date(endTime);

                        // Modify the endTime of the original time entry to be 11:59:59.999 PM of the current day
                        // timeEntry.startTime = new Date(startTime);
                        // startTime = setHoursDifference(timeEntry.startTime, req.user.timezoneOffset, req.user.timezone)
                        timeEntry.endTime = startTime.endOf('day');
                        endTime = DateTime.fromJSDate(timeEntry.endTime, { zone: req.user.timezone });

                    } else if (startTime < startOfToday && endTime >= startOfToday && endTime < endOfToday) {
                        newTimeEntry = { ...timeEntry };
                        newTimeEntry.startTime = new Date(startTime);
                        newTimeEntry.endTime = startTime.endOf('day');

                        // Modify the endTime of the original time entry to be 11:59:59.999 PM of the current day

                        timeEntry.startTime = endTime.startOf('day');
                        startTime = DateTime.fromJSDate(timeEntry.startTime, { zone: req.user.timezone });


                    }
                    if (startTime >= startOfDay && startTime < endOfDay) {
                        // Calculate the hours worked for the time entry
                        const hoursWorkedd = (Math.min(endOfDay, endTime) - Math.max(startOfDay, startTime)) / (1000 * 60 * 60);
                        totalHoursForDay += Math.max(hoursWorkedd, 0);
                    }
                    if (newTimeEntry.startTime >= startOfDay && newTimeEntry.startTime < endOfDay) {
                        // Calculate the hours worked for the time entry
                        const hoursWorkedd = (Math.min(endOfDay, newTimeEntry.endTime) - Math.max(startOfDay, newTimeEntry.startTime)) / (1000 * 60 * 60);
                        totalHoursForDay += Math.max(hoursWorkedd, 0);
                    }

                }
            }
            // Add total hours for the current day to the array
            let dayhours = formatTime(Math.max(totalHoursForDay, 0))
            totalHoursByDay.push({
                date: currentDay.toFormat('d-L-yyyy'),
                totalHours: dayhours,
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                totalHoursByDay,
                timezone: user.timezone,
                name: user.name,
                email: user.email,
                usertype: user.userType,
                startOfToday: startOfToday,
                endOfToday: endOfToday,
            },
        });
    } catch (error) {
        console.error('Error getting total hours and screenshots:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ################################# REPORTS #################################
const getYearlyRecords = async (req, res) => {

    const user = await User.findById(req.user._id);

    const currentDate = new Date();
    const userCurrentDate = setHoursDifference(currentDate, req.user.timezoneOffset, req.user.timezone)

    const yearSpecifier = req.query.yearSpecifier; // Get the yearSpecifier from the URL parameter

    let yearStartDate; let yearEndDate;

    // Create a new date representing 7 days ago
    const lastYear = new Date(currentDate.getFullYear() - 1, 0, 1); // January 1st of the previous year

    const userLastYear = setHoursDifference(lastYear, req.user.timezoneOffset, req.user.timezone)

    if (yearSpecifier === 'previous') {
        // Calculate the previous year number

        yearStartDate = userLastYear.startOf('year');
        yearEndDate = userLastYear.endOf('year');
    } else if (yearSpecifier === 'this') {
        // Calculate the year number of the current dat

        yearStartDate = userCurrentDate.startOf('year');
        yearEndDate = userCurrentDate.endOf('year');
    } else {
        return res.status(400).json({ success: false, message: 'Invalid year specifier' });
    }

    try {
        let ReportPercentage = await getReportForYear(user, yearStartDate, yearEndDate, req.user.timezone)
        const totalYearHours = await getTotalHoursForYear(user, yearStartDate, yearEndDate, req.user.timezone);

        var totalhours = formatTime(totalYearHours.totalTimeHours)
        var allUsers = [
            { employee: user.name, Duration: totalhours, Activity: totalYearHours.totalActivityToday }
        ]
        return res.status(200).json({
            success: true,
            data: {
                yearSpecifier,
                allUsers: allUsers,
                totalHours: totalhours,
                totalActivity: totalYearHours.totalActivityToday,
                ReportPercentage: ReportPercentage
            },
        });
    } catch (error) {
        console.error('Error getting monthly records:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getReportForYear = async (user, yearStartDate, yearEndDate, timezone) => {

    // Assuming totalMatchValues is the sum of all matchvalues
    let totalMatchValues = 0;
    let ReportPercentage = [];
    const timeTrackings = await TimeTracking.find({ userId: user._id });
    for (const timeTracking of timeTrackings) {
        for (const timeEntry of timeTracking.timeEntries) {
            if (timeEntry.screenshots && timeEntry.screenshots.length > 0) {
                let startTime = DateTime.fromJSDate(timeEntry.startTime, { zone: timezone });
                let endTime = 0;
                if (timeEntry.endTime) {
                    endTime = DateTime.fromJSDate(timeEntry.endTime, { zone: timezone });
                } else {
                    const lastScreenshot = timeEntry.screenshots.slice(-1)[0];

                    if (lastScreenshot) {
                        endTime = DateTime.fromJSDate(lastScreenshot.createdAt, { zone: timezone });
                    } else {
                        // No screenshots in this timeEntry, skip it
                        continue;
                    }
                }
                if (startTime == endTime) {
                    continue;
                }
                if (startTime < yearStartDate && endTime < yearStartDate || startTime > yearEndDate) {
                    continue;
                }
                // else if (startTime > yearEndDate) {
                //     break;
                // }
                else {
                    for (const screenshot of timeEntry.screenshots) {
                        const screenshotTime = DateTime.fromJSDate(timeEntry.startTime, { zone: timezone });

                        if (screenshotTime >= yearStartDate && screenshotTime <= yearEndDate) {

                            const description = screenshot.description;

                            // Check if description is not in ReportPercentage
                            const existingIndex = ReportPercentage.findIndex(item => item.description === description);

                            if (existingIndex === -1) {
                                // If not in ReportPercentage, add it
                                ReportPercentage.push({ description, matchValue: 1 });
                                totalMatchValues += 1;  // Increment totalMatchValues
                            } else {
                                // If already in ReportPercentage, increment matchValue
                                ReportPercentage[existingIndex].matchValue++;
                                totalMatchValues++;  // Increment totalMatchValues
                            }

                            // if (screenshot.visitedUrls && screenshot.visitedUrls.length > 0) {
                            //     // Check if description is not in ReportPercentage
                            //     const url = screenshot.visitedUrls[0].url ? screenshot.visitedUrls[0].url : 'Google';
                            //     const existingIndexUrl = ReportPercentage.findIndex(item => item.description === url);

                            //     if (existingIndexUrl === -1) {
                            //         // If not in ReportPercentage, add it
                            //         ReportPercentage.push({ description: url, matchValue: 1 });
                            //         totalMatchValues += 1;  // Increment totalMatchValues
                            //     } else {
                            //         // If already in ReportPercentage, increment matchValue
                            //         ReportPercentage[existingIndexUrl].matchValue++;
                            //         totalMatchValues++;  // Increment totalMatchValues
                            //     }
                            // }
                        }
                        else if (screenshotTime > yearEndDate) {
                            break;
                        }
                    }
                }
            };
        }
    }
    // Calculate percentage

    const thresholdPercentage = 1;
    let indextoRemove = [];

    ReportPercentage.forEach((item, index) => {
        if (!item.percentage) {
            // Calculate percentage if not already calculated
            item.percentage = (item.matchValue * 100) / totalMatchValues;
        }

        if (item.percentage < thresholdPercentage) {
            indextoRemove.push(index);

            // Find the index of "Others"
            let indexOthers = ReportPercentage.findIndex((otherItem) => otherItem.description === 'Others');

            if (indexOthers === -1) {
                // If "Others" doesn't exist, create it
                ReportPercentage.push({
                    description: 'Others',
                    matchValue: item.matchValue,
                    percentage: item.percentage,
                });
            } else {
                // If "Others" exists, update its values
                if (!ReportPercentage[indexOthers].percentage) {
                    ReportPercentage[indexOthers].percentage = (ReportPercentage[indexOthers].matchValue * 100) / totalMatchValues;
                }
                else {
                    ReportPercentage[indexOthers].percentage += item.percentage;
                    ReportPercentage[indexOthers].matchValue += item.matchValue;
                }
            }
        }
    });

    // Create a new array without elements at the specified indices
    const newArray = ReportPercentage.filter((_, index) => !indextoRemove.includes(index));

    // Now, newArray contains the elements with percentage >= 2 and "Others" category
    console.log(newArray);

    return newArray;
};

const getTotalHoursForYear = async (user, yearStartDate, yearEndDate, timezone) => {

    let totalHours = 0;
    var newTimeEntry = [];
    let newHoursWorked = 0;
    let hoursWorked = 0;
    let activityCount = 0;
    let totalActivity = 0;

    const timeTrackings = await TimeTracking.find({ userId: user._id });
    for (const timeTracking of timeTrackings) {
        for (const timeEntry of timeTracking.timeEntries) {
            let startTime = DateTime.fromJSDate(timeEntry.startTime, { zone: timezone });

            let endTime = 0;
            if (timeEntry.endTime) {
                endTime = DateTime.fromJSDate(timeEntry.endTime, { zone: timezone });
            } else {
                const lastScreenshot = timeEntry.screenshots.slice(-1)[0];

                if (lastScreenshot) {
                    endTime = DateTime.fromJSDate(lastScreenshot.createdAt, { zone: timezone });
                } else {
                    // No screenshots in this timeEntry, skip it
                    continue;
                }
            }
            if (startTime == endTime) {
                continue;
            }
            // let startTime = new Date(startconv);
            if (startTime >= yearStartDate && startTime < yearEndDate && endTime > yearEndDate) {
                // Create a new time entry for the next day starting at 12:00 AM
                newTimeEntry = { ...timeEntry };
                newTimeEntry.startTime = endTime.startOf('day');

                newTimeEntry.endTime = new Date(endTime);

                timeEntry.endTime = startTime.endOf('day');
                endTime = DateTime.fromJSDate(timeEntry.endTime, { zone: timezone });

                // Calculate the hours worked for both time entries
                hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                newHoursWorked = (newTimeEntry.endTime - newTimeEntry.startTime) / (1000 * 60 * 60);

                // Add hours worked to the appropriate time range (daily, weekly, monthly)
                if (startTime >= yearStartDate && startTime < yearEndDate) {
                    totalHours += hoursWorked;
                }
                if (newTimeEntry.startTime >= yearStartDate && newTimeEntry.startTime < yearEndDate) {
                    totalHours += newHoursWorked;
                }
            } else if (startTime < yearStartDate && endTime >= yearStartDate && endTime < yearEndDate) {
                newTimeEntry = { ...timeEntry };
                newTimeEntry.startTime = new Date(startTime);
                newTimeEntry.endTime = startTime.endOf('day');

                // Modify the endTime of the original time entry to be 11:59:59.999 PM of the current day

                timeEntry.startTime = endTime.startOf('day');
                startTime = DateTime.fromJSDate(timeEntry.startTime, { zone: timezone });
                // Calculate the hours worked for both time entries
                hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                //  (endTime - timeEntry.startTime) / (1000 * 60 * 60);

                newHoursWorked = (newTimeEntry.endTime - newTimeEntry.startTime) / (1000 * 60 * 60);

                // Add hours worked to the appropriate time range (daily, weekly, monthly)
                if (newTimeEntry.startTime >= yearStartDate && newTimeEntry.startTime < yearEndDate) {
                    totalHours += newHoursWorked;
                }
                // Add hours worked to the appropriate time range (daily, weekly, monthly)
                if (startTime >= yearStartDate && startTime < yearEndDate) {
                    totalHours += hoursWorked;
                }

            } else {
                // Calculate the hours worked using the corrected start and end times
                hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                newHoursWorked = 0;
                // Add hours worked to the appropriate time range (daily, weekly, monthly)
                if (startTime >= yearStartDate && startTime < yearEndDate) {
                    totalHours += hoursWorked;
                }
            }
            // ############# calculating activity percentage ###############
            const screenshotsToday = timeEntry.screenshots.filter((screenshot) => {
                const screenshotTime = DateTime.fromJSDate(screenshot.createdAt, { zone: user.timezone });

                if (screenshotTime >= yearStartDate && screenshotTime < yearEndDate) {
                    // Calculate the total activity for this screenshot
                    if (screenshot.visitedUrls && screenshot.visitedUrls.length > 0) {
                        totalActivity += screenshot.visitedUrls[0].activityPercentage || 0;
                        activityCount += 1;
                    }
                }
            });
        }
    }

    const totalActivityToday = activityCount > 0 ? (totalActivity / activityCount) : 0;
    return {
        totalActivityToday: totalActivityToday,
        totalTimeHours: totalHours
    };
};

const getMonthlyRecords = async (req, res) => {

    const user = await User.findById(req.user._id);

    const currentDate = new Date();
    const userCurrentDate = setHoursDifference(currentDate, req.user.timezoneOffset, req.user.timezone)

    const monthSpecifier = req.query.monthSpecifier; // Get the monthSpecifier from the URL parameter

    let monthStartDate; let monthEndDate;

    // Create a new date representing 7 days ago
    const lastMonth = new Date();
    lastMonth.setDate(1);
    lastMonth.setDate(0);

    const userLastMonth = setHoursDifference(lastMonth, req.user.timezoneOffset, req.user.timezone)

    if (monthSpecifier === 'previous') {
        // Calculate the previous month number

        monthStartDate = userLastMonth.startOf('month');
        monthEndDate = userLastMonth.endOf('month');
    } else if (monthSpecifier === 'this') {
        // Calculate the month number of the current dat

        monthStartDate = userCurrentDate.startOf('month');
        monthEndDate = userCurrentDate.endOf('month');
    } else {
        return res.status(400).json({ success: false, message: 'Invalid Month specifier' });
    }

    try {
        let ReportPercentage = await getReportForMonth(user, monthStartDate, monthEndDate, req.user.timezone)
        const totalMonthHours = await getTotalHoursForMonth(user, monthStartDate, monthEndDate, req.user.timezone);

        var totalhours = formatTime(totalMonthHours.totalTimeHours)
        var allUsers = [
            { employee: user.name, Duration: totalhours, Activity: totalMonthHours.totalActivityToday }
        ]
        return res.status(200).json({
            success: true,
            data: {
                monthSpecifier,
                allUsers: allUsers,
                totalHours: totalhours,
                totalActivity: totalMonthHours.totalActivityToday,
                ReportPercentage: ReportPercentage
            },
        });
    } catch (error) {
        console.error('Error getting monthly records:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getReportForMonth = async (user, monthStartDate, monthEndDate, timezone) => {
    // Assuming totalMatchValues is the sum of all matchvalues
    let totalMatchValues = 0;
    let ReportPercentage = [];
    const timeTrackings = await TimeTracking.find({ userId: user._id });
    for (const timeTracking of timeTrackings) {
        for (const timeEntry of timeTracking.timeEntries) {
            if (timeEntry.screenshots && timeEntry.screenshots.length > 0) {
                let startTime = DateTime.fromJSDate(timeEntry.startTime, { zone: timezone });
                let endTime = 0;
                if (timeEntry.endTime) {
                    endTime = DateTime.fromJSDate(timeEntry.endTime, { zone: timezone });
                } else {
                    const lastScreenshot = timeEntry.screenshots.slice(-1)[0];

                    if (lastScreenshot) {
                        endTime = DateTime.fromJSDate(lastScreenshot.createdAt, { zone: timezone });
                    } else {
                        // No screenshots in this timeEntry, skip it
                        continue;
                    }
                }
                if (startTime == endTime) {
                    continue;
                }
                if (startTime < monthStartDate && endTime < monthStartDate || startTime > monthEndDate) {
                    continue;
                }
                // else if (startTime > monthEndDate) {
                //     break;
                // }
                else {
                    for (const screenshot of timeEntry.screenshots) {
                        const screenshotTime = DateTime.fromJSDate(timeEntry.startTime, { zone: timezone });

                        if (screenshotTime >= monthStartDate && screenshotTime <= monthEndDate) {

                            const description = screenshot.description;

                            // Check if description is not in ReportPercentage
                            const existingIndex = ReportPercentage.findIndex(item => item.description === description);

                            if (existingIndex === -1) {
                                // If not in ReportPercentage, add it
                                ReportPercentage.push({ description, matchValue: 1 });
                                totalMatchValues += 1;  // Increment totalMatchValues
                            } else {
                                // If already in ReportPercentage, increment matchValue
                                ReportPercentage[existingIndex].matchValue++;
                                totalMatchValues++;  // Increment totalMatchValues
                            }

                            // if (screenshot.visitedUrls && screenshot.visitedUrls.length > 0) {
                            //     // Check if description is not in ReportPercentage
                            //     const url = screenshot.visitedUrls[0].url ? screenshot.visitedUrls[0].url : 'Google';
                            //     const existingIndexUrl = ReportPercentage.findIndex(item => item.description === url);

                            //     if (existingIndexUrl === -1) {
                            //         // If not in ReportPercentage, add it
                            //         ReportPercentage.push({ description: url, matchValue: 1 });
                            //         totalMatchValues += 1;  // Increment totalMatchValues
                            //     } else {
                            //         // If already in ReportPercentage, increment matchValue
                            //         ReportPercentage[existingIndexUrl].matchValue++;
                            //         totalMatchValues++;  // Increment totalMatchValues
                            //     }
                            // }
                        }
                        else if (screenshotTime > monthEndDate) {
                            break;
                        }
                    }
                }
            };
        }
    }
    // Calculate percentage

    const thresholdPercentage = 1;
    let indextoRemove = [];

    ReportPercentage.forEach((item, index) => {
        if (!item.percentage) {
            // Calculate percentage if not already calculated
            item.percentage = (item.matchValue * 100) / totalMatchValues;
        }

        if (item.percentage < thresholdPercentage) {
            indextoRemove.push(index);

            // Find the index of "Others"
            let indexOthers = ReportPercentage.findIndex((otherItem) => otherItem.description === 'Others');

            if (indexOthers === -1) {
                // If "Others" doesn't exist, create it
                ReportPercentage.push({
                    description: 'Others',
                    matchValue: item.matchValue,
                    percentage: item.percentage,
                });
            } else {
                // If "Others" exists, update its values
                if (!ReportPercentage[indexOthers].percentage) {
                    ReportPercentage[indexOthers].percentage = (ReportPercentage[indexOthers].matchValue * 100) / totalMatchValues;
                }
                else {
                    ReportPercentage[indexOthers].percentage += item.percentage;
                    ReportPercentage[indexOthers].matchValue += item.matchValue;
                }
            }
        }
    });

    // Create a new array without elements at the specified indices
    const newArray = ReportPercentage.filter((_, index) => !indextoRemove.includes(index));

    // Now, newArray contains the elements with percentage >= 2 and "Others" category
    console.log(newArray);

    return newArray;
};

const getTotalHoursForMonth = async (user, monthStartDate, monthEndDate, timezone) => {

    let totalHours = 0;
    var newTimeEntry = [];
    let newHoursWorked = 0;
    let hoursWorked = 0;
    let activityCount = 0;
    let totalActivity = 0;
    const timeTrackings = await TimeTracking.find({ userId: user._id });
    for (const timeTracking of timeTrackings) {
        for (const timeEntry of timeTracking.timeEntries) {
            let startTime = DateTime.fromJSDate(timeEntry.startTime, { zone: timezone });

            let endTime = 0;
            if (timeEntry.endTime) {
                endTime = DateTime.fromJSDate(timeEntry.endTime, { zone: timezone });
            } else {
                const lastScreenshot = timeEntry.screenshots.slice(-1)[0];

                if (lastScreenshot) {
                    endTime = DateTime.fromJSDate(lastScreenshot.createdAt, { zone: timezone });
                } else {
                    // No screenshots in this timeEntry, skip it
                    continue;
                }
            }
            if (startTime == endTime) {
                continue;
            }
            // let startTime = new Date(startconv);
            if (startTime >= monthStartDate && startTime < monthEndDate && endTime > monthEndDate) {
                // Create a new time entry for the next day starting at 12:00 AM
                newTimeEntry = { ...timeEntry };
                newTimeEntry.startTime = endTime.startOf('day');

                newTimeEntry.endTime = new Date(endTime);

                timeEntry.endTime = startTime.endOf('day');
                endTime = DateTime.fromJSDate(timeEntry.endTime, { zone: timezone });

                // Calculate the hours worked for both time entries
                hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                newHoursWorked = (newTimeEntry.endTime - newTimeEntry.startTime) / (1000 * 60 * 60);

                // Add hours worked to the appropriate time range (daily, weekly, monthly)
                if (startTime >= monthStartDate && startTime < monthEndDate) {
                    totalHours += hoursWorked;
                }
                if (newTimeEntry.startTime >= monthStartDate && newTimeEntry.startTime < monthEndDate) {
                    totalHours += newHoursWorked;
                }
            } else if (startTime < monthStartDate && endTime >= monthStartDate && endTime < monthEndDate) {
                newTimeEntry = { ...timeEntry };
                newTimeEntry.startTime = new Date(startTime);
                newTimeEntry.endTime = startTime.endOf('day');

                // Modify the endTime of the original time entry to be 11:59:59.999 PM of the current day

                timeEntry.startTime = endTime.startOf('day');
                startTime = DateTime.fromJSDate(timeEntry.startTime, { zone: timezone });
                // Calculate the hours worked for both time entries
                hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                //  (endTime - timeEntry.startTime) / (1000 * 60 * 60);

                newHoursWorked = (newTimeEntry.endTime - newTimeEntry.startTime) / (1000 * 60 * 60);

                // Add hours worked to the appropriate time range (daily, weekly, monthly)
                if (newTimeEntry.startTime >= monthStartDate && newTimeEntry.startTime < monthEndDate) {
                    totalHours += newHoursWorked;
                }
                // Add hours worked to the appropriate time range (daily, weekly, monthly)
                if (startTime >= monthStartDate && startTime < monthEndDate) {
                    totalHours += hoursWorked;
                }

            } else {
                // Calculate the hours worked using the corrected start and end times
                hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                newHoursWorked = 0;
                // Add hours worked to the appropriate time range (daily, weekly, monthly)
                if (startTime >= monthStartDate && startTime < monthEndDate) {
                    totalHours += hoursWorked;
                }
            }
            // ############# calculating activity percentage ###############
            const screenshotsToday = timeEntry.screenshots.filter((screenshot) => {
                const screenshotTime = DateTime.fromJSDate(screenshot.createdAt, { zone: user.timezone });

                if (screenshotTime >= monthStartDate && screenshotTime < monthEndDate) {
                    // Calculate the total activity for this screenshot
                    if (screenshot.visitedUrls && screenshot.visitedUrls.length > 0) {
                        totalActivity += screenshot.visitedUrls[0].activityPercentage || 0;
                        activityCount += 1;
                    }
                }
            });
        }
    }

    const totalActivityToday = activityCount > 0 ? (totalActivity / activityCount) : 0;
    return {
        totalActivityToday: totalActivityToday,
        totalTimeHours: totalHours
    };
};

const getWeeklyRecords = async (req, res) => {

    const user = await User.findById(req.user._id);

    const currentDate = new Date();
    // Create a new date representing 7 days ago
    const sevenDaysAgo = new Date(currentDate);
    sevenDaysAgo.setDate(currentDate.getDate() - 7);
    const weekSpecifier = req.query.weekSpecifier; // Get the weekSpecifier from the URL parameter

    let weekStartDate; let weekEndDate;
    const userSevenDaysAgo = setHoursDifference(sevenDaysAgo, req.user.timezoneOffset, req.user.timezone)
    const userCurrentDate = setHoursDifference(currentDate, req.user.timezoneOffset, req.user.timezone)

    if (weekSpecifier === 'previous') {
        // Calculate the previous week number
        const previousWeekNumber = getWeekNumber(currentDate) - 1;
        const currentYear = currentDate.getFullYear();

        // Calculate the first and last dates of the previous week
        weekStartDate = userSevenDaysAgo.startOf('week');
        weekEndDate = userSevenDaysAgo.endOf('week');
    } else if (weekSpecifier === 'this') {
        // Calculate the week number of the current date
        const currentWeekNumber = getWeekNumber(currentDate);
        const currentYear = currentDate.getFullYear();

        // Calculate the first and last dates of the current week
        weekStartDate = userCurrentDate.startOf('week');
        weekEndDate = userCurrentDate.endOf('week');
    } else {
        return res.status(400).json({ success: false, message: 'Invalid week specifier' });
    }

    try {
        let ReportPercentage = await getReportForWeek(user, weekStartDate, weekEndDate, req.user.timezone)
        const totalWeekHours = await getTotalHoursForWeek(user, weekStartDate, weekEndDate, req.user.timezone);
        var totalhours = formatTime(totalWeekHours.totalTimeHours)
        var allUsers = [
            { employee: user.name, Duration: totalhours, Activity: totalWeekHours.totalActivityToday }
        ]
        return res.status(200).json({
            success: true,
            data: {
                weekSpecifier,
                allUsers: allUsers,
                totalHours: totalhours,
                totalActivity: totalWeekHours.totalActivityToday,
                ReportPercentage: ReportPercentage
            },
        });
    } catch (error) {
        console.error('Error getting weekly records:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getReportForWeek = async (user, weekStartDate, weekEndDate, timezone) => {
    // Assuming totalMatchValues is the sum of all matchvalues
    let totalMatchValues = 0;
    let ReportPercentage = [];
    const timeTrackings = await TimeTracking.find({ userId: user._id });

    for (const timeTracking of timeTrackings) {
        for (const timeEntry of timeTracking.timeEntries) {
            if (timeEntry.screenshots && timeEntry.screenshots.length > 0) {
                let startTime = DateTime.fromJSDate(timeEntry.startTime, { zone: timezone });
                let endTime = 0;
                if (timeEntry.endTime) {
                    endTime = DateTime.fromJSDate(timeEntry.endTime, { zone: timezone });
                } else {
                    const lastScreenshot = timeEntry.screenshots.slice(-1)[0];

                    if (lastScreenshot) {
                        endTime = DateTime.fromJSDate(lastScreenshot.createdAt, { zone: timezone });
                    } else {
                        // No screenshots in this timeEntry, skip it
                        continue;
                    }
                }
                if (startTime == endTime) {
                    continue;
                }
                if (startTime < weekStartDate && endTime < weekStartDate || startTime > weekEndDate) {
                    continue;
                }
                // else if (startTime > weekEndDate) {
                //     break;
                // }
                else {
                    for (const screenshot of timeEntry.screenshots) {
                        const screenshotTime = DateTime.fromJSDate(timeEntry.startTime, { zone: timezone });

                        if (screenshotTime >= weekStartDate && screenshotTime <= weekEndDate) {

                            const description = screenshot.description;

                            // Check if description is not in ReportPercentage
                            const existingIndex = ReportPercentage.findIndex(item => item.description === description);

                            if (existingIndex === -1) {
                                // If not in ReportPercentage, add it
                                ReportPercentage.push({ description, matchValue: 1 });
                                totalMatchValues += 1;  // Increment totalMatchValues
                            } else {
                                // If already in ReportPercentage, increment matchValue
                                ReportPercentage[existingIndex].matchValue++;
                                totalMatchValues++;  // Increment totalMatchValues
                            }

                            // if (screenshot.visitedUrls && screenshot.visitedUrls.length > 0) {
                            //     // Check if description is not in ReportPercentage
                            //     const url = screenshot.visitedUrls[0].url ? screenshot.visitedUrls[0].url : 'Google';
                            //     const existingIndexUrl = ReportPercentage.findIndex(item => item.description === url);

                            //     if (existingIndexUrl === -1) {
                            //         // If not in ReportPercentage, add it
                            //         ReportPercentage.push({ description: url, matchValue: 1 });
                            //         totalMatchValues += 1;  // Increment totalMatchValues
                            //     } else {
                            //         // If already in ReportPercentage, increment matchValue
                            //         ReportPercentage[existingIndexUrl].matchValue++;
                            //         totalMatchValues++;  // Increment totalMatchValues
                            //     }
                            // }
                        }
                        else if (screenshotTime > weekEndDate) {
                            break;
                        }
                    }
                }
            };
        }
    }
    // Calculate percentage

    const thresholdPercentage = 1;
    let indextoRemove = [];

    ReportPercentage.forEach((item, index) => {
        if (!item.percentage) {
            // Calculate percentage if not already calculated
            item.percentage = (item.matchValue * 100) / totalMatchValues;
        }

        if (item.percentage < thresholdPercentage) {
            indextoRemove.push(index);

            // Find the index of "Others"
            let indexOthers = ReportPercentage.findIndex((otherItem) => otherItem.description === 'Others');

            if (indexOthers === -1) {
                // If "Others" doesn't exist, create it
                ReportPercentage.push({
                    description: 'Others',
                    matchValue: item.matchValue,
                    percentage: item.percentage,
                });
            } else {
                // If "Others" exists, update its values
                if (!ReportPercentage[indexOthers].percentage) {
                    ReportPercentage[indexOthers].percentage = (ReportPercentage[indexOthers].matchValue * 100) / totalMatchValues;
                }
                else {
                    ReportPercentage[indexOthers].percentage += item.percentage;
                    ReportPercentage[indexOthers].matchValue += item.matchValue;
                }
            }
        }
    });

    // Create a new array without elements at the specified indices
    const newArray = ReportPercentage.filter((_, index) => !indextoRemove.includes(index));

    // Now, newArray contains the elements with percentage >= 2 and "Others" category
    console.log(newArray);

    return newArray;
};

const getTotalHoursForWeek = async (user, weekStartDate, weekEndDate, timezone) => {

    let totalHours = 0;
    var newTimeEntry = [];
    let newHoursWorked = 0;
    let hoursWorked = 0;
    let activityCount = 0;
    let totalActivity = 0;
    const timeTrackings = await TimeTracking.find({ userId: user._id });
    for (const timeTracking of timeTrackings) {
        for (const timeEntry of timeTracking.timeEntries) {
            let startTime = DateTime.fromJSDate(timeEntry.startTime, { zone: timezone });

            let endTime = 0;
            if (timeEntry.endTime) {
                endTime = DateTime.fromJSDate(timeEntry.endTime, { zone: timezone });
            } else {
                const lastScreenshot = timeEntry.screenshots.slice(-1)[0];

                if (lastScreenshot) {
                    endTime = DateTime.fromJSDate(lastScreenshot.createdAt, { zone: timezone });
                } else {
                    // No screenshots in this timeEntry, skip it
                    continue;
                }
            }
            if (startTime == endTime) {
                continue;
            }
            // let startTime = new Date(startconv);
            if (startTime >= weekStartDate && startTime < weekEndDate && endTime > weekEndDate) {
                // Create a new time entry for the next day starting at 12:00 AM
                newTimeEntry = { ...timeEntry };
                newTimeEntry.startTime = endTime.startOf('day');

                newTimeEntry.endTime = new Date(endTime);

                timeEntry.endTime = startTime.endOf('day');
                endTime = DateTime.fromJSDate(timeEntry.endTime, { zone: timezone });

                // Calculate the hours worked for both time entries
                hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                newHoursWorked = (newTimeEntry.endTime - newTimeEntry.startTime) / (1000 * 60 * 60);

                // Add hours worked to the appropriate time range (daily, weekly, monthly)
                if (startTime >= weekStartDate && startTime < weekEndDate) {
                    totalHours += hoursWorked;
                }
                if (newTimeEntry.startTime >= weekStartDate && newTimeEntry.startTime < weekEndDate) {
                    totalHours += newHoursWorked;
                }
            } else if (startTime < weekStartDate && endTime >= weekStartDate && endTime < weekEndDate) {
                newTimeEntry = { ...timeEntry };
                newTimeEntry.startTime = new Date(startTime);
                newTimeEntry.endTime = startTime.endOf('day');

                // Modify the endTime of the original time entry to be 11:59:59.999 PM of the current day

                timeEntry.startTime = endTime.startOf('day');
                startTime = DateTime.fromJSDate(timeEntry.startTime, { zone: timezone });
                // Calculate the hours worked for both time entries
                hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                //  (endTime - timeEntry.startTime) / (1000 * 60 * 60);

                newHoursWorked = (newTimeEntry.endTime - newTimeEntry.startTime) / (1000 * 60 * 60);

                // Add hours worked to the appropriate time range (daily, weekly, monthly)
                if (newTimeEntry.startTime >= weekStartDate && newTimeEntry.startTime < weekEndDate) {
                    totalHours += newHoursWorked;
                }
                // Add hours worked to the appropriate time range (daily, weekly, monthly)
                if (startTime >= weekStartDate && startTime < weekEndDate) {
                    totalHours += hoursWorked;
                }

            } else {
                // Calculate the hours worked using the corrected start and end times
                hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                newHoursWorked = 0;
                // Add hours worked to the appropriate time range (daily, weekly, monthly)
                if (startTime >= weekStartDate && startTime < weekEndDate) {
                    totalHours += hoursWorked;
                }
            }
            // ############# calculating activity percentage ###############
            const screenshotsToday = timeEntry.screenshots.filter((screenshot) => {
                const screenshotTime = DateTime.fromJSDate(screenshot.createdAt, { zone: user.timezone });

                if (screenshotTime >= weekStartDate && screenshotTime < weekEndDate) {
                    // Calculate the total activity for this screenshot
                    if (screenshot.visitedUrls && screenshot.visitedUrls.length > 0) {
                        totalActivity += screenshot.visitedUrls[0].activityPercentage || 0;
                        activityCount += 1;
                    }
                }
            });
        }
    }

    const totalActivityToday = activityCount > 0 ? (totalActivity / activityCount) : 0;
    return {
        totalActivityToday: totalActivityToday,
        totalTimeHours: totalHours
    };
};

const getDailyRecords = async (req, res) => {

    const user = await User.findById(req.user._id);

    const now = new Date();
    const userDateTime = setHoursDifference(now, req.user.timezoneOffset, req.user.timezone)

    const daySpecifier = req.query.daySpecifier; // Get the daySpecifier from the URL parameter

    let dayStartTime; let dayEndTime;

    if (daySpecifier === 'previous') {

        // Calculate the first and last dates of the previous day
        dayStartTime = userDateTime.minus({ days: 1 }).startOf('day'); // Subtract 1 day for yesterday
        dayEndTime = dayStartTime.endOf('day'); // Start of today is the end of yesterday

    } else if (daySpecifier === 'this') {

        dayStartTime = userDateTime.startOf('day');
        dayEndTime = userDateTime.endOf('day');

    } else if (req.query.startDate || req.query.endDate) {
        if (!req.query.startDate || !req.query.endDate) {
            return res.status(400).json({ success: false, message: 'Please select both startDate and endDate' });
        }
        let daysStart = convertDate(req.query.startDate, req.user.timezoneOffset, req.user.timezone)
        let daysEnd = convertDate(req.query.endDate, req.user.timezoneOffset, req.user.timezone)
        dayStartTime = daysStart.startOf('day')

        dayEndTime = daysEnd.endOf('day');

    }
    else {
        return res.status(400).json({ success: false, message: 'Invalid Day specifier' });
    }

    try {
        let ReportPercentage = await getReportForDay(user, dayStartTime, dayEndTime, req.user.timezone)
        const totalTimeHours = await getTotalHoursForDay(user, dayStartTime, dayEndTime, req.user.timezone);
        var totalhours = formatTime(totalTimeHours.totalTimeHours)
        var allUsers = [
            { employee: user.name, Duration: totalhours, Activity: totalTimeHours.totalActivityToday }
        ]
        return res.status(200).json({
            success: true,
            data: {
                daySpecifier,
                totalHours: totalhours,
                allUsers: allUsers,
                totalActivity: totalTimeHours.totalActivityToday,
                ReportPercentage: ReportPercentage
            },
        });
    } catch (error) {
        console.error('Error getting weekly records:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getReportForDay = async (user, dayStartTime, dayEndTime, timezone) => {
    let totalMatchValues = 0;
    let ReportPercentage = [];
    const timeTrackings = await TimeTracking.find({ userId: user._id });
    // Assuming totalMatchValues is the sum of all matchvalues

    for (const timeTracking of timeTrackings) {
        for (const timeEntry of timeTracking.timeEntries) {
            if (timeEntry.screenshots && timeEntry.screenshots.length > 0) {
                let startTime = DateTime.fromJSDate(timeEntry.startTime, { zone: timezone });
                let endTime = 0;
                if (timeEntry.endTime) {
                    endTime = DateTime.fromJSDate(timeEntry.endTime, { zone: timezone });
                } else {
                    const lastScreenshot = timeEntry.screenshots.slice(-1)[0];

                    if (lastScreenshot) {
                        endTime = DateTime.fromJSDate(lastScreenshot.createdAt, { zone: timezone });
                    } else {
                        // No screenshots in this timeEntry, skip it
                        continue;
                    }
                }
                if (startTime == endTime) {
                    continue;
                }
                if (startTime < dayStartTime && endTime < dayStartTime || startTime > dayEndTime) {
                    continue;
                }
                // else if (startTime > dayEndTime) {
                //     break;
                // }
                else {
                    for (const screenshot of timeEntry.screenshots) {
                        const screenshotTime = DateTime.fromJSDate(timeEntry.startTime, { zone: timezone });

                        if (screenshotTime >= dayStartTime && screenshotTime <= dayEndTime) {

                            const description = screenshot.description;

                            // Check if description is not in ReportPercentage
                            const existingIndex = ReportPercentage.findIndex(item => item.description === description);

                            if (existingIndex === -1) {
                                // If not in ReportPercentage, add it
                                ReportPercentage.push({ description, matchValue: 1 });
                                totalMatchValues += 1;  // Increment totalMatchValues
                            } else {
                                // If already in ReportPercentage, increment matchValue
                                ReportPercentage[existingIndex].matchValue++;
                                totalMatchValues++;  // Increment totalMatchValues
                            }

                            // if (screenshot.visitedUrls && screenshot.visitedUrls.length > 0) {
                            //     // Check if description is not in ReportPercentage
                            //     const url = screenshot.visitedUrls[0].url ? screenshot.visitedUrls[0].url : 'Google';
                            //     const existingIndexUrl = ReportPercentage.findIndex(item => item.description === url);

                            //     if (existingIndexUrl === -1) {
                            //         // If not in ReportPercentage, add it
                            //         ReportPercentage.push({ description: url, matchValue: 1 });
                            //         totalMatchValues += 1;  // Increment totalMatchValues
                            //     } else {
                            //         // If already in ReportPercentage, increment matchValue
                            //         ReportPercentage[existingIndexUrl].matchValue++;
                            //         totalMatchValues++;  // Increment totalMatchValues
                            //     }
                            // }
                        }
                        else if (screenshotTime > dayEndTime) {
                            break;
                        }
                    }
                }
            };
        }
    }
    // Calculate percentage

    const thresholdPercentage = 1;
    let indextoRemove = [];

    ReportPercentage.forEach((item, index) => {
        if (!item.percentage) {
            // Calculate percentage if not already calculated
            item.percentage = (item.matchValue * 100) / totalMatchValues;
        }

        if (item.percentage < thresholdPercentage) {
            indextoRemove.push(index);

            // Find the index of "Others"
            let indexOthers = ReportPercentage.findIndex((otherItem) => otherItem.description === 'Others');

            if (indexOthers === -1) {
                // If "Others" doesn't exist, create it
                ReportPercentage.push({
                    description: 'Others',
                    matchValue: item.matchValue,
                    percentage: item.percentage,
                });
            } else {
                // If "Others" exists, update its values
                if (!ReportPercentage[indexOthers].percentage) {
                    ReportPercentage[indexOthers].percentage = (ReportPercentage[indexOthers].matchValue * 100) / totalMatchValues;
                }
                else {
                    ReportPercentage[indexOthers].percentage += item.percentage;
                    ReportPercentage[indexOthers].matchValue += item.matchValue;
                }
            }
        }
    });

    // Create a new array without elements at the specified indices
    const newArray = ReportPercentage.filter((_, index) => !indextoRemove.includes(index));

    // Now, newArray contains the elements with percentage >= 2 and "Others" category
    console.log(newArray);

    return newArray;
};

const getTotalHoursForDay = async (user, dayStartTime, dayEndTime, timezone) => {
    let totalHours = 0;
    var newTimeEntry = [];
    let newHoursWorked = 0;
    let hoursWorked = 0;
    let activityCount = 0;
    let totalActivity = 0;
    const timeTrackings = await TimeTracking.find({ userId: user._id });

    for (const timeTracking of timeTrackings) {
        for (const timeEntry of timeTracking.timeEntries) {
            let startTime = DateTime.fromJSDate(timeEntry.startTime, { zone: timezone });

            let endTime = 0;
            if (timeEntry.endTime) {
                endTime = DateTime.fromJSDate(timeEntry.endTime, { zone: timezone });
            } else {
                const lastScreenshot = timeEntry.screenshots.slice(-1)[0];

                if (lastScreenshot) {
                    endTime = DateTime.fromJSDate(lastScreenshot.createdAt, { zone: timezone });
                } else {
                    // No screenshots in this timeEntry, skip it
                    continue;
                }
            }
            if (startTime == endTime) {
                continue;
            }
            // let startTime = new Date(startconv);
            if (startTime >= dayStartTime && startTime < dayEndTime && endTime > dayEndTime) {
                // Create a new time entry for the next day starting at 12:00 AM
                newTimeEntry = { ...timeEntry };
                newTimeEntry.startTime = endTime.startOf('day');

                newTimeEntry.endTime = new Date(endTime);

                timeEntry.endTime = startTime.endOf('day');
                endTime = DateTime.fromJSDate(timeEntry.endTime, { zone: timezone });

                // Calculate the hours worked for both time entries
                hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                newHoursWorked = (newTimeEntry.endTime - newTimeEntry.startTime) / (1000 * 60 * 60);

                // Add hours worked to the appropriate time range (daily, weekly, monthly)
                if (startTime >= dayStartTime && startTime < dayEndTime) {
                    totalHours += hoursWorked;
                }
                if (newTimeEntry.startTime >= dayStartTime && newTimeEntry.startTime < dayEndTime) {
                    totalHours += newHoursWorked;
                }
            } else if (startTime < dayStartTime && endTime >= dayStartTime && endTime < dayEndTime) {
                newTimeEntry = { ...timeEntry };
                newTimeEntry.startTime = new Date(startTime);
                newTimeEntry.endTime = startTime.endOf('day');

                // Modify the endTime of the original time entry to be 11:59:59.999 PM of the current day

                timeEntry.startTime = endTime.startOf('day');
                startTime = DateTime.fromJSDate(timeEntry.startTime, { zone: timezone });
                // Calculate the hours worked for both time entries
                hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                //  (endTime - timeEntry.startTime) / (1000 * 60 * 60);

                newHoursWorked = (newTimeEntry.endTime - newTimeEntry.startTime) / (1000 * 60 * 60);

                // Add hours worked to the appropriate time range (daily, weekly, monthly)
                if (newTimeEntry.startTime >= dayStartTime && newTimeEntry.startTime < dayEndTime) {
                    totalHours += newHoursWorked;
                }
                // Add hours worked to the appropriate time range (daily, weekly, monthly)
                if (startTime >= dayStartTime && startTime < dayEndTime) {
                    totalHours += hoursWorked;
                }

            } else {
                // Calculate the hours worked using the corrected start and end times
                hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                newHoursWorked = 0;
                // Add hours worked to the appropriate time range (daily, weekly, monthly)
                if (startTime >= dayStartTime && startTime < dayEndTime) {
                    totalHours += hoursWorked;
                }
            }
            // ############# calculating activity percentage ###############
            const screenshotsToday = timeEntry.screenshots.filter((screenshot) => {
                const screenshotTime = DateTime.fromJSDate(screenshot.createdAt, { zone: user.timezone });

                if (screenshotTime >= dayStartTime && screenshotTime < dayEndTime) {
                    // Calculate the total activity for this screenshot
                    if (screenshot.visitedUrls && screenshot.visitedUrls.length > 0) {
                        totalActivity += screenshot.visitedUrls[0].activityPercentage || 0;
                        activityCount += 1;
                    }
                }
            });
        }
    }
    const totalActivityToday = activityCount > 0 ? (totalActivity / activityCount) : 0;
    return {
        totalActivityToday: totalActivityToday,
        totalTimeHours: totalHours
    };
};

function convertDate(date, timezoneOffset, timeZone) {
    const newDate = new Date(date);
    let dateToday = moment(newDate).utcOffset(timezoneOffset).tz(timeZone);
    return dateToday;
}

export default { getDailyTimetracking, getTotalHoursWithOfflineAndScreenshotse, visitedurlSave, getWeeklyRecords, getMonthlyRecords, getTotalWorkingHoursForYear, addNewTracking, deleteActivity, updateActivityData, getTotalHoursWithOfflineAndScreenshots, deleteScreenshotAndDeductTime, getActivityData, stopTracking, updatedFile, updateAppUrl, addScreenshotab, addScreenshot, splitActivity, getTotalHoursWorked, getUserOnlineStatus, sortedScreenshots, getMonthlyScreenshots, getTotalHoursByDay, getYearlyRecords, getDailyRecords };