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

const addScreenshotabscrot = async (req, res) => {
    const pusher = res.locals.pusher;
    const { timeEntryId } = req.params;
    const { description, activityPercentage } = req.body;
    const endTime = 0;
    let visitedUrls = [];

    try {
        const timeTrack = await TimeTracking.findOne({ 'timeEntries._id': timeEntryId });

        if (!timeTrack) {
            return res.status(404).json({ success: false, message: 'Time entry not found' });
        }

        const timeEntry = timeTrack.timeEntries.id(timeEntryId);

        if (!timeEntry) {
            return res.status(404).json({ success: false, message: 'Time entry not found' });
        }

        // Capture screenshot using scrot
        const screenshotPath = await captureScreenshot(`screenshot_${req.body.startTime}_${req.user._id}.jpeg`);

        // Upload the screenshot to AWS and get the URL
        const url = await aws.UploadToAws({
            path: screenshotPath,
            originalname: `screenshot_${req.body.startTime}_${req.user._id}.jpeg`,
        });

        const startTime = new Date(req.body.startTime);
        const userLocalNow = new Date(req.body.createdAt);
        const currentTime = userLocalNow.toLocaleTimeString([], { hour: 'numeric', minute: 'numeric' });
        const createdAt = userLocalNow;

        const newVisitedUrl = {
            activityPercentage,
        };
        visitedUrls.push(newVisitedUrl);

        const addedScreenshot = {
            startTime,
            endTime: userLocalNow,
            key: url,
            description,
            time: currentTime,
            createdAt,
            visitedUrls,
        };

        timeEntry.screenshots.push(addedScreenshot);

        if (timeEntry.endTime) {
            timeEntry.endTime = userLocalNow;
        }

        const splitActivities = timeEntry.activities.filter((activity) => {
            return activity.startTime <= createdAt && activity.endTime >= createdAt;
        });

        if (splitActivities.length > 0) {
            splitActivities.forEach((activity) => {
                activity.endTime = createdAt;
            });
        }

        await timeTrack.save();

        const newTimeEntry = {
            key: url,
            description,
            time: currentTime,
            createdAt,
            visitedUrls,
            user_id: req.user._id,
            timeEntryId,
        };

        await User.findByIdAndUpdate(
            req.user._id,
            {
                lastActive: userLocalNow,
                isActive: true,
            },
            { new: true }
        );

        const addedScreenshotId = timeEntry.screenshots[timeEntry.screenshots.length - 1]._id;

        pusher.trigger('ss-track', 'new-ss', {
            message: 'new screenshots',
            data: newTimeEntry,
        });

        return res.status(200).json({
            success: true,
            id: addedScreenshotId,
            screenshot: url,
            time: currentTime,
            data: timeEntry,
            filename: `screenshot_${req.body.startTime}_${req.user._id}.jpeg`,
            message: 'Screenshot added successfully',
        });
    } catch (error) {
        console.error('Error adding screenshot:', error);
        return res.status(500).json({ success: false, message: 'Failed to add screenshot', Error: error });
    }
};

const addScreenshotabdesktop = async (req, res) => {
    const pusher = res.locals.pusher;
    const { timeEntryId } = req.params;
    const { description } = req.body;
    const { activityPercentage } = req.body;
    // req.body.startTime;
    // req.body.createdAt;
    const endTime = 0;
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
        const screenshotBuffer = await screenshot();
        // const browser = await puppeteer.launch();
        // const pages = await browser.pages();

        // const activePage = pages[0]; // Assuming the first page is the active one
        // const screenshotBuffer = await activePage.screenshot();
        // await browser.close();

        // Upload the screenshot to AWS and get the URL
        const url = await aws.UploadToAws({
            buffer: screenshotBuffer,
            originalname: `screenshot_${req.body.startTime}_${req.user._id}.jpeg`,
        });

        const startTime = new Date(req.body.startTime);
        const userLocalNow = new Date(req.body.createdAt);
        const currentTime = userLocalNow.toLocaleTimeString([], { hour: 'numeric', minute: 'numeric' });
        const createdAt = userLocalNow;

        const newVisitedUrl = {
            activityPercentage,
        };
        visitedUrls.push(newVisitedUrl);

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
        timeEntry.screenshots.push(addedScreenshot);

        if (timeEntry.endTime) {
            timeEntry.endTime = userLocalNow;
        }

        const splitActivities = timeEntry.activities.filter((activity) => {
            return activity.startTime <= createdAt && activity.endTime >= createdAt;
        });

        if (splitActivities.length > 0) {
            splitActivities.forEach((activity) => {
                activity.endTime = createdAt;
            });
        }

        await timeTrack.save();

        const newTimeEntry = {
            key: url,
            description: description,
            time: currentTime,
            createdAt: createdAt,
            visitedUrls: visitedUrls,
            user_id: req.user._id,
            timeEntryId: timeEntryId,
        };

        await User.findByIdAndUpdate(
            req.user._id,
            {
                lastActive: userLocalNow,
                isActive: true,
            },
            { new: true }
        );

        const addedScreenshotId = timeEntry.screenshots[timeEntry.screenshots.length - 1]._id;

        pusher.trigger('ss-track', 'new-ss', {
            message: 'new screenshots',
            data: newTimeEntry,
        });

        return res.status(200).json({
            success: true,
            id: addedScreenshotId,
            screenshot: url,
            time: currentTime,
            data: timeEntry,
            filename: `screenshot_${req.body.startTime}_${req.user._id}.jpeg`,
            message: 'Screenshot added successfully',
        });
    } catch (error) {
        console.error('Error adding screenshot:', error);
        return res.status(500).json({ success: false, message: 'Failed to add screenshot', Error: error });
    }
};

const addScreenshotabcon = async (req, res) => {
    const pusher = res.locals.pusher;
    const { timeEntryId } = req.params;
    let addedScreenshotId = 0;
    let userLocalNow;
    let currentTime;
    const endTime = 0;
    let url = `screenshot_.jpeg`;
    let visitedUrls = [];
    let fileBuffer;

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
        if (req.body.screenshotId) {
            const file = req.body.file;

            addedScreenshotId = req.body.screenshotId
            const indexOfData = timeEntry.screenshots.id(addedScreenshotId);
            fileBuffer = Buffer.from(file, 'base64');
            fileBuffer.originalname = `screenshot_${indexOfData.startTime}_${req.user._id}.jpeg`;
            // Upload the screenshot to AWS and get the URL
            url = await aws.UploadToAws(fileBuffer);
            // Check if the element was found
            if (indexOfData !== -1) {
                // Update the url property of the found element
                indexOfData.key = file;
                console.log(`Updated url for screenshot with _id ${addedScreenshotId}`);
            } else {
                console.log(`Screenshot with _id ${addedScreenshotId} not found`);
            }
            userLocalNow = new Date(indexOfData.startTime)
            currentTime = userLocalNow.toLocaleTimeString([], { hour: 'numeric', minute: 'numeric' });

            // Save the updated time tracking document
            await timeTrack.save();

        }
        else {
            const { description, description2 } = req.body;
            const { activityPercentage } = req.body;

            const startTime = new Date(req.body.startTime)
            // Get the current date and time in the user's local time zone
            userLocalNow = new Date(req.body.createdAt);

            // Get the current time as a string in 'hour:minute' format
            currentTime = userLocalNow.toLocaleTimeString([], { hour: 'numeric', minute: 'numeric' });

            const createdAt = userLocalNow;

            const newVisitedUrl = {
                activityPercentage, // Use the provided activityPercentage
                url: description2
                // You can add other properties as needed
            };
            visitedUrls.push(newVisitedUrl);
            // Create an object for the added screenshot
            const addedScreenshot = {
                startTime: startTime,
                endTime: userLocalNow,
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
            addedScreenshotId = timeEntry.screenshots[timeEntry.screenshots.length - 1]._id;
            // Return the success response with the screenshot URL and time
            // applying real time
            pusher.trigger("ss-track", "new-ss", {
                message: "new screenshots",
                data: newTimeEntry,
            });
        }

        // Update the user's lastActive field to the current time
        await User.findByIdAndUpdate(
            req.user._id, {
            lastActive: userLocalNow,
            isActive: true,
        }, { new: true });


        return res.status(200).json({
            success: true,
            id: addedScreenshotId,
            screenshot: url,
            time: currentTime,
            data: timeEntry,
            filename: fileBuffer.originalname,
            message: 'Screenshot added successfully',
        });
    } catch (error) {
        console.error('Error adding screenshot:', error);
        return res.status(500).json({ success: false, message: 'Failed to add screenshot', Error: error });
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