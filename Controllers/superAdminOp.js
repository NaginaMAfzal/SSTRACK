/* eslint-disable no-const-assign */
/* eslint-disable no-loop-func */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */
/* eslint-disable new-cap */
/* eslint-disable no-param-reassign */
/* eslint-disable no-continue */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-unused-vars */
/* eslint-disable no-plusplus */
/* eslint-disable import/newline-after-import */
/* eslint-disable no-shadow */
/* eslint-disable radix */
/* eslint-disable object-shorthand */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-underscore-dangle */
import status from 'http-status';
import moment from 'moment';
import generateUniqueId from 'generate-unique-id';
import mongoose from 'mongoose';
import { DateTime } from 'luxon';

import EventSchema from '../Models/eventSchema';
import Project from '../Models/projectSchema';
import User from '../Models/userSchema';
import TimeTracking from '../Models/timeSchema';
import EmployeeSettings from '../Models/effectiveSettingSchema';
import ScreenshotHistory from '../Models/screenshotHistorySchema';
import Timetracking from './Timetracking';
import userSchema from '../Models/userSchema';







const getProjects = (req, res) => {
    Project.find()
        .populate('userId', 'name') // This populates 'userId' and retrieves 'name' field from the User document.
        .then(projects => {
            res.status(200).send(projects);
        })
        .catch(err => {
            res.status(500).send({
                message: 'Unable to retrieve projects.',
                err,
            });
        });
};
const countEmployeesInProject = async (req, res) => {
    const { projectId } = req.params;
    try {
        // Find the project by its ID (using lean() and select() optimizations)
        const project = await Project.findById(projectId).lean().select('_id');

        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        // Count the employees associated with the project
        const employeeCount = await User.countDocuments({ projectId: project._id });

        // Update the project with the employee count
        project.employeeCount = employeeCount;

        return res.status(200).json({ success: true, employeeCount });
    } catch (error) {
        console.error('Error counting employees in project:', error);
        return res.status(500).json({ success: false, message: 'Failed to count employees' });
    }
};



const getAllClients = (req, res) => {
    User.find({ userType: 'cilent' })
        .then(clients => {
            if (clients.length === 0) {
                return res.status(404).json({ message: 'No clients found' });
            }
            res.status(200).json(clients);
        })
        .catch(error => {
            console.error('Error retrieving clients:', error);
            res.status(500).json({ message: 'Unable to retrieve clients' });
        });
};

const getAllemployees = (req, res) => {
    const pageSize = 100; // Define the size of each chunk
    const { page } = req.query;

    // Calculate the starting index for the chunk
    const startIndex = (page - 1) * pageSize;

    User.find()
        .skip(startIndex)
        .limit(pageSize)
        .then((employees) => {
            res.status(200).json({ employees });
        })
        .catch((error) => {
            console.error('Error retrieving employees:', error);
            res.status(500).json({ message: 'Failed to retrieve employees' });
        });
};

const addProjects = (req, res) => {

    const { name, description } = req.body;

    const project = new Project({
        name,
        description,

    });
    project
        .save()
        .then(savedEvent => {
            res.status(status.OK).send({
                savedEvent,
                Message: 'Event Created Successfully',
                type: status.Ok,
            });
        })
        .catch(err => {
            res.status(status.INTERNAL_SERVER_ERROR).send({
                Message: status.INTERNAL_SERVER_ERROR,
                err,
            });
        });
};

const deleteEvent = (req, res) => {
    const { id } = req.params;
    EventSchema.findByIdAndRemove(id, (err, result) => {
        if (result) {
            res.status(status.OK).send({
                Message: 'Event Deleted Successfully.',
            });
        } else {
            res.status(status.INTERNAL_SERVER_ERROR).send({
                Message: 'Unable to Delete.',
                err,
            });
        }
    });
};

const editEvent = (req, res) => {
    const { id } = req.params;
    const query = { $set: req.body };
    EventSchema.findByIdAndUpdate(id, query, { new: true }, (err, result) => {
        if (err) {
            res.status(status.INTERNAL_SERVER_ERROR).send({
                Message: 'Unable to Update.',
            });
        } else {
            res.status(status.OK).send({
                Message: 'Successfully Updated.',
                result,
            });
        }
    });
};

const getUsersStatus = async (req, res) => {
    try {
        const users = await User.find({});
        const now = new Date();
        const inactiveThreshold = 5 * 60 * 1000; // 5 minutes in milliseconds
        const result = users.map(user => {
            const lastActiveTime = user.lastActive.getTime();
            const timeDiff = now.getTime() - lastActiveTime;
            const isActive = user.isActive;
            return { id: user._id, isActive };
        });
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error getting users status:', error);
        return res.status(500).json({ success: false, message: 'Failed to get users status' });
    }
};

// Helper function to calculate total hours
const getTotalHours = (timeEntries, lastActive) => {
    const totalMilliseconds = timeEntries.reduce((acc, entry) => {
        if (entry.timeEntries.startTime) {
            const endTime = entry.timeEntries.endTime ? entry.timeEntries.endTime : new Date();
            const timeWorked = endTime - entry.timeEntries.startTime;
            return acc + timeWorked;
        }
        return acc;
    }, 0);

    return totalMilliseconds / (1000 * 60 * 60);
};


const getSingleEvent = (req, res) => {
    const { eid } = req.params;

    Project.findOne({ _id: eid }).populate('userId', 'name')
        .then(event => {
            if (!event) {
                return res.status(status.NOT_FOUND).send({
                    Message: ' not found',
                });
            }
            return res.status(status.OK).send(event);
        })
        .catch(err => {
            return res.status(status.INTERNAL_SERVER_ERROR).send({
                Message: 'Internal Server Error',
                err,
            });
        });
};
const getUsersWorkingToday = async (req, res) => {
    try {
        // Get all users
        const users = await User.find();
        if (!users) {
            return res.status(404).json({ success: false, message: 'No users found' });
        }

        // Get the start and end times for today
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(startOfToday.getTime() + (24 * 60 * 60 * 1000));

        const startOfYesterday = new Date(startOfToday.getTime() - (24 * 60 * 60 * 1000));
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Format hours function
        const formatHours = (hoursDecimal) => {
            const hours = Math.floor(hoursDecimal);
            const minutes = Math.round((hoursDecimal - hours) * 60);
            return `${hours}h ${minutes}m`;
        };

        // Filter the users who worked today
        const usersWorkingToday = await Promise.all(users.map(async (user) => {
            const workedToday = await TimeTracking.aggregate([
                { $match: { userId: user._id } },
                { $unwind: '$timeEntries' },
                { $match: { 'timeEntries.startTime': { $gte: startOfToday, $lt: endOfToday } } },
            ]);

            const workedYesterday = await TimeTracking.aggregate([
                { $match: { userId: user._id } },
                { $unwind: '$timeEntries' },
                { $match: { 'timeEntries.startTime': { $gte: startOfYesterday, $lt: startOfToday } } },
            ]);

            const workedThisWeek = await TimeTracking.aggregate([
                { $match: { userId: user._id } },
                { $unwind: '$timeEntries' },
                { $match: { 'timeEntries.startTime': { $gte: startOfWeek, $lt: endOfToday } } },
            ]);

            const workedThisMonth = await TimeTracking.aggregate([
                { $match: { userId: user._id } },
                { $unwind: '$timeEntries' },
                { $match: { 'timeEntries.startTime': { $gte: startOfMonth, $lt: endOfToday } } },
            ]);

            const totalHoursWorkedToday = formatHours(getTotalHours(workedToday, user.lastActive));
            const totalHoursWorkedYesterday = formatHours(getTotalHours(workedYesterday));
            const totalHoursWorkedThisWeek = formatHours(getTotalHours(workedThisWeek));
            const totalHoursWorkedThisMonth = formatHours(getTotalHours(workedThisMonth));

            // Get the user's online status
            const lastActiveTime = user.lastActive.getTime();
            const currentTime = new Date().getTime();
            const timeDiff = currentTime - lastActiveTime;
            const inactiveThreshold = 5 * 60 * 1000; // 5 minutes in milliseconds
            const isActive = user.isActive;
            const activeStatus = isActive ? 'Active' : `${Math.round(timeDiff / 60000)} minutes ago`;

            return {
                _id: user._id,
                name: user.name,
                email: user.email,
                isActive: isActive,
                isArchived: user.isArchived,
                activeStatus: activeStatus,
                totalHoursWorkedToday: totalHoursWorkedToday,
                totalHoursWorkedYesterday: totalHoursWorkedYesterday,
                totalHoursWorkedThisWeek: totalHoursWorkedThisWeek,
                totalHoursWorkedThisMonth: totalHoursWorkedThisMonth
            };
        }));

        // Get the count of employees worked today and their online status
        const totalEmployees = usersWorkingToday.length;
        const activeEmployees = usersWorkingToday.filter(user => user.isActive).length;

        return res.status(200).json({
            success: true,
            data: {
                usersWorkingToday: usersWorkingToday,
                totalEmployees: totalEmployees,
                activeEmployees: activeEmployees,
            },
        });
    } catch (error) {
        console.error('Error getting users working today:', error);
        return res.status(500).json({ success: false, message: 'Failed to get users working today' });
    }
};






const editCompanyName = (req, res) => {
    const { id } = req.params;
    const query = { $set: req.body };
    User.findByIdAndUpdate(id, query, { new: true }, (err, result) => {
        if (err) {
            res.status(status.INTERNAL_SERVER_ERROR).send({
                Message: 'Unable to Update.',
            });
        } else {
            res.status(status.OK).send({
                Message: 'Successfully Updated.',
                result,
            });
        }
    });
};
const calculateHoursWorked = async (user, period) => {
    const now = new Date();
    const userDateTime = setHoursDifference(now, user.ownertimezoneOffset, user.ownertimezone)
    let totalhours = 0;
    let hoursWorked = 0;
    let newHoursWorked = 0;
    let newTimeEntry = []
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

    const periods = {
        daily: {
            start: userDateTime.startOf('day'),
            end: userDateTime.endOf('day'),
        },
        yesterday: {
            start: userDateTime.minus({ days: 1 }).startOf('day'), // Subtract 1 day for yesterday,
            end: startOfYesterday.endOf('day'), // Start of today is the end of yesterday
        },
        weekly: {
            start: userDateTime.startOf('week'),
            end: userDateTime.endOf('week'),
        },
        monthly: {
            start: userDateTime.startOf('month'),
            end: userDateTime.endOf('month'),
        },
    };

    const timeEntries = await TimeTracking.aggregate([
        { $match: { userId: user._id } },
        { $unwind: '$timeEntries' },
        {
            $match: {
                $or: [
                    // Time entries that start and end within the selected period
                    {
                        'timeEntries.startTime': { $gte: periods[period].start, $lt: periods[period].end },
                    },
                    // Time entries that started before the selected period and extend into it
                    {
                        'timeEntries.startTime': { $lt: periods[period].start },
                        'timeEntries.endTime': { $gte: periods[period].start },
                    },
                    // Time entries that start from yesterday and end on today
                    {
                        'timeEntries.startTime': { $lt: periods[period].end },
                        'timeEntries.endTime': { $gte: periods[period].start },
                    },
                ],
            },
        },
    ]);

    const totalMilliseconds = timeEntries.reduce((acc, entry) => {
        if (entry.timeEntries.startTime) {
            let startTime = DateTime.fromJSDate(entry.timeEntries.startTime, { zone: user.ownertimezone });
            let endTime = 0;
            if (entry.timeEntries.endTime) {
                endTime = DateTime.fromJSDate(entry.timeEntries.endTime, { zone: user.ownertimezone });
            } else {
                const lastScreenshot = entry.timeEntries.screenshots.slice(-1)[0];

                if (lastScreenshot) {
                    endTime = DateTime.fromJSDate(lastScreenshot.createdAt, { zone: user.ownertimezone });
                }
                else {
                    endTime = startTime;
                }
            }
            if (startTime >= periods[period].start && startTime < periods[period].end && endTime > periods[period].end) {
                // Create a new time entry for the next day starting at 12:00 AM
                newTimeEntry = { ...entry.timeEntries };
                newTimeEntry.startTime = endTime.startOf('day');

                newTimeEntry.endTime = new Date(endTime);

                // Modify the endTime of the original time entry to be 11:59:59.999 PM of the current day
                entry.timeEntries.endTime = startTime.endOf('day');
                endTime = entry.timeEntries.endTime;

                // Calculate the hours worked for both time entries
                hoursWorked = (endTime - startTime);
                newHoursWorked = (newTimeEntry.endTime - newTimeEntry.startTime);

                // Add hours worked to the appropriate time range (daily, weekly, monthly)

            } else if (startTime < periods[period].start && endTime >= periods[period].start && endTime < periods[period].end) {
                newTimeEntry = { ...entry.timeEntries };
                newTimeEntry.startTime = new Date(startTime);
                newTimeEntry.endTime = startTime.endOf('day');

                // Modify the endTime of the original time entry to be 11:59:59.999 PM of the current day

                entry.timeEntries.startTime = endTime.startOf('day');
                startTime = entry.timeEntries.startTime;
                // Calculate the hours worked for both time entries
                hoursWorked = (endTime - startTime);
                //  (endTime - entry.timeEntries.startTime);

                newHoursWorked = (newTimeEntry.endTime - newTimeEntry.startTime);

            } else {
                // Calculate the hours worked using the corrected start and end times
                hoursWorked = (endTime - startTime);
                newHoursWorked = 0;
            }
            if (startTime >= periods[period].start && startTime < periods[period].end) {
                totalhours += hoursWorked;

            }
            if (newTimeEntry.startTime >= periods[period].start && newTimeEntry.startTime < periods[period].end) {
                totalhours += newHoursWorked;
            }
            return acc = totalhours;
        }
        return acc;
    }, 0);

    const totalHours = Math.floor(totalMilliseconds / (1000 * 60 * 60));
    const totalMinutes = Math.floor((totalMilliseconds % (1000 * 60 * 60)) / (1000 * 60));

    return { hours: totalHours, minutes: totalMinutes };
};


const calculateHoursWorkedold = async (user, period) => {
    const now = new Date();
    const periods = {
        daily: {
            start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
        },
        yesterday: {
            start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
            end: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999),
        },
        weekly: {
            start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()),
            end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - now.getDay()), 23, 59, 59, 999),
        },
        monthly: {
            start: new Date(now.getFullYear(), now.getMonth(), 1),
            end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
        },
    };

    const timeEntries = await TimeTracking.aggregate([
        { $match: { userId: user._id } },
        { $unwind: '$timeEntries' },
        { $match: { 'timeEntries.startTime': { $gte: periods[period].start, $lt: periods[period].end } } },
    ]);

    const totalMilliseconds = timeEntries.reduce((acc, entry) => {
        if (entry.timeEntries.startTime) {
            let endTime = 0;
            if (entry.timeEntries.endTime) {
                endTime = new Date(entry.timeEntries.endTime);
            } else {
                const lastScreenshot = entry.timeEntries.screenshots.slice(-1)[0];

                if (lastScreenshot) {
                    endTime = new Date(lastScreenshot.createdAt);
                }
                else {
                    endTime = entry.timeEntries.startTime;
                }
            }
            const timeWorked = endTime - entry.timeEntries.startTime;
            return acc + timeWorked;
        }
        return acc;
    }, 0);

    const totalHours = Math.floor(totalMilliseconds / (1000 * 60 * 60));
    const totalMinutes = Math.floor((totalMilliseconds % (1000 * 60 * 60)) / (1000 * 60));

    return { hours: totalHours, minutes: totalMinutes };
};

function formatHoursAndMinutes(time) {
    let hours = time.hours || 0;
    let minutes = time.minutes || 0;

    hours = String(hours).padStart(2, '0');
    minutes = String(minutes).padStart(2, '0');

    return `${hours}h ${minutes}m`;
}


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


const calculateBillingAmount = async (user, period) => {
    const ratePerHour = user.billingInfo ? user.billingInfo.ratePerHour : 0;
    const totalHoursWorked = await calculateHoursWorked(user, period);
    const totalBillingAmount = (totalHoursWorked.hours + totalHoursWorked.minutes / 60) * ratePerHour;
    return Math.round(totalBillingAmount);
};
async function retrieveScreenshotsForUser(userId) {
    try {
        const user = await User.findById(userId);
        let latestScreenshot = null;
        // Find all time entries for the user
        const timeEntries = await TimeTracking.aggregate([
            { $match: { userId } },
            { $unwind: '$timeEntries' },
            { $sort: { 'timeEntries.startTime': -1 } }, // Sort by start time in descending order
            { $limit: 5 } // Retrieve the two most recent time entries
        ]);

        if (!timeEntries || timeEntries.length === 0) {
            return null; // No time entries found for the user
        }

        for (const timeEntry of timeEntries) {
            if (timeEntry.timeEntries.screenshots && timeEntry.timeEntries.screenshots.length > 0) {
                // Get the last screenshot from the time entry
                const lastScreenshot = timeEntry.timeEntries.screenshots[timeEntry.timeEntries.screenshots.length - 1];
                latestScreenshot = lastScreenshot;

                // If the last screenshots are found, return and exit the loop
                return latestScreenshot;
            }
        }

        // If no last screenshots are found, it will reach this point
        return latestScreenshot;
    } catch (error) {
        console.error(error);
        return null; // Return null in case of any error
    }
}


const getTotalHoursWorkedAllEmployees = async (req, res) => {
    try {
        const users = await User.find({ company: req.user.company, userType: { $in: ['user', 'admin'] } });
        const totalHoursAll = {
            daily: { hours: 0, minutes: 0 },
            yesterday: { hours: 0, minutes: 0 },
            weekly: { hours: 0, minutes: 0 },
            monthly: { hours: 0, minutes: 0 },
        };

        const totalBillingAll = {
            daily: 0,
            yesterday: 0,
            weekly: 0,
            monthly: 0,
        };

        let totalUsers = 0;
        let totalUsersWorkingToday = 0;
        const offlineUsers = [];

        let usersWorkingToday = await Promise.all(
            users.map(async (user) => {
                user.ownertimezoneOffset = req.user.timezoneOffset
                user.ownertimezone = req.user.timezone
                const employeeId = user._id;

                totalUsers++;

                const totalHoursWorkedDaily = await calculateHoursWorked(user, 'daily');
                const totalHoursWorkedYesterday = await calculateHoursWorked(user, 'yesterday');
                const totalHoursWorkedWeekly = await calculateHoursWorked(user, 'weekly');
                const totalHoursWorkedMonthly = await calculateHoursWorked(user, 'monthly');

                const billingAmountsDaily = await calculateBillingAmount(user, 'daily');
                const billingAmountsYesterday = await calculateBillingAmount(user, 'yesterday');
                const billingAmountsWeekly = await calculateBillingAmount(user, 'weekly');
                const billingAmountsMonthly = await calculateBillingAmount(user, 'monthly');

                totalHoursAll.daily.hours += totalHoursWorkedDaily.hours;
                totalHoursAll.daily.minutes += totalHoursWorkedDaily.minutes;
                totalHoursAll.yesterday.hours += totalHoursWorkedYesterday.hours;
                totalHoursAll.yesterday.minutes += totalHoursWorkedYesterday.minutes;
                totalHoursAll.weekly.hours += totalHoursWorkedWeekly.hours;
                totalHoursAll.weekly.minutes += totalHoursWorkedWeekly.minutes;
                totalHoursAll.monthly.hours += totalHoursWorkedMonthly.hours;
                totalHoursAll.monthly.minutes += totalHoursWorkedMonthly.minutes;

                totalBillingAll.daily += billingAmountsDaily;
                totalBillingAll.yesterday += billingAmountsYesterday;
                totalBillingAll.weekly += billingAmountsWeekly;
                totalBillingAll.monthly += billingAmountsMonthly;

                const recentScreenshot = await retrieveScreenshotsForUser(employeeId);
                if (recentScreenshot) {
                    console.log('Recent screenshot:', recentScreenshot);
                } else {
                    console.log('No recent screenshot found.');
                }

                let minutesAgo = 'Awaiting'
                // Get the user's last active time
                if (user.lastActive > user.createdAt) {
                    const lastActiveTime = user.lastActive;
                    minutesAgo = getTimeAgo(lastActiveTime);
                }

                const currentTime = new Date().getTime();
                const inactiveThreshold = 5 * 60 * 1000; // 5 minutes in milliseconds
                const isActive = user.isActive;

                const userInfo = {
                    userId: user._id,
                    userName: user.name,
                    recentScreenshot: recentScreenshot,
                    minutesAgo,
                    isActive,
                    isArchived: user.isArchived,
                    UserStatus: user.inviteStatus,

                    totalHours: {
                        daily: formatHoursAndMinutes(totalHoursWorkedDaily),
                        yesterday: formatHoursAndMinutes(totalHoursWorkedYesterday),
                        weekly: formatHoursAndMinutes(totalHoursWorkedWeekly),
                        monthly: formatHoursAndMinutes(totalHoursWorkedMonthly),
                    },
                    billingAmounts: {
                        daily: billingAmountsDaily,
                        yesterday: billingAmountsYesterday,
                        weekly: billingAmountsWeekly,
                        monthly: billingAmountsMonthly,
                    },
                };

                if (user.isActive) {
                    totalUsersWorkingToday++;
                    return userInfo;
                }

                offlineUsers.push(userInfo);
                return null;
            })
        );

        const filteredUsers = usersWorkingToday.filter(user => user !== null);
        const formatHoursAndMinutest = (hours, minutes) => {
            return `${hours < 10 ? '0' : ''}${hours}h ${minutes < 10 ? '0' : ''}${minutes}m`;
        };

        const totalHoursFormatted = {
            daily: formatHoursAndMinutest(totalHoursAll.daily.hours, totalHoursAll.daily.minutes),
            yesterday: formatHoursAndMinutest(totalHoursAll.yesterday.hours, totalHoursAll.yesterday.minutes),
            weekly: formatHoursAndMinutest(totalHoursAll.weekly.hours, totalHoursAll.weekly.minutes),
            monthly: formatHoursAndMinutest(totalHoursAll.monthly.hours, totalHoursAll.monthly.minutes),
        };

        return res.json({
            success: true,
            totalUsers: totalUsers,
            onlineUsers: filteredUsers,
            totalActiveUsers: filteredUsers.length,
            totalUsersWorkingToday: totalUsersWorkingToday,
            offlineUsers: offlineUsers,
            offlineUsersTotal: offlineUsers.length,
            totalHours: totalHoursFormatted,
            totalBillingAmounts: totalBillingAll,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};




const getTotalHoursWorked = async (req, res) => {

    const userId = req.params.id;

    try {

        // Check if the user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const ratePerHour = user.billingInfo ? user.billingInfo.ratePerHour : 0;

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
        const timeTrackings = await TimeTracking.find({ userId });
        // Check if timeTrackings is empty
        if (timeTrackings.length === 0) {
            const totalHoursWorked = {
                daily: '00h 00m',
                weekly: '00h 00m',
                monthly: '00h 00m',
                yesterday: '00h 00m',
            };

            const billingAmounts = {
                daily: 0,
                weekly: 0,
                monthly: 0,
                yesterday: 0,
            };

            return res.status(200).json({ success: true, data: { totalHours: totalHoursWorked, billingAmounts } });
        }
        const totalHoursWorked = {
            daily: 0,
            weekly: 0,
            monthly: 0,
            yesterday: 0,
        };

        for (const timeTracking of timeTrackings) {
            for (const timeEntry of timeTracking.timeEntries) {
                const startTime = new Date(timeEntry.startTime);
                const endTime = timeEntry.endTime ? new Date(timeEntry.endTime) : user.lastActive;
                const hoursWorked = (endTime - startTime) / (1000 * 60 * 60);

                if (startTime >= startOfToday) {
                    totalHoursWorked.daily += hoursWorked;
                }

                if (startTime >= startOfThisWeek && startTime < endOfThisWeek) {
                    totalHoursWorked.weekly += hoursWorked;
                }

                if (startTime >= startOfThisMonth && startTime < endOfThisMonth) {
                    totalHoursWorked.monthly += hoursWorked;
                }

                if (startTime >= startOfYesterday && startTime < startOfToday) {
                    totalHoursWorked.yesterday += hoursWorked;
                }
            }
        }
        const formatHours = (hoursDecimal) => {
            const hours = Math.floor(hoursDecimal);
            const minutes = Math.round((hoursDecimal - hours) * 60);
            return `${hours}h ${minutes}m`;
        };

        const formattedTotalHoursWorked = {
            daily: formatHours(totalHoursWorked.daily),
            weekly: formatHours(totalHoursWorked.weekly),
            monthly: formatHours(totalHoursWorked.monthly),
            yesterday: formatHours(totalHoursWorked.yesterday),
        };

        const billingAmounts = {
            daily: parseInt(ratePerHour * totalHoursWorked.daily),
            weekly: parseInt(ratePerHour * totalHoursWorked.weekly),
            monthly: parseInt(ratePerHour * totalHoursWorked.monthly),
            yesterday: parseInt(ratePerHour * totalHoursWorked.yesterday),
        };

        return res.status(200).json({ success: true, data: { totalHours: formattedTotalHoursWorked, billingAmounts } });
    } catch (error) {
        console.error('Error getting total hours worked:', error);
        return res.status(500).json({ success: false, message: 'Failed to get total hours worked' });
    }
};

const updateCompanyNameForAllEmployees = async (req, res) => {
    try {
        // Get the company name from the request body
        const { companyName } = req.body;

        // Update the company name for all users
        await User.updateMany({}, { companyName: companyName });

        return res.status(200).json({ success: true, message: 'Company name updated for all employees' });
    } catch (error) {
        console.error('Error updating company name for all employees:', error);
        return res.status(500).json({ success: false, message: 'Failed to update company name for all employees' });
    }
};
const updateBillingInfo = async (req, res) => {
    try {
        const { userId } = req.params;
        const { ratePerHour, currency } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // If billingInfo doesn't exist, create a new object with the provided values
        if (!user.billingInfo) {
            user.billingInfo = {
                ratePerHour: ratePerHour,
                currency: currency
            };
        } else {
            // Otherwise, update the existing billingInfo object
            if (ratePerHour) {
                user.billingInfo.ratePerHour = ratePerHour;
            }
            if (currency) {
                user.billingInfo.currency = currency;
            }
        }

        await user.save();

        return res.status(200).json({ success: true, data: user.billingInfo });

    } catch (error) {
        console.error('Error updating billing information:', error);
        return res.status(500).json({ success: false, message: 'Failed to update billing information' });
    }
};

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

function totalMillisecondsToHoursAndMinutes(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return { hours, minutes };
}

// const formatHoursAndMinutes = (hoursAndMinutes) => {
//     return `${hoursAndMinutes.hours}h ${hoursAndMinutes.minutes}m`;
// };

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
        screenshots: screenshots,
    });

    return groupedScreenshots;
}









const sortedScreenshotsEachEmployee = async (req, res) => {
    try {
        const { userId } = req.params;
        const { date } = req.query;

        // Get the start and end times for the provided date
        const startOfDate = new Date(date);
        const endOfDate = new Date(startOfDate.getTime() + 24 * 60 * 60 * 1000);

        // Query the database to retrieve all timeEntries for the specific user
        const timeTrackings = await TimeTracking.find({ userId }).populate('userId');

        const allScreenshots = [];

        timeTrackings.forEach((timeTracking) => {
            timeTracking.timeEntries.forEach((timeEntry) => {
                const startTime = new Date(timeEntry.startTime);
                const endTime = new Date(timeEntry.endTime);

                // Check if the time entry overlaps with the provided date
                if (
                    (startTime >= startOfDate && startTime < endOfDate) ||
                    (endTime >= startOfDate && endTime < endOfDate)
                ) {
                    // Iterate through screenshots of the time entry
                    timeEntry.screenshots.forEach((screenshot) => {
                        const screenshotTime = screenshot.createdAt;
                        const screenshotHours = screenshotTime.getHours();
                        const screenshotMinutes = screenshotTime.getMinutes();
                        const amOrPmScreenshot = screenshotHours < 12 ? 'A.M' : 'P.M';
                        const adjustedScreenshotHours = screenshotHours % 12 || 12;

                        const screenshotWithUserAndTime = {
                            ...screenshot.toObject(),
                            userId: timeTracking.userId._id,
                            userName: timeTracking.userId.name,
                            userEmail: timeTracking.userId.email,
                            time: `${String(adjustedScreenshotHours).padStart(2, '0')}:${String(
                                screenshotMinutes
                            ).padStart(2, '0')} ${amOrPmScreenshot}`,
                        };

                        allScreenshots.push(screenshotWithUserAndTime);
                    });
                }
            });
        });

        const sortedScreenshots = allScreenshots.sort((a, b) => a.createdAt - b.createdAt);

        const timelineDurationInMinutes = 60; // Total duration of the timeline in minutes

        // Calculate the width of the timeline container or element
        const timelineWidth = 100; // Specify the desired width in percentage

        // Calculate the position for each screenshot within the timeline
        sortedScreenshots.forEach((screenshot, index) => {
            const screenshotTime = screenshot.createdAt;
            const screenshotStartTime = screenshotTime - startOfDate; // Calculate the time since the start of the provided date in milliseconds

            // Calculate the position as a percentage based on the timeline duration and width
            const position = (screenshotStartTime / (timelineDurationInMinutes * 60 * 1000)) * timelineWidth;

            // Assign the position to the screenshot object
            sortedScreenshots[index].position = position;
        });

        // Return the sorted screenshots with position information as a JSON object in the response
        res.status(200).json({ success: true, data: sortedScreenshots });
    } catch (error) {
        console.error('Error getting sorted screenshots:', error);
        res.status(500).json({ success: false, message: 'Failed to get sorted screenshots' });
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
const getMonthlyScreenshots = async (req, res) => {
    const userId = req.params.userId;
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    try {
        const historyItems = await ScreenshotHistory.find({
            userId: userId,
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



const moveMonthsScreenshotsToHistory = async (res, req) => {
    const { userId } = req.body;
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);


    if (!userId) {
        return res.status(400).json({ success: false, message: 'User ID is required.' });
    }
    const timeTrackings = await TimeTracking.find({
        userId: userId,
        'timeEntries.screenshots.createdAt': {
            $gte: startOfMonth,
            $lte: endOfMonth,
        },
    });

    for (const timeTracking of timeTrackings) {
        for (const timeEntry of timeTracking.timeEntries) {
            const monthsScreenshots = timeEntry.screenshots.filter(screenshot => {
                const screenshotDate = new Date(screenshot.createdAt);
                return screenshotDate >= startOfMonth && screenshotDate <= endOfMonth;
            });

            // Save month's screenshots to the history collection
            for (const screenshot of monthsScreenshots) {
                const historyScreenshot = new ScreenshotHistory({
                    screenshot: screenshot.screenshot,
                    type: 'month',
                    originalTimeTrackingId: timeTracking._id,
                    originalTimeEntryId: timeEntry._id,
                    userId: timeTracking.userId, // Assuming timeTracking has a userId field
                });

                await historyScreenshot.save();
            }
        }
    }
};

const archiveProject = (req, res) => {
    const { projectId } = req.params;
    const query = { $set: req.body };
    Project.findByIdAndUpdate(projectId, query, { new: true }, (err, result) => {
        if (err) {
            res.status(status.INTERNAL_SERVER_ERROR).send({
                Message: 'Unable to Update.',
            });
        } else {
            res.status(status.OK).send({
                Message: 'Successfully Updated.',
                result,
            });
        }
    });
};


const editProject = (req, res) => {
    const { projectId } = req.params;
    console.log(projectId);
    const query = { $set: req.body };
    Project.findByIdAndUpdate(projectId, query, { new: true }, (err, result) => {
        if (err) {
            console.log(err);
            res.status(status.INTERNAL_SERVER_ERROR).send({
                Message: 'Unable to Update.',
            });
        } else {
            res.status(status.OK).send({
                Message: 'Successfully Updated.',
                result,
            });
        }
    });
};

const getSingleEmployee = (req, res) => {
    const { eid } = req.params;

    User.findOne({ _id: eid })
        .then(event => {
            if (!event) {
                return res.status(status.NOT_FOUND).send({
                    Message: 'Boat not found',
                });
            }
            return res.status(status.OK).send(event);
        })
        .catch(err => {
            return res.status(status.INTERNAL_SERVER_ERROR).send({
                Message: 'Internal Server Error',
                err,
            });
        });
};
const deleteEmployee = (req, res) => {
    const { id } = req.params;
    User.findByIdAndRemove(id, (err, result) => {
        if (result) {
            res.status(status.OK).send({
                Message: 'User Deleted Successfully.',
            });
        } else {
            res.status(status.INTERNAL_SERVER_ERROR).send({
                Message: 'Unable to Delete.',
                err,
            });
        }
    });
};

const updateEmployeeSettingsold = async (req, res) => {
    const { userId } = req.params;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        let settings;
        if (!user.employeeSettings) {
            // Create a new employee settings record if it doesn't exist
            const settingsData = {
                userId: user._id, // Associate the userId with the employeeSettings
                ...req.body,
            };

            settings = new EmployeeSettings(settingsData);
            await settings.save();

            // settings = new EmployeeSettings(req.body);
            // await settings.save();

            // Update the user with the new employee settings reference
            user.employeeSettings = settings._id;
            await user.save();
        } else {
            // Update the existing employee settings record
            settings = await EmployeeSettings.findByIdAndUpdate(
                user.employeeSettings,
                req.body, { new: true, runValidators: true }
            );
        }

        if (!settings) {
            return res.status(404).json({ success: false, message: 'Employee settings not found' });
        }

        res.status(200).json({ success: true, message: 'Employee settings updated', data: settings });
    } catch (error) {
        console.error('Error updating employee settings:', error);
        res.status(500).json({ success: false, message: 'Failed to update employee settings' });
        console.log(error);
    }
};

const updateEmployeeSettings = async (req, res) => {
    const userData = req.body; // Assuming userData is an array of objects, each containing user ID and settings data

    try {
        const updatedSettings = [];

        for (const userDataEntry of userData) {
            const userId = userDataEntry.userId;
            const settingsData = userDataEntry.settings;

            const user = await User.findById(userId);
            if (!user) {
                // Handle the case where a user is not found
                continue; // Move to the next user
            }

            let settings;

            if (!user.employeeSettings) {
                // Create a new employee settings record if it doesn't exist
                const settingsDataWithUserId = {
                    userId: user._id,
                    ...settingsData, // You might want to process settingsData accordingly
                };

                settings = new EmployeeSettings(settingsDataWithUserId);
                await settings.save();
                user.employeeSettings = settings._id;
                await user.save();
            } else {
                // Update the existing employee settings record
                settings = await EmployeeSettings.findByIdAndUpdate(
                    user.employeeSettings,
                    settingsData,
                    { new: true, runValidators: true }
                );
            }

            if (!settings) {
                // Handle the case where settings are not found
                continue; // Move to the next user
            }

            updatedSettings.push(settings);
        }

        if (updatedSettings.length === 0) {
            // Handle the case where no settings were updated
            return res.status(404).json({ success: false, message: 'No employee settings were updated' });
        }

        res.status(200).json({ success: true, message: 'Employee settings updated', data: updatedSettings });
    } catch (error) {
        console.error('Error updating employee settings:', error);
        res.status(500).json({ success: false, message: 'Failed to update employee settings', error: error });
    }
};



const updateUserArchiveStatus = async (req, res) => {
    const userId = req.params.userId;
    const isArchived = req.body.isArchived;

    try {
        const user = await User.findByIdAndUpdate(userId, { isArchived }, { new: true });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.status(200).json({ success: true, message: 'User archive status updated', user });
    } catch (error) {
        console.error('Error updating user archive status:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};
const getEffectiveSettingsEachUser = async (req, res) => {
    const { userId } = req.params;
    try {


        const user = await User.findOne({ _id: userId }).populate('employeeSettings');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const employeeSettings = user.employeeSettings;
        return res.status(200).json({ success: true, employeeSettings });
    } catch (error) {
        console.error('Error retrieving employee settings:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getActivityData = async (req, res) => {
    const { eid } = req.params;

    try {
        // Check if the user exists
        const user = await User.findById({ _id: eid });
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
        const timeTrackings = await TimeTracking.find({ eid }).populate(' timeEntries.visitedUrls');

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
                    activityData.daily.screenshots.push(...timeEntry.screenshots);
                    activityData.daily.visitedUrls.push(...timeEntry.visitedUrls);
                }

                if (startTime >= startOfThisWeek && startTime < endOfThisWeek) {
                    activityData.weekly.screenshots.push(...timeEntry.screenshots);
                    activityData.weekly.visitedUrls.push(...timeEntry.visitedUrls);
                }

                if (startTime >= startOfThisMonth && startTime < endOfThisMonth) {
                    activityData.monthly.screenshots.push(...timeEntry.screenshots);
                    activityData.monthly.visitedUrls.push(...timeEntry.visitedUrls);
                }

                if (startTime >= startOfYesterday && startTime < startOfToday) {
                    activityData.yesterday.screenshots.push(...timeEntry.screenshots);
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

import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const emailInviteExp = async (req, res) => {
    const gLink = req.params.gLink;
    const email = req.params.email;

    const user = await User.findOne({ email: email, gLink: gLink, inviteStatus: true })
    if (user) {

        const currentTimestamp = Date.now();

        if (currentTimestamp > user.expirationTimestamp) {
            // The link has expired
            res.status(403).json({ success: false, message: 'Invite link expired' });
            return;
        }
        else {
            res.status(200).json({ success: true, user, message: 'Invite link not expired' });
        }
    }
    else {
        res.status(400).json({ success: false, message: 'Invalid invite link' });
        return;
    }
}

const random = (length) => {
    // Implement your random number generation logic here
    // For example, you can use a library like 'crypto' to generate a secure random number.
    // Here's a basic example for generating a random number between 100000 and 999999:
    return Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000;
};

const normalizeEmail = (email) => {
    // Normalize email address by removing dots from local part
    const [localPart, domain] = email.split('@');
    const normalizedLocalPart = localPart.replace(/\./g, '');
    return `${normalizedLocalPart}@${domain}`;
};


const checkPass = async (req, res) => {
    const verification = req.body.verification;
    const email = req.body.email;
    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({ verification: verification, email: normalizedEmail })
    if (user) {
        const currentTimestamp = Date.now();

        if (currentTimestamp > user.otpTime) {
            // The link has expired
            res.status(403).json({ success: false, message: 'Verification code expired' });
            return;
        }
        else {
            res.status(200).json({ success: true, message: 'Token verified' });
        }

    }
    else {
        res.status(400).json({ success: false, message: 'Invalid verification code' });
    }
}

const forgotPassword = async (req, res) => {
    const expirationTimeInHours = 2;
    const otpTime = Date.now() + expirationTimeInHours * 60 * 60 * 1000; // Calculate the expiration timestamp (2 hours from now)
    const number = random(6); // Generate a random 6-digit number

    const email = req.body.email;
    const normalizedEmail = normalizeEmail(email);

    try {
        // Find the user by email and _id
        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Update the user's verification field with the generated number
        user.verification = number;
        user.otpTime = otpTime;
        await user.save();

        // Send the verification email
        const msg = {
            to: normalizedEmail,
            from: 'SSTRACK <invites@screenshottime.com>', // Replace with your own email or a verified sender in SendGrid
            subject: 'Your reset password verification code is here',
            text: `Please reset your password using this code: ${number}`,
            html: `<p>Reset your password using this code: <strong>${number}</strong></p><p>Please don't share this code with anyone else</p>
                    <p style="color: #555; text-align: center;">
                        <strong>Note:</strong> This link will expire after 24 hours.
                        Please access the link before <strong>${new Date(otpTime).toLocaleString()}</strong>.
                    </p>
                    <p style="color: #555; text-align: center;">
                        If you have any questions or need further assistance, please contact us at 
                        <a href="mailto:support@caiif.ca" style="color: #0066cc;">support@caiif.ca</a> or call us at 
                        <a href="tel:+12895869810" style="color: #0066cc;">+1 (289) 586-9810</a>.
                    </p>`
        };

        await sgMail.send(msg);

        res.status(200).json({ success: true, user, message: 'Verification code sent successfully' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ success: false, message: 'Failed to send verification code' });
    }
};

const emailInvite = async (req, res) => {
    const email = req.body.toEmail;
    const normalizedEmail = normalizeEmail(email);

    const company = req.body.company;
    const expirationTimeInHours = 24;
    const expirationTimestamp = Date.now() + expirationTimeInHours * 60 * 60 * 1000; // Calculate the expiration timestamp (2 hours from now)

    const gLink = generateUniqueId({
        length: 9
    });

    const user = await User.findOne({ email: normalizedEmail })
    if (!user) {
        const newUser = new User({
            inviteStatus: true,
            email: normalizedEmail,
            expirationTimestamp,
            gLink,
            company,
        });
        try {
            const inviteLink = `https://www.sstrack.io/create-account/${gLink}/${normalizedEmail}`;
            const msg = {
                to: normalizedEmail,
                from: 'SSTRACK <invites@screenshottime.com>',
                subject: 'You Have Been Invited',
                text: `You have been invited. Please click on the following link to join:`,
                html: `
                    <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
                        <h2 style="color: #333; text-align: center;">You Have Been Invited!</h2>
                        <p style="color: #555; text-align: center;">Please click on the following link to join:</p>
                        <div style="text-align: center; margin: 20px;">
                            <a href="${inviteLink}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: #fff; text-decoration: none; border-radius: 5px;">Join SSTRACK</a>
                        </div>
                        <p style="color: #555; text-align: center;">
                            <strong>Note:</strong> This link will expire after 24 hours.
                            Please access the link before <strong>${new Date(expirationTimestamp).toLocaleString()}</strong>.
                        </p>
                        <p style="color: #555; text-align: center;">
                            If you have any questions or need further assistance, please contact us at 
                            <a href="mailto:support@caiif.ca" style="color: #0066cc;">support@caiif.ca</a> or call us at 
                            <a href="tel:+12895869810" style="color: #0066cc;">+1 (289) 586-9810</a>.
                        </p>
                    </div>
                `
            };

            await sgMail.send(msg);
            const savedUser = await newUser.save();
            res.status(200).json({ success: true, savedUser, msg, message: 'Email sent successfully' });
        } catch (error) {
            console.error('Error sending email:', error);
            res.status(500).json({ success: false, message: 'Failed to send email' });
        }
    }
    else {
        res.status(400).json({ success: false, message: 'Email already exist' });
    }
};

const emailInviteClient = async (req, res) => {
    const { toEmail } = req.body;
    const gLink = generateUniqueId({
        length: 9
    });
    const inviteLink = `https://yourwebsite.com/invite-client/${gLink}`;
    const msg = {
        to: toEmail,
        from: 'SSTRACK <invites@screenshottime.com>', // replace this with your own email
        subject: 'You have been invited as a client',
        text: `You have been invited. Please click on the following link to join: ${inviteLink}`,
        html: `<p>You have been invited. Please click on the following link to join: <a href="${inviteLink}">${inviteLink}</a></p>`
    };

    try {
        await sgMail.send(msg);
        res.status(200).json({ success: true, message: 'Email sent successfully' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ success: false, message: 'Failed to send email' });
    }
};
const deleteProject = async (req, res) => {
    try {
        const { projectId } = req.params;

        // Find the 'Empty Project' bucket
        let emptyProject = await Project.findOne({ name: 'Empty Project' });

        // If 'Empty Project' does not exist, create one
        if (!emptyProject) {
            emptyProject = new Project({ name: 'Empty Project' });
            await emptyProject.save();
        }

        // Re-assign the time entries and screenshots from the project being deleted to 'Empty Project'
        await TimeTracking.updateMany({ projectId }, { projectId: emptyProject._id });

        // Delete the project
        const result = await Project.findByIdAndRemove(projectId);
        if (result) {
            res.status(200).send({ message: 'Project deleted successfully.' });
        } else {
            res.status(404).send({ message: 'Project not found.' });
        }

    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).send({ message: 'Failed to delete project.' });
    }
};
// Helper function to format time range
const getTimeRange = (startTime, endTime) => {
    const formatTime = (time) => {
        const hours = time.getHours();
        const minutes = time.getMinutes();
        const amOrPm = hours < 12 ? 'A.M' : 'P.M';
        const adjustedHours = hours % 12 || 12;
        return `${String(adjustedHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${amOrPm}`;
    };

    return `${formatTime(startTime)} - ${formatTime(endTime)}`;
};
const getTotalHoursQ = async (req, res) => {
    const { userId } = req.params;
    const date = req.query.date ? new Date(req.query.date) : new Date();

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const ratePerHour = user.billingInfo ? user.billingInfo.ratePerHour : 0;

        const now = new Date();
        const startOfToday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const endOfToday = new Date(startOfToday);
        endOfToday.setDate(startOfToday.getDate() + 1);
        const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
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
        };

        for (const timeTracking of timeTrackings) {
            for (const timeEntry of timeTracking.timeEntries) {
                const startTime = new Date(timeEntry.startTime);
                const endTime = timeEntry.endTime ? new Date(timeEntry.endTime) : user.lastActive;
                const hoursWorked = (endTime - startTime) / (1000 * 60 * 60);

                if (startTime >= startOfToday && startTime < endOfToday) {
                    totalHoursWorked.daily += hoursWorked;
                }

                if (startTime >= startOfThisWeek && startTime < endOfThisWeek) {
                    totalHoursWorked.weekly += hoursWorked;
                }

                if (startTime >= startOfThisMonth && startTime < endOfThisMonth) {
                    totalHoursWorked.monthly += hoursWorked;
                }
            }
        }

        const formatHours = (hoursDecimal) => {
            const hours = Math.floor(hoursDecimal);
            const minutes = Math.round((hoursDecimal - hours) * 60);
            return `${hours}h ${minutes}m`;
        };

        const formattedTotalHoursWorked = {
            daily: formatHours(totalHoursWorked.daily),
            weekly: formatHours(totalHoursWorked.weekly),
            monthly: formatHours(totalHoursWorked.monthly),
        };

        const billingAmounts = {
            daily: parseInt(ratePerHour * totalHoursWorked.daily),
            weekly: parseInt(ratePerHour * totalHoursWorked.weekly),
            monthly: parseInt(ratePerHour * totalHoursWorked.monthly),
        };

        // Retrieve the activities from the time tracking document
        const activities = TimeTracking.activities;

        // Sort the activities by start time in ascending order
        activities.sort((a, b) => a.startTime - b.startTime);

        // Create an empty array to store the timeline
        const timeline = [];

        // Iterate through each activity
        for (const activity of activities) {
            // Retrieve the associated screenshots for the activity
            const screenshots = activity.screenshots;

            // Sort the screenshots by timestamp in ascending order
            screenshots.sort((a, b) => a.createdAt - b.createdAt);

            // Group the screenshots based on time proximity
            const groups = [];
            let currentGroup = [screenshots[0]];

            for (let i = 1; i < screenshots.length; i++) {
                const currentScreenshot = screenshots[i];
                const previousScreenshot = currentGroup[currentGroup.length - 1];

                // Determine the time proximity threshold (e.g., 1 minute)
                const timeThreshold = 1 * 60 * 1000; // 1 minute in milliseconds

                // Check if the current screenshot is within the time proximity of the previous screenshot
                if (currentScreenshot.createdAt - previousScreenshot.createdAt <= timeThreshold) {
                    currentGroup.push(currentScreenshot);
                } else {
                    groups.push(currentGroup);
                    currentGroup = [currentScreenshot];
                }
            }

            // Add the last group to the timeline
            groups.push(currentGroup);

            // Check if the activity was split
            if (activity.split) {
                // Retrieve the split information from the activity
                const { originalActivityId, splitActivityId } = activity.split;

                // Find the original activity in the timeline
                const originalActivity = timeline.find((a) => a.activityId === originalActivityId);

                if (originalActivity) {
                    // Find the index of the original activity in the timeline
                    const originalActivityIndex = timeline.indexOf(originalActivity);

                    // Create a new activity timeline for the split part
                    const splitActivityTimeline = {
                        activityId: splitActivityId,
                        startTime: activity.startTime,
                        endTime: activity.endTime,
                        screenshotGroups: groups,
                    };

                    // Insert the split activity timeline after the original activity in the timeline
                    timeline.splice(originalActivityIndex + 1, 0, splitActivityTimeline);
                }
            } else {
                // Create an object representing the activity with its associated screenshot groups
                const activityTimeline = {
                    activityId: activity._id,
                    startTime: activity.startTime,
                    endTime: activity.endTime,
                    screenshotGroups: groups,
                };

                // Add the activity timeline to the timeline array
                timeline.push(activityTimeline);
            }
        }



        return res.status(200).json({
            success: true,
            data: {
                totalHours: formattedTotalHoursWorked,
                billingAmounts,
                groupedScreenshots: timeline,
                timezone: user.timezone,
                name: user.name,
            },
        });
    } catch (error) {
        console.error('Error getting total hours worked:', error);
        return res.status(500).json({ success: 0 });
    }
};

const assignUserToManager = async (req, res) => {
    try {
        const { managerId } = req.params;
        const { userId } = req.body;

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Find the manager
        const manager = await User.findById(managerId);
        if (!manager) {
            return res.status(404).json({ message: 'Manager not found' });
        }

        // Check if the manager has manager or admin role
        if (manager.userType !== 'manager' && manager.userType !== 'admin') {
            return res.status(403).json({ message: 'This user does not have permission to be a manager' });
        }

        // Assign the manager to the user
        user.managerId = managerId;
        await user.save();

        // Assign the user to the manager
        if (!manager.assignedUsers.includes(userId)) {
            manager.assignedUsers.push(userId);
            await manager.save();
        }

        return res.status(200).json({ message: 'User assigned to manager successfully' });

    } catch (error) {
        console.error('Error assigning user to manager:', error);
        return res.status(500).json({ message: 'Failed to assign user to manager' });
    }
};
// Helper function to format time as hh:mm AM/PM
const formatTime = (time) => {
    const hours = Math.floor(time);
    const minutes = Math.round((time - hours) * 60);
    return `${hours}h ${minutes}m`;
};

// Helper function to format duration in hh:mm format
const formatDuration = (duration) => {
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
};


const trimActivity = (activity, inactiveThreshold) => {
    const startTime = activity.startTime.getTime();
    const endTime = activity.endTime.getTime();

    // Calculate the duration of the activity
    const duration = endTime - startTime;

    // Check if the activity needs to be trimmed
    if (duration > inactiveThreshold) {
        // Calculate the start time of the trimmed activity
        const trimmedStartTime = startTime + inactiveThreshold;

        // Calculate the end time of the trimmed activity
        const trimmedEndTime = endTime - inactiveThreshold;

        // Create the trimmed activity object
        const trimmedActivity = {
            startTime: new Date(trimmedStartTime),
            endTime: new Date(trimmedEndTime),
            // Copy other properties from the original activity
            // ...
        };

        return trimmedActivity;
    }

    return activity;
};

const trimActivityInTimeEntry = async (req, res) => {
    try {
        const { userId, timeEntryId } = req.params;
        const startTime = DateTime.fromFormat(req.body.startTime, "yyyy-MM-dd h:mm a", { zone: req.user.timezone });
        const endTime = DateTime.fromFormat(req.body.endTime, "yyyy-MM-dd h:mm a", { zone: req.user.timezone });
        var screenshotsToMove = 0
        // Now, 'startTime' and 'endTime' are DateTime objects in the specified timezone

        console.log(startTime.toISO()); // To see the JavaScript Date equivalent
        console.log(endTime.toISO());

        // Log the received IDs for debugging
        console.log('Received IDs:', userId, timeEntryId);

        // Step 1: Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Step 2: Find the time tracking document
        const timeTracking = await TimeTracking.findOne({ userId });
        if (!timeTracking) {
            return res.status(404).json({ success: false, message: 'Time tracking not found' });
        }

        // Step 3: Find the time entry within the time tracking document
        const foundTimeEntry = timeTracking.timeEntries.find(entry => entry._id.toString() === timeEntryId);
        if (!foundTimeEntry) {
            return res.status(404).json({ success: false, message: 'Time entry not found' });
        }
        const lastScreenshot = foundTimeEntry.screenshots.slice(-1)[0]; // Get the last time entry
        if (!foundTimeEntry.endTime) {
            foundTimeEntry.endTime = lastScreenshot.createdAt
        }

        if (foundTimeEntry.startTime <= startTime && foundTimeEntry.endTime >= endTime) {
            // Filter screenshots within the specified time range
            screenshotsToMove = foundTimeEntry.screenshots.filter(screenshot => {
                const screenshotTime = DateTime.fromJSDate(
                    new Date(screenshot.startTime) || new Date(screenshot.createdAt),
                    { zone: req.user.timezone }
                );
                return screenshotTime >= startTime && screenshotTime <= endTime;
            });
        }
        else {
            return res.status(404).json({ success: false, message: 'Invalid time' });
        }


        // Find the index of the screenshot that matches or is just after the endTime
        const indexToSplit = foundTimeEntry.screenshots.findIndex(screenshot => {
            const screenshotTime = DateTime.fromJSDate(
                new Date(screenshot.startTime) || new Date(screenshot.createdAt),
                { zone: req.user.timezone }
            );
            return screenshotTime >= endTime;
        });
        let newTimeEntry = [];
        if (indexToSplit !== -1) {
            // Create a new time entry with the second part of foundTimeEntry
            newTimeEntry = { ...foundTimeEntry };
            newTimeEntry.startTime = endTime.toJSDate();
            newTimeEntry.screenshots = foundTimeEntry.screenshots.slice(indexToSplit);
            newTimeEntry.endTime = foundTimeEntry.endTime

            // Adjust the endTime of the original foundTimeEntry
            foundTimeEntry.endTime = startTime.toJSDate();
            foundTimeEntry.screenshots = foundTimeEntry.screenshots.slice(0, indexToSplit);

            // Now, foundTimeEntry contains screenshots up to endTime, and newTimeEntry contains screenshots after endTime
        }
        // Remove the filtered screenshots from the original foundTimeEntry
        foundTimeEntry.screenshots = foundTimeEntry.screenshots.filter(screenshot => !screenshotsToMove.includes(screenshot));
        if (!foundTimeEntry.screenshots) {
            foundTimeEntry.endTime = foundTimeEntry.startTime;
        }
        if (newTimeEntry !== null && newTimeEntry.length !== 0) {            // Push newTimeEntry to timeEntries array
            timeTracking.timeEntries.push(newTimeEntry);
        }
        timeTracking.timeEntries.sort((a, b) => a.startTime - b.startTime);

        const trimmedActivity = {
            startTime: startTime.toJSDate(),
            endTime: endTime.toJSDate(),
            changeTime: new Date(),
            editedBy: req.user._id,
            scope: 'trim',
            change: `Activity trimmed from ${startTime} to ${endTime}`,
            screenshots: screenshotsToMove,
            historyChanges: [],
        };

        // Step 7: Push the new activity to the activities array
        foundTimeEntry.activities.push(trimmedActivity);

        // Step 8: Save the changes to the time tracking document
        await timeTracking.save();

        // Log the trimmed activity for debugging
        console.log('Trimmed Activity:', trimmedActivity);

        return res.status(200).json({
            success: true,
            data: {
                activity: trimmedActivity,
                message: 'Activity trimmed successfully',
            },
        });
    } catch (error) {
        // Log the error for debugging
        console.error('Error trimming activity:', error);
        return res.status(500).json({ success: false, message: 'Failed to trim activity', error: error });
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

const formatTHours = (hoursDecimal) => {
    const hours = Math.floor(hoursDecimal);
    const minutes = Math.round((hoursDecimal - hours) * 60);
    return `${hours}h ${minutes < 10 ? '0' : ''}${minutes}m`;
};
const calculateTotalHours = (timeTrackings) => {
    let totalMilliseconds = 0;

    for (const timeTracking of timeTrackings) {
        for (const timeEntry of timeTracking.timeEntries) {
            const entryDuration = timeEntry.endTime - timeEntry.startTime;
            totalMilliseconds += entryDuration;

            // Add the duration of offline activities within the time entry
            for (const activity of timeEntry.activities) {
                const activityDuration = activity.endTime - activity.startTime;
                totalMilliseconds += activityDuration;
            }
        }
    }

    const totalDuration = moment.duration(totalMilliseconds);
    const totalHours = Math.floor(totalDuration.asHours());
    const totalMinutes = totalDuration.minutes();
    return `${totalHours}h ${totalMinutes}m`;
};

const addOfflineTime = async (req, res) => {
    const { userId } = req.params;
    const { notes, projectId } = req.body;
    // Convert the time format
    const startTime = DateTime.fromFormat(req.body.startTime, "yyyy-MM-dd hh:mm a", { zone: req.user.timezone });
    const endTime = DateTime.fromFormat(req.body.endTime, "yyyy-MM-dd hh:mm a", { zone: req.user.timezone });
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const timeTracking = await TimeTracking.findOne({ userId });
        if (!timeTracking) {
            return res.status(404).json({ success: false, message: 'Time tracking not found' });
        }


        // Create a new time entry for the offline activity
        const newTimeEntry = {
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            description: 'offline',
            activities: [{
                startTime: startTime,
                endTime: endTime,
                notes,
                projectId,
                scope: 'offline',
                editedBy: req.user._id,
                screenshots: [],
                historyChanges: [],
                offline: true,
            },],
        };

        // Add the new time entry to the time tracking document
        timeTracking.timeEntries.push(newTimeEntry);
        timeTracking.timeEntries.sort((a, b) => a.startTime - b.startTime);
        // Save the changes to the time tracking document
        await timeTracking.save();


        return res.status(200).json({
            success: true,
            data: {
                newTimeEntry,
                message: 'Offline time added successfully',
            },
        });
    } catch (error) {
        console.error('Error adding offline time:', error);
        return res.status(500).json({ success: false, message: 'Failed to add offline time' });
    }
};


const addOfflineTimeold = async (req, res) => {
    const { userId } = req.params;
    const { startTime, endTime, notes, projectId } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const timeTracking = await TimeTracking.findOne({ userId });
        if (!timeTracking) {
            return res.status(404).json({ success: false, message: 'Time tracking not found' });
        }

        // Convert the time format using moment.js
        const splitTime = DateTime.fromFormat(req.body.splitTime, "yyyy-MM-dd hh:mm a", { zone: req.user.timezone });
        const startTimeFormatted = moment(startTime, 'h:mm A').toISOString();
        const endTimeFormatted = moment(endTime, 'h:mm A').toISOString();

        // Create a new time entry for the offline activity
        const newTimeEntry = {
            startTime: new Date(startTimeFormatted),
            endTime: new Date(endTimeFormatted),
            activities: [{
                startTime: new Date(startTimeFormatted),
                endTime: new Date(endTimeFormatted),
                notes,
                projectId,
                scope: 'offline',
                editedBy: req.user._id,
                screenshots: [],
                historyChanges: [],
                offline: true,
            },],
        };

        // Add the new time entry to the time tracking document
        timeTracking.timeEntries.push(newTimeEntry);

        // Save the changes to the time tracking document
        await timeTracking.save();

        // Check if the new time entry is for today
        const isToday = new Date(startTimeFormatted) >= startOfToday;

        return res.status(200).json({
            success: true,
            data: {
                newTimeEntry,
                message: 'Offline time added successfully',
            },
        });
    } catch (error) {
        console.error('Error adding offline time:', error);
        return res.status(500).json({ success: false, message: 'Failed to add offline time' });
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



const getTotalHoursAndScreenshots = async (req, res) => {
    const { userId } = req.params;
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
                                    visitedUrls: screenshot.visitedUrls
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
    let indexToSplit;
    try {
        const { timeEntryId, userId } = req.body;
        const splitTime = DateTime.fromFormat(req.body.splitTime, "yyyy-MM-dd h:mm a", { zone: req.user.timezone });

        const timeTracking = await TimeTracking.findOne({
            userId,
            'timeEntries._id': timeEntryId,
        }).exec();

        if (!timeTracking) {
            return res.status(404).json({ success: false, message: 'Time entry not found' });
        }

        const timeEntry = timeTracking.timeEntries.id(timeEntryId);
        if (!timeEntry) {
            return res.status(404).json({ success: false, message: 'Time entry not found' });
        }
        if (timeEntry.startTime <= splitTime && timeEntry.endTime >= splitTime) {
            indexToSplit = timeEntry.screenshots.findIndex(screenshot => {
                // Assuming screenshot.startTime and screenshot.createdAt are JavaScript Date objects
                const screenshotTime = DateTime.fromJSDate(
                    new Date(screenshot.startTime) || new Date(screenshot.createdAt),
                    { zone: req.user.timezone }
                ); return screenshotTime >= splitTime;
            });
        }
        else {
            return res.status(404).json({ success: false, message: 'Invalid time' });
        }


        let newTimeEntry = [];
        if (indexToSplit !== -1) {
            // Create a new time entry with the second part of timeEntry
            newTimeEntry = { ...timeEntry };
            newTimeEntry.startTime = splitTime
            newTimeEntry.screenshots = timeEntry.screenshots.slice(indexToSplit);
            newTimeEntry.endTime = timeEntry.endTime

            // Adjust the endTime of the original timeEntry
            timeEntry.endTime = splitTime
            timeEntry.screenshots = timeEntry.screenshots.slice(0, indexToSplit);

            // Now, foundTimeEntry contains screenshots up to endTime, and newTimeEntry contains screenshots after endTime
        }
        timeTracking.timeEntries.push(newTimeEntry)
        timeTracking.timeEntries.sort((a, b) => a.startTime - b.startTime);

        await timeTracking.save();

        return res.status(200).json({
            success: true,
            message: 'Activity split successfully',
            splitActivities: [timeEntry, newTimeEntry],
        });
    } catch (error) {
        console.error('Error splitting activity:', error);
        return res.status(500).json({ success: false, message: 'Failed to split activity' });
    }
};

const splitActivityold = async (req, res) => {
    try {
        const { timeEntryId, splitTime, userId } = req.body;

        const timeTracking = await TimeTracking.findOne({
            userId,
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
            editedBy: activity.editedBy,
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
            editedBy: activity.editedBy,
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


const getActivityHistoryChanges = async (req, res) => {
    try {
        const userId = req.user._id;

        // Find all time tracking documents for the user
        const timeTrackings = await TimeTracking.find({ userId });

        if (!timeTrackings || timeTrackings.length === 0) {
            return res.status(404).json({ success: false, message: 'No time tracking documents found for the user' });
        }

        const userHistoryChanges = [];

        // Loop through each time tracking document
        for (const timeTracking of timeTrackings) {
            // Loop through each time entry
            for (const timeEntry of timeTracking.timeEntries) {
                // Loop through each activity
                for (const activity of timeEntry.activities) {
                    // Find the history changes for the activity
                    const historyChanges = activity.historyChanges;
                    if (historyChanges && historyChanges.length > 0) {
                        // Filter the history changes by the user
                        const userChanges = historyChanges.filter((change) => change.editedBy === userId);
                        if (userChanges.length > 0) {
                            // Add the history changes to the list
                            userHistoryChanges.push({
                                timeEntryId: timeEntry._id,
                                activityId: activity._id,
                                changes: userChanges.map((change) => ({
                                    changeTime: change.changeTime,
                                    previousData: change.previousData,
                                })),
                            });
                        }
                    }
                }
            }
        }

        // Prepare the response
        const response = {
            userId,
            userHistoryChanges,
        };

        return res.status(200).json({ success: true, data: response });
    } catch (error) {
        console.error('Error retrieving user history changes:', error);
        return res.status(500).json({ success: false, message: 'Failed to retrieve user history changes' });
    }
};



const getHistoryChanges = async (req, res) => {
    const userId = req.user._id;

    try {
        // Find all time trackings for the user
        const timeTrackings = await TimeTracking.find({ userId });

        // Retrieve all history changes for the user
        const historyChanges = timeTrackings.flatMap((timeTracking) =>
            timeTracking.timeEntries.flatMap((timeEntry) =>
                timeEntry.activities.flatMap((activity) =>
                    activity.historyChanges.filter((change) => change.editedBy === userId)
                )
            )
        );

        // Return the history changes
        return res.status(200).json({
            success: true,
            data: {
                historyChanges,
            },
        });
    } catch (error) {
        console.error('Error fetching history changes:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getTotalHoursForCustomDateRange = async (userId, startDate, endDate) => {
    const timeTrackings = await TimeTracking.find({ userId });

    let totalHours = 0;

    for (const timeTracking of timeTrackings) {
        for (const timeEntry of timeTracking.timeEntries) {
            const startTime = new Date(timeEntry.startTime);
            const endTime = timeEntry.endTime ? new Date(timeEntry.endTime) : new Date();

            // Check if the time entry overlaps with the specified date range
            if (startTime <= endDate && endTime >= startDate) {
                const intervalStart = startTime < startDate ? startDate : startTime;
                const intervalEnd = endTime > endDate ? endDate : endTime;

                // Calculate the hours worked for this interval
                const hoursWorked = (intervalEnd - intervalStart) / (1000 * 60 * 60);
                totalHours += hoursWorked;
            }
        }
    }

    return totalHours;
};


const getCustomDateRangeRecords = async (req, res) => {
    console.log("hello");
    const userId = req.user._id;
    const startDate = new Date(req.body.startDate); // Get the start date from the query parameter
    const endDate = new Date(req.body.endDate); // Get the end date from the query parameter

    if (isNaN(startDate) || isNaN(endDate) || startDate > endDate) {
        return res.status(400).json({ success: false, message: 'Invalid date range' });
    }

    try {
        const totalCustomDateRangeHours = await getTotalHoursForCustomDateRange(userId, startDate, endDate);

        return res.status(200).json({
            success: true,
            data: {

                totalHours: formatTime(totalCustomDateRangeHours),
            },
        });
    } catch (error) {
        console.error('Error getting custom date range records:', error);
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

const getMonthlyRecordsold = async (req, res) => {
    const userId = req.user._id;
    const currentDate = new Date();

    const monthSpecifier = req.query.monthSpecifier; // Get the monthSpecifier from the URL parameter as a string
    console.log(monthSpecifier);

    if (monthSpecifier !== 'previous' && monthSpecifier !== 'this') {
        return res.status(400).json({ success: false, message: 'Invalid month specifier' });
    }

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





const calculateTotalAnnualWorkingHours = async (users, year) => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const isPreviousYear = year.toLowerCase() === 'previous';

    if (isPreviousYear) {
        // If 'previous' is passed, calculate for the previous year
        year = currentYear - 1;
    } else {
        // If a specific year is provided, ensure it's a valid number
        year = parseInt(year, 10);
        if (isNaN(year)) {
            throw new Error('Invalid year parameter');
        }
    }

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year + 1, 0, 1);

    const totalWorkingHoursByUser = {};
    let totalWorkingHoursAllUsers = 0;

    for (const user of users) {
        const employeeId = user._id;
        const timeTrackings = await TimeTracking.find({ userId: employeeId });

        let totalAnnualWorkingHours = 0;

        for (const timeTracking of timeTrackings) {
            for (const timeEntry of timeTracking.timeEntries) {
                const startTime = new Date(timeEntry.startTime);
                const endTime = timeEntry.endTime ? new Date(timeEntry.endTime) : user.lastActive;

                if (startTime >= startOfYear && startTime < endOfYear) {
                    const hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                    totalAnnualWorkingHours += hoursWorked;
                }
            }
        }

        const totalHours = Math.floor(totalAnnualWorkingHours);
        const totalMinutes = Math.round((totalAnnualWorkingHours - totalHours) * 60);
        totalWorkingHoursByUser[user.name] = `${totalHours}h ${totalMinutes}m`;

        totalWorkingHoursAllUsers += totalAnnualWorkingHours;
    }

    const totalHoursAllUsers = Math.floor(totalWorkingHoursAllUsers);
    const totalMinutesAllUsers = Math.round((totalWorkingHoursAllUsers - totalHoursAllUsers) * 60);
    const formattedTotalTimeAllUsers = `${totalHoursAllUsers}h ${totalMinutesAllUsers}m`;

    return { totalWorkingHoursByUser, formattedTotalTimeAllUsers };
};


const getTotalAnnualWorkingHours = async (req, res) => {
    try {
        const users = await User.find({ company: req.user.company });
        const year = req.params.year || 'current';

        const { totalWorkingHoursByUser, formattedTotalTimeAllUsers } = await calculateTotalAnnualWorkingHours(users, year);

        return res.json({
            success: true,
            totalWorkingHoursByUser,
            totalHoursAllUsers: formattedTotalTimeAllUsers,
            year,
        });
    } catch (error) {

        return res.status(500).json({ success: false, message: 'Server error' });
    }
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

const getWeeklyRecordsold = async (req, res) => {
    const userId = req.user._id;
    const currentDate = new Date();

    const weekSpecifier = req.params.weekSpecifier; // Get the weekSpecifier from the URL parameter

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


const calculateTotalHoursd = async (startDate, endDate, company) => {
    try {
        const timeTrackings = await TimeTracking.find({ company }); // Retrieve all time tracking entries
        let totalHours = 0;

        for (const timeTracking of timeTrackings) {
            for (const timeEntry of timeTracking.timeEntries) {
                const startTime = new Date(timeEntry.startTime);
                const endTime = timeEntry.endTime ? new Date(timeEntry.endTime) : new Date();

                if (startTime >= startDate && endTime <= endDate) {
                    const hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                    totalHours += hoursWorked;
                }
            }
        }

        return formatTime(totalHours);
    } catch (error) {
        throw error;
    }
};

const getWorkingHoursSummary = async (req, res) => {
    const currentDate = new Date();
    const yesterdayDate = new Date(currentDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);

    try {
        const company = req.user.company;
        const dailyTotalHours = await calculateTotalHoursd(currentDate, currentDate, company);
        const weeklyTotalHours = await calculateTotalHoursd(getFirstDateOfWeek(currentDate), getLastDateOfWeek(currentDate), company);
        const yesterdayTotalHours = await calculateTotalHoursd(yesterdayDate, yesterdayDate, company);

        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
        const lastDayOfMonth = new Date(currentYear, currentMonth, 0);
        const monthlyTotalHours = await calculateTotalHoursd(firstDayOfMonth, lastDayOfMonth, company);

        return res.status(200).json({
            success: true,
            data: {
                dailyTotalHours,
                weeklyTotalHours,
                yesterdayTotalHours,
                monthlyTotalHours,
            },
        });
    } catch (error) {
        console.error('Error getting working hours summary:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


const convertTimezone = (time, timezoneOffset) => {
    const originalTime = DateTime.fromJSDate(time);
    const convertedTime = originalTime.setZone(timezoneOffset);
    //  // Log the original and converted times
    // console.log('Original Time:', originalTime.toString());
    // console.log('Converted Time:', convertedTime.toString());
    return convertedTime;
};

const getAllemployeesr = (req, res) => {
    const pageSize = 100; // Define the size of each chunk
    const { page } = req.query;

    // Calculate the starting index for the chunk
    const startIndex = (page - 1) * pageSize;

    User.find()
        .skip(startIndex)
        .limit(pageSize)
        .then((employees) => {
            if (employees) {
                const convertedEmployees = employees.map((employee) => {
                    const convertedCreatedAt = convertTimezone(employee.createdAt, employee.timezone);
                    const convertedLastActive = convertTimezone(employee.lastActive, employee.timezone);
                    const convertedUpdatedAt = convertTimezone(employee.updatedAt, employee.timezone);

                    // Create a new object with the updated properties
                    const convertedEmployee = {
                        ...employee.toObject(),
                        convertedCreatedAt,
                        convertedLastActive,
                        convertedUpdatedAt
                    };

                    return convertedEmployee; // Return the updated employee object
                });
                res.status(200).json({ convertedEmployees });
            }
        })
        .catch((error) => {
            console.error('Error retrieving employees:', error);
            res.status(500).json({ message: 'Failed to retrieve employees' });
        });
};


// const getTotalHoursAndScreenshote = async (req, res) => {
//     const { userId } = req.params;
//     const date = req.query.date ? new Date(req.query.date) : new Date();

//     console.log(req.user.timezone);
//     console.log(req.user);
// console.log(DateTime.now);

//     const converttimezone = (time, timezone) => {

//         const originalTime = DateTime.fromJSDate(time);
//         const convertedTime = originalTime.setZone(timezone);
//         //  // Log the original and converted times
//         return convertedTime;
//         // hello sania 
//     };


//     try {
//         const user = await User.findById(userId);
//         if (!user) {
//             return res.status(404).json({ success: false, message: 'User not found' });
//         }

//         const ratePerHour = user.billingInfo ? user.billingInfo.ratePerHour : 0;

//         const startToday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
//         var startOfToday = setHoursDifference(startToday, req.user.timezoneOffset, req.user.timezone);

//         const endToday = new Date(startToday);
//         endToday.setDate(startToday.getDate() + 1);
//         var endOfToday = setHoursDifference(endToday, req.user.timezoneOffset, req.user.timezone);

//         const startThisWeek = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
//         var startOfThisWeek = setHoursDifference(startThisWeek, req.user.timezoneOffset, req.user.timezone)

//         const endThisWeek = new Date(startThisWeek);
//         endThisWeek.setDate(startThisWeek.getDate() + 7); // 6 days added to the start of the week
//         var endOfThisWeek = setHoursDifference(endThisWeek, req.user.timezoneOffset, req.user.timezone);

//         const startThisMonth = new Date(date.getFullYear(), date.getMonth(), 1);
//         var startOfThisMonth = setHoursDifference(startThisMonth, req.user.timezoneOffset, req.user.timezone);

//         const endThisMonth = new Date(startThisMonth);
//         endThisMonth.setMonth(startThisMonth.getMonth() + 1); // 1 month added to the start of the month
//         var endOfThisMonth = setHoursDifference(endThisMonth, req.user.timezoneOffset, req.user.timezone);


//         const timeTrackings = await TimeTracking.find({ userId });

//         const totalHoursWorked = {
//             daily: 0,
//             weekly: 0,
//             monthly: 0,
//             offline: 0,
//         };
//         let activityCount = 0;
//         let totalActivity = 0;
//         const groupedScreenshots = [];
//         let hoursWorked = 0;
//         let newTimeEntry =[];
//         let newHoursWorked = 0;
//         // const now = new Date();
//         const now = user.lastActive;
//         // Current time for handling ongoing time entries

//         for (const timeTracking of timeTrackings) {
//             for (const timeEntry of timeTracking.timeEntries) {
//                 let startTime = converttimezone(timeEntry.startTime, req.user.timezone);
//                 let endTime = timeEntry.endTime ? converttimezone(timeEntry.endTime, req.user.timezone) : converttimezone(now, req.user.timezone);

//                 if (startTime >= startOfToday && startTime < endOfToday && endTime > endOfToday) {
//                     // Create a new time entry for the next day starting at 12:00 AM
//                     newTimeEntry = { ...timeEntry };
//                     newTimeEntry.startTime = new Date(startTime);
//                     newTimeEntry.startTime.setDate(newTimeEntry.startTime.getDate() + 1); // Move to the next day
//                     newTimeEntry.startTime.setHours(0, 0, 0, 0);
//                     newTimeEntry.startTime = setHoursDifference(newTimeEntry.startTime, req.user.timezoneOffset, req.user.timezone);
//                     newTimeEntry.endTime = new Date(endTime);
//                     newTimeEntry.endTime = converttimezone(newTimeEntry.endTime, req.user.timezone);

//                     // Modify the endTime of the original time entry to be 11:59:59.999 PM of the current day
//                     // timeEntry.startTime = new Date(startTime);
//                     // startTime = setHoursDifference(timeEntry.startTime, req.user.timezoneOffset, req.user.timezone)
//                     timeEntry.endTime = new Date(startTime);
//                     timeEntry.endTime.setHours(23, 59, 59, 999);
//                     endTime = timeEntry.endTime ? setHoursDifference(timeEntry.endTime, req.user.timezoneOffset, req.user.timezone) : setHoursDifference(now, req.user.timezoneOffset, req.user.timezone);

//                     // Calculate the hours worked for both time entries
//                     hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
//                     newHoursWorked = (newTimeEntry.endTime - newTimeEntry.startTime) / (1000 * 60 * 60);

//                     // Add hours worked to the appropriate time range (daily, weekly, monthly)
//                     if (startTime >= startOfToday && startTime < endOfToday) {
//                         totalHoursWorked.daily += hoursWorked;
//                     }
//                     if (newTimeEntry.startTime >= startOfToday && newTimeEntry.startTime < endOfToday) {
//                         totalHoursWorked.daily += newHoursWorked;
//                     }
//                 } else if (startTime < startOfToday && endTime >= startOfToday && endTime < endOfToday) {
//                     newTimeEntry = { ...timeEntry };
//                     // newTimeEntry.startTime = new Date(startTime);
//                     timeEntry.endTime = new Date(startTime);
//                     timeEntry.endTime.setHours(23, 59, 59, 999);
//                     timeEntry.endTime = setHoursDifference(timeEntry.endTime, req.user.timezoneOffset, req.user.timezone);
//                     // timeEntry.endTime = setHoursDifference(timeEntry.endTimee, req.user.timezoneOffset, req.user.timezone);

//                     // Modify the endTime of the original time entry to be 11:59:59.999 PM of the current day

//                     newTimeEntry.startTime = new Date(startTime);
//                     newTimeEntry.startTime.setDate(newTimeEntry.startTime.getDate() + 1); // Move to the next day
//                     newTimeEntry.startTime.setHours(0, 0, 0, 0);
//                     // newTimeEntry.endTime = new Date(endTime)
//                     // endTime = setHoursDifference(newTimeEntry.endTime, req.user.timezoneOffset, req.user.timezone)
//                     // startTime = setHoursDifference(newTimeEntry.startTime, req.user.timezoneOffset, req.user.timezone);
//                     newTimeEntry.startTime = setHoursDifference(newTimeEntry.startTime, req.user.timezoneOffset, req.user.timezone);
//                     // Calculate the hours worked for both time entries
//                     hoursWorked = (timeEntry.endTime - startTime) / (1000 * 60 * 60);
//                     //  (endTime - timeEntry.startTime) / (1000 * 60 * 60);

//                     newHoursWorked = (endTime - newTimeEntry.startTime) / (1000 * 60 * 60);

//                     // Add hours worked to the appropriate time range (daily, weekly, monthly)
//                     if (startTime >= startOfToday && startTime < endOfToday) {
//                         totalHoursWorked.daily += hoursWorked;
//                     }
//                     // Add hours worked to the appropriate time range (daily, weekly, monthly)
//                     if (newTimeEntry.startTime >= startOfToday && newTimeEntry.startTime < endOfToday) {
//                         totalHoursWorked.daily += newHoursWorked;
//                     }

//                 } else {
//                     // Calculate the hours worked using the corrected start and end times
//                     hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
//                     newHoursWorked = 0 ;
//                     // Add hours worked to the appropriate time range (daily, weekly, monthly)
//                     if (startTime >= startOfToday && startTime < endOfToday) {
//                         totalHoursWorked.daily += hoursWorked;
//                     }
//                 }

//                 // Check if the time entry has offline activities
//                 if (timeEntry.activities && timeEntry.activities.length > 0) {
//                     const offlineActivities = timeEntry.activities.filter((activity) => activity.offline);
//                     if (offlineActivities.length > 0) {
//                         const offlineDuration = offlineActivities.reduce((total, activity) => {
//                             const activityStartTime = new Date(activity.startTime);
//                             const activityEndTime = new Date(activity.endTime);

//                             // Only consider offline activities within today's range
//                             if (activityStartTime >= startTime && activityEndTime >= startTime && activityEndTime < endTime) {
//                                 return total + (activityEndTime - activityStartTime);
//                             }

//                             return total;
//                         }, 0);

//                         // Add the offline duration to the daily hours worked
//                         totalHoursWorked.daily += offlineDuration / (1000 * 60 * 60);

//                         for (const activity of offlineActivities) {
//                             const activityStartTime = new Date(activity.startTime);
//                             const activityEndTime = new Date(activity.endTime);
//                             const timeRange = `${activityStartTime.toString()} - ${activityEndTime.toString()} (offline)`;
//                             // const timerangeconv = setHoursDifference(timeRange, usertimezone)

//                             groupedScreenshots.push({ time: timeRange });
//                         }

//                     }
//                 }

//                 // Check if the time entry has screenshots taken today
//                 if (timeEntry.screenshots && timeEntry.screenshots.length > 0) {
//                     console.log('Screenshots are available for processing.');
//                     const screenshotsToday = timeEntry.screenshots.filter((screenshot) => {
//                         const screenshotTime = new Date(screenshot.createdAt);
//                         return screenshotTime >= startOfToday && screenshotTime < endOfToday;
//                     });

//                     if (screenshotsToday.length > 0) {
//                         console.log('Length of screenshotsToday:', screenshotsToday.length);

//                         const screenshotStartTime = startTime.toFormat('h:mm a');
//                         const screenshotEndTime = endTime.toFormat('h:mm a');

//                         const screenshotTimeRange = `${screenshotStartTime} - ${screenshotEndTime}`;
//                         console.log('Range', screenshotTimeRange);

//                         // Map screenshots to screenshotDetails
//                         const screenshotDetails = screenshotsToday.map((screenshot) => {
//                             // console.log('Processing screenshot:', screenshot); // Log each screenshot for debugging
//                             const convertedCreatedAt = setHoursDifference(screenshot.createdAt, req.user.timezoneOffset, req.user.timezone);

//                             // Calculate the total activity for this screenshot
//                             if (screenshot.visitedUrls && screenshot.visitedUrls.length > 0) {
//                                 totalActivity += screenshot.visitedUrls[0].activityPercentage || 0;
//                                 activityCount += 1;
//                             }

//                             return {
//                                 _id: screenshot._id,
//                                 key: screenshot.key,
//                                 description: screenshot.description,
//                                 time: convertedCreatedAt.toFormat('h:mm a'),
//                                 trackingId: timeTracking._id,
//                                 visitedUrls: screenshot.visitedUrls,
//                             };
//                         });
//                         let totalcount = 0;
//                         const totalActivityForScreenshots = screenshotDetails.reduce((total, screenshot) => {
//                             // Check if visitedUrls and activityPercentage are defined
//                             if (screenshot.visitedUrls && screenshot.visitedUrls[0] && screenshot.visitedUrls[0].activityPercentage !== undefined) {
//                                 return total + screenshot.visitedUrls[0].activityPercentage;
//                             }
//                             return total;
//                         }, 0);

//                         const maxPossibleActivity = 100 * screenshotDetails.length; // Assuming each screenshot can have a maximum activity of 100%

//                         const totalActivityAsPercentage = totalActivityForScreenshots / screenshotDetails.length;

//                         // Push screenshot data to groupedScreenshots along with totalactivity as a percentage
//                         groupedScreenshots.push(
//                             {
//                                 time: screenshotTimeRange,
//                                 screenshots: screenshotDetails,
//                                 totalactivity: totalActivityAsPercentage,
//                                 timeentryId: timeEntry._id,
//                             }
//                         );
//                     }
//                 }


//                 if (startTime >= startOfThisWeek && startTime < endOfThisWeek) {
//                     totalHoursWorked.weekly += hoursWorked;
//                 }
//                 if (newTimeEntry.startTime >= startOfThisWeek && newTimeEntry.startTime < endOfThisWeek) {
//                     totalHoursWorked.weekly += newHoursWorked;
//                 }

//                 if (startTime >= startOfThisMonth && startTime < endOfThisMonth) {
//                     totalHoursWorked.monthly += hoursWorked;
//                 }
//                 if (newTimeEntry.startTime >= startOfThisMonth && newTimeEntry.startTime < endOfThisMonth) {
//                     totalHoursWorked.monthly += newHoursWorked;
//                 }


//             }
//         }

//         totalHoursWorked.daily = Math.max(totalHoursWorked.daily, 0);
//         totalHoursWorked.weekly = Math.max(totalHoursWorked.weekly, 0);
//         totalHoursWorked.monthly = Math.max(totalHoursWorked.monthly, 0);


//         const formatTime = (time) => {
//             const hours = Math.floor(time);
//             const minutes = Math.round((time - hours) * 60);

//             // Ensure minutes are displayed correctly
//             if (minutes === 60) {
//                 // If minutes are 60, increment the hour and set minutes to 0
//                 return `${hours + 1}h 0m`;
//             } else {
//                 return `${hours}h ${minutes}m`;
//             }
//         };

//         const formattedTotalHoursWorked = {
//             daily: formatTime(totalHoursWorked.daily),
//             weekly: formatTime(totalHoursWorked.weekly),
//             monthly: formatTime(totalHoursWorked.monthly),
//         };
//         const totalActivityToday = activityCount > 0 ? (totalActivity / activityCount) : 0;
//         console.log('Total Activity Today:', totalActivityToday + '%');

//         return res.status(200).json({
//             success: true,
//             data: {
//                 totalHours: formattedTotalHoursWorked,
//                 billingAmounts: {
//                     daily: Math.round(totalHoursWorked.daily * ratePerHour),
//                     weekly: Math.round(totalHoursWorked.weekly * ratePerHour),
//                     monthly: Math.round(totalHoursWorked.monthly * ratePerHour),
//                 },
//                 groupedScreenshots,
//                 totalactivity: totalActivityToday,
//                 timezone: user.timezone,
//                 name: user.name,
//                 email: user.email,
//                 usertype: user.userType,
//             },
//         });
//     } catch (error) {
//         console.error('Error getting total hours and screenshots:', error);
//         return res.status(500).json({ success: false, message: 'Internal server error' });
//     }
// };

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

const getTotalHoursAndScreenshotemy = async (req, res) => {
    const { userId } = req.params;
    const date = req.query.date ? new Date(req.query.date) : new Date();

    const converttimezone = (time, timezone) => {

        const originalTime = DateTime.fromJSDate(time);
        const convertedTime = originalTime.setZone(timezone);
        //  // Log the original and converted times
        // console.log('Original Time:', originalTime.toString());
        // console.log('Converted Time:', convertedTime.toString());
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

        let TimeTrackingId = 0;

        const groupedScreenshots = [];
        var newTimeEntry = [];

        // const now = new Date();
        const now = user.lastActive; // Current time for handling ongoing time entries

        for (const timeTracking of timeTrackings) {
            for (const timeEntry of timeTracking.timeEntries) {
                TimeTrackingId = timeTracking._id;
                let startTime = DateTime.fromJSDate(timeEntry.startTime, { zone: req.user.timezone });

                let newHoursWorked = 0;
                let hoursWorked = 0;
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
                let screenshotTimeRange = 0
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
                    // Calculate the hours worked for both time entries
                    // hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                    // //  (endTime - timeEntry.startTime) / (1000 * 60 * 60);

                    // newHoursWorked = (newTimeEntry.endTime - newTimeEntry.startTime) / (1000 * 60 * 60);

                    // // Add hours worked to the appropriate time range (daily, weekly, monthly)
                    // if (newTimeEntry.startTime >= startOfToday && newTimeEntry.startTime < endOfToday) {
                    //     totalHoursWorked.daily += newHoursWorked;
                    // }
                    // // Add hours worked to the appropriate time range (daily, weekly, monthly)
                    // if (startTime >= startOfToday && startTime < endOfToday) {
                    //     totalHoursWorked.daily += hoursWorked;
                    // }

                }
                // else {
                //     // Calculate the hours worked using the corrected start and end times
                //     hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                //     newHoursWorked = 0;
                //     // Add hours worked to the appropriate time range (daily, weekly, monthly)
                //     if (startTime >= startOfToday && startTime < endOfToday) {
                //         totalHoursWorked.daily += hoursWorked;
                //     }
                // }

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
                if (startTime >= startOfToday && startTime < endOfToday) {
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


                if (timeEntry.screenshots && timeEntry.screenshots.length > 0) {
                    console.log('Screenshots are available for processing.');
                    const screenshotsToday = timeEntry.screenshots.filter((screenshot) => {
                        const screenshotTime = DateTime.fromJSDate(screenshot.createdAt, { zone: req.user.timezone });

                        return screenshotTime >= startOfToday && screenshotTime < endOfToday;
                    });

                    console.log('Screenshots Today:', screenshotsToday); // Log the screenshots for debugging
                    console.log('visitedUrl', timeEntry.visitedUrls);

                    if (screenshotsToday.length > 0) {
                        console.log('Length of screenshotsToday:', screenshotsToday.length);

                        // Fetch the first screenshot
                        const firstScreenshot = screenshotsToday[0];
                        console.log('First Screenshot:', firstScreenshot);

                        // Fetch the last screenshot
                        const lastScreenshot = screenshotsToday[screenshotsToday.length - 1];
                        console.log('Last Screenshot:', lastScreenshot);

                        const screenshotStartTime = startTime.toFormat('h:mm a');
                        const screenshotEndTime = endTime.toFormat('h:mm a');
                        const screenshotTimeRange = `${screenshotStartTime} - ${screenshotEndTime}`;
                        console.log('Range:', screenshotTimeRange);


                        // Map screenshots to screenshotDetails
                        const screenshotDetails = screenshotsToday.map((screenshot) => {
                            // console.log('Processing screenshot:', screenshot); // Log each screenshot for debugging
                            const convertedCreatedAt = DateTime.fromJSDate(screenshot.createdAt, { zone: req.user.timezone });

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
                                activities: timeEntry.activities,
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

const getTotalHoursByDay = async (req, res) => {
    const { userId } = req.params;
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

        // const formatTime = (time) => {
        //     const hours = Math.floor(time);
        //     const minutes = Math.floor((time - hours) * 60);
        //     if (minutes === 60) {
        //         // If minutes are 60, increment the hour and set minutes to 0
        //         return `${hours + 1}h 0m`;
        //     } else {
        //         return `${hours}h ${minutes}m`;
        //     }
        // };
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


const getTotalHoursAndScreenshote = async (req, res) => {
    const { userId } = req.params;
    const date = req.query.date ? new Date(req.query.date) : new Date();

    const converttimezone = (time, timezone) => {

        const originalTime = DateTime.fromJSDate(time);
        const convertedTime = originalTime.setZone(timezone);
        //  // Log the original and converted times
        // console.log('Original Time:', originalTime.toString());
        // console.log('Converted Time:', convertedTime.toString());
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
                let screenshotTimeRange = 0
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
                if (startTime >= startOfToday && startTime < endOfToday) {
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
                //             let activitystart = new Date(activity.startTime);
                //             let activityend = new Date(activity.endTime);

                //             const activityStartTime = DateTime.fromJSDate(activitystart, { zone: req.user.timezone });
                //             const activityEndTime = DateTime.fromJSDate(activityend, { zone: req.user.timezone });
                //             // const userDateTime = setHoursDifference(date, req.user.timezoneOffset, req.user.timezone)

                //             // Only consider offline activities within today's range
                //             // startTime >= startOfToday && startTime < endOfToday && endTime > endOfToday
                //             if (activityStartTime >= startOfToday && activityEndTime >= endOfToday && activityEndTime < endTime) {
                //                 return total + (activityEndTime - activityStartTime);
                //             }

                //             return total;
                //         }, 0);

                //         // Add the offline duration to the daily hours worked
                //         totalHoursWorked.daily += offlineDuration / (1000 * 60 * 60);

                //         for (const activity of offlineActivities) {
                //             let activitystart = new Date(activity.startTime);
                //             let activityend = new Date(activity.endTime);

                //             const activityStartTime = DateTime.fromJSDate(activitystart, { zone: req.user.timezone });
                //             const activityEndTime = DateTime.fromJSDate(activityend, { zone: req.user.timezone });

                //             const activityStartTimef = activityStartTime.toFormat('h:mm a');
                //             const activityEndTimef = activityEndTime.toFormat('h:mm a');

                //             const timeRange = `${activityStartTimef} - ${activityEndTimef} (offline)`;
                //             // console.log('Range', screenshotTimeRange);
                //             //     const activityStartTime = new Date(activity.startTime);
                //             //     const activityEndTime = new Date(activity.endTime);
                //             //     const timeRange = `${activityStartTime.toString()} - ${activityEndTime.toString()} (offline)`;
                //             // const timerangeconv = converttimezone(timeRange, usertimezone)

                //             groupedScreenshots.push({ time: timeRange });
                //         }

                //     }
                // }

                // Check if the time entry has screenshots taken today

                if (timeEntry.screenshots && timeEntry.screenshots.length > 0) {
                    console.log('Screenshots are available for processing.');
                    const screenshotsToday = timeEntry.screenshots.filter((screenshot) => {
                        const screenshotTime = DateTime.fromJSDate(screenshot.createdAt, { zone: req.user.timezone });

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
                            const convertedCreatedAt = DateTime.fromJSDate(screenshot.createdAt, { zone: req.user.timezone });

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
                                activities: timeEntry.activities,
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


const calculateTotalMonthlyWorkingHours = async (users, monthSpecifier) => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    const isPreviousMonth = monthSpecifier.toLowerCase() === 'previous';

    if (isPreviousMonth) {
        // If 'previous' is passed, calculate for the previous month
        monthSpecifier = currentMonth - 1;
        if (monthSpecifier < 0) {
            // If the previous month is in the previous year
            monthSpecifier = 11; // December of the previous year
            currentYear -= 1;
        }
    } else if (monthSpecifier.toLowerCase() === 'this') {
        // If 'this' is passed, use the current month
        monthSpecifier = currentMonth;
    } else {
        // If a specific month is provided, ensure it's a valid number (0-11)
        monthSpecifier = parseInt(monthSpecifier, 10);
        if (isNaN(monthSpecifier) || monthSpecifier < 0 || monthSpecifier > 11) {
            throw new Error('Invalid monthSpecifier parameter');
        }
    }

    const startOfMonth = new Date(currentYear, monthSpecifier, 1);
    const endOfMonth = new Date(currentYear, monthSpecifier + 1, 0);

    const totalWorkingHoursByUser = {};
    let totalWorkingHoursAllUsers = 0;

    for (const user of users) {
        const employeeId = user._id;
        const timeTrackings = await TimeTracking.find({ userId: employeeId });

        let totalMonthlyWorkingHours = 0;

        for (const timeTracking of timeTrackings) {
            for (const timeEntry of timeTracking.timeEntries) {
                const startTime = new Date(timeEntry.startTime);
                const endTime = timeEntry.endTime ? new Date(timeEntry.endTime) : user.lastActive;

                if (startTime >= startOfMonth && startTime <= endOfMonth) {
                    const hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                    totalMonthlyWorkingHours += hoursWorked;
                }
            }
        }

        const totalHours = Math.floor(totalMonthlyWorkingHours);
        const totalMinutes = Math.round((totalMonthlyWorkingHours - totalHours) * 60);
        totalWorkingHoursByUser[user.name] = `${totalHours}h ${totalMinutes}m`;

        totalWorkingHoursAllUsers += totalMonthlyWorkingHours;
    }

    const totalHoursAllUsers = Math.floor(totalWorkingHoursAllUsers);
    const totalMinutesAllUsers = Math.round((totalWorkingHoursAllUsers - totalHoursAllUsers) * 60);
    const formattedTotalTimeAllUsers = `${totalHoursAllUsers}h ${totalMinutesAllUsers}m`;

    return { totalWorkingHoursByUser, formattedTotalTimeAllUsers };
};

const getTotalMonthlyWorkingHours = async (req, res) => {
    try {
        const users = await User.find({ company: req.user.company });
        const monthSpecifier = req.params.monthspecifier || 'this';

        const { totalWorkingHoursByUser, formattedTotalTimeAllUsers } = await calculateTotalMonthlyWorkingHours(users, monthSpecifier);

        return res.json({
            success: true,
            totalWorkingHoursByUser,
            totalHoursAllUsers: formattedTotalTimeAllUsers,
            monthSpecifier,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};


// ################################# REPORTS #################################
const getYearlyRecords = async (req, res) => {
    let users = []

    if (req.query.userId) {
        const userId = req.query.userId

        // If userId is provided, fetch a single user based on the userId
        const user = await userSchema.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        users = [user]; // Convert the single user into an array
    } else {
        // If userId is not provided, fetch all users (or users based on a certain criteria, e.g., company)
        const companyId = req.user.company; // Change this based on your actual user structure

        users = await userSchema.find({ company: companyId, inviteStatus: false })
    }
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
        let ReportPercentage = await getReportForYear(users, yearStartDate, yearEndDate, req.user.timezone)
        const totalYearHours = await getTotalHoursForYear(users, yearStartDate, yearEndDate, req.user.timezone);
        var totalhours = formatTime(totalYearHours.totalTimeHours)

        return res.status(200).json({
            success: true,
            data: {
                yearSpecifier,
                allUsers: totalYearHours.allUsers,
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

const getReportForYear = async (users, yearStartDate, yearEndDate, timezone) => {

    // Assuming totalMatchValues is the sum of all matchvalues
    let totalMatchValues = 0;
    let ReportPercentage = [];
    for (const user of users) {
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

const getTotalHoursForYear = async (users, yearStartDate, yearEndDate, timezone) => {

    let totalHours = 0;
    let newHoursWorked = 0;
    let hoursWorked = 0;
    let activityCount = 0;
    let totalActivity = 0;
    var allUsers = []
    // { employee: 'John', Duration: 0, Activity: 0 },

    for (const user of users) {
        var userHours = 0
        var userActivity = 0
        var userCount = 0
        const timeTrackings = await TimeTracking.find({ userId: user._id });
        for (const timeTracking of timeTrackings) {
            var newTimeEntry = [];

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
                        userHours += hoursWorked;
                    }
                    if (newTimeEntry.startTime >= yearStartDate && newTimeEntry.startTime < yearEndDate) {
                        totalHours += newHoursWorked;
                        userHours += newHoursWorked;
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
                        userHours += newHoursWorked;
                    }
                    // Add hours worked to the appropriate time range (daily, weekly, monthly)
                    if (startTime >= yearStartDate && startTime < yearEndDate) {
                        totalHours += hoursWorked;
                        userHours += hoursWorked;
                    }

                } else {
                    // Calculate the hours worked using the corrected start and end times
                    hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                    newHoursWorked = 0;
                    // Add hours worked to the appropriate time range (daily, weekly, monthly)
                    if (startTime >= yearStartDate && startTime < yearEndDate) {
                        totalHours += hoursWorked;
                        userHours += hoursWorked;
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
                            userActivity += screenshot.visitedUrls[0].activityPercentage || 0;
                            userCount += 1;
                        }
                    }
                });
            }
        }
        const ActivityOfUser = userCount > 0 ? (userActivity / userCount) : 0;
        var HoursOfUser = formatTime(userHours)
        allUsers.push({ employee: user.name, Duration: HoursOfUser, Activity: ActivityOfUser })
    }

    const totalActivityToday = activityCount > 0 ? (totalActivity / activityCount) : 0;
    return {
        allUsers: allUsers,
        totalActivityToday: totalActivityToday,
        totalTimeHours: totalHours
    };
};

const getMonthlyRecords = async (req, res) => {
    let users = []

    if (req.query.userId) {
        const userId = req.query.userId

        // If userId is provided, fetch a single user based on the userId
        const user = await userSchema.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        users = [user]; // Convert the single user into an array
    } else {
        // If userId is not provided, fetch all users (or users based on a certain criteria, e.g., company)
        const companyId = req.user.company; // Change this based on your actual user structure

        users = await userSchema.find({ company: companyId, inviteStatus: false })
    } const currentDate = new Date();
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
        let ReportPercentage = await getReportForMonth(users, monthStartDate, monthEndDate, req.user.timezone)
        const totalMonthHours = await getTotalHoursForMonth(users, monthStartDate, monthEndDate, req.user.timezone);
        var totalhours = formatTime(totalMonthHours.totalTimeHours)

        return res.status(200).json({
            success: true,
            data: {
                monthSpecifier,
                allUsers: totalMonthHours.allUsers,
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

const getReportForMonth = async (users, monthStartDate, monthEndDate, timezone) => {
    // Assuming totalMatchValues is the sum of all matchvalues
    let totalMatchValues = 0;
    let ReportPercentage = [];
    for (const user of users) {
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

const getTotalHoursForMonth = async (users, monthStartDate, monthEndDate, timezone) => {

    let totalHours = 0;
    var newTimeEntry = [];
    let newHoursWorked = 0;
    let hoursWorked = 0;
    let activityCount = 0;
    let totalActivity = 0;
    var allUsers = []

    for (const user of users) {
        var userHours = 0
        var userActivity = 0
        var userCount = 0
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
                        userHours += hoursWorked;
                    }
                    if (newTimeEntry.startTime >= monthStartDate && newTimeEntry.startTime < monthEndDate) {
                        totalHours += newHoursWorked;
                        userHours += newHoursWorked;
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
                        userHours += newHoursWorked;

                    }
                    // Add hours worked to the appropriate time range (daily, weekly, monthly)
                    if (startTime >= monthStartDate && startTime < monthEndDate) {
                        totalHours += hoursWorked;
                        userHours += hoursWorked;
                    }

                } else {
                    // Calculate the hours worked using the corrected start and end times
                    hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                    newHoursWorked = 0;
                    // Add hours worked to the appropriate time range (daily, weekly, monthly)
                    if (startTime >= monthStartDate && startTime < monthEndDate) {
                        totalHours += hoursWorked;
                        userHours += hoursWorked;

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
                            userActivity += screenshot.visitedUrls[0].activityPercentage || 0;
                            userCount += 1;
                        }
                    }
                });
            }
        }
        const ActivityOfUser = userCount > 0 ? (userActivity / userCount) : 0;
        var HoursOfUser = formatTime(userHours)
        allUsers.push({ employee: user.name, Duration: HoursOfUser, Activity: ActivityOfUser })
    }

    const totalActivityToday = activityCount > 0 ? (totalActivity / activityCount) : 0;
    return {
        allUsers: allUsers,
        totalActivityToday: totalActivityToday,
        totalTimeHours: totalHours
    };
};

const getWeeklyRecords = async (req, res) => {
    let users = []

    if (req.query.userId) {
        const userId = req.query.userId

        // If userId is provided, fetch a single user based on the userId
        const user = await userSchema.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        users = [user]; // Convert the single user into an array
    } else {
        // If userId is not provided, fetch all users (or users based on a certain criteria, e.g., company)
        const companyId = req.user.company; // Change this based on your actual user structure

        users = await userSchema.find({ company: companyId, inviteStatus: false })
    }
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
        let ReportPercentage = await getReportForWeek(users, weekStartDate, weekEndDate, req.user.timezone)
        const totalWeekHours = await getTotalHoursForWeek(users, weekStartDate, weekEndDate, req.user.timezone);
        var totalhours = formatTime(totalWeekHours.totalTimeHours)

        return res.status(200).json({
            success: true,
            data: {
                weekSpecifier,
                allUsers: totalWeekHours.allUsers,
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

const getReportForWeek = async (users, weekStartDate, weekEndDate, timezone) => {
    // Assuming totalMatchValues is the sum of all matchvalues
    let totalMatchValues = 0;
    let ReportPercentage = [];
    for (const user of users) {
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

const getTotalHoursForWeek = async (users, weekStartDate, weekEndDate, timezone) => {

    let totalHours = 0;
    var newTimeEntry = [];
    let newHoursWorked = 0;
    let hoursWorked = 0;
    let activityCount = 0;
    let totalActivity = 0;
    var allUsers = []

    for (const user of users) {
        var userHours = 0
        var userActivity = 0
        var userCount = 0

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
                        userHours += hoursWorked;
                    }
                    if (newTimeEntry.startTime >= weekStartDate && newTimeEntry.startTime < weekEndDate) {
                        totalHours += newHoursWorked;
                        userHours += newHoursWorked;
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
                        userHours += newHoursWorked;
                    }
                    // Add hours worked to the appropriate time range (daily, weekly, monthly)
                    if (startTime >= weekStartDate && startTime < weekEndDate) {
                        totalHours += hoursWorked;
                        userHours += hoursWorked;
                    }

                } else {
                    // Calculate the hours worked using the corrected start and end times
                    hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                    newHoursWorked = 0;
                    // Add hours worked to the appropriate time range (daily, weekly, monthly)
                    if (startTime >= weekStartDate && startTime < weekEndDate) {
                        totalHours += hoursWorked;
                        userHours += hoursWorked;
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
                            userActivity += screenshot.visitedUrls[0].activityPercentage || 0;
                            userCount += 1;
                        }
                    }
                });
            }
        }
        const ActivityOfUser = userCount > 0 ? (userActivity / userCount) : 0;
        var HoursOfUser = formatTime(userHours)
        allUsers.push({ employee: user.name, Duration: HoursOfUser, Activity: ActivityOfUser })
    }

    const totalActivityToday = activityCount > 0 ? (totalActivity / activityCount) : 0;
    return {
        allUsers: allUsers,
        totalActivityToday: totalActivityToday,
        totalTimeHours: totalHours
    };
};

const getDailyRecords = async (req, res) => {
    let users = []

    if (req.query.userId) {
        const userId = req.query.userId

        // If userId is provided, fetch a single user based on the userId
        const user = await userSchema.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        users = [user]; // Convert the single user into an array
    } else {
        // If userId is not provided, fetch all users (or users based on a certain criteria, e.g., company)
        const companyId = req.user.company; // Change this based on your actual user structure

        users = await userSchema.find({ company: companyId, inviteStatus: false })
    }
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
        let ReportPercentage = await getReportForDay(users, dayStartTime, dayEndTime, req.user.timezone)
        const totalTimeHours = await getTotalHoursForDay(users, dayStartTime, dayEndTime, req.user.timezone);
        var totalhours = formatTime(totalTimeHours.totalTimeHours)

        return res.status(200).json({
            success: true,
            data: {
                daySpecifier,
                allUsers: totalTimeHours.allUsers,
                totalHours: totalhours,
                totalActivity: totalTimeHours.totalActivityToday,
                ReportPercentage: ReportPercentage
            },
        });
    } catch (error) {
        console.error('Error getting weekly records:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getReportForDay = async (users, weekStartDate, weekEndDate, timezone) => {
    let totalMatchValues = 0;
    let ReportPercentage = [];
    for (const user of users) {
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

const getTotalHoursForDay = async (users, weekStartDate, weekEndDate, timezone) => {
    let totalHours = 0;
    var newTimeEntry = [];
    let newHoursWorked = 0;
    let hoursWorked = 0;
    let activityCount = 0;
    let totalActivity = 0;
    var allUsers = []

    for (const user of users) {
        var userHours = 0
        var userActivity = 0
        var userCount = 0

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
                        userHours += hoursWorked;
                    }
                    if (newTimeEntry.startTime >= weekStartDate && newTimeEntry.startTime < weekEndDate) {
                        totalHours += newHoursWorked;
                        userHours += newHoursWorked;

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
                        userHours += newHoursWorked;

                    }
                    // Add hours worked to the appropriate time range (daily, weekly, monthly)
                    if (startTime >= weekStartDate && startTime < weekEndDate) {
                        totalHours += hoursWorked;
                        userHours += hoursWorked;
                    }

                } else {
                    // Calculate the hours worked using the corrected start and end times
                    hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                    newHoursWorked = 0;
                    // Add hours worked to the appropriate time range (daily, weekly, monthly)
                    if (startTime >= weekStartDate && startTime < weekEndDate) {
                        totalHours += hoursWorked;
                        userHours += hoursWorked;

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
                            userActivity += screenshot.visitedUrls[0].activityPercentage || 0;
                            userCount += 1;
                        }
                    }
                });
            }
        }
        const ActivityOfUser = userCount > 0 ? (userActivity / userCount) : 0;
        var HoursOfUser = formatTime(userHours)
        allUsers.push({ employee: user.name, Duration: HoursOfUser, Activity: ActivityOfUser })
    }

    const totalActivityToday = activityCount > 0 ? (totalActivity / activityCount) : 0;
    return {
        allUsers: allUsers,
        totalActivityToday: totalActivityToday,
        totalTimeHours: totalHours
    };
};

function convertDate(date, timezoneOffset, timeZone) {
    const newDate = new Date(date);
    let dateToday = moment(newDate).utcOffset(timezoneOffset).tz(timeZone);
    return dateToday;
}

export default { checkPass, forgotPassword, getProjects, getCustomDateRangeRecords, getWorkingHoursSummary, getAllemployeesr, getTotalMonthlyWorkingHours, getTotalHoursAndScreenshote, getWeeklyRecords, getTotalAnnualWorkingHours, getAllClients, splitActivity, countEmployeesInProject, getTotalHoursAndScreenshots, getHistoryChanges, getMonthlyScreenshots, deleteActivity, trimActivityInTimeEntry, getActivityData, getSingleEmployee, assignUserToManager, emailInviteExp, emailInviteClient, emailInvite, getTotalHoursQ, getEffectiveSettingsEachUser, archiveProject, deleteEmployee, updateEmployeeSettings, deleteScreenshotAndDeductTime, moveMonthsScreenshotsToHistory, addProjects, deleteEvent, updateUserArchiveStatus, editEvent, getSingleEvent, getUsersStatus, updateBillingInfo, getUsersWorkingToday, updateCompanyNameForAllEmployees, getAllemployees, editCompanyName, getTotalHoursWorked, editProject, getTotalHoursWorkedAllEmployees, sortedScreenshotsEachEmployee, deleteProject, addOfflineTime, getTotalHoursByDay, getDailyRecords, getMonthlyRecords, getYearlyRecords };