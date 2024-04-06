import status from 'http-status';
import moment from 'moment-timezone';
// import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import TimeTracking from '../Models/timeSchema';

import ProjectSchema from '../Models/projectSchema';
import User from '../Models/userSchema';
import ScreenshotHistory from '../Models/screenshotHistorySchema';
import aws from './aws';
import trackerSchema from '../Models/trackerSchema';

const converttimezone = (time, timezone) => {

    const originalTime = DateTime.fromJSDate(time);
    const convertedTime = originalTime.setZone(timezone);
    return convertedTime;
};

// Function to calculate distance between two points in kilometers
function calculateDistance(lat1, lon1, lat2, lon2) {
    const earthRadiusKm = 6371; // Radius of the earth in kilometers
    const dLat = degreesToRadians(lat2 - lat1);
    const dLon = degreesToRadians(lon2 - lon1);
    const radLat1 = degreesToRadians(lat1);
    const radLat2 = degreesToRadians(lat2);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(radLat1) * Math.cos(radLat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = earthRadiusKm * c; // Distance in kilometers
    return distance;
}

// Function to convert degrees to radians
function degreesToRadians(degrees) {
    return degrees * (Math.PI / 180);
}

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

const startTracker = async (req, res) => {
    try {
        const { startTime, location, longitude, latitude } = req.body;

        const locations = {
            startTime: new Date(startTime),
            location: location, // Corrected field definition
            longitude: longitude,
            latitude: latitude,
            endTime: new Date(startTime)
        };

        // Initialize locations array
        const newLocationEntry = {
            startTime: new Date(startTime),
            locations: [],
        };

        // Push locations into newLocationEntry.locations
        newLocationEntry.locations.push(locations);

        // Update or create the time tracking document
        const updatedTracker = await trackerSchema.findOneAndUpdate(
            {
                userId: req.user._id,
            },
            { $push: { locationEntries: newLocationEntry } },
            { upsert: true, new: true }
        );

        // Update user's information
        await User.findByIdAndUpdate(req.user._id, { lastActiveOnMb: new Date(), isActiveOnMb: true });

        res.status(200).json({ success: true, data: updatedTracker });

    } catch (error) {
        console.error('Error adding time entry:', error);
        res.status(500).json({ success: false, message: 'Failed to add time entry', error: error });
    }
};

const updateLocations = async (req, res) => {
    try {
        const { location, latitude, longitude, startTime, locationId } = req.body;

        const locations = {
            startTime: new Date(startTime),
            location: location,
            longitude: longitude,
            latitude: latitude,
            endTime: new Date(startTime)
        }

        const tracker = await trackerSchema.findOne({ 'locationEntries._id': locationId });

        const foundLocation = tracker.locationEntries.id(locationId);
        if (foundLocation) {

            const lastEntry = foundLocation.locations[foundLocation.locations.length - 1];
            if (lastEntry.location === location) {
                lastEntry.endTime = new Date(startTime)
            }
            else {
                foundLocation.locations.push(locations)
            }
            let savedData = await tracker.save()
            return res.status(200).json({ success: true, message: "Location saved successfully", data: savedData })
        }
        else {
            return res.status(404).json({ success: false, message: "Invalid LocationEntry Id" })
        }

    }
    catch (error) {
        console.error("error adding locations data", error)
        return res.status(500).json({ success: false, message: "failed to add location data", error: error })
    }
}

const pauseTracker = async (req, res) => {
    try {
        const { endTime, location, latitude, longitude, locationId } = req.body;

        const locations = {
            location: location,
            startTime: new Date(endTime),
            longitude: longitude,
            latitude: latitude
        }
        const locationEntry = await trackerSchema.findOne({ 'locationEntries._id': locationId })
        if (locationEntry) {

            const foundLocation = locationEntry.locationEntries.id(locationId)
            const lastEntry = foundLocation.locations[foundLocation.locations.length - 1]
            if (lastEntry.location === location) {
                lastEntry.endTime = new Date(endTime)
            }
            else {
                foundLocation.locations.push(locations)
            }
            foundLocation.endTime = new Date(endTime)
        }

        else {
            return res.status(404).json({ success: false, message: "Invalid location Id" })
        }
        const savedData = await locationEntry.save()

        return res.status(200).json({ success: true, message: "Tracker Paused Successfully", data: savedData })
    }
    catch (error) {
        console.error("error pausing the tracker", error)
        return res.status(500).json({ success: false, message: "Error Pausing the Tracker", error: error })
    }
}

const getTrackerDataold = async (req, res) => {
    try {
        const trackerData = await trackerSchema.findOne({ userId: req.user._id })
        if (trackerData) {
            return res.status(200).json({ success: true, message: "Data Fetched Successfully", data: trackerData })
        }
        else {
            return res.status(404).json({ success: false, message: "Tracking Data not found" })
        }

    }
    catch (error) {
        console.error("error fetching data")
        return res.status(500).json({ success: false, message: "Error fetching Data", error: error })
    }
}

const getTrackerData = async (req, res) => {
    const totalHoursWorked = {
        daily: 0,
        weekly: 0,
        monthly: 0,
        offline: 0,
    };
    let newHoursWorked = 0;
    let hoursWorked = 0;
    const groupedLocations = [];
    var newTimeEntry = [];
    let firstLongitude = 0;
    let firstLatitude = 0;
    try {
        const date = req.query.date ? new Date(req.query.date) : new Date();

        const userData = await trackerSchema.findOne({ userId: req.user._id });
        if (userData) {

            const userDateTime = setHoursDifference(date, req.user.timezoneOffset, req.user.timezone);

            const startOfToday = userDateTime.startOf('day');
            const endOfToday = userDateTime.endOf('day');

            const startOfThisWeek = userDateTime.startOf('week');
            const endOfThisWeek = userDateTime.endOf('week');

            const startOfMonth = userDateTime.startOf('month');
            const endOfMonth = userDateTime.endOf('month');

            for (let locationEntry of userData.locationEntries) {
                let startTime = DateTime.fromJSDate(locationEntry.startTime, { zone: req.user.timezone });
                let endTime = 0;
                if (locationEntry.endTime) {
                    endTime = DateTime.fromJSDate(locationEntry.endTime, { zone: req.user.timezone });
                }
                else {
                    const lastlocation = locationEntry.locations.slice(-1)[0];
                    if (lastlocation) {
                        endTime = DateTime.fromJSDate(lastlocation.endTime, { zone: req.user.timezone });
                    }
                    else {
                        // no location availavle skip it
                        continue;
                    }
                }
                if (startTime == endTime) {
                    continue;
                }

                if (startTime >= startOfToday && startTime < endOfToday && endTime > endOfToday) {
                    // Create a new time entry for the next day starting at 12:00 AM
                    newTimeEntry = { ...locationEntry };
                    newTimeEntry.startTime = endTime.startOf('day');

                    newTimeEntry.endTime = new Date(endTime);

                    // Modify the endTime of the original time entry to be 11:59:59.999 PM of the current day
                    locationEntry.endTime = startTime.endOf('day');
                    endTime = DateTime.fromJSDate(locationEntry.endTime, { zone: req.user.timezone });

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
                    newTimeEntry = { ...locationEntry };
                    newTimeEntry.startTime = new Date(startTime);
                    newTimeEntry.endTime = startTime.endOf('day');

                    // Modify the endTime of the original time entry to be 11:59:59.999 PM of the current day
                    locationEntry.startTime = endTime.startOf('day');
                    startTime = DateTime.fromJSDate(locationEntry.startTime, { zone: req.user.timezone });
                    // Calculate the hours worked for both time entries
                    hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
                    //  (endTime - locationEntry.startTime) / (1000 * 60 * 60);

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

                // Check if the time entry has screenshots taken today
                if (locationEntry.locations && locationEntry.locations.length > 0) {
                    firstLongitude = locationEntry.locations[0].longitude;
                    firstLatitude = locationEntry.locations[0].latitude;

                    console.log('locations are available for processing.');
                    const locationsToday = locationEntry.locations.filter((location) => {
                        const locationTime = converttimezone(location.startTime, req.user.timezone);

                        return locationTime >= startOfToday && locationTime < endOfToday;
                    });

                    console.log('locations Today:', locationsToday); // Log the locations for debugging

                    if (locationsToday.length > 0) {
                        console.log('Length of locationsToday:', locationsToday.length);

                        const locationStartTime = startTime.toFormat('h:mm a');
                        const locationEndTime = endTime.toFormat('h:mm a');

                        const screenshotTimeRange = `${locationStartTime} - ${locationEndTime}`;
                        console.log('Range', screenshotTimeRange);

                        // Map locations to screenshotDetails
                        const screenshotDetails = locationsToday.map((location) => {
                            // console.log('Processing location:', location); // Log each location for debugging
                            const convertedCreatedAt = converttimezone(location.startTime, req.user.timezone);
                            let hours = 0;
                            if (location.startTime !== location.endTime) {
                                hours = (location.endTime - location.startTime) / (1000 * 60 * 60);
                            }
                            let totalTime = formatTime(hours)
                            const distance = calculateDistance(firstLatitude, firstLongitude, location.latitude, location.longitude);


                            return {
                                distance: distance,
                                location: location.location,
                                _id: location._id,
                                totalTime: totalTime,
                                time: convertedCreatedAt.toFormat('h:mm a'),
                            };
                        });

                        // Push screenshot data to groupedLocations along with totalactivity as a percentage
                        groupedLocations.push(
                            {
                                time: screenshotTimeRange,
                                locations: screenshotDetails,
                                timeentryId: locationEntry._id,
                            }
                        );
                    }
                }
                if (startTime >= startOfThisWeek && startTime < endOfThisWeek) {
                    totalHoursWorked.weekly += hoursWorked;
                }
                if (newTimeEntry.startTime >= startOfThisWeek && newTimeEntry.startTime < endOfThisWeek) {
                    totalHoursWorked.weekly += newHoursWorked;
                }

                if (startTime >= startOfMonth && startTime < endOfMonth) {
                    totalHoursWorked.monthly += hoursWorked;
                }
                if (newTimeEntry.startTime >= startOfMonth && newTimeEntry.startTime < endOfMonth) {
                    totalHoursWorked.monthly += newHoursWorked;
                }
            }
            totalHoursWorked.daily = Math.max(totalHoursWorked.daily, 0);
            totalHoursWorked.weekly = Math.max(totalHoursWorked.weekly, 0);
            totalHoursWorked.monthly = Math.max(totalHoursWorked.monthly, 0);


            const formattedTotalHoursWorked = {
                daily: formatTime(totalHoursWorked.daily),
                weekly: formatTime(totalHoursWorked.weekly),
                monthly: formatTime(totalHoursWorked.monthly),
            };


            return res.status(200).json({
                success: true,
                data: {
                    totalHours: formattedTotalHoursWorked,

                    groupedLocations,
                    timezone: req.user.timezone,
                    name: req.user.name,
                    email: req.user.email,
                    usertype: req.user.userType,
                    startOfToday: startOfToday,
                    endOfToday: endOfToday,
                },
            });






            return res.status(200).json({ success: true, message: "Data fetched Successfully", data: totalHoursWorked })


        }
        else {
            return res.status(404).json({ success: true, message: "Data Not Found" })
        }
    }
    catch (error) {
        console.error("error fetching Data", error)
        return res.status(500).json({ success: false, message: "Error Fetching Data", error: error })
    }
}


export default { startTracker, updateLocations, pauseTracker, getTrackerData };