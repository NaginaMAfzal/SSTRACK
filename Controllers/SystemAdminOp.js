/* eslint-disable no-shadow */
/* eslint-disable no-unused-vars */
/* eslint-disable no-plusplus */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-await-in-loop */
// import status from 'http-status';
import status from 'http-status';
import UserSchema from '../Models/userSchema';
import TimeTracking from '../Models/timeSchema';
import ProjectSchema from '../Models/projectSchema';

// hello cyclic 
import moment from 'moment';

const getEvents = async (req, res) => {
    try {
        const owners = await UserSchema.find({ userType: 'owner'});

        const companyNames = [...new Set(owners.map(owner => owner.company))];

        const usersCountByCompany = {};

        for (const companyName of companyNames) {
            const usersCount = await UserSchema.countDocuments({ company: companyName, userType: { $ne: 'owner' } });
            usersCountByCompany[companyName] = usersCount;
        }

        const eventsWithUserCount = await Promise.all(owners.map(async owner => {
            const lastActive = owner.lastActive ? moment(owner.lastActive).fromNow() : 'Never';
            const userCount = usersCountByCompany[owner.company] || 0;

            // Fetch owner's time tracking data for daily and monthly working hours
            const timeTracking = await TimeTracking.findOne({ userId: owner._id });

            let dailyWorkingHours = 0;
            let monthlyWorkingHours = 0;

            if (timeTracking) {
                // Calculate daily working hours
                const today = new Date();
                const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const endOfToday = new Date(startOfToday);
                endOfToday.setDate(startOfToday.getDate() + 1);

                for (const timeEntry of timeTracking.timeEntries) {
                    const startTime = new Date(timeEntry.startTime);

                    if (startTime >= startOfToday && startTime < endOfToday) {
                        dailyWorkingHours += (timeEntry.endTime - startTime) / (1000 * 60 * 60);
                    }
                }

                // Calculate monthly working hours
                const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                const endOfThisMonth = new Date(startOfThisMonth);
                endOfThisMonth.setMonth(startOfThisMonth.getMonth() + 1);

                for (const timeEntry of timeTracking.timeEntries) {
                    const startTime = new Date(timeEntry.startTime);

                    if (startTime >= startOfThisMonth && startTime < endOfThisMonth) {
                        monthlyWorkingHours += (timeEntry.endTime - startTime) / (1000 * 60 * 60);
                    }
                }
            }

            return {
                owner,
                userCount,
                lastActive,
                dailyWorkingHours,
                monthlyWorkingHours,
            };
        }));

        res.status(status.OK).json(eventsWithUserCount);
    } catch (err) {
        console.error('Error fetching events:', err);
        res.status(status.INTERNAL_SERVER_ERROR).json({
            Message: 'Error fetching events',
            Error: err.message,
        });
    }
};
const getDisabledEvents = async (req, res) => {
    try {
        const owners = await UserSchema.find({ userType: 'owner' ,isArchived:true});

        const companyNames = [...new Set(owners.map(owner => owner.company))];

        const usersCountByCompany = {};

        for (const companyName of companyNames) {
            const usersCount = await UserSchema.countDocuments({ company: companyName, userType: { $ne: 'owner' } });
            usersCountByCompany[companyName] = usersCount;
        }

        const eventsWithUserCount = await Promise.all(owners.map(async owner => {
            const lastActive = owner.lastActive ? moment(owner.lastActive).fromNow() : 'Never';
            const userCount = usersCountByCompany[owner.company] || 0;

            // Fetch owner's time tracking data for daily and monthly working hours
            const timeTracking = await TimeTracking.findOne({ userId: owner._id });

            let dailyWorkingHours = 0;
            let monthlyWorkingHours = 0;

            if (timeTracking) {
                // Calculate daily working hours
                const today = new Date();
                const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const endOfToday = new Date(startOfToday);
                endOfToday.setDate(startOfToday.getDate() + 1);

                for (const timeEntry of timeTracking.timeEntries) {
                    const startTime = new Date(timeEntry.startTime);

                    if (startTime >= startOfToday && startTime < endOfToday) {
                        dailyWorkingHours += (timeEntry.endTime - startTime) / (1000 * 60 * 60);
                    }
                }

                // Calculate monthly working hours
                const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

                for (const timeEntry of timeTracking.timeEntries) {
                    const startTime = new Date(timeEntry.startTime);

                    if (startTime >= startOfThisMonth && startTime < endOfThisMonth) {
                        monthlyWorkingHours += (timeEntry.endTime - startTime) / (1000 * 60 * 60);
                    }
                }
            }

            return {
                owner,
                userCount,
                lastActive,
                dailyWorkingHours,
                monthlyWorkingHours,
            };
        }));

        res.status(status.OK).json(eventsWithUserCount);
    } catch (err) {
        console.error('Error fetching events:', err);
        res.status(status.INTERNAL_SERVER_ERROR).json({
            Message: 'Error fetching events',
            Error: err.message,
        });
    }
};
const calculateHoursWorked = async(user, period) => {
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
            const endTime = entry.timeEntries.endTime ? entry.timeEntries.endTime : user.lastActive;
            const timeWorked = endTime - entry.timeEntries.startTime;
            return acc + timeWorked;
        }
        return acc;
    }, 0);

    const totalHours = Math.floor(totalMilliseconds / (1000 * 60 * 60));
    const totalMinutes = Math.floor((totalMilliseconds % (1000 * 60 * 60)) / (1000 * 60));

    return { hours: totalHours, minutes: totalMinutes };
};

const getcompanyemployees = async (req, res) => {
    try {
        const { com } = req.params;

        const employees = await UserSchema.find({ company: com });
        const totalHoursByEmployee = await Promise.all(employees.map(async (employee) => {
            const employeeId = employee._id;

            const yesterdayHours = await calculateHoursWorked(employeeId, 'yesterday');
            const dailyHours = await calculateHoursWorked(employeeId, 'daily');
            const weeklyHours = await calculateHoursWorked(employeeId, 'weekly');
            const monthlyHours = await calculateHoursWorked(employeeId, 'monthly');

            return {
                ...employee.toObject(),
                totalHours: {
                    yesterday: yesterdayHours || 0, // Show 0 if no hours available
                    daily: dailyHours || 0, // Show 0 if no hours available
                    weekly: weeklyHours || 0, // Show 0 if no hours available
                    monthly: monthlyHours || 0, // Show 0 if no hours available
                },
            };
        }));
        
        const employeeCount = employees.length;

        res.status(status.OK).json({
           
            count: employeeCount,
            totalHoursByEmployee
        });
    } catch (err) {
        console.error('Error fetching company employees:', err);
        res.status(status.INTERNAL_SERVER_ERROR).json({
            Message: 'Error fetching company employees',
            Error: err.message,
        });
    }
};

const updateUserArchiveStatus = async (req, res) => {
    const { company } = req.params;
    const { isArchived } = req.body;

    try {
        // Update all users with the same company to be archived
        const result = await UserSchema.updateMany({ company }, { isArchived: isArchived });

        if (result.nModified === 0) {
            return res.status(404).json({ success: false, message: 'No users with the specified company found' });
        }
        if(isArchived)
        {
            return res.status(200).json({ success: true, message: 'company archived successfully' });
        }
        res.status(200).json({ success: true, message: 'company unArchived successfully' });
    } catch (error) {
        console.error('Error archiving users:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};



export default { getEvents,getcompanyemployees,updateUserArchiveStatus,getDisabledEvents };